import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { setDoc, doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Device } from "@capacitor/device";
import { motion, AnimatePresence } from "motion/react";
import { Lock, Mail, User, Phone, CheckCircle, MessageSquare } from "lucide-react";

interface AuthScreenProps {
  onAuthSuccess: () => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [showActivation, setShowActivation] = useState(false);
  const [tempRegData, setTempRegData] = useState({ name: "", phone: "", email: "" });





  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const deviceId = await Device.getId();
      const uuid = deviceId.identifier;

      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data();

          // Migrate old single deviceId to allowedDevices array if needed
          let allowed = userData.allowedDevices || [];

          if (userData.deviceId && allowed.length === 0) {
            allowed = [userData.deviceId];
            // Don't await this, just let it update in the background
            setDoc(doc(db, "users", userCredential.user.uid), { allowedDevices: allowed }, { merge: true });
          } else if (allowed.length === 0 && !userData.deviceId) {
            // BACKWARD COMPATIBILITY: Existing user with no device binding data at all.
            // Register this current device as their first allowed device automatically.
            allowed = [uuid];
            await setDoc(doc(db, "users", userCredential.user.uid), { allowedDevices: allowed }, { merge: true });
          }

          if (allowed.length > 0 && !allowed.includes(uuid)) {
            // Sign out the user immediately if device ID doesn't match
            await auth.signOut();

            // Create a device approval request for the admin
            try {
               await addDoc(collection(db, "deviceRequests"), {
                 userId: userCredential.user.uid,
                 email: email,
                 name: userData.name || "مستخدم",
                 deviceId: uuid,
                 status: "pending",
                 timestamp: serverTimestamp()
               });
            } catch(e) {
               console.error("Failed to send device request", e);
            }

            throw new Error("هذا الجهاز غير مصرح له. تم إرسال طلب للإدارة للموافقة عليه، يرجى الانتظار والمحاولة لاحقاً.");
          }
        }

        // Always save biometric credentials on successful login (for both native and web environments!)
        localStorage.setItem("saved_email", email);
        // localStorage.setItem("saved_password", password); // REMOVED FOR SECURITY (PlainText Password Storage)

        onAuthSuccess();
      } else {
        if (!name.trim()) throw new Error("الاسم الكامل مطلوب");
        if (!phone.trim()) throw new Error("رقم الهاتف مطلوب");
        
        const res = await createUserWithEmailAndPassword(auth, email, password);
        
        // Setup initial 30 days free trial
        const oneMonthLater = new Date();
        oneMonthLater.setDate(oneMonthLater.getDate() + 30);

        const userData = {
          name: name.trim(),
          phone: phone.trim(),
          status: "active",
          subscriptionEnd: oneMonthLater,
          createdAt: new Date(),
          photoURL: "",
          allowedDevices: [uuid] // Store device ID in array on registration
        };

        await setDoc(doc(db, "users", res.user.uid), userData);
        
        setTempRegData({ name: name.trim(), phone: phone.trim(), email: email.trim() });
        setShowActivation(true);
      }
    } catch (err: any) {
      console.error(err);
      let arabicError = "حدث خطأ أثناء تسجيل الدخول. يرجى التحقق من صحة البيانات.";
      if (err.code === "auth/email-already-in-use") {
        arabicError = "البريد الإلكتروني مستخدم بالفعل من قبل.";
      } else if (err.code === "auth/weak-password") {
        arabicError = "كلمة المرور ضعيفة جداً. يجب أن تكون 6 أحرف على الأقل.";
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        arabicError = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
      } else if (err.message) {
        arabicError = err.message;
      }
      setError(arabicError);
    } finally {
      setLoading(false);
    }
  };

  const sendActivationWA = () => {
    const msg = `مرحباً\nأريد تفعيل حسابي في تطبيق الدفتر الآمن\nالاسم: ${tempRegData.name}\nرقم الهاتف: ${tempRegData.phone}\nالبريد: ${tempRegData.email}`;
    const url = `https://wa.me/967770158410?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
    setShowActivation(false);
    onAuthSuccess();
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 calm-wave-bg select-none overflow-y-auto" dir="rtl">
      {/* Activation Modal */}
      <AnimatePresence>
        {showActivation && (
          <div className="fixed inset-0 bg-slate-900/90  z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl border border-slate-100"
            >
              <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 text-2xl">
                <CheckCircle size={36} />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">تم إنشاء الحساب بنجاح!</h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                تم تفعيل حسابك التجريبي لمدة 30 يوماً مجاناً. هل ترغب في مراسلة الإدارة لتأكيد حسابك وضمان عدم توقفه؟
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={sendActivationWA}
                  className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <MessageSquare size={20} />
                  موافق، راسل الإدارة
                </button>
                <button
                  onClick={() => {
                    setShowActivation(false);
                    onAuthSuccess();
                  }}
                  className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition cursor-pointer"
                >
                  تخطي والبدء الآن
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Auth Form Container */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-6 md:p-8 relative mt-16 border border-slate-100"
      >
        {/* App Logo Emblem */}
        <div className="absolute -top-16 left-0 right-0 mx-auto w-28 h-28 bg-white rounded-full p-2 shadow-xl border border-slate-100 flex items-center justify-center overflow-hidden">
          <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center text-white relative">
            <Lock className="w-10 h-10 text-amber-400 animate-pulse" />
          </div>
        </div>

        <div className="text-center mt-12 mb-6">
          <h1 className="text-3xl font-black text-slate-800">الدفتر الآمن</h1>
          <p className="text-slate-500 text-sm mt-1">نظام المحاسبة السحابي المتكامل</p>
        </div>

        <h2 className="text-lg font-bold text-slate-700 mb-6 text-center">
          {isLogin ? "تسجيل الدخول للنظام" : "إنشاء حساب جديد"}
        </h2>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold text-center"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleAuth} className="block">
          <AnimatePresence initial={false}>
            {!isLogin && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-4"
              >
                <div>
                  <label htmlFor="name" className="block text-xs font-bold text-slate-500 mb-1 mr-1">
                    الاسم الكامل <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <div className="relative mb-4">
                    <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="name"
                      type="text"
                      placeholder="محمد علي صالح"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-right font-medium"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="phone" className="block text-xs font-bold text-slate-500 mb-1 mr-1">
                    رقم الهاتف <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <div className="relative mb-4">
                    <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="phone"
                      type="tel"
                      placeholder="77XXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-left font-mono"
                      dir="ltr"
                      required
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label htmlFor="email" className="block text-xs font-bold text-slate-500 mb-1 mr-1">
              البريد الإلكتروني <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <div className="relative mb-4">
              <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="email"
                type="email"
                placeholder="example@mail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-left font-mono"
                dir="ltr"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-bold text-slate-500 mb-1 mr-1">
              كلمة المرور <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <div className="relative mb-4">
              <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-left font-mono"
                dir="ltr"
                required
              />
            </div>
          </div>

          <div className="flex mt-6">
            <button
              type="submit"
              disabled={loading}
              className={`py-4 px-4 ml-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold rounded-2xl text-lg transition shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 w-full`}
            >
              {loading ? (
                <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : isLogin ? (
                "دخول للنظام"
              ) : (
                "إنشاء حساب جديد"
              )}
            </button>


          </div>
        </form>

        <p className="text-center text-sm font-semibold text-slate-400 mt-6 cursor-pointer" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? (
            <span>ليس لديك حساب؟ <span className="text-violet-600 underline">إنشاء حساب</span></span>
          ) : (
            <span>لديك حساب بالفعل؟ <span className="text-violet-600 underline">تسجيل الدخول</span></span>
          )}
        </p>
      </motion.div>

    </div>
  );
}
