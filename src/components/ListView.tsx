import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Person, Expense, AccountType } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, Plus, X, Trash2, Edit2, DollarSign, Calendar,
  Briefcase, Landmark, Phone, Layers, ShieldAlert, Contact 
} from "lucide-react";
import { Contacts } from "@capacitor-community/contacts";
import { Capacitor } from "@capacitor/core";
import { toEnglishDigits } from "../utils/numberUtils";

interface ListViewProps {
  currentUser?: any;
  section: string; // e.g. "suppliers", "customers", "expenses", "employees", "well_customers", "well_expenses", "well_queue", "qat_fields"
  title: string;
  onNavigateStatement: (id: string, name: string, phone: string, balance: number) => void;
}

export default function ListView({ currentUser, section, title, onNavigateStatement }: ListViewProps) {
  const [search, setSearch] = useState("");

  const cacheKeyPersons = `cached_list_${section}_persons`;
  const cacheKeyExpenses = `cached_list_${section}_expenses`;

  const [persons, setPersons] = useState<Person[]>(() => {
    const cached = localStorage.getItem(cacheKeyPersons);
    if (cached) {
      try {
        const parsed = JSON.parse(decodeURIComponent(escape(atob(cached))));
        return parsed.map((p: any) => ({
          ...p,
          createdAt: p.createdAt ? { toDate: () => new Date(p.createdAt) } : null,
          lastTransactionAt: p.lastTransactionAt ? { toDate: () => new Date(p.lastTransactionAt) } : null
        }));
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const cached = localStorage.getItem(cacheKeyExpenses);
    if (cached) {
      try {
        const parsed = JSON.parse(decodeURIComponent(escape(atob(cached))));
        return parsed.map((e: any) => ({
          ...e,
          date: e.date ? { toDate: () => new Date(e.date) } : null,
          createdAt: e.createdAt ? { toDate: () => new Date(e.createdAt) } : null
        }));
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [loading, setLoading] = useState(() => {
    return persons.length === 0 && expenses.length === 0;
  });
  const [loadedSections, setLoadedSections] = useState<Set<string>>(new Set());

  // Modal State
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  // Person Form state
  const [pName, setPName] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pGender, setPGender] = useState<"male" | "female">("male");
  const [pCompany, setPCompany] = useState("");
  const [pSalary, setPSalary] = useState("");
  const [pRegion, setPRegion] = useState("");
  const [pFieldsCount, setPFieldsCount] = useState("");



  // Expense Form state
  const [expCategory, setExpCategory] = useState("بقالة");
  const [expAmount, setExpAmount] = useState("");
  const [expNote, setExpNote] = useState("");

  const isExpenseSection = section === "expenses" || section === "well_expenses";

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);

    let unsubscribe: () => void;

    if (isExpenseSection) {
      // Fetch Expenses
      const q = query(
        collection(db, "expenses"),
        where("userId", "==", currentUser.uid),
        where("section", "==", section)
      );

      unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
        const loadedExpenses: Expense[] = [];
        snap.forEach((d) => {
          loadedExpenses.push({ id: d.id, ...d.data() } as Expense);
        });
        // Sort descending by creation date
        loadedExpenses.sort((a, b) => {
          const tA = a.createdAt?.toDate().getTime() || 0;
          const tB = b.createdAt?.toDate().getTime() || 0;
          return tB - tA;
        });
        setExpenses(loadedExpenses);

        // Cache expenses
        try {
          const serialized = loadedExpenses.map(e => ({
            ...e,
            date: e.date ? e.date.toDate().toISOString() : null,
            createdAt: e.createdAt ? e.createdAt.toDate().toISOString() : null
          }));
          localStorage.setItem(cacheKeyExpenses, btoa(unescape(encodeURIComponent(JSON.stringify(serialized)))));
        } catch (err) {
          console.error("Cache error", err);
        }

        setLoading(false);
        setLoadedSections(prev => new Set(prev).add(section));
      });
    } else {
      // Fetch Persons (Standard ledger categories, including well_queue)
      const q = query(
        collection(db, "persons"),
        where("userId", "==", currentUser.uid),
        where("type", "==", section)
      );

      unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
        const loadedPersons: Person[] = [];
        snap.forEach((d) => {
          loadedPersons.push({ id: d.id, ...d.data() } as Person);
        });
        
        // Sort alphabetically or by creation
        loadedPersons.sort((a, b) => a.name.localeCompare(b.name, "ar"));
        setPersons(loadedPersons);

        // Cache persons
        try {
          const serialized = loadedPersons.map(p => ({
            ...p,
            createdAt: p.createdAt ? p.createdAt.toDate().toISOString() : null,
            lastTransactionAt: p.lastTransactionAt ? p.lastTransactionAt.toDate().toISOString() : null
          }));
          localStorage.setItem(cacheKeyPersons, btoa(unescape(encodeURIComponent(JSON.stringify(serialized)))));
        } catch (err) {
          console.error("Cache error", err);
        }

        setLoading(false);
        setLoadedSections(prev => new Set(prev).add(section));
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [section, currentUser]);

  // Calculate Daily Expense Total
  const getTodayExpensesTotal = () => {
    const todayStr = new Date().toDateString();
    return expenses
      .filter((exp) => exp.createdAt?.toDate().toDateString() === todayStr)
      .reduce((sum, curr) => sum + (curr.amount || 0), 0);
  };

  const handleOpenAdd = () => {
    setEditId("");
    setPName("");
    setPPhone("");
    setPGender("male");
    setPCompany("");
    setPSalary("");
    setPRegion("");
    setPFieldsCount("");
    
    setExpCategory("بقالة");
    setExpAmount("");
    setExpNote("");
    setIsOpen(true);
  };

  const handleOpenEditExpense = (exp: Expense) => {
    setEditId(exp.id);
    setExpCategory(exp.category);
    setExpAmount(String(exp.amount));
    setExpNote(exp.note);
    setIsOpen(true);
  };

  const handleOpenEditPerson = (e: React.MouseEvent, p: Person) => {
    e.stopPropagation(); // Prevent navigation to statement view
    setEditId(p.id);
    setPName(p.name);
    setPPhone(p.phone || "");
    setPGender(p.gender || "male");
    setPCompany(p.company || "");
    setPSalary(p.salary ? String(p.salary) : "");
    setPRegion(p.region || "");
    setPFieldsCount(p.fieldsCount || "");
    setIsOpen(true);
  };

  const handleSelectContact = async () => {
    // Set flag to ignore app lock when opening external picker activity
    localStorage.setItem("ignore_app_lock", "true");
    
    // Clear flag after a short timeout in case the app didn't go to background
    const clearLockIgnore = setTimeout(() => {
      localStorage.removeItem("ignore_app_lock");
    }, 3000);

    // 0. If running on Android with our custom AndroidContacts interface bridge, use it!
    if ((window as any).AndroidContacts && typeof (window as any).AndroidContacts.pickContact === "function") {
      (window as any).onAndroidContactSelected = (name: string, phone: string) => {
        localStorage.removeItem("ignore_app_lock");
        clearTimeout(clearLockIgnore);
        if (name === "ERROR") {
          alert("⚠️ حدث خطأ أثناء جلب جهة الاتصال: " + phone);
        } else if (name === "CANCELLED") {
          // User cancelled selection
        } else {
          let cleanedPhone = phone || "";
          if (cleanedPhone) {
            cleanedPhone = cleanedPhone.replace(/[\s-()]/g, "");
            if (cleanedPhone.startsWith("00")) {
              cleanedPhone = "+" + cleanedPhone.substring(2);
            }
          }
          if (name) setPName(name);
          if (cleanedPhone) setPPhone(cleanedPhone);
        }
      };
      try {
        (window as any).AndroidContacts.pickContact();
      } catch (err: any) {
        console.error("AndroidContacts interface call failed:", err);
        localStorage.removeItem("ignore_app_lock");
        clearTimeout(clearLockIgnore);
      }
      return;
    }

    // 1. If running as a Native App (Capacitor), prioritize the native system contacts picker immediately!
    if (Capacitor.isNativePlatform()) {
      try {
        let permStatus = await Contacts.checkPermissions();
        if (permStatus.contacts !== 'granted') {
          permStatus = await Contacts.requestPermissions();
        }
        
        if (permStatus.contacts === 'granted') {
          const result = await Contacts.pickContact({
            projection: { name: true, phones: true }
          });
          if (result && result.contact) {
            const c = result.contact;
            const name = c.name?.display || (c.name ? `${c.name.given || ""} ${c.name.family || ""}`.trim() : "") || "بدون اسم";
            
            let phone = "";
            if (c.phones && Array.isArray(c.phones) && c.phones.length > 0) {
              phone = c.phones[0].number || "";
            }
            
            if (phone) {
              phone = phone.replace(/[\s-()]/g, "");
              if (phone.startsWith("00")) {
                phone = "+" + phone.substring(2);
              }
            }
            
            if (name) setPName(name);
            if (phone) setPPhone(phone);
          }
        } else {
          alert("⚠️ يرجى منح صلاحية الوصول لجهات الاتصال من إعدادات التطبيق.");
        }
      } catch (nativeErr: any) {
        console.error("Native Contact Picker Error:", nativeErr);
        alert("⚠️ تعذر فتح جهات الاتصال: " + (nativeErr.message || JSON.stringify(nativeErr)));
      } finally {
        localStorage.removeItem("ignore_app_lock");
        clearTimeout(clearLockIgnore);
      }
      return; // Do NOT fall back to Web API if we are in a Native app!
    }

    // For web, we don't need app lock ignore as web apps aren't native-locked on appStateChange
    localStorage.removeItem("ignore_app_lock");
    clearTimeout(clearLockIgnore);

    // 2. Try standard Web Contact Picker API if available (supports Chrome on Android & Safari on iOS in HTTPS)
    if ("contacts" in navigator && (navigator as any).contacts?.select) {
      try {
        const options = { multiple: false };
        const selected = await (navigator as any).contacts.select(["name", "tel"], options);
        
        if (selected && selected.length > 0) {
          const contact = selected[0];
          
          // Highly robust name and phone parsing supporting both arrays and raw strings
          let name = "";
          if (contact.name) {
            if (Array.isArray(contact.name)) {
              name = contact.name[0] || "";
            } else if (typeof contact.name === "string") {
              name = contact.name;
            }
          }
          if (!name) name = "بدون اسم";

          let phone = "";
          if (contact.tel) {
            if (Array.isArray(contact.tel)) {
              phone = contact.tel[0] || "";
            } else if (typeof contact.tel === "string") {
              phone = contact.tel;
            }
          }
          
          if (phone) {
            phone = phone.replace(/[\s-()]/g, "");
            if (phone.startsWith("00")) {
              phone = "+" + phone.substring(2);
            }
          }
          
          if (name) setPName(name);
          if (phone) setPPhone(phone);
          return; // Web Contact Picker success!
        }
      } catch (webErr: any) {
        console.log("Web Contact Picker failed or was canceled:", webErr);
        
        // Handle iframe restrictions and permission blocks gracefully with direct alerts
        if (window.self !== window.top) {
          alert("⚠️ تمنع بيئة المعاينة فتح جهات الاتصال مباشرة. يرجى فتح التطبيق في علامة تبويب جديدة (New Tab)!");
        } else if (webErr && (webErr.name === "SecurityError" || webErr.name === "NotAllowedError")) {
          alert("⚠️ تم رفض أو حظر الوصول لجهات الاتصال. يرجى التأكد من تفعيل الإذن.");
        } else if (webErr && webErr.message && webErr.message.includes("Unable to open a contact selector")) {
          alert("⚠️ يبدو أنك تستخدم التطبيق كـ (APK) مبني عبر أداة تحويل المواقع (WebView). هذا النوع من التطبيقات يمنعه نظام أندرويد من الوصول لجهات الاتصال.\n\n💡 لتعمل الميزة، يجب برمجة التطبيق أصلياً (Native) أو إدخال البيانات يدوياً في الوقت الحالي.");
        } else if (webErr && webErr.name !== "AbortError") {
          alert("عذراً، تعذر فتح جهات الاتصال: " + (webErr.message || webErr));
        }
      }
    } else {
      // If the browser doesn't support the API at all
      if (window.self !== window.top) {
        alert("⚠️ يرجى فتح التطبيق في علامة تبويب جديدة (New Tab) لتتمكن من استخدام ميزة جلب جهات الاتصال بنجاح.");
      } else {
        alert("⚠️ متصفحك الحالي لا يدعم ميزة اختيار جهات الاتصال مباشرة. يرجى كتابة البيانات يدوياً، أو استخدام متصفح Google Chrome على الأندرويد أو Safari على الآيفون.");
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (isSaving) return;

    setIsSaving(true);
    try {
      if (isExpenseSection) {
        const amt = Number(expAmount);
        if (!amt || amt <= 0) {
          alert("الرجاء إدخال مبلغ صحيح");
          setIsSaving(false);
          return;
        }

        const expData = {
          userId: currentUser.uid,
          category: expCategory,
          amount: amt,
          note: expNote.trim(),
          section: section as "expenses" | "well_expenses",
          updatedAt: new Date()
        };

        if (editId) {
          updateDoc(doc(db, "expenses", editId), expData).catch(err => console.error(err));
        } else {
          addDoc(collection(db, "expenses"), {
            ...expData,
            createdAt: new Date()
          }).catch(err => console.error(err));
        }
      } else {
        if (!pName.trim()) {
          alert("الاسم الكامل مطلوب");
          setIsSaving(false);
          return;
        }

        const personData: any = {
          name: pName.trim(),
          phone: pPhone.trim(),
          gender: pGender,
          region: pRegion.trim(),
          fieldsCount: pFieldsCount.trim()
        };

        if (section === "suppliers") {
          personData.company = pCompany.trim();
        }
        if (section === "employees") {
          personData.salary = Number(pSalary) || 0;
        }

        if (editId) {
          updateDoc(doc(db, "persons", editId), personData).catch(err => console.error(err));
        } else {
          // New creation
          addDoc(collection(db, "persons"), {
            ...personData,
            userId: currentUser.uid,
            type: section as AccountType,
            balance: 0,
            createdAt: new Date()
          }).catch(err => console.error(err));
        }
      }

      setIsOpen(false);
    } catch (err) {
      console.error("Error saving data:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (confirm("هل تريد حذف هذه الصرفية نهائياً؟")) {
      try {
        await deleteDoc(doc(db, "expenses", id));
      } catch (err) {
        console.error("Error deleting expense:", err);
      }
    }
  };

  // Filters
  const filteredPersons = persons.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search)
  );

  const filteredExpenses = expenses.filter((e) =>
    e.category.toLowerCase().includes(search.toLowerCase()) ||
    e.note.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pt-4 pb-36 px-4 text-slate-800" dir="rtl">
      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder={isExpenseSection ? "بحث في الصرفيات..." : "بحث بالاسم أو رقم الهاتف..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-4 pr-12 py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 font-bold focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none shadow-sm transition"
        />
      </div>

      {/* Daily Expenses Stats */}
      {isExpenseSection && expenses.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-red-100 shadow-sm mb-6 flex flex-col items-center">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mb-1">
            <Calendar size={14} className="text-red-500" />
            إجمالي الصرفيات (اليوم)
          </span>
          <span className="text-2xl font-black text-red-500 font-mono">
            {getTodayExpensesTotal().toLocaleString('en-US')}
          </span>
          <span className="text-xs text-slate-400 font-bold mt-1">ر.ي</span>
        </div>
      )}

      {/* List Container */}
      <div className="flex-1 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-bold gap-3">
            <span className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
            <span>جاري تحميل البيانات...</span>
          </div>
        ) : isExpenseSection ? (
          filteredExpenses.length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-bold">لا توجد صرفيات مسجلة.</div>
          ) : (
            filteredExpenses.map((exp) => (
              <motion.div
                key={exp.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex justify-between items-center"
              >
                <div>
                  <h4 className="font-extrabold text-slate-800">{exp.category}</h4>
                  <p className="text-xs text-slate-400 font-bold mt-1">
                    {exp.note ? `${exp.note} | ` : ""}
                    {exp.createdAt?.toDate().toLocaleDateString("ar-EG")}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-base font-black text-red-500 font-mono" dir="ltr">
                    -{exp.amount.toLocaleString('en-US')}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenEditExpense(exp)}
                      className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteExpense(exp.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )
        ) : (
          filteredPersons.length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-bold">لا توجد حسابات مسجلة.</div>
          ) : (
            filteredPersons.map((p) => {
              const absBal = Math.abs(p.balance);
              const color = p.balance > 0 ? "text-red-500" : p.balance < 0 ? "text-emerald-600" : "text-slate-500";
              const balanceLabel = p.balance > 0 ? `عليه: ${absBal.toLocaleString('en-US')}` : p.balance < 0 ? `له: ${absBal.toLocaleString('en-US')}` : "مصفر";

              let subDetails = p.phone || "بدون هاتف";
              if (section === "well_customers" || section === "qat_fields") {
                const parts = [];
                if (p.region) parts.push(p.region);
                if (p.fieldsCount) parts.push(`${p.fieldsCount} جرب`);
                if (p.phone) parts.push(p.phone);
                subDetails = parts.join(" | ") || "بدون تفاصيل";
              }

              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => onNavigateStatement(p.id, p.name, p.phone, p.balance)}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex justify-between items-center cursor-pointer hover:border-indigo-100 transition active:scale-[0.99]"
                >
                  <div className="flex-1 min-w-0 pr-1">
                    <h4 className="font-extrabold text-slate-800 text-sm md:text-base truncate">{p.name}</h4>
                    <p className="text-xs text-slate-400 font-bold mt-1.5 truncate">{subDetails}</p>
                  </div>
                  <div className="flex items-center gap-3.5">
                    <div className="text-left">
                      <span className={`text-sm md:text-base font-black font-mono ${color}`}>
                        {balanceLabel}
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold block mt-0.5">ر.ي</span>
                    </div>
                    <button
                      onClick={(e) => handleOpenEditPerson(e, p)}
                      className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-xl transition cursor-pointer flex items-center justify-center border border-transparent hover:border-indigo-100"
                      title="تعديل الاسم والبيانات"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )
        )}
      </div>

      {/* FAB Add Button */}
      <button
        onClick={handleOpenAdd}
        className="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-tr from-violet-600 to-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/30 hover:scale-105 active:scale-95 transition cursor-pointer z-20"
      >
        <Plus size={28} />
      </button>

      {/* Creation/Edit Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 bg-slate-900/90  z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl overflow-y-auto max-h-[85vh] border border-slate-100"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-slate-800">
                  {editId ? "تعديل السجل" : isExpenseSection ? "إضافة صرفية جديدة" : "إضافة حساب جديد"}
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                {isExpenseSection ? (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">الفئة</label>
                      <div className="relative">
                        <Landmark className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <select
                          value={expCategory}
                          onChange={(e) => setExpCategory(e.target.value)}
                          className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition cursor-pointer appearance-none"
                        >
                          <option value="بقالة">بقالة</option>
                          <option value="بترول/ديزل">بترول / ديزل</option>
                          <option value="صيانة بئر">صيانة البئر</option>
                          <option value="أجور عمال">أجور عمال</option>
                          <option value="أخرى">أخرى</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">المبلغ (ر.ي)</label>
                      <div className="relative">
                        <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="number"
                          placeholder="المبلغ بالأرقام..."
                          value={expAmount}
                          onChange={(e) => setExpAmount(toEnglishDigits(e.target.value))}
                          className={`w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition font-mono ${expAmount ? "text-left" : "text-right"}`}
                          dir={expAmount ? "ltr" : "rtl"}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">التفاصيل والبيان</label>
                      <textarea
                        placeholder="اكتب ملاحظات الصرفية هنا..."
                        value={expNote}
                        onChange={(e) => setExpNote(e.target.value)}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition min-h-[80px]"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">الاسم الكامل</label>
                      <div className="relative">
                        <Landmark className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="text"
                          placeholder={section === "qat_fields" ? "اسم الرعوي / الجربة..." : "الاسم الثنائي أو الثلاثي..."}
                          value={pName}
                          onChange={(e) => setPName(e.target.value)}
                          className="w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">رقم الهاتف</label>
                      <div className="relative">
                        <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="tel"
                          placeholder="رقم الهاتف (اختياري)..."
                          value={pPhone}
                          onChange={(e) => setPPhone(toEnglishDigits(e.target.value))}
                          className={`w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition ${pPhone ? "text-left" : "text-right"}`}
                          dir={pPhone ? "ltr" : "rtl"}
                        />
                        <button
                          type="button"
                          onClick={handleSelectContact}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 rounded-xl transition cursor-pointer flex items-center justify-center"
                          title="استيراد من جهات الاتصال"
                        >
                          <Contact size={18} />
                        </button>
                      </div>
                    </div>

                    {section === "customers" && (
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">النوع / الجنس</label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="gender"
                              value="male"
                              checked={pGender === "male"}
                              onChange={(e) => setPGender(e.target.value as "male" | "female")}
                              className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-bold text-slate-700">ذكر (السيد)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="gender"
                              value="female"
                              checked={pGender === "female"}
                              onChange={(e) => setPGender(e.target.value as "male" | "female")}
                              className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-bold text-slate-700">أنثى (السيدة)</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {section === "suppliers" && (
                      <div>
                        <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">الشركة أو البضاعة الموردة</label>
                        <div className="relative">
                          <Briefcase className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="مثال: قطع غيار، بذور، بترول..."
                            value={pCompany}
                            onChange={(e) => setPCompany(e.target.value)}
                            className="w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                          />
                        </div>
                      </div>
                    )}

                    {section === "employees" && (
                      <div>
                        <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">الراتب الأساسي الشهري (ر.ي)</label>
                        <div className="relative">
                          <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                          <input
                            type="number"
                            placeholder="الراتب المتفق عليه..."
                            value={pSalary}
                            onChange={(e) => setPSalary(toEnglishDigits(e.target.value))}
                            className={`w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition font-mono ${pSalary ? "text-left" : "text-right"}`}
                            dir={pSalary ? "ltr" : "rtl"}
                          />
                        </div>
                      </div>
                    )}

                    {(section === "well_customers" || section === "qat_fields") && (
                      <>
                        <div>
                          <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">المنطقة / العزلة</label>
                          <div className="relative">
                            <Landmark className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                              type="text"
                              placeholder="مثال: وادي بني علي، القفر..."
                              value={pRegion}
                              onChange={(e) => setPRegion(e.target.value)}
                              className="w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">عدد الجرب (المقاطع)</label>
                          <div className="relative">
                            <Layers className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                              type="number"
                              placeholder="عدد قطع الأراضي..."
                              value={pFieldsCount}
                              onChange={(e) => setPFieldsCount(e.target.value)}
                              className={`w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition font-mono ${pFieldsCount ? "text-left" : "text-right"}`}
                              dir={pFieldsCount ? "ltr" : "rtl"}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className={`flex-2 py-3.5 px-4 bg-gradient-to-tr from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold rounded-2xl transition cursor-pointer shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-2 ${isSaving ? "opacity-70 cursor-not-allowed" : ""}`}
                  >
                    {isSaving ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        جاري الحفظ...
                      </>
                    ) : (
                      "حفظ"
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setIsOpen(false)}
                    className="flex-1 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-2xl transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
