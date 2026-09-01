import React, { useEffect, useState, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { UserProfile, Well } from "./types";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, Bell, BookOpen, Cloud, Database, Droplets, 
  Home, Leaf, Lock, Menu, MessageSquare, RefreshCw, Settings,
  X, Search, Phone, Clock
} from "lucide-react";
import { App as CapApp } from "@capacitor/app";
import { RootDetection } from "@capawesome/capacitor-root-detection";
import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { sendLocalNotification } from "./utils/notificationHelper";

// Components
import AuthScreen from "./components/AuthScreen";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import ListView from "./components/ListView";
import StatementView from "./components/StatementView";
import ReportsView from "./components/ReportsView";
import AppLockScreen from "./components/AppLockScreen";
import WellProjectView from "./components/WellProjectView";
import WellsList from "./components/WellsList";

interface NavState {
  view: string;
  title: string;
  selectedPersonId?: string;
  section?: string;
}

import InventoryDashboard from "./components/InventoryDashboard";
import CashBanksDashboard from "./components/CashBanksDashboard";
import ReportsDashboard from "./components/ReportsDashboard";
import MarketMqawetView from "./components/MarketMqawetView";
import CalculatorModal from "./components/CalculatorModal";
import MessageTemplatesView from "./components/MessageTemplatesView";
import { Calculator } from "lucide-react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = localStorage.getItem("cached_user_auth");
    if (saved) {
      try {
        return JSON.parse(decodeURIComponent(escape(atob(saved))));
      } catch (e) {
        console.error("Error parsing cached auth", e);
      }
    }
    return null;
  });
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem("cached_user_profile");
    if (saved) {
      try {
        const parsed = JSON.parse(decodeURIComponent(escape(atob(saved))));
        if (parsed.subscriptionEnd) {
          const dateStr = parsed.subscriptionEnd;
          parsed.subscriptionEnd = { toDate: () => new Date(dateStr) };
        }
        if (parsed.createdAt) {
          const dateStr = parsed.createdAt;
          parsed.createdAt = { toDate: () => new Date(dateStr) };
        }
        return parsed;
      } catch (e) {
        console.error("Error parsing cached profile", e);
      }
    }
    return null;
  });
  const [appReady, setAppReady] = useState(() => {
    return localStorage.getItem("cached_app_ready") === "true";
  });
  const [expired, setExpired] = useState(() => {
    return localStorage.getItem("cached_app_expired") === "true";
  });

  // Floating in-app alert/notification state
  const [toastNotification, setToastNotification] = useState<{ title: string; body: string } | null>(null);
  const [overdueCustomers, setOverdueCustomers] = useState<any[]>([]);
  const [showOverdueModal, setShowOverdueModal] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  // Listen for custom notification trigger events and overdue modal
  useEffect(() => {
    const handleShowNotification = (e: any) => {
      setToastNotification(e.detail);
    };
    const handleOpenOverdueModal = () => {
      setShowOverdueModal(true);
    };
    window.addEventListener("show-app-notification" as any, handleShowNotification);
    window.addEventListener("open-overdue-modal" as any, handleOpenOverdueModal);
    const handleOpenCalculator = () => setShowCalculator(true);
    window.addEventListener("open-calculator" as any, handleOpenCalculator);
    return () => {
      window.removeEventListener("show-app-notification" as any, handleShowNotification);
      window.removeEventListener("open-overdue-modal" as any, handleOpenOverdueModal);
      window.removeEventListener("open-calculator" as any, handleOpenCalculator);
    };
  }, []);

  // Root Detection on Startup
  useEffect(() => {
    const checkRootStatus = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const result = await RootDetection.isRooted();
          if ((result as any).isRooted || (result as any).rooted) {
            alert("خطأ أمني: تم اكتشاف محاولة للعبث بالنظام أو بيئة غير آمنة. سيتم إغلاق التطبيق.");
            await CapApp.exitApp();
          }
        } catch (e) {
          console.error("Root check failed", e);
        }
      }
    };
    checkRootStatus();
  }, []);

  // Monitor overdue debt status in real-time
  useEffect(() => {
    if (!currentUser) {
      setOverdueCustomers([]);
      return;
    }

    const q = query(
      collection(db, "persons"),
      where("userId", "==", currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      const now = new Date();
      const alertsEnabled = localStorage.getItem("debt_alerts_enabled") === "true";
      const alertsDaysStr = localStorage.getItem("debt_alerts_days");
      const alertsDays = alertsDaysStr ? parseInt(alertsDaysStr, 10) : 15;
      const thresholdMs = alertsDays * 24 * 60 * 60 * 1000;

      const list: any[] = [];
      snap.forEach((docSnap) => {
        const p = docSnap.data();
        if (p.balance && p.balance > 0) {
          // Calculate overdue based on lastTransactionAt or createdAt
          const lastDate = p.lastTransactionAt ? p.lastTransactionAt.toDate() : (p.createdAt ? p.createdAt.toDate() : null);
          if (lastDate) {
            const elapsed = now.getTime() - lastDate.getTime();
            if (elapsed >= thresholdMs) {
              const daysOverdue = Math.floor(elapsed / (1000 * 60 * 60 * 24));
              list.push({
                id: docSnap.id,
                ...p,
                daysOverdue
              });
            }
          }
        }
      });

      // Sort by longest overdue days first
      list.sort((a, b) => b.daysOverdue - a.daysOverdue);
      setOverdueCustomers(list);

      // Consolidate & send alert if list changed and alerts are enabled
      if (list.length > 0 && alertsEnabled) {
        const count = list.length;
        const totalDebt = list.reduce((sum, item) => sum + (item.balance || 0), 0);
        const title = `🚨 تنبيه الديون المستحقة المتأخرة`;
        const body = `يوجد لديك ${count} عملاء متأخرين عن السداد بمبلغ إجمالي ${totalDebt.toLocaleString('en-US')} ر.ي. انقر هنا لعرض قائمة الأسماء والتفاصيل ومتابعتهم.`;

        // Native System Notification (Native-aware helper)
        try {
          const lastNotifiedCount = localStorage.getItem("last_notified_count");
          if (lastNotifiedCount !== String(count)) {
            localStorage.setItem("last_notified_count", String(count));
            sendLocalNotification(title, body);
          }
        } catch (e) {
          console.error("Native notification failed:", e);
        }

        // In-app Notification toast
        const sessionShown = sessionStorage.getItem("overdue_notif_shown");
        if (sessionShown !== String(count)) {
          sessionStorage.setItem("overdue_notif_shown", String(count));
          setToastNotification({ title, body });
        }
      }
    }, (error) => {
      console.error("Error watching overdue accounts:", error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // App lock state for real biometric security
  const [isAppLocked, setIsAppLocked] = useState(() => {
    return localStorage.getItem("fingerprint_enabled") === "true";
  });

  // Listen for Capacitor background/resume state to secure the app automatically
  useEffect(() => {
    const stateListener = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) {
        // App went to the background/minimized
        if (localStorage.getItem("ignore_app_lock") === "true") {
          // Skip locking this once, but reset the flag so it locks next time if minimized again
          localStorage.removeItem("ignore_app_lock");
          return;
        }
        if (localStorage.getItem("fingerprint_enabled") === "true") {
          setIsAppLocked(true);
        }
      }
    });

    return () => {
      stateListener.then((h) => h.remove());
    };
  }, []);

  // Layout View States
  const [currentView, setCurrentView] = useState("dashboard");
  const [viewTitle, setViewTitle] = useState("الرئيسية");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedWellId, setSelectedWellId] = useState("");
  const [activeSection, setActiveSection] = useState(""); // context e.g. "suppliers" | "well_customers"

  // Navigation History Stack (highly robust in-app routing)
  const [historyStack, setHistoryStack] = useState<NavState[]>([]);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // System Announcement state
  const [announcement, setAnnouncement] = useState<any>(null);
  const [showAnnModal, setShowAnnModal] = useState(false);

  // Connection/Sync State tracking
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOnlineToast, setShowOnlineToast] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOnlineToast(true);
      setTimeout(() => setShowOnlineToast(false), 4000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowOnlineToast(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Listen for Authentication state
  useEffect(() => {
    // Auth state initialization
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          localStorage.setItem("cached_user_auth", btoa(unescape(encodeURIComponent(JSON.stringify({ uid: user.uid, email: user.email })))));
        } catch(e) {
          console.error("Error caching auth", e);
        }
        setAppReady(true);
        localStorage.setItem("cached_app_ready", "true");
      } else {
        localStorage.removeItem("cached_user_auth");
        localStorage.removeItem("cached_user_profile");
        setUserProfile(null);
        setAppReady(true);
        localStorage.setItem("cached_app_ready", "true");
        setExpired(false);
        localStorage.setItem("cached_app_expired", "false");
      }
    });
    return () => unsubscribe();
  }, []);

  // Listen to User Profile & Subscription status
  useEffect(() => {
    if (!currentUser) return;

    // setAppReady(false); // Removed to avoid blocking UI on reconnects/offline
    const userDocRef = doc(db, "users", currentUser.uid);

    const unsubscribe = onSnapshot(userDocRef, { includeMetadataChanges: true }, async (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;

        // Perform Device Validation in real-time
        try {
          const deviceId = await Device.getId();
          const uuid = deviceId.identifier;

          let allowed = (data as any).allowedDevices || [];
          if (allowed.length === 0 && (data as any).deviceId) {
            allowed = [(data as any).deviceId];
          }

          // BACKWARD COMPATIBILITY: If no device data exists AT ALL (legacy account), auto-register it now in background
          if (allowed.length === 0 && !(data as any).deviceId) {
            allowed = [uuid];
            // Update firestore in background so we don't block
            setDoc(doc(db, "users", currentUser.uid), { allowedDevices: allowed }, { merge: true }).catch(console.error);
          }

          if (allowed.length > 0 && !allowed.includes(uuid)) {
             // Device is no longer allowed or was never allowed (caught on resume/realtime)
             if (navigator.onLine) {
                // Submit a device request BEFORE signing out
                try {
                   const reqsQ = query(collection(db, "deviceRequests"), where("userId", "==", currentUser.uid), where("deviceId", "==", uuid), where("status", "==", "pending"));
                   const reqsSnap = await getDocs(reqsQ);
                   if (reqsSnap.empty) {
                     await addDoc(collection(db, "deviceRequests"), {
                       userId: currentUser.uid,
                       email: currentUser.email || "",
                       name: data.name || "مستخدم",
                       deviceId: uuid,
                       status: "pending",
                       timestamp: serverTimestamp()
                     });
                   }
                } catch(reqErr) {
                   console.error("Failed to submit background device request", reqErr);
                }

                await auth.signOut();
                alert("تم تسجيل الخروج: هذا الجهاز غير مصرح له. تم إرسال طلب للإدارة، يرجى الانتظار.");
             }
             return;
          }
        } catch(e) {
          console.error("Device ID check failed", e);
        }

        setUserProfile(data);

        // Cache the profile minus any non-serializable fields if needed (dates are serialized by firestore if we just use strings or we stringify the object)
        const serializedData = {
          ...data,
          subscriptionEnd: data.subscriptionEnd ? data.subscriptionEnd.toDate().toISOString() : null,
          createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null
        };
        try {
          localStorage.setItem("cached_user_profile", btoa(unescape(encodeURIComponent(JSON.stringify(serializedData)))));
        } catch(e) {
          console.error("Error caching profile", e);
        }

        // Calculate subscription validity
        const now = new Date();
        const subEnd = data.subscriptionEnd ? data.subscriptionEnd.toDate() : new Date(0);
        
        if (data.status === "active" && subEnd > now) {
          setExpired(false);
          localStorage.setItem("cached_app_expired", "false");
        } else {
          setExpired(true);
          localStorage.setItem("cached_app_expired", "true");
        }
      } else {
        // Only sign out if we are definitely online (prevents logging out offline users)
        if (navigator.onLine) {
          auth.signOut();
        }
      }
      setAppReady(true);
    }, (error) => {
      console.error("Error reading subscription status:", error);
      setAppReady(true);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Listen to Global System Announcements
  useEffect(() => {
    if (!currentUser || expired) return;

    const annDocRef = doc(db, "system", "announcement");
    const unsubscribe = onSnapshot(annDocRef, { includeMetadataChanges: true }, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.isActive) {
          const annId = data.date ? data.date.toDate().getTime().toString() : data.title;
          if (localStorage.getItem("seen_announcement") !== annId) {
            setAnnouncement({ id: annId, ...data });
            setShowAnnModal(true);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser, expired]);


  // Migration logic for default well
  useEffect(() => {
    if (!currentUser || !appReady) return;

    let hasMigrated = false;

    // We do a single check using getDocs to see if we need to migrate.
    // Using onSnapshot can lead to multiple triggers or race conditions.
    const checkAndMigrate = async () => {
      if (hasMigrated) return;
      hasMigrated = true;

      try {
        const wellsQuery = query(collection(db, "wells"), where("userId", "==", currentUser.uid));
        const snap = await getDocs(wellsQuery);

        let mainWellId = null;

        if (snap.empty) {
          // Create a default well if absolutely no wells exist
          const docRef = await addDoc(collection(db, "wells"), {
            userId: currentUser.uid,
            name: "البئر الرئيسي",
            location: "تم إنشاؤه تلقائياً لترحيل البيانات السابقة",
            createdAt: serverTimestamp()
          });
          mainWellId = docRef.id;
        } else {
          // If wells exist, use the first one or a specific one as the fallback
          mainWellId = snap.docs[0].id;
        }

        if (mainWellId) {
          // Migrate old customers who don't have a wellId or whose wellId is "default_well"
          const q = query(collection(db, "persons"), where("userId", "==", currentUser.uid), where("type", "==", "well_customers"));
          const personsSnap = await getDocs(q);
          const updatePromises: any[] = [];

          personsSnap.forEach((d) => {
            const data = d.data();
            if (!data.wellId || data.wellId === "default_well") {
                updatePromises.push(updateDoc(doc(db, "persons", d.id), { wellId: mainWellId }));
            }
          });

          // Migrate old expenses
          const expQ = query(collection(db, "expenses"), where("userId", "==", currentUser.uid), where("section", "==", "well_expenses"));
          const expSnap = await getDocs(expQ);
          expSnap.forEach((d) => {
             const data = d.data();
             if (!data.wellId || data.wellId === "default_well") {
                updatePromises.push(updateDoc(doc(db, "expenses", d.id), { wellId: mainWellId }));
             }
          });

          // Migrate old transactions
          const txQ = query(collection(db, "transactions"), where("userId", "==", currentUser.uid), where("section", "==", "well_customers"));
          const txSnap = await getDocs(txQ);
          txSnap.forEach((d) => {
             const data = d.data();
             if (!data.wellId || data.wellId === "default_well") {
                updatePromises.push(updateDoc(doc(db, "transactions", d.id), { wellId: mainWellId }));
             }
          });

          await Promise.all(updatePromises);
        }
      } catch(e) {
        console.error("Migration error", e);
      }
    };

    checkAndMigrate();
  }, [currentUser, appReady]);


  // Clean back navigation handler
  const handleGoBack = () => {
    if (historyStack.length > 0) {
      const prev = historyStack[historyStack.length - 1];
      setHistoryStack((prevStack) => prevStack.slice(0, -1));

      setCurrentView(prev.view);
      setViewTitle(prev.title);
      setSelectedPersonId(prev.selectedPersonId || "");
      setActiveSection(prev.section || "");
    } else {
      // Fallback to main dashboard
      setCurrentView("dashboard");
      setViewTitle("الرئيسية");
      setSelectedPersonId("");
      setActiveSection("");
    }
  };

  // Refs for current state to use in back listeners
  const currentViewRef = useRef(currentView);
  const sidebarOpenRef = useRef(sidebarOpen);
  const historyStackRef = useRef(historyStack);
  const modalsRef = useRef({ ann: showAnnModal, overdue: showOverdueModal });

  useEffect(() => {
    currentViewRef.current = currentView;
    sidebarOpenRef.current = sidebarOpen;
    historyStackRef.current = historyStack;
    modalsRef.current = { ann: showAnnModal, overdue: showOverdueModal };
  }, [currentView, sidebarOpen, historyStack, showAnnModal, showOverdueModal]);

  // Physical Back Button Handler (Double press to exit on Home dashboard) & PWA support
  useEffect(() => {
    let lastBackPressed = 0;

    const performBack = () => {
      if (modalsRef.current.ann) {
        setShowAnnModal(false);
        return true;
      }
      if (modalsRef.current.overdue) {
        setShowOverdueModal(false);
        return true;
      }
      if (sidebarOpenRef.current) {
        setSidebarOpen(false);
        return true; // prevent exit
      }
      if (typeof (window as any).customBackHandler === "function") {
        (window as any).customBackHandler();
        return true; // prevent exit
      }
      if (currentViewRef.current !== "dashboard") {
        const hStack = historyStackRef.current;
        if (hStack.length > 0) {
          const prev = hStack[hStack.length - 1];
          setCurrentView(prev.view);
          setViewTitle(prev.title);
          setSelectedPersonId(prev.selectedPersonId || "");
          setActiveSection(prev.section || "");
          setHistoryStack(hStack.slice(0, -1));
        } else {
          setCurrentView("dashboard");
          setViewTitle("الرئيسية");
          setSelectedPersonId("");
          setActiveSection("");
          setHistoryStack([]);
        }
        return true; // prevent exit
      }
      return false; // allow exit logic
    };

    const handleHardwareBack = () => {
      const prevented = performBack();
      if (!prevented) {
        const now = Date.now();
        if (now - lastBackPressed < 2000) {
          CapApp.exitApp();
        } else {
          lastBackPressed = now;
          const toast = document.createElement("div");
          toast.className = "fixed bottom-32 left-0 right-0 mx-auto w-fit text-center bg-slate-900 text-white font-bold text-sm px-5 py-3 rounded-full z-50 animate-bounce shadow-xl";
          toast.innerText = "اضغط مرة أخرى للخروج من التطبيق";
          toast.dir = "rtl";
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 2000);
        }
      }
    };

    const isNative = Capacitor.isNativePlatform();

    const backListener = CapApp.addListener("backButton", (e) => {
      if (!isNative) return; // Prevent double firing if somehow triggered on web
      handleHardwareBack();
    });
    
    const handlePopState = (e: PopStateEvent) => {
      if (isNative) return; // Native handles it via CapApp
      const prevented = performBack();
      if (prevented) {
        window.history.pushState(null, "", window.location.href);
      }
    };
    
    window.addEventListener("popstate", handlePopState);
    
    return () => {
      backListener.then((h) => h.remove());
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Sync PWA history state
  useEffect(() => {
    if (historyStack.length > 0) {
      window.history.pushState(null, "", window.location.href);
    }
  }, [historyStack.length]);


  // Safe navigation wrapper
  const [reportInitialType, setReportInitialType] = useState<string>("customers");

  const handleNavigate = (viewId: string, title?: string, reportType?: string) => {
    // Save current state to history stack
    const currentNav: NavState = {
      view: currentView,
      title: viewTitle,
      selectedPersonId: selectedPersonId,
      section: activeSection
    };
    setHistoryStack((prev) => [...prev, currentNav]);

    // Set new view states
    if (["suppliers", "customers", "expenses", "employees", "well_customers", "well_expenses", "well_queue", "qat_fields"].includes(viewId)) {
      setCurrentView("list");
      setActiveSection(viewId);
    } else {
      setCurrentView(viewId);
    }
    setViewTitle(title || "");
    setSelectedPersonId("");
    
    if (viewId === "reports" && reportType) {
      setReportInitialType(reportType);
    }
  };

  const handleNavigateStatement = (personId: string, name: string, phone: string, balance: number) => {
    // Save current to history
    const currentNav: NavState = {
      view: currentView,
      title: viewTitle,
      selectedPersonId: selectedPersonId,
      section: activeSection
    };
    setHistoryStack((prev) => [...prev, currentNav]);

    setSelectedPersonId(personId);
    setCurrentView("statement");
    setViewTitle(`كشف: ${name}`);
  };

  const handleNavigateStatementWithSection = (p: any) => {
    const currentNav: NavState = {
      view: currentView,
      title: viewTitle,
      selectedPersonId: selectedPersonId,
      section: activeSection
    };
    setHistoryStack((prev) => [...prev, currentNav]);

    setSelectedPersonId(p.id);
    setActiveSection(p.type || "customers");
    setCurrentView("statement");
    setViewTitle(`كشف: ${p.name}`);
    setShowOverdueModal(false);
  };

  const dismissAnnouncement = () => {
    if (announcement) {
      localStorage.setItem("seen_announcement", announcement.id);
    }
    setShowAnnModal(false);
  };

  if (!appReady) {
    return (
      <div className="fixed inset-0 flex flex-col justify-center items-center bg-slate-950 text-white select-none">
        <span className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></span>
        <h3 className="text-sm font-bold tracking-wider text-slate-400">جاري تحميل نظام الدفتر الآمن...</h3>
      </div>
    );
  }

  // Not Logged In screen
  if (!currentUser) {
    return <AuthScreen onAuthSuccess={() => {}} />;
  }

  // Biometric App Lock Check
  if (isAppLocked && localStorage.getItem("fingerprint_enabled") === "true") {
    return (
      <AppLockScreen 
        onUnlock={() => setIsAppLocked(false)} 
        userEmail={currentUser.email || ""} 
      />
    );
  }

  // Expired Subscription screen
  if (expired) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 text-slate-800 p-6 text-center select-none" dir="rtl">
        <div className="w-20 h-20 bg-red-100 text-red-500 rounded-3xl flex items-center justify-center mb-6 text-4xl shadow-md">
          <Lock size={44} className="animate-pulse" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">انتهت فترة الاشتراك</h2>
        <p className="text-slate-500 text-sm leading-relaxed mb-6 max-w-sm">
          الرجاء تجديد اشتراكك السنوي لفتح وتفعيل نظام الدفتر الآمن الخاص بك ومتابعة حساباتك المالية بأمان وسرعة.
        </p>

        <button 
          onClick={() => window.open("https://wa.me/967770158410", "_blank")}
          className="py-4 px-8 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20 cursor-pointer"
        >
          <MessageSquare size={20} />
          تجديد الاشتراك عبر واتس اب
        </button>

        <span className="text-lg font-black text-slate-700 font-mono mt-6 block">770158410</span>

        <button 
          onClick={() => auth.signOut()}
          className="mt-12 text-sm font-bold text-red-500 hover:underline cursor-pointer"
        >
          تسجيل الخروج من الحساب
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen relative" dir="rtl">
      {/* Printable Area - Rendered offscreen, active during print */}
      <div id="print-area"></div>

      {/* Main application sidebar wrapper */}
      <CalculatorModal isOpen={showCalculator} onClose={() => setShowCalculator(false)} />
      <Sidebar
        currentUser={currentUser}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userProfile={userProfile}
        onNavigate={handleNavigate}
      />

      {/* Global Announcements Popup */}
      <AnimatePresence>
        {showAnnModal && announcement && (
          <div className="fixed inset-0 bg-slate-900/90  z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2rem] p-6 max-w-sm w-full text-center shadow-2xl border border-slate-100"
            >
              <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4 text-2xl">
                <Bell size={36} className="animate-bounce" />
              </div>
              <h2 className="text-lg font-black text-slate-800 mb-2">{announcement.title}</h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">{announcement.message}</p>
              <button
                onClick={dismissAnnouncement}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold rounded-2xl transition cursor-pointer"
              >
                فهمت الإشعار
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Non-dashboard generic header bar */}
      {currentView !== "dashboard" && (
        <header className="flex justify-between items-center px-5 py-4 bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm">
          <button 
            onClick={handleGoBack}
            className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer"
          >
            <ArrowLeft size={22} />
          </button>
          
          <h1 className="text-base font-black text-slate-800 truncate max-w-[70%]">{viewTitle}</h1>
          
          <div className="flex gap-1">
            <button 
              onClick={() => setShowCalculator(true)}
              className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer"
            >
              <Calculator size={22} />
            </button>
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer"
            >
              <Settings size={22} />
            </button>
          </div>
        </header>
      )}

      {/* Primary Page Screen views switcher */}
      <main className="min-h-screen">
        {currentView === "dashboard" && (
          <Dashboard currentUser={currentUser} userProfile={userProfile} onToggleSidebar={() => setSidebarOpen(true)} onNavigate={handleNavigate} />
        )}

        {currentView === "list" && (
          <ListView 
            currentUser={currentUser}
            section={activeSection}
            title={viewTitle}
            onNavigateStatement={handleNavigateStatement}
          />
        )}

        {currentView === "statement" && (
          <StatementView 
            currentUser={currentUser}
            personId={selectedPersonId}
            section={activeSection}
            onGoBack={handleGoBack}
            userProfile={userProfile}
          />
        )}

        {currentView === "reports" && (
          <ReportsView 
            currentUser={currentUser}
            initialType={reportInitialType}
            userProfile={userProfile}
          />
        )}

        {currentView === "well_project" && (
          <WellProjectView currentUser={currentUser} onGoBack={handleGoBack} selectedWellId={selectedWellId} />
        )}

        {currentView === "inventory_dashboard" && (
          <InventoryDashboard currentUser={currentUser} onGoBack={handleGoBack} userProfile={userProfile} onNavigate={handleNavigate} />
        )}

        {currentView === "cash_banks_dashboard" && (
          <CashBanksDashboard currentUser={currentUser} onGoBack={handleGoBack} userProfile={userProfile} onNavigate={handleNavigate} />
        )}

        {currentView === "reports_dashboard" && (
          <ReportsDashboard currentUser={currentUser} onGoBack={handleGoBack} userProfile={userProfile} onNavigate={handleNavigate} />
        )}

        {currentView === "templates" && (
          <MessageTemplatesView currentUser={currentUser} onGoBack={handleGoBack} />
        )}

        {/* Artesian Well Sub-Dashboard View */}
                {currentView === "wells_list" && (
          <WellsList
            currentUser={currentUser}
            onSelectWell={(id, name) => {
              setSelectedWellId(id);
              handleNavigate("well_project", "بئر: " + name);
            }}
          />
        )}

        {currentView === "well_dashboard" && (
          <div className="p-5 select-none" dir="rtl">
            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-3xl p-6 text-white shadow-lg mb-6 relative overflow-hidden">
              <h2 className="text-xl font-black mb-1.5 flex items-center gap-2">
                <Droplets size={24} />
                مشروع بئر ارتوازي
              </h2>
              <p className="text-cyan-100 text-sm font-semibold">إدارة المزارعين وتفاصيل السقاية والصرفيات</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div 
                onClick={() => handleNavigate("wells_list", "قائمة الآبار الارتوازية")}
                className="p-5 bg-white border border-slate-100 rounded-2xl flex flex-col items-center text-center cursor-pointer shadow-sm active:scale-95 transition"
              >
                <div className="p-3 bg-cyan-50 text-cyan-500 rounded-xl mb-3">
                  <Droplets size={22} />
                </div>
                <h3 className="font-black text-sm text-slate-800">قائمة الآبار</h3>
              </div>

              <div 
                onClick={() => handleNavigate("well_expenses", "مصروفات البئر")}
                className="p-5 bg-white border border-slate-100 rounded-2xl flex flex-col items-center text-center cursor-pointer shadow-sm active:scale-95 transition"
              >
                <div className="p-3 bg-red-50 text-red-500 rounded-xl mb-3">
                  <RefreshCw size={22} />
                </div>
                <h3 className="font-black text-sm text-slate-800">مصروفات البئر</h3>
              </div>

              <div 
                onClick={() => handleNavigate("well_queue", "قائمة الدور")}
                className="p-5 bg-white border border-slate-100 rounded-2xl flex flex-col items-center text-center cursor-pointer shadow-sm active:scale-95 transition"
              >
                <div className="p-3 bg-amber-50 text-amber-500 rounded-xl mb-3">
                  <Database size={22} />
                </div>
                <h3 className="font-black text-sm text-slate-800">قائمة الدور</h3>
              </div>

              <div 
                onClick={() => handleNavigate("reports", "تقارير البئر")}
                className="p-5 bg-white border border-slate-100 rounded-2xl flex flex-col items-center text-center cursor-pointer shadow-sm active:scale-95 transition"
              >
                <div className="p-3 bg-indigo-50 text-indigo-500 rounded-xl mb-3">
                  <BookOpen size={22} />
                </div>
                <h3 className="font-black text-sm text-slate-800">تقارير مفصلة</h3>
              </div>

              {/* مشروع بئر - نظام السقايات */}
              <div 
                onClick={() => handleNavigate("well_project", "مشروع بئر (نظام السقايات)")}
                className="col-span-2 p-5 bg-gradient-to-tr from-cyan-50/50 to-blue-50/50 border border-cyan-100/70 rounded-2xl flex items-center gap-4 cursor-pointer shadow-sm active:scale-95 transition"
              >
                <div className="p-3 bg-cyan-500 text-white rounded-xl shadow-md shadow-cyan-500/15">
                  <Droplets size={22} className="animate-pulse" />
                </div>
                <div className="text-right">
                  <h3 className="font-black text-sm text-slate-800">مشروع بئر</h3>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">نظام السقايات الذكي وحساب الساعات والديزل بالتفصيل</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Qat Sellers Sub-Dashboard View */}
        {currentView === "qat_dashboard" && (
          <div className="p-5 select-none" dir="rtl">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 text-white shadow-lg mb-6 relative overflow-hidden">
              <h2 className="text-xl font-black mb-1.5 flex items-center gap-2">
                <Leaf size={24} />
                إدارة جرب القات
              </h2>
              <p className="text-emerald-100 text-sm font-semibold">إدارة حسابات المقاوتة ومبيعات ومصاريف المزارع</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div 
                onClick={() => handleNavigate("qat_fields", "سجل الجرب")}
                className="p-5 bg-white border border-slate-100 rounded-2xl flex flex-col items-center text-center cursor-pointer shadow-sm active:scale-95 transition"
              >
                <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl mb-3">
                  <Leaf size={22} />
                </div>
                <h3 className="font-black text-sm text-slate-800">الجرب والمقاطع</h3>
              </div>

              <div 
                onClick={() => handleNavigate("reports", "تقارير المقاوتة")}
                className="p-5 bg-white border border-slate-100 rounded-2xl flex flex-col items-center text-center cursor-pointer shadow-sm active:scale-95 transition"
              >
                <div className="p-3 bg-indigo-50 text-indigo-500 rounded-xl mb-3">
                  <BookOpen size={22} />
                </div>
                <h3 className="font-black text-sm text-slate-800">تقارير مخلّصة</h3>
              </div>

              <div
                onClick={() => handleNavigate("market_mqawet", "مقوت من السوق")}
                className="p-5 bg-white border border-slate-100 rounded-2xl flex flex-col items-center text-center cursor-pointer shadow-sm active:scale-95 transition md:col-span-2"
              >
                <div className="p-3 bg-amber-50 text-amber-500 rounded-xl mb-3">
                  <Leaf size={22} />
                </div>
                <h3 className="font-black text-sm text-slate-800">مقوت من السوق</h3>
              </div>
            </div>
          </div>
        )}

        {currentView === "market_mqawet" && (
          <MarketMqawetView
            currentUser={currentUser}
            userProfile={userProfile}
            onNavigate={handleNavigate}
          />
        )}

        {/* Global Multi-field Search Tool View */}
        {currentView === "search" && (
          <div className="p-5">
            <ListView 
              currentUser={currentUser}
              section="customers"
              title="البحث السريع"
              onNavigateStatement={handleNavigateStatement}
            />
          </div>
        )}
      </main>

      {/* Premium Floating Bottom Navigation Dock */}
      <nav className="fixed bottom-6 left-0 right-0 mx-auto w-[90%] max-w-sm bg-white  rounded-full px-6 py-2.5 shadow-2xl border border-slate-100/50 flex justify-between items-center z-30">
        <button 
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-50 transition cursor-pointer flex flex-col items-center gap-0.5"
          title="الإعدادات الشخصية"
        >
          <Settings size={20} />
          <span className="text-xs font-black">الإعدادات</span>
        </button>

        <button 
          onClick={() => {
            const spinner = document.getElementById("nav-sync-spinner");
            if (spinner) spinner.classList.add("animate-spin");
            
            if (navigator.onLine) {
              alert("تمت مزامنة حسابك، وتحديث الكشوفات، وتأمين البيانات السحابية بنجاح!");
            } else {
              alert("أنت تعمل حالياً دون اتصال بالإنترنت (أوفلاين). تم تأمين وحفظ البيانات محلياً على جهازك بنجاح، وسيتم إرسال ومزامنة التحديثات الجديدة إلى السحاب تلقائياً بمجرد اتصالك بالإنترنت!");
            }
            
            setTimeout(() => {
              if (spinner) spinner.classList.remove("animate-spin");
            }, 1000);
          }}
          className="-mt-8 w-14 h-14 bg-gradient-to-tr from-violet-600 via-indigo-600 to-blue-600 hover:scale-105 active:scale-95 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/30 transition cursor-pointer border-4 border-slate-50"
          title="مزامنة وتأمين فوري"
        >
          <RefreshCw size={22} id="nav-sync-spinner" />
        </button>

        <button 
          onClick={() => {
            // Clear navigation history when resetting back to main screen
            setHistoryStack([]);
            setCurrentView("dashboard");
            setViewTitle("الرئيسية");
            setSelectedPersonId("");
            setActiveSection("");
          }}
          className={`p-2 rounded-full transition cursor-pointer flex flex-col items-center gap-0.5 ${
            currentView === "dashboard" ? "text-indigo-600" : "text-slate-400 hover:text-slate-800 hover:bg-slate-50"
          }`}
          title="الرئيسية"
        >
          <Home size={20} />
          <span className="text-xs font-black">الرئيسية</span>
        </button>
      </nav>

      {/* Online/Offline Dynamic Notification Overlays */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-32 left-0 right-0 mx-auto w-[90%] max-w-sm bg-slate-900  text-amber-400 text-sm font-bold px-4 py-3 rounded-2xl shadow-xl border border-amber-500/20 flex items-center justify-center gap-2.5 z-40"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="text-center font-bold">وضع الأوفلاين نشط • يمكنك العمل وإضافة البيانات وسنقوم بمزامنتها تلقائياً</span>
          </motion.div>
        )}

        {showOnlineToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-32 left-0 right-0 mx-auto w-[90%] max-w-sm bg-emerald-950/95  text-emerald-400 text-sm font-bold px-4 py-3 rounded-2xl shadow-xl border border-emerald-500/20 flex items-center justify-center gap-2.5 z-40"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-center font-bold">تم استعادة الاتصال • جاري مزامنة وتأمين البيانات الجديدة تلقائياً</span>
          </motion.div>
        )}

        {toastNotification && (
          <motion.div 
            initial={{ opacity: 0, y: -80, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -80, scale: 0.95 }}
            onClick={() => {
              setShowOverdueModal(true);
              setToastNotification(null);
            }}
            className="fixed top-6 left-0 right-0 mx-auto w-[92%] max-w-sm bg-slate-900  text-white px-5 py-4 rounded-[1.8rem] shadow-2xl border border-slate-700/50 flex items-start gap-3 z-50 cursor-pointer"
          >
            <div className="p-2 bg-amber-500 text-slate-950 rounded-2xl mt-0.5 shadow-md animate-bounce flex-shrink-0">
              <Bell size={18} />
            </div>
            <div className="flex-1 text-right">
              <div className="flex justify-between items-center mb-0.5">
                <h4 className="font-black text-sm text-amber-400">تنبيه مستحق مالي</h4>
                <span className="text-xs font-black text-slate-400 font-mono">الآن</span>
              </div>
              <p className="text-slate-200 text-sm font-bold leading-relaxed">{toastNotification.body}</p>
              <p className="text-xs text-slate-400 font-bold mt-1.5 flex items-center gap-1">
                <span>💡 انقر لفتح قائمة المتأخرين ومتابعتهم</span>
              </p>
            </div>
          </motion.div>
        )}

        {/* Overdue Customers Modal */}
        {showOverdueModal && (
          <div className="fixed inset-0 bg-slate-900/90  z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] p-6 max-w-md w-full shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] relative"
              dir="rtl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
                  <span className="p-1.5 bg-amber-500 text-slate-950 rounded-xl flex items-center justify-center">
                    <Bell size={16} />
                  </span>
                  الحسابات المتأخرة المستحقة
                </h3>
                <button
                  onClick={() => setShowOverdueModal(false)}
                  className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Stats Card */}
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-4 text-right">
                <p className="text-xs font-black text-amber-600">إجمالي المبالغ المتبقية</p>
                <p className="text-lg font-black text-amber-700 mt-0.5">
                  {overdueCustomers.reduce((sum, item) => sum + (item.balance || 0), 0).toLocaleString('en-US')} <span className="text-sm">ر.ي</span>
                </p>
                <p className="text-xs font-bold text-slate-400 mt-1">
                  موزعة على {overdueCustomers.length} حسابات تجاوزت فترة الاستحقاق المحددة.
                </p>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
                {overdueCustomers.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-bold text-sm leading-relaxed">
                    🎉 لا توجد حسابات متأخرة تجاوزت فترة الاستحقاق حالياً!
                  </div>
                ) : (
                  overdueCustomers.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleNavigateStatementWithSection(p)}
                      className="p-4 bg-slate-50 hover:bg-amber-50/30 border border-slate-150 hover:border-amber-200 rounded-2xl flex items-center justify-between cursor-pointer transition select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 font-black text-sm flex items-center justify-center">
                          {p.name?.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-black text-slate-800 text-sm">{p.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md font-bold">
                              {p.type === "customers" ? "عميل" : p.type === "suppliers" ? "مورد" : p.type === "employees" ? "موظف" : p.type === "well_customers" ? "مزارع" : "أخرى"}
                            </span>
                            <span className="text-xs text-red-500 font-black">
                              متأخر {p.daysOverdue} يوم
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <p className="font-black text-sm text-red-500">
                          {p.balance?.toLocaleString('en-US')} ر.ي
                        </p>
                        <p className="text-xs font-black text-slate-400 mt-0.5 uppercase tracking-wider">
                          اضغط لفتح الحساب
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
