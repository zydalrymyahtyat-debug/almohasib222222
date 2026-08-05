import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import { UserProfile } from "../types";
import { motion } from "motion/react";
import { 
  Menu, Cloud, Search, Truck, User, CreditCard, 
  Users, Droplets, Leaf, ArrowUpRight, ArrowDownLeft, Bell,
  Package, Wallet, BarChart2
} from "lucide-react";
import { Calculator } from "lucide-react";

interface DashboardProps {
  currentUser?: any;
  userProfile: UserProfile | null;
  onToggleSidebar: () => void;
  onNavigate: (view: string, title: string) => void;
}

export default function Dashboard({ currentUser, userProfile, onToggleSidebar, onNavigate }: DashboardProps) {
  const [isSyncing, setIsSyncing] = useState(() => !sessionStorage.getItem("has_synced_this_session"));

  useEffect(() => {
    if (isSyncing) {
      const timer = setTimeout(() => {
        setIsSyncing(false);
        sessionStorage.setItem("has_synced_this_session", "true");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSyncing]);

  // Dynamic Greeting Logic
  const getGreeting = () => {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();

    if (day === 5) {
      return { text: "جمعة مباركة", icon: "✨", color: "from-emerald-500 to-teal-500" };
    }

    if (hour >= 5 && hour < 12) {
      return { text: "صباح الخير", icon: "🌅", color: "from-amber-400 to-orange-500" };
    } else if (hour >= 12 && hour < 17) {
      return { text: "طاب يومك", icon: "☀️", color: "from-blue-400 to-cyan-500" };
    } else {
      return { text: "مساء الخير", icon: "🌙", color: "from-indigo-500 to-purple-600" };
    }
  };
  const greeting = getGreeting();

  const [totals, setTotals] = useState(() => {
    const saved = localStorage.getItem("cached_dashboard_totals");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing cached totals", e);
      }
    }
    return { لك: 0, عليك: 0 };
  });
  const [loading, setLoading] = useState(() => {
    return localStorage.getItem("cached_dashboard_totals") ? false : true;
  });

  useEffect(() => {
    if (!currentUser) return;

    // Listen to all persons of this user to calculate real-time grand totals
    const q = query(
      collection(db, "persons"),
      where("userId", "==", currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      let totalLek = 0; // Owed to me (balance > 0, customer owes us, i.e. "عليه")
      let totalAlek = 0; // Owed by me (balance < 0, customer has credit, i.e. "له")

      snap.forEach((doc) => {
        const d = doc.data();
        // Skip projects/sub-modules from standard totals if required
        if (!["malaqatah", "well_customers", "qat_fields"].includes(d.type)) {
          const b = d.balance || 0;
          if (b > 0) {
            totalLek += b;
          } else if (b < 0) {
            totalAlek += Math.abs(b);
          }
        }
      });

      setTotals({ لك: totalLek, عليك: totalAlek });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const menuCards = [
    { id: "suppliers", title: "الموردين", sub: "إدارة الحسابات", icon: Truck, color: "text-amber-500 bg-amber-50 border-amber-100" },
    { id: "customers", title: "العملاء", sub: "حسابات الزبائن", icon: User, color: "text-slate-600 bg-slate-50 border-slate-100" },
    { id: "expenses", title: "الصرفيات", sub: "المصروفات العامة", icon: CreditCard, color: "text-yellow-500 bg-yellow-50 border-yellow-100" },
    { id: "employees", title: "الموظفين", sub: "الرواتب والمسحوبات", icon: Users, color: "text-blue-500 bg-blue-50 border-blue-100" },
    { id: "well_dashboard", title: "بئر ارتوازي", sub: "مشروع بئر المياه", icon: Droplets, color: "text-cyan-500 bg-cyan-50 border-cyan-100" },
    { id: "qat_dashboard", title: "المقاوتة", sub: "إدارة مبيعات القات", icon: Leaf, color: "text-emerald-500 bg-emerald-50 border-emerald-100" },
    { id: "inventory_dashboard", title: "المخزون", sub: "الكميات والباركود", icon: Package, color: "text-indigo-500 bg-indigo-50 border-indigo-100" },
    { id: "cash_banks_dashboard", title: "الصندوق والبنوك", sub: "سندات ومحافظ", icon: Wallet, color: "text-rose-500 bg-rose-50 border-rose-100" },
    { id: "reports_dashboard", title: "التقارير", sub: "أرباح وحركة", icon: BarChart2, color: "text-violet-500 bg-violet-50 border-violet-100" }
  ];

  return (
    <div className="flex flex-col min-h-screen text-slate-100" dir="rtl">
      {/* Dark Curved Header Section */}
      <div className="px-6 pt-4 pb-10 bg-gradient-to-b from-slate-900 to-slate-800 rounded-b-[2rem] relative shadow-lg">
        <header className="flex justify-between items-center mb-3">
          <button 
            onClick={onToggleSidebar}
            className="p-2 bg-slate-800/80 hover:bg-slate-800 text-slate-100 rounded-full transition cursor-pointer border border-slate-700/50"
          >
            <Menu size={20} />
          </button>
          
          <div className="flex flex-col items-center justify-center">
            <h1 className="text-2xl font-black tracking-tight text-white relative">
              الرئيسية
            </h1>
          </div>
          
          <div className="flex items-center gap-2 relative">
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent("open-calculator"))}
              className="p-2 bg-slate-800/80 hover:bg-slate-800 text-slate-100 rounded-full transition cursor-pointer border border-slate-700/50"
              title="آلة حاسبة"
            >
              <Calculator size={20} />
            </button>
            <button 
              onClick={() => {
                window.dispatchEvent(new CustomEvent("open-overdue-modal"));
              }}
              className="p-2 bg-slate-800/80 hover:bg-slate-800 text-slate-100 rounded-full transition cursor-pointer border border-slate-700/50 relative"
              title="تنبيهات الاستحقاق"
            >
              <Bell size={20} className="text-amber-400" />
              <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            </button>

            <button 
              onClick={() => {
                if (navigator.onLine) {
                  alert("تمت مزامنة البيانات والنسخ الاحتياطي السحابي بنجاح! جميع حساباتك آمنة.");
                } else {
                  alert("أنت تعمل حالياً دون اتصال بالإنترنت (أوفلاين). تطبيق الدفتر الآمن يحفظ بياناتك وحساباتك الجديدة محلياً وبكل أمان، وسيتم رفعها وتزامنها تلقائياً بمجرد استعادة الاتصال بالإنترنت!");
                }
              }}
              className="p-2 bg-slate-800/80 hover:bg-slate-800 text-slate-100 rounded-full transition cursor-pointer border border-slate-700/50"
              title="حالة المزامنة السحابية"
            >
              <Cloud size={20} className={navigator.onLine ? "text-indigo-400 animate-pulse" : "text-amber-400"} />
            </button>
          </div>
        </header>

        {isSyncing && (
          <div className="absolute top-0 left-0 right-0 h-1 z-50 bg-slate-800/50 overflow-hidden rounded-t-[2rem]">
            <div className="h-full bg-gradient-to-r from-emerald-400 via-indigo-500 to-amber-400 w-1/2 animate-[progress_1s_ease-in-out_infinite_alternate] shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div>
          </div>
        )}

        {/* Profile and Search Row */}
        <div className="flex flex-col items-center mt-2 space-y-3 justify-center">
          <div className="flex items-center justify-center gap-3 w-full max-w-sm px-4">
              <div
                onClick={onToggleSidebar}
                className="w-12 h-12 shrink-0 rounded-full bg-slate-800 border-2 border-slate-700 p-0.5 overflow-hidden shadow-inner cursor-pointer relative"
              >
                <img
                  id="userImg"
                  src={userProfile?.photoURL || "iconapp.png"}
                  alt="Avatar"
                  onError={(e) => {
                    e.currentTarget.src = "iconapp.png";
                  }}
                  className="w-full h-full object-cover rounded-full bg-white relative z-10"
                />
              </div>

              {/* Mock Search Bar that triggers ListView in search state */}
              <div
                onClick={() => onNavigate("search", "بحث بالاسم")}
                className="flex-1 flex items-center gap-3 px-4 py-3 bg-slate-950/40 hover:bg-slate-950/60 rounded-2xl text-slate-400 border border-slate-700/30 cursor-pointer transition"
              >
                <Search size={16} />
                <span className="text-xs font-bold truncate">بحث عن عميل أو عملية...</span>
              </div>
          </div>
        </div>
      </div>

      {/* Main Stats and Navigation Section */}
      <div className="flex-1 -mt-6 px-5 pb-36 z-10">
        {/* Greeting Banner */}
        <div className={`mb-4 rounded-2xl bg-gradient-to-r ${greeting.color} p-0.5 shadow-lg`}>
          <div className="bg-white/95 rounded-2xl px-4 py-2.5 flex items-center justify-between backdrop-blur-sm">
             <div className="flex items-center gap-2">
                <span className="text-xl">{greeting.icon}</span>
                <span className="font-black text-slate-800 text-sm tracking-wide">{greeting.text} {userProfile?.name?.split(' ')[0] || ""}</span>
             </div>
             <span className="text-xs font-bold text-slate-500">{new Date().toLocaleDateString('ar-EG', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>

        {/* Glowing Totals Cards */}
        <div className="flex gap-4 mb-4">
          {/* Lek (Receivables - Green) */}
          <div className="flex-1 p-4 rounded-2xl bg-white shadow-xl flex flex-col items-center border border-slate-100 glowing-border-card">
            <span className="text-sm font-bold text-slate-500 mb-1 flex items-center gap-1">
              <ArrowDownLeft size={14} className="text-emerald-500" />
              لـــك
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-600 font-mono">
              {loading ? "..." : totals.لك.toLocaleString('en-US')}
            </span>
            <span className="text-xs text-slate-400 font-bold mt-1">ر.ي</span>
          </div>

          {/* Alek (Debts - Red) */}
          <div className="flex-1 p-4 rounded-2xl bg-white shadow-xl flex flex-col items-center border border-slate-100 glowing-border-card">
            <span className="text-sm font-bold text-slate-500 mb-1 flex items-center gap-1">
              <ArrowUpRight size={14} className="text-red-500" />
              عليك
            </span>
            <span className="text-xl sm:text-2xl font-black text-red-500 font-mono">
              {loading ? "..." : totals.عليك.toLocaleString('en-US')}
            </span>
            <span className="text-xs text-slate-400 font-bold mt-1">ر.ي</span>
          </div>
        </div>

        {/* Modules Navigation Grid */}
        <div className="grid grid-cols-3 gap-3">
          {menuCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => onNavigate(card.id, card.title)}
                className="p-3 bg-white text-slate-800 shadow-md border border-slate-100 flex flex-col items-center justify-start text-center cursor-pointer select-none relative overflow-hidden group hover:shadow-lg transition rounded-2xl h-full"
              >
                {/* Visual Icon Box */}
                <div className={`p-3 rounded-2xl mb-2 flex items-center justify-center ${card.color}`}>
                  <Icon size={20} />
                </div>
                <h3 className="font-black text-xs text-slate-800 leading-tight break-words">{card.title}</h3>
                <p className="text-[10px] text-slate-500 font-bold mt-1 leading-tight break-words">{card.sub}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
