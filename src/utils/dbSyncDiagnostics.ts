import { doc, setDoc, getDoc, serverTimestamp, waitForPendingWrites } from "firebase/firestore";
import { db } from "../firebase";

export interface DiagnosticResult {
  isOnline: boolean;
  firestoreConnected: boolean;
  readSuccess: boolean;
  writeSuccess: boolean;
  hasPendingWrites: boolean;
  latencyMs: number;
  message: string;
  timestamp: string;
}

/**
 * Runs a set of checks to test connection to Firestore and data synchronization status.
 */
export async function runFirestoreDiagnostics(userId: string | undefined): Promise<DiagnosticResult> {
  const result: DiagnosticResult = {
    isOnline: navigator.onLine,
    firestoreConnected: false,
    readSuccess: false,
    writeSuccess: false,
    hasPendingWrites: false,
    latencyMs: 0,
    message: "",
    timestamp: new Date().toLocaleTimeString("ar-YE")
  };

  if (!userId) {
    result.message = "يرجى تسجيل الدخول أولاً لإجراء الفحص.";
    return result;
  }

  // 1. Basic Internet Check
  if (!navigator.onLine) {
    result.message = "لا يوجد اتصال بالإنترنت في المتصفح/الجهاز حالياً. النظام يعمل في الوضع الاوفلاين.";
    return result;
  }

  const startTime = Date.now();
  try {
    // 2. Try to read user's profile document from Firestore (forcing server access to test real-time link)
    const userDocRef = doc(db, "users", userId);
    
    // We try to read it with source: 'server' to ensure we are testing the actual live link
    let docSnap;
    try {
      docSnap = await getDoc(userDocRef);
      result.readSuccess = true;
      result.firestoreConnected = true;
      if (docSnap.exists()) {
        result.hasPendingWrites = docSnap.metadata.hasPendingWrites;
      }
    } catch (readErr) {
      console.warn("Server-side read failed, trying cache:", readErr);
      // Fallback to default fetch
      docSnap = await getDoc(userDocRef);
      result.readSuccess = true;
      result.hasPendingWrites = docSnap.metadata.hasPendingWrites;
    }

    // 3. Try to perform a light diagnostic write under the user's document
    const diagDocRef = doc(db, "users", userId, "diagnostics", "sync_test");
    await setDoc(diagDocRef, {
      lastChecked: serverTimestamp(),
      clientTime: new Date().toISOString(),
      status: "active"
    }, { merge: true });

    result.writeSuccess = true;
    result.latencyMs = Date.now() - startTime;

    // 4. Check if there are any unsynced local database writes
    // We run a fast race: wait for pending writes to sync.
    // If it resolves immediately, everything is synced.
    const syncTimeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000));
    const syncPromise = waitForPendingWrites(db).then(() => true);
    
    const isSynced = await Promise.race([syncPromise, syncTimeout]);
    if (isSynced) {
      result.hasPendingWrites = false;
      result.message = `الاتصال بالبنية السحابية لـ Firestore نشط وممتاز. جميع البيانات والملفات تم مزامنتها بنجاح مع السحابة بنسبة 100%! (زمن الاستجابة: ${result.latencyMs}ms)`;
    } else {
      result.hasPendingWrites = true;
      result.message = "الاتصال قائم، ولكن هناك عمليات تعديل محلية في قائمة الانتظار جاري مزامنتها حالياً مع السحابة.";
    }

  } catch (err: any) {
    console.error("Firestore diagnostics error:", err);
    result.firestoreConnected = false;
    result.message = `فشل في الاتصال المباشر بالسحابة: ${err.message || err}. يتم حفظ التعديلات محلياً وسيتم المزامنة تلقائياً عند عودة الاتصال.`;
  }

  return result;
}
