import React, { useState, useEffect } from "react";
import { NativeBiometric } from "capacitor-native-biometric";
import { motion } from "motion/react";
import { Fingerprint, Lock } from "lucide-react";

interface AppLockScreenProps {
  onUnlock: () => void;
  userEmail: string;
}

export default function AppLockScreen({ onUnlock, userEmail }: AppLockScreenProps) {
  const [isNativeAvailable, setIsNativeAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Virtual scanning states (for browser/preview fallback)
  const [isVirtualScanning, setIsVirtualScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanSuccess, setScanSuccess] = useState(false);

  useEffect(() => {
    const checkBiometrics = async () => {
      try {
        const result = await NativeBiometric.isAvailable();
        if (result && result.isAvailable) {
          setIsNativeAvailable(true);
          // Auto trigger native fingerprint prompt on mount
          triggerNativeBiometrics();
        }
      } catch (err) {
        console.log("Biometrics not available on this platform/browser:", err);
      }
    };
    checkBiometrics();
  }, []);

  const triggerNativeBiometrics = async () => {
    setError("");
    setLoading(true);
    try {
      await NativeBiometric.verifyIdentity({
        reason: "يرجى وضع إصبعك على مستشعر البصمة لفتح تطبيق الدفتر الآمن",
        title: "فتح قفل الدفتر الآمن",
        subtitle: "تأكيد الهوية البيومترية",
        description: "يرجى وضع البصمة المسجلة في جهازك للمتابعة"
      });
      onUnlock();
    } catch (err: any) {
      console.error(err);
      setError("فشلت عملية التحقق من البصمة. يرجى المحاولة مجدداً.");
    } finally {
      setLoading(false);
    }
  };

  const startVirtualScan = () => {
    if (scanProgress > 0 && scanProgress < 100) return;
    
    setError("");
    setIsVirtualScanning(true);
    setScanProgress(0);
    setScanSuccess(false);
    
    let current = 0;
    const interval = setInterval(() => {
      current += 8;
      if (current >= 100) {
        current = 100;
        clearInterval(interval);
        setScanSuccess(true);
        setTimeout(() => {
          setIsVirtualScanning(false);
          onUnlock();
        }, 800);
      }
      setScanProgress(current);
    }, 80);
  };

  return (
    <div className="fixed inset-0 bg-slate-950 text-white z-[9999] flex flex-col items-center justify-between p-8 text-center select-none" dir="rtl">
      {/* Upper Brand Section */}
      <div className="mt-12 flex flex-col items-center">
        <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-3xl flex items-center justify-center mb-4 shadow-xl">
          <Lock size={32} />
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight">تطبيق الدفتر الآمن مقفل</h2>
        <p className="text-xs text-slate-400 mt-2 max-w-xs">
          مستند حساباتك ({userEmail}) محمي بواسطة نظام التشفير وقفل البصمة الذكي.
        </p>
      </div>

      {/* Center Interactive Scanner Area */}
      <div className="flex flex-col items-center my-auto">
        <div className="relative w-48 h-48 flex items-center justify-center">
          {/* Outer Ripple Effects */}
          <div className={`absolute inset-0 rounded-full border-4 ${scanSuccess ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.3)]' : isVirtualScanning ? 'border-indigo-500 bg-indigo-500/5 shadow-[0_0_30px_rgba(99,102,241,0.2)] animate-pulse' : 'border-slate-800 bg-slate-900/50'} transition-all duration-300`} />

          {/* SVG Circular Loader */}
          {isVirtualScanning && (
            <svg className="absolute w-44 h-44 transform -rotate-90">
              <circle
                cx="88"
                cy="88"
                r="80"
                stroke="#6366f1"
                strokeWidth="6"
                fill="transparent"
                strokeDasharray={String(2 * Math.PI * 80)}
                strokeDashoffset={String(2 * Math.PI * 80 * (1 - scanProgress / 100))}
                className="transition-all duration-75"
              />
            </svg>
          )}

          {/* Core Button Trigger */}
          <button
            onClick={isNativeAvailable ? triggerNativeBiometrics : startVirtualScan}
            disabled={loading}
            className={`w-32 h-32 rounded-full flex flex-col items-center justify-center transition-all duration-300 ${scanSuccess ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/30' : isVirtualScanning ? 'bg-indigo-950 text-indigo-300 scale-105' : 'bg-slate-900 border border-slate-800 hover:border-indigo-500/30 text-indigo-400 hover:text-indigo-300 hover:scale-105 active:scale-95'} cursor-pointer`}
          >
            <Fingerprint size={64} className={isVirtualScanning ? "animate-pulse" : ""} />
          </button>
        </div>

        {/* Dynamic Status Text */}
        <div className="mt-8 space-y-1.5 min-h-[50px]">
          <span className="text-base font-black text-slate-200 block">
            {scanSuccess ? "تم التحقق والمطابقة بنجاح!" : isVirtualScanning ? `جاري قراءة خطوط البصمة: ${scanProgress}%` : loading ? "يرجى التحقق من مستشعر الهاتف..." : "اضغط للمطابقة وفتح القفل"}
          </span>
          {error && <p className="text-xs text-red-400 font-bold max-w-xs">{error}</p>}
          {!error && (
            <p className="text-[11px] text-slate-500">
              {isNativeAvailable ? "يرجى مطابقة إصبعك المسجل في نظام حماية جوالك" : "بيئة تجريبية: اضغط على زر البصمة لتجربة المحاكاة"}
            </p>
          )}
        </div>
      </div>

      {/* Bottom Option / Recovery */}
      <div className="mb-8 w-full max-w-xs space-y-3">
        {isNativeAvailable && (
          <button
            onClick={triggerNativeBiometrics}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-2xl transition shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            استدعاء مستشعر البصمة الحقيقي
          </button>
        )}
        <p className="text-[10px] text-slate-600 font-medium">
          الدفتر الآمن يمتثل لمعايير الأمان وقفل الأجهزة لضمان خصوصية مطلقة لبياناتك المالية.
        </p>
      </div>
    </div>
  );
}
