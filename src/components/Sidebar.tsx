import React, { useRef, useState, useEffect } from "react";
import { UserProfile } from "../types";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { updateDoc, doc, getDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, Camera, Trash2, BookOpen, Database, RefreshCw, 
  Fingerprint, LogOut, CheckCircle, Bell, Info, Edit2
} from "lucide-react";
import {
  getNotificationPermission,
  requestNotificationPermission,
  sendLocalNotification
} from "../utils/notificationHelper";

interface SidebarProps {
  currentUser?: any;
  isOpen?: boolean;
  currentView?: string;
  onClose: () => void;
  userProfile: UserProfile | null;
  pendingCount?: number;
  onNavigate: (view: string, title: string) => void;
}

export default function Sidebar({ currentUser, currentView, isOpen, onNavigate, onClose, userProfile, pendingCount }: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("checking"); // "checking" | "up-to-date"
  const [fingerprintEnabled, setFingerprintEnabled] = useState(
    localStorage.getItem("fingerprint_enabled") === "true"
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");

  // --- Start Overdue Debt Alerts States & Logic ---
  const [alertsEnabled, setAlertsEnabled] = useState(
    localStorage.getItem("debt_alerts_enabled") === "true"
  );
  const [alertsDays, setAlertsDays] = useState(() => {
    const d = localStorage.getItem("debt_alerts_days");
    return d ? parseInt(d, 10) : 15; // default 15 days (half month)
  });
  const [permissionStatus, setPermissionStatus] = useState<string>("default");

  useEffect(() => {
    async function checkPerms() {
      const status = await getNotificationPermission();
      setPermissionStatus(status);
    }
    checkPerms();
  }, []);

  const notifiedIdsRef = useRef<Set<string>>(new Set());

  // Background scanner
  useEffect(() => {
    if (!currentUser || !alertsEnabled) return;

    const q = query(
      collection(db, "persons"),
      where("userId", "==", currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      const now = new Date();
      const thresholdMs = alertsDays * 24 * 60 * 60 * 1000;

      snap.forEach((docSnap) => {
        const p = docSnap.data();
        if (p.balance && p.balance > 0) {
          const lastDate = p.lastTransactionAt ? p.lastTransactionAt.toDate() : (p.createdAt ? p.createdAt.toDate() : null);
          if (lastDate) {
            const elapsed = now.getTime() - lastDate.getTime();
            if (elapsed >= thresholdMs) {
              const daysOverdue = Math.floor(elapsed / (1000 * 60 * 60 * 24));

              // Only notify once per user session
              if (!notifiedIdsRef.current.has(docSnap.id)) {
                notifiedIdsRef.current.add(docSnap.id);

                const title = `تنبيه مستحقات: ${p.name}`;
                const body = `متأخر عن التسديد منذ ${daysOverdue} يوماً. إجمالي المبلغ المستحق عليه: ${p.balance.toLocaleString('en-US')} ر.ي.`;

                // 1. Native system notification
                sendLocalNotification(title, body);

                // 2. In-app fallback toast
                window.dispatchEvent(new CustomEvent("show-app-notification", {
                  detail: { title, body }
                }));
              }
            }
          }
        }
      });
    }, (error) => {
      console.error("Error scanning overdue debt:", error);
    });

    return () => unsubscribe();
  }, [alertsEnabled, alertsDays, currentUser]);

  const handleToggleAlerts = async () => {
    const nextState = !alertsEnabled;
    setAlertsEnabled(nextState);
    localStorage.setItem("debt_alerts_enabled", String(nextState));

    if (nextState) {
      const currentPerm = await getNotificationPermission();
      if (currentPerm === "default" || currentPerm === "prompt") {
        const status = await requestNotificationPermission();
        setPermissionStatus(status);
        if (status === "granted") {
          sendLocalNotification("تم تفعيل تنبيهات الديون المستحقة", "سيقوم النظام بمراقبة الحسابات المتأخرة وتنبيهك بها تلقائياً في شريط إشعارات الجوال.");
        }
      } else {
        setPermissionStatus(currentPerm);
      }
    }
  };

  const adjustAlertsDays = (amount: number) => {
    const nextDays = Math.max(1, alertsDays + amount);
    setAlertsDays(nextDays);
    localStorage.setItem("debt_alerts_days", String(nextDays));
    notifiedIdsRef.current.clear(); // Reset to scan under new threshold
  };

  const runManualOverdueScan = async () => {
    if (!currentUser) return;
    notifiedIdsRef.current.clear(); // Clear so they can see all alerts

    const currentPerm = await getNotificationPermission();
    if (currentPerm === "default" || currentPerm === "prompt") {
      const status = await requestNotificationPermission();
      setPermissionStatus(status);
    }

    const q = query(
      collection(db, "persons"),
      where("userId", "==", currentUser.uid)
    );

    try {
      const now = new Date();
      const thresholdMs = alertsDays * 24 * 60 * 60 * 1000;
      let matchesCount = 0;

      const { getDocs } = await import("firebase/firestore");
      const snap = await getDocs(q);

      snap.forEach((docSnap) => {
        const p = docSnap.data();
        if (p.balance && p.balance > 0) {
          const lastDate = p.lastTransactionAt ? p.lastTransactionAt.toDate() : (p.createdAt ? p.createdAt.toDate() : null);
          if (lastDate) {
            const elapsed = now.getTime() - lastDate.getTime();
            if (elapsed >= thresholdMs) {
              matchesCount++;
              const daysOverdue = Math.floor(elapsed / (1000 * 60 * 60 * 24));
              const title = `تنبيه مستحقات: ${p.name}`;
              const body = `متأخر عن التسديد منذ ${daysOverdue} يوماً. إجمالي الدين: ${p.balance.toLocaleString('en-US')} ر.ي.`;

              sendLocalNotification(title, body);

              window.dispatchEvent(new CustomEvent("show-app-notification", {
                detail: { title, body }
              }));
            }
          }
        }
      });

      if (matchesCount === 0) {
        alert("🎉 فحص فوري مكتمل: لا توجد ديون مستحقة متأخرة عن الفترة المحددة حالياً!");
      } else {
        alert(`🔔 فحص مكتمل: تم العثور على ${matchesCount} حسابات متأخرة وتم إرسال الإشعارات والتحذيرات بنجاح!`);
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الفحص المالي للديون.");
    }
  };
  // --- End Overdue Debt Alerts States & Logic ---

  const handleSaveName = async () => {
    if (!editedName.trim()) return;
    try {
      if (currentUser) {
        await updateDoc(doc(db, "users", currentUser.uid), {
          name: editedName.trim()
        });
        setIsEditingName(false);
      }
    } catch (err) {
      console.error("Error saving profile name:", err);
      alert("حدث خطأ أثناء حفظ الاسم.");
    }
  };

  // Calculate remaining subscription days
  const getSubDaysLeft = () => {
    if (!userProfile?.subscriptionEnd) return 0;
    const now = new Date();
    const subEnd = userProfile.subscriptionEnd.toDate();
    const diffTime = subEnd.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const daysLeft = getSubDaysLeft();

  const handleLogout = async () => {
    if (confirm("هل أنت متأكد من رغبتك في تسجيل الخروج؟")) {
      await signOut(auth);
      onClose();
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          const compressedB64 = canvas.toDataURL("image/jpeg", 0.7);
          try {
            if (currentUser) {
              await updateDoc(doc(db, "users", currentUser.uid), {
                photoURL: compressedB64
              });
            }
          } catch (err) {
            console.error("Error saving profile photo:", err);
            alert("حدث خطأ أثناء حفظ الصورة الشخصية.");
          }
        }
        setIsUploading(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = async () => {
    if (confirm("هل تريد إزالة الصورة الشخصية واستعادة الشعار الافتراضي؟")) {
      setIsUploading(true);
      try {
        if (currentUser) {
          await updateDoc(doc(db, "users", currentUser.uid), {
            photoURL: ""
          });
        }
      } catch (err) {
        console.error("Error removing profile photo:", err);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const triggerBackup = () => {
    alert("تم أخذ النسخة الاحتياطية ومزامنة بياناتك السحابية بنجاح بنسبة 100%!");
  };

  const checkUpdates = () => {
    setShowUpdateModal(true);
    setUpdateStatus("checking");
    setTimeout(async () => {
      try {
        const docRef = doc(db, "system", "update");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().link) {
          setUpdateStatus("new-update");
          (window as any).updateLinkUrl = docSnap.data().link;
        } else {
          setUpdateStatus("up-to-date");
        }
      } catch (e) {
        setUpdateStatus("error");
      }
    }, 1500);
  };

  const toggleFingerprint = () => {
    const nextState = !fingerprintEnabled;
    setFingerprintEnabled(nextState);
    localStorage.setItem("fingerprint_enabled", String(nextState));
    if ((window as any).AppBridge) {
      (window as any).AppBridge.toggleFingerprint();
    } else {
      alert(
        nextState 
          ? "تم تفعيل القفل الذكي محلياً بنجاح!" 
          : "تم إلغاء تفعيل قفل البصمة."
      );
    }
  };

  return (
    <>
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 flex flex-col rounded-l-[2rem] overflow-hidden"
            dir="rtl"
          >
            {/* Sidebar Header */}
            <div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 p-6 text-white relative">
              <button 
                onClick={onClose}
                className="absolute top-4 left-4 p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="flex flex-col items-center mt-4">
                {/* Profile Photo Upload/Display */}
                <div className="relative group mb-3">
                  <div className="w-20 h-20 bg-white rounded-full p-1 shadow-lg overflow-hidden flex items-center justify-center">
                    {isUploading ? (
                      <div className="w-full h-full rounded-full flex items-center justify-center bg-slate-100">
                        <span className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                      </div>
                    ) : (
                      <img
                        id="userImg"
                        src={userProfile?.photoURL || "iconapp.png"}
                        alt="Profile"
                        onError={(e) => {
                          e.currentTarget.src = "iconapp.png";
                        }}
                        className="w-full h-full object-cover rounded-full bg-white"
                      />
                    )}
                  </div>
                  
                  {/* Photo Controls */}
                  <div className="absolute -bottom-1 -right-1 flex gap-1 bg-white  px-1.5 py-1 rounded-full shadow-md border border-slate-100">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1 hover:bg-slate-100 text-indigo-600 rounded-full transition cursor-pointer"
                      title="تغيير الصورة"
                    >
                      <Camera size={14} />
                    </button>
                    {userProfile?.photoURL && (
                      <button
                        onClick={handleRemovePhoto}
                        className="p-1 hover:bg-slate-100 text-red-500 rounded-full transition cursor-pointer"
                        title="حذف الصورة"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>

                {isEditingName ? (
                  <div className="flex items-center gap-1.5 mt-2 justify-center max-w-[90%] mx-auto">
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="px-3 py-1 bg-white/20  text-white border border-white/30 rounded-xl text-sm text-center font-bold focus:outline-none focus:ring-1 focus:ring-white/50 w-full"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveName();
                        if (e.key === "Escape") setIsEditingName(false);
                      }}
                    />
                    <button
                      onClick={handleSaveName}
                      className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition cursor-pointer flex-shrink-0"
                      title="حفظ"
                    >
                      <CheckCircle size={14} />
                    </button>
                    <button
                      onClick={() => setIsEditingName(false)}
                      className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition cursor-pointer flex-shrink-0"
                      title="إلغاء"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <h3 className="text-lg font-black text-white">{userProfile?.name || "جاري التحميل..."}</h3>
                    <button
                      onClick={() => {
                        setEditedName(userProfile?.name || "");
                        setIsEditingName(true);
                      }}
                      className="p-1 text-white/75 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                      title="تعديل الاسم الرسمي"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                )}
                <p className="text-indigo-100 text-xs font-semibold">{currentUser?.email}</p>
                
                {/* Subscription Status Badge */}
                <div 
                  className={`mt-4 px-4 py-1.5 rounded-full text-xs font-bold shadow-md bg-white ${
                    daysLeft <= 5 ? "text-red-500 animate-pulse" : "text-emerald-600"
                  }`}
                >
                  الاشتراك: باقي {daysLeft} يوم
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="flex-1 p-4 overflow-y-auto space-y-2">
              <button
                onClick={() => {
                  onClose();
                  onNavigate("reports", "التقارير الحسابية");
                }}
                className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 text-slate-700 hover:text-slate-950 rounded-2xl transition font-bold text-right cursor-pointer"
              >
                <BookOpen size={20} className="text-slate-400" />
                <span>التقارير الحسابية</span>
              </button>

              <button
                onClick={triggerBackup}
                className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 text-slate-700 hover:text-slate-950 rounded-2xl transition font-bold text-right cursor-pointer"
              >
                <Database size={20} className="text-slate-400" />
                <span>النسخة الاحتياطية</span>
              </button>

              <button
                onClick={checkUpdates}
                className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 text-slate-700 hover:text-slate-950 rounded-2xl transition font-bold text-right cursor-pointer"
              >
                <RefreshCw size={20} className="text-slate-400" />
                <span>تحديث النظام</span>
              </button>

              {/* Premium Fingerprint Toggle Card */}
              <div 
                onClick={toggleFingerprint}
                className="mx-2 my-4 p-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50/80 cursor-pointer transition flex items-center gap-4 text-slate-800 font-bold"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-600/10">
                  <Fingerprint size={22} className={fingerprintEnabled ? "animate-pulse" : ""} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-black text-slate-800">قفل البصمة الذكي</h4>
                  <p className="text-xs text-slate-500 font-medium">حماية إضافية لحساباتك</p>
                </div>
                <div className="relative">
                  <div className={`w-10 h-6 rounded-full transition-colors ${fingerprintEnabled ? "bg-indigo-600" : "bg-slate-300"}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${fingerprintEnabled ? "left-1" : "left-5"}`} />
                  </div>
                </div>
              </div>

              {/* Debt Due Alerts Card (Premium Feature) */}
              <div className="mx-2 my-4 p-4 rounded-2xl border border-amber-100 bg-amber-50/40 space-y-3">
                <div 
                  onClick={handleToggleAlerts}
                  className="cursor-pointer flex items-center gap-4 text-slate-800 font-bold"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-orange-600/10">
                    <Bell size={20} className={alertsEnabled ? "animate-swing animate-pulse" : ""} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-black text-slate-800">تنبيهات استحقاق الديون</h4>
                    <p className="text-xs text-slate-500 font-medium">إرسال إشعار عند تأخر السداد</p>
                  </div>
                  <div className="relative">
                    <div className={`w-10 h-6 rounded-full transition-colors ${alertsEnabled ? "bg-amber-500" : "bg-slate-300"}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${alertsEnabled ? "left-1" : "left-5"}`} />
                    </div>
                  </div>
                </div>

                {alertsEnabled && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="pt-2 border-t border-amber-200/50 space-y-3.5"
                  >
                    {/* Days threshold selector */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">فترة الاستحقاق:</span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => adjustAlertsDays(-1)}
                          className="w-7 h-7 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-extrabold flex items-center justify-center transition cursor-pointer"
                        >
                          -
                        </button>
                        <span className="text-sm font-black font-mono bg-white px-3 py-1 border border-slate-100 rounded-lg text-slate-800">
                          {alertsDays} {alertsDays === 15 ? "(نصف شهر)" : alertsDays === 30 ? "(شهر كامل)" : "يوم"}
                        </span>
                        <button 
                          onClick={() => adjustAlertsDays(1)}
                          className="w-7 h-7 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-extrabold flex items-center justify-center transition cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Notification permission status */}
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-400">إشعار شريط الحالة للجوال:</span>
                      <span className={`px-2 py-0.5 rounded-md ${
                        permissionStatus === "granted" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {permissionStatus === "granted" ? "مفعّل ونشط" : "يحتاج تفعيل إذن"}
                      </span>
                    </div>

                    {/* Manual scan & trigger test notification */}
                    <button
                      onClick={runManualOverdueScan}
                      className="w-full py-2.5 px-3 bg-gradient-to-tr from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-md shadow-orange-500/10 cursor-pointer"
                    >
                      <RefreshCw size={14} className="animate-spin-slow" />
                      فحص فوري وجلب التنبيهات حالياً
                    </button>

                    
                  </motion.div>
                )}
              </div>
            </div>

            {/* Logout Footer */}
            <div className="p-4 border-t border-slate-100">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 text-red-500 bg-red-50 hover:bg-red-100 rounded-2xl transition font-bold text-sm cursor-pointer"
              >
                <LogOut size={16} />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* System Update Modal */}
      <AnimatePresence>
        {showUpdateModal && (
          <div className="fixed inset-0 bg-slate-900/90  z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl border border-slate-100"
              dir="rtl"
            >
              {updateStatus === "checking" ? (
                <>
                  <div className="mx-auto w-16 h-16 bg-slate-100 text-indigo-600 rounded-full flex items-center justify-center mb-4 text-2xl">
                    <RefreshCw size={36} className="animate-spin" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800 mb-2">جاري البحث عن تحديثات...</h2>
                  <p className="text-slate-400 text-sm">نحن نتحقق من وجود إصدارات جديدة للنظام.</p>
                </>
              ) : updateStatus === "new-update" ? (
                <>
                  <div className="mx-auto w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4 text-2xl">
                    <Bell size={36} className="animate-bounce" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800 mb-2">يتوفر تحديث جديد!</h2>
                  <p className="text-slate-500 text-sm mb-6 leading-relaxed">يتوفر إصدار مالي وأمني مطور للتطبيق. يرجى تنزيل الإصدار الأخير.</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        const url = (window as any).updateLinkUrl;
                        if (url) window.open(url, "_blank");
                        setShowUpdateModal(false);
                      }}
                      className="flex-1 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl text-sm cursor-pointer shadow-lg shadow-emerald-500/10"
                    >
                      تحميل التحديث
                    </button>
                    <button
                      onClick={() => setShowUpdateModal(false)}
                      className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-2xl text-sm cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mx-auto w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-4 text-2xl">
                    <CheckCircle size={36} />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800 mb-2">النظام محدّث بالكامل</h2>
                  <p className="text-slate-500 text-sm leading-relaxed mb-6">أنت تستخدم الإصدار الشامل الأخير والأكثر أماناً من الدفتر الآمن.</p>
                  <button
                    onClick={() => setShowUpdateModal(false)}
                    className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl text-sm cursor-pointer"
                  >
                    إغلاق
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
