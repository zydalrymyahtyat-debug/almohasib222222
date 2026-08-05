import React, { useState, useEffect } from "react";
import { ArrowRight, Wallet, Banknote, ArrowDownToLine, ArrowUpFromLine, RefreshCcw, FileText, Plus, X, Save, DollarSign } from "lucide-react";
import { UserProfile, CashTransaction } from "../types";
import { auth, db } from "../firebase";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc } from "firebase/firestore";

interface Props {
  currentUser?: any;
  onGoBack: () => void;
  userProfile: UserProfile | null;
  onNavigate: (viewId: string, title: string) => void;
}

export default function CashBanksDashboard({ currentUser, onGoBack, userProfile, onNavigate }: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "history">("overview");

  const [transactions, setTransactions] = useState<CashTransaction[]>(() => {
    const cached = localStorage.getItem("cached_cash_transactions");
    if (cached) {
      try {
        const parsed = JSON.parse(decodeURIComponent(escape(atob(cached))));
        return parsed.map((t: any) => ({
          ...t,
          createdAt: t.createdAt ? { toMillis: () => new Date(t.createdAt).getTime(), toDate: () => new Date(t.createdAt) } : null,
          date: t.date ? { toDate: () => new Date(t.date) } : null
        }));
      } catch(e) { return []; }
    }
    return [];
  });

  const [balance, setBalance] = useState(() => {
    const cached = localStorage.getItem("cached_cash_balance");
    return cached ? parseFloat(cached) : 0;
  });

  const [loading, setLoading] = useState(() => {
    return transactions.length === 0;
  });

  // Modals
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptType, setReceiptType] = useState<"in" | "out" | "transfer">("in");
  const [form, setForm] = useState({ amount: "" as string | number, note: "", source: "cash", destination: "bank1" });


  useEffect(() => {
    if (isReceiptModalOpen) {
      (window as any).customBackHandler = () => {
        setIsReceiptModalOpen(false);
      };
    } else {
      delete (window as any).customBackHandler;
    }
    return () => {
      delete (window as any).customBackHandler;
    };
  }, [isReceiptModalOpen]);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    
    const q = query(collection(db, "cash_transactions"), where("userId", "==", currentUser.uid));
    const unsub = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      const txs: CashTransaction[] = [];
      let bal = 0;
      snap.forEach((doc) => {
        const t = { id: doc.id, ...doc.data() } as CashTransaction;
        txs.push(t);
        if (t.type === "in") bal += t.amount;
        if (t.type === "out") bal -= t.amount;
        // transfers don't change global balance, but would change specific bank balances
      });
      txs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setTransactions(txs);
      setBalance(bal);

      try {
        const serialized = txs.map(t => ({
           ...t,
           createdAt: t.createdAt ? t.createdAt.toDate().toISOString() : null,
           date: t.date ? t.date.toDate().toISOString() : null
        }));
        localStorage.setItem("cached_cash_transactions", btoa(unescape(encodeURIComponent(JSON.stringify(serialized)))));
        localStorage.setItem("cached_cash_balance", bal.toString());
      } catch (e) {
        console.error("Cache error", e);
      }

      setLoading(false);
    }, (error) => {
      console.error("Error fetching cash transactions:", error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleSaveReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(form.amount) || 0;
    if (!currentUser || parsedAmount <= 0) return;

    if (receiptType === "out" && parsedAmount > balance) {
      if (!window.confirm("رصيد الصندوق أقل من المبلغ المطلوب. هل تريد الاستمرار بالسالب؟")) {
        return;
      }
    }

    try {
      await addDoc(collection(db, "cash_transactions"), {
        userId: currentUser.uid,
        type: receiptType,
        amount: parsedAmount,
        note: form.note,
        source: form.source,
        destination: receiptType === "transfer" ? form.destination : null,
        createdAt: serverTimestamp()
      });
      setIsReceiptModalOpen(false);
      setForm({ amount: "", note: "", source: "cash", destination: "bank1" });
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حفظ السند.");
    }
  };

  const getSourceLabel = (src: string) => {
    if (src === 'cash') return 'الصندوق الرئيسي (نقد)';
    if (src === 'bank1') return 'حساب البنك / محفظة 1';
    if (src === 'bank2') return 'حساب البنك / محفظة 2';
    return src;
  };

  const renderOverview = () => (
    <>
      <div className="bg-gradient-to-tr from-rose-500 to-pink-600 rounded-2xl p-6 text-white shadow-lg shadow-rose-500/20 mb-6">
          <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/20 rounded-xl ">
                  <Wallet size={24} />
              </div>
              <div>
                  <p className="text-rose-100 text-xs font-bold">إجمالي رصيد الصندوق</p>
                  <h2 className="text-3xl font-black font-mono mt-1">{loading ? "..." : balance.toLocaleString('en-US')} <span className="text-sm">ر.ي</span></h2>
              </div>
          </div>
          <div className="flex gap-2">
              <button 
                onClick={() => { setReceiptType("in"); setIsReceiptModalOpen(true); }}
                className="flex-1 bg-white text-rose-600 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1 hover:bg-rose-50 transition shadow-sm">
                  <ArrowDownToLine size={16} />
                  سند قبض (دخل)
              </button>
              <button 
                onClick={() => { setReceiptType("out"); setIsReceiptModalOpen(true); }}
                className="flex-1 bg-rose-700/50 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1 hover:bg-rose-700/70 transition">
                  <ArrowUpFromLine size={16} />
                  سند صرف (خرج)
              </button>
          </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center cursor-pointer hover:shadow-md transition">
          <Banknote size={24} className="text-emerald-500 mx-auto mb-2" />
          <h3 className="font-extrabold text-sm text-slate-800">حسابات البنوك</h3>
          <p className="text-xs text-slate-400 mt-1">البنوك والمحافظ الإلكترونية</p>
        </div>
        <div 
          onClick={() => { setReceiptType("transfer"); setIsReceiptModalOpen(true); }}
          className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center cursor-pointer hover:shadow-md transition">
          <RefreshCcw size={24} className="text-blue-500 mx-auto mb-2" />
          <h3 className="font-extrabold text-sm text-slate-800">تحويل أموال</h3>
          <p className="text-xs text-slate-400 mt-1">بين الصناديق والبنوك</p>
        </div>
        <div 
          onClick={() => setActiveTab("history")}
          className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center cursor-pointer hover:shadow-md transition col-span-2">
          <FileText size={24} className="text-slate-500 mx-auto mb-2" />
          <h3 className="font-extrabold text-sm text-slate-800">كشف حركة الصندوق</h3>
          <p className="text-xs text-slate-400 mt-1">عرض العمليات اليومية بالتفصيل</p>
        </div>
      </div>
    </>
  );

  const renderHistory = () => (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-slate-800 text-sm">الحركات النقدية</h3>
        </div>
        
        <div className="space-y-3">
          {transactions.map(t => (
            <div key={t.id} className="py-3 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.type === 'in' ? 'bg-emerald-50 text-emerald-500' : t.type === 'out' ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'}`}>
                  {t.type === 'in' ? <ArrowDownToLine size={20} /> : t.type === 'out' ? <ArrowUpFromLine size={20} /> : <RefreshCcw size={20} />}
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm">{t.note || (t.type === 'in' ? 'سند قبض' : t.type === 'out' ? 'سند صرف' : 'تحويل')}</h4>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">
                    {t.createdAt?.toDate?.().toLocaleDateString('ar-YE')} | {t.type === 'transfer' ? `${getSourceLabel(t.source)} -> ${getSourceLabel(t.destination!)}` : getSourceLabel(t.source)}
                  </p>
                </div>
              </div>
              <div className="text-left">
                <span className={`text-sm font-black font-mono block ${t.type === 'in' ? 'text-emerald-500' : t.type === 'out' ? 'text-rose-500' : 'text-blue-500'}`}>
                  {t.type === 'out' ? '-' : '+'}{t.amount.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-slate-400">ر.ي</span>
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <div className="text-center py-10">
                <p className="text-sm font-bold text-slate-400">لا توجد حركات مالية مسجلة.</p>
            </div>
          )}
        </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 pb-36" dir="rtl">
      <header className="px-5 py-4 bg-white shadow-sm flex items-center justify-between sticky top-0 z-10 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button onClick={onGoBack} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition">
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-800">الصندوق والبنوك</h1>
            <p className="text-xs font-bold text-slate-400">إدارة النقد والمحافظ والسندات</p>
          </div>
        </div>
      </header>

      <div className="flex border-b border-slate-200 bg-white mb-4">
        <button onClick={() => setActiveTab("overview")} className={`flex-1 py-3 text-sm font-bold border-b-2 transition ${activeTab === "overview" ? "border-rose-500 text-rose-600" : "border-transparent text-slate-500"}`}>لوحة القيادة</button>
        <button onClick={() => setActiveTab("history")} className={`flex-1 py-3 text-sm font-bold border-b-2 transition ${activeTab === "history" ? "border-rose-500 text-rose-600" : "border-transparent text-slate-500"}`}>سجل الحركات</button>
      </div>

      <div className="p-5 pt-0">
        {loading ? (
          <div className="text-center py-10 text-slate-400 font-bold">جاري التحميل...</div>
        ) : (
          <>
            {activeTab === "overview" && renderOverview()}
            {activeTab === "history" && renderHistory()}
          </>
        )}
      </div>

      {isReceiptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-slate-900/50  p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative">
            <button onClick={() => setIsReceiptModalOpen(false)} className="absolute top-4 left-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full">
              <X size={20} />
            </button>
            <h2 className={`text-xl font-black mb-6 flex items-center gap-2 ${receiptType === 'in' ? 'text-emerald-600' : receiptType === 'out' ? 'text-rose-600' : 'text-blue-600'}`}>
              {receiptType === 'in' ? <ArrowDownToLine /> : receiptType === 'out' ? <ArrowUpFromLine /> : <RefreshCcw />}
              {receiptType === 'in' ? "سند قبض (دخل جديد)" : receiptType === 'out' ? "سند صرف (خرج)" : "تحويل رصيد"}
            </h2>

            <form onSubmit={handleSaveReceipt} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">المبلغ</label>
                <div className="relative">
                  <DollarSign size={18} className="absolute right-4 top-3.5 text-slate-400" />
                  <input type="number" required min="1" value={form.amount || ""} onChange={e => setForm({...form, amount: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-11 pl-4 py-3 text-lg font-black focus:outline-none focus:border-rose-500 text-rose-600 font-mono" placeholder="0" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">الحساب المصدر (من)</label>
                <select value={form.source} onChange={e => setForm({...form, source: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-rose-500">
                  <option value="cash">الصندوق الرئيسي (نقد)</option>
                  <option value="bank1">حساب البنك / محفظة 1</option>
                  <option value="bank2">حساب البنك / محفظة 2</option>
                </select>
              </div>

              {receiptType === "transfer" && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">الحساب الوجهة (إلى)</label>
                  <select value={form.destination} onChange={e => setForm({...form, destination: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-rose-500">
                    <option value="cash">الصندوق الرئيسي (نقد)</option>
                    <option value="bank1">حساب البنك / محفظة 1</option>
                    <option value="bank2">حساب البنك / محفظة 2</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">البيان / التفاصيل</label>
                <input type="text" required value={form.note} onChange={e => setForm({...form, note: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-rose-500" placeholder="مثال: دفعة مبيعات، مصروفات نثرية..." />
              </div>

              <button type="submit" className={`w-full py-4 text-white font-extrabold rounded-xl shadow-md transition flex justify-center items-center gap-2 mt-4 ${receiptType === 'in' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' : receiptType === 'out' ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'}`}>
                <Save size={20} />
                تأكيد العملية
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
