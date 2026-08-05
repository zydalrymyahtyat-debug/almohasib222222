import React, { useState, useEffect } from "react";
import { ArrowRight, BarChart2, PieChart, LineChart, FileText, Briefcase, Truck, Users, Activity, TrendingDown, Printer } from "lucide-react";
import { UserProfile, Person, Expense, Transaction, InventoryItem, InventoryMovement, CashTransaction } from "../types";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

interface Props {
  currentUser?: any;
  onGoBack: () => void;
  userProfile: UserProfile | null;
  onNavigate: (viewId: string, title?: string, reportType?: string) => void;
}

export default function ReportsDashboard({ currentUser, onGoBack, userProfile, onNavigate }: Props) {
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const reportsList = [
    { id: "profit_loss", title: "الأرباح والخسائر", sub: "بيان الدخل الصافي", icon: LineChart, color: "text-emerald-500 bg-emerald-50" },
    { id: "balance_sheet", title: "الميزانية العمومية", sub: "الأصول والخصوم", icon: PieChart, color: "text-blue-500 bg-blue-50" },
    { id: "customers_statement", title: "كشف حساب العملاء", sub: "حركات ديون الزبائن", icon: Users, color: "text-indigo-500 bg-indigo-50", nav: "reports", type: "customers" },
    { id: "suppliers_statement", title: "كشف الموردين", sub: "حركات حسابات الموردين", icon: Truck, color: "text-amber-500 bg-amber-50", nav: "reports", type: "suppliers" },
    { id: "expenses_report", title: "تقرير المصروفات", sub: "تفصيل النفقات", icon: TrendingDown, color: "text-rose-500 bg-rose-50" },
    { id: "overdue_debts", title: "الديون المستحقة", sub: "المتأخرات على العملاء", icon: FileText, color: "text-red-500 bg-red-50" },
  ];

  const fetchProfitLoss = async () => {
    setLoading(true);
    let totalRevenue = 0;
    let totalExpenses = 0;

    const txsQ = query(collection(db, "transactions"), where("userId", "==", currentUser!.uid));
    const txsSnap = await getDocs(txsQ);
    txsSnap.forEach(doc => {
      const t = doc.data();
      if (t.type === "qat_sale" || t.type === "well_watering") totalRevenue += t.amount;
      if (t.type === "qat_expense" || t.type === "salary") totalExpenses += t.amount;
    });

    const expQ = query(collection(db, "expenses"), where("userId", "==", currentUser!.uid));
    const expSnap = await getDocs(expQ);
    expSnap.forEach(doc => {
      totalExpenses += doc.data().amount;
    });

    setData({ revenue: totalRevenue, expenses: totalExpenses, net: totalRevenue - totalExpenses });
    setLoading(false);
  };

  const fetchBalanceSheet = async () => {
    setLoading(true);
    let cashBalance = 0;
    let inventoryValue = 0;
    let receivables = 0; // لك (Assets)
    let payables = 0; // عليك (Liabilities)

    // Cash
    const cashQ = query(collection(db, "cash_transactions"), where("userId", "==", currentUser!.uid));
    const cashSnap = await getDocs(cashQ);
    cashSnap.forEach(doc => {
      const t = doc.data();
      if (t.type === "in") cashBalance += t.amount;
      if (t.type === "out") cashBalance -= t.amount;
    });

    // Inventory
    const invQ = query(collection(db, "inventory_items"), where("userId", "==", currentUser!.uid));
    const invSnap = await getDocs(invQ);
    invSnap.forEach(doc => {
      const t = doc.data();
      inventoryValue += (t.cost || 0) * (t.quantity || 0);
    });

    // Persons (Receivables / Payables)
    const pQ = query(collection(db, "persons"), where("userId", "==", currentUser!.uid));
    const pSnap = await getDocs(pQ);
    pSnap.forEach(doc => {
      const p = doc.data();
      if (p.balance > 0) receivables += p.balance;
      if (p.balance < 0) payables += Math.abs(p.balance);
    });

    const totalAssets = cashBalance + inventoryValue + receivables;
    const totalLiabilities = payables;
    const equity = totalAssets - totalLiabilities;

    setData({ cashBalance, inventoryValue, receivables, payables, totalAssets, totalLiabilities, equity });
    setLoading(false);
  };

  const fetchExpensesReport = async () => {
    setLoading(true);
    const expQ = query(collection(db, "expenses"), where("userId", "==", currentUser!.uid));
    const expSnap = await getDocs(expQ);
    const exps: any[] = [];
    let total = 0;
    expSnap.forEach(doc => {
      const e = doc.data();
      exps.push(e);
      total += e.amount;
    });
    setData({ list: exps, total });
    setLoading(false);
  };

  const fetchOverdueDebts = async () => {
    setLoading(true);
    const pQ = query(collection(db, "persons"), where("userId", "==", currentUser!.uid));
    const pSnap = await getDocs(pQ);
    const overdue: any[] = [];
    let total = 0;
    pSnap.forEach(doc => {
      const p = doc.data();
      if (p.balance > 0) { // Has debt
        const diffDays = Math.floor((new Date().getTime() - (p.createdAt?.toMillis() || Date.now())) / (1000 * 3600 * 24));
        if (diffDays >= 15) { // Or some threshold
          overdue.push({...p, daysOverdue: diffDays});
          total += p.balance;
        }
      }
    });
    setData({ list: overdue.sort((a,b) => b.balance - a.balance), total });
    setLoading(false);
  };

  const handleReportClick = (report: any) => {
    if (report.nav) {
      onNavigate(report.nav, report.title, report.type);
    } else {
      setActiveReport(report.id);
      if (report.id === "profit_loss") fetchProfitLoss();
      if (report.id === "balance_sheet") fetchBalanceSheet();
      if (report.id === "expenses_report") fetchExpensesReport();
      if (report.id === "overdue_debts") fetchOverdueDebts();
    }
  };

  const renderActiveReport = () => {
    if (loading) return <div className="text-center py-10 font-bold text-slate-400">جاري معالجة التقرير...</div>;
    if (!data) return null;

    if (activeReport === "profit_loss") {
      return (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="font-black text-slate-800 text-lg mb-6 flex items-center gap-2">
            <LineChart className="text-emerald-500" />
            الأرباح والخسائر
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-slate-50">
              <span className="font-bold text-slate-500">إجمالي الإيرادات (المبيعات)</span>
              <span className="font-black text-emerald-600 font-mono">{data.revenue.toLocaleString()} ر.ي</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-slate-50">
              <span className="font-bold text-slate-500">إجمالي المصروفات والتكاليف</span>
              <span className="font-black text-rose-500 font-mono">{data.expenses.toLocaleString()} ر.ي</span>
            </div>
            <div className="flex justify-between items-center py-4 mt-2 bg-slate-50 rounded-xl px-4 border border-slate-100">
              <span className="font-black text-slate-800">صافي الربح / الخسارة</span>
              <span className={`font-black text-lg font-mono ${data.net >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                {data.net.toLocaleString()} ر.ي
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (activeReport === "balance_sheet") {
      return (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="font-black text-slate-800 text-lg mb-6 flex items-center gap-2">
            <PieChart className="text-blue-500" />
            الميزانية العمومية
          </h3>
          
          <h4 className="font-extrabold text-blue-600 text-sm mb-3">الأصول (الممتلكات لك)</h4>
          <div className="space-y-3 mb-6 pl-4 border-r-2 border-blue-100">
            <div className="flex justify-between text-sm">
              <span className="font-bold text-slate-500">السيولة النقدية (الصندوق)</span>
              <span className="font-black font-mono">{data.cashBalance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-bold text-slate-500">قيمة المخزون (بالتكلفة)</span>
              <span className="font-black font-mono">{data.inventoryValue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-bold text-slate-500">ديون لدى العملاء</span>
              <span className="font-black font-mono">{data.receivables.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-t border-slate-100">
              <span className="font-extrabold text-slate-800">إجمالي الأصول</span>
              <span className="font-black text-blue-600 font-mono">{data.totalAssets.toLocaleString()}</span>
            </div>
          </div>

          <h4 className="font-extrabold text-rose-600 text-sm mb-3">الخصوم (الالتزامات عليك)</h4>
          <div className="space-y-3 mb-6 pl-4 border-r-2 border-rose-100">
            <div className="flex justify-between text-sm">
              <span className="font-bold text-slate-500">ديون للموردين والغير</span>
              <span className="font-black font-mono">{data.payables.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-t border-slate-100">
              <span className="font-extrabold text-slate-800">إجمالي الخصوم</span>
              <span className="font-black text-rose-600 font-mono">{data.totalLiabilities.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex justify-between items-center py-4 mt-2 bg-indigo-50 rounded-xl px-4 border border-indigo-100">
            <span className="font-black text-indigo-900">حقوق الملكية (رأس المال الصافي)</span>
            <span className={`font-black text-lg font-mono ${data.equity >= 0 ? 'text-indigo-600' : 'text-rose-500'}`}>
              {data.equity.toLocaleString()} ر.ي
            </span>
          </div>
        </div>
      );
    }

    if (activeReport === "expenses_report") {
      return (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="font-black text-slate-800 text-lg mb-4 flex items-center gap-2">
            <TrendingDown className="text-rose-500" />
            تقرير المصروفات
          </h3>
          <div className="flex justify-between items-center py-4 mb-4 bg-rose-50 rounded-xl px-4 border border-rose-100">
            <span className="font-black text-rose-900">إجمالي المصروفات</span>
            <span className="font-black text-lg font-mono text-rose-600">
              {data.total.toLocaleString()} ر.ي
            </span>
          </div>
          <div className="space-y-3">
            {data.list.map((exp: any, i: number) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50 text-sm">
                <div>
                  <span className="font-bold text-slate-800 block">{exp.category || "عام"}</span>
                  <span className="text-xs text-slate-400">{exp.note || "-"}</span>
                </div>
                <span className="font-black text-rose-500 font-mono">{exp.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeReport === "overdue_debts") {
      return (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="font-black text-slate-800 text-lg mb-4 flex items-center gap-2">
            <FileText className="text-red-500" />
            الديون المستحقة
          </h3>
          <div className="flex justify-between items-center py-4 mb-4 bg-red-50 rounded-xl px-4 border border-red-100">
            <span className="font-black text-red-900">إجمالي الديون المتأخرة</span>
            <span className="font-black text-lg font-mono text-red-600">
              {data.total.toLocaleString()} ر.ي
            </span>
          </div>
          <div className="space-y-3">
            {data.list.map((p: any, i: number) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50 text-sm">
                <div>
                  <span className="font-bold text-slate-800 block">{p.name}</span>
                  <span className="text-xs text-red-500 font-bold">متأخر {p.daysOverdue} يوم</span>
                </div>
                <span className="font-black text-red-600 font-mono">{p.balance.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 pb-36" dir="rtl">
      <header className="px-5 py-4 bg-white shadow-sm flex items-center justify-between sticky top-0 z-10 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              if (activeReport) setActiveReport(null);
              else onGoBack();
            }} 
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition">
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-800">{activeReport ? "تفاصيل التقرير" : "التقارير المالية"}</h1>
            <p className="text-xs font-bold text-slate-400">إحصائيات وقوائم محاسبية</p>
          </div>
        </div>
      </header>

      <div className="p-5">
        {!activeReport ? (
          <div className="grid grid-cols-2 gap-3">
            {reportsList.map((report) => {
              const Icon = report.icon;
              return (
                <div 
                  key={report.id}
                  onClick={() => handleReportClick(report)}
                  className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition flex flex-col items-start relative overflow-hidden"
                >
                  <div className={`p-2.5 rounded-xl mb-3 ${report.color}`}>
                    <Icon size={20} />
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-800">{report.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 font-bold">{report.sub}</p>
                </div>
              );
            })}
          </div>
        ) : (
          renderActiveReport()
        )}
      </div>
    </div>
  );
}
