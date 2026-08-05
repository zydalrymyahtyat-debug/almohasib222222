import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Person, AccountType, UserProfile, Transaction } from "../types";
import { motion } from "motion/react";
import { BookOpen, Printer, RefreshCw, Calendar as CalendarIcon, Filter } from "lucide-react";

interface ReportsViewProps {
  currentUser?: any;
  initialType?: string;
  userProfile?: UserProfile | null;
}

interface ReportRow {
  person: Person;
  startBalance: number;
  totalGiven: number; // عليه (Sales, loans, etc)
  totalPaid: number;  // له (Payments, etc)
  endBalance: number;
  wellName?: string;
}

export default function ReportsView({ currentUser, initialType = "customers", userProfile }: ReportsViewProps) {
  const [activeTab, setActiveTab] = useState<AccountType>(initialType as AccountType);
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Date filtering state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [useDateFilter, setUseDateFilter] = useState(false);

  const getMillis = (val: any): number => {
    if (!val) return 0;
    try {
      if (typeof val.toMillis === "function") {
        const m = val.toMillis();
        return isNaN(m) ? 0 : m;
      }
      if (typeof val.toDate === "function") {
        const m = val.toDate().getTime();
        return isNaN(m) ? 0 : m;
      }
      if (val instanceof Date) {
        const m = val.getTime();
        return isNaN(m) ? 0 : m;
      }
      if (typeof val === "string") {
        const m = new Date(val).getTime();
        return isNaN(m) ? 0 : m;
      }
      if (typeof val === "number") {
        return isNaN(val) ? 0 : val;
      }
      if (typeof val.seconds === "number") {
        const m = val.seconds * 1000;
        return isNaN(m) ? 0 : m;
      }
    } catch (e) {
      console.error("Error parsing date in getMillis:", e);
    }
    return 0;
  };

  const tabs: { id: AccountType; label: string }[] = [
    { id: "customers", label: "العملاء" },
    { id: "suppliers", label: "الموردين" },
    { id: "employees", label: "الموظفين" },
    { id: "well_customers", label: "الآبار" },
    { id: "qat_fields", label: "المقاوتة" }
  ];

  const fetchReport = async () => {
    if (!currentUser) return;
    setLoading(true);

    try {
      // 1. Fetch all persons in this section
      const qPersons = query(
        collection(db, "persons"),
        where("userId", "==", currentUser.uid),
        where("type", "==", activeTab)
      );
      const snapPersons = await getDocs(qPersons);
      const persons: Person[] = [];
      snapPersons.forEach((doc) => {
        persons.push({ id: doc.id, ...doc.data() } as Person);
      });

      // 1.5 Fetch wells to map wellId to wellName for well_customers
      const wellsMap: Record<string, string> = {};
      if (activeTab === "well_customers") {
        const qWells = query(collection(db, "wells"), where("userId", "==", currentUser.uid));
        const snapWells = await getDocs(qWells);
        snapWells.forEach((wDoc) => {
          wellsMap[wDoc.id] = wDoc.data().name || "بئر غير معروف";
        });

        // Ensure default well exists in map (if any legacy data exists)
        if (!wellsMap["default_well"]) wellsMap["default_well"] = "البئر الرئيسي (سابق)";
      }

      // If no date filter, we just use their current balance as the "endBalance"
      // and zeros for the rest, because historical breakdown requires transactions.
      if (!useDateFilter || !startDate || !endDate) {
        const rows = persons.map(p => ({
          person: p,
          startBalance: 0,
          totalGiven: 0,
          totalPaid: 0,
          endBalance: p.balance || 0,
          wellName: p.wellId ? wellsMap[p.wellId] : undefined
        }));
        rows.sort((a, b) => a.person.name.localeCompare(b.person.name, "ar"));
        setReportData(rows);
        setLoading(false);
        return;
      }

      // 2. If date filter is active, fetch all transactions for this section
      const qTx = query(
        collection(db, "transactions"),
        where("userId", "==", currentUser.uid),
        where("section", "==", activeTab)
      );
      const snapTx = await getDocs(qTx);
      const transactions: Transaction[] = [];
      snapTx.forEach((doc) => {
        transactions.push({ id: doc.id, ...doc.data() } as Transaction);
      });

      // Prepare date boundaries
      // Construct date objects safely assuming standard YYYY-MM-DD input from the type="date" picker
      const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
      const start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);

      const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
      const end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);

      // ⚡ Bolt: Pre-group transactions by personId for better performance O(N+M) instead of O(N*M)
      const transactionsByPerson: Record<string, Transaction[]> = {};
      for (const t of transactions) {
        if (!transactionsByPerson[t.personId]) {
          transactionsByPerson[t.personId] = [];
        }
        transactionsByPerson[t.personId].push(t);
      }

      const rows: ReportRow[] = [];

      for (const p of persons) {
        // Find transactions for this person
        const pTx = transactionsByPerson[p.id] || [];

        let startBalance = 0;
        let periodGiven = 0;
        let periodPaid = 0;

        for (const t of pTx) {
          // If transaction has a specific "date" field (like expenses/movements), use it, otherwise fallback to createdAt
          const tMillis = t.date ? getMillis(t.date) : getMillis(t.createdAt);
          const tDate = new Date(tMillis);

          const amount = t.amount || 0;
          // Determine if debt (عليه) or credit (له)
          const isDebt = ["debt", "withdrawal", "deduction", "well_watering", "qat_expense"].includes(t.type);
          const isCredit = ["credit", "salary", "bonus", "well_payment", "qat_sale"].includes(t.type);

          if (tMillis < start.getTime()) {
            // Happened before the period -> counts towards startBalance
            if (isDebt) startBalance += amount;
            if (isCredit) startBalance -= amount;
          } else if (tMillis >= start.getTime() && tMillis <= end.getTime()) {
            // Happened during the period
            if (isDebt) periodGiven += amount;
            if (isCredit) periodPaid += amount;
          }
        }

        // الرصيد النهائي يعتمد حصرياً على رصيد ما قبل الفترة + عمليات الفترة (يتجاهل ما بعد الفترة)
        const endBalance = startBalance + periodGiven - periodPaid;

        rows.push({
          person: p,
          startBalance,
          totalGiven: periodGiven,
          totalPaid: periodPaid,
          endBalance,
          wellName: p.wellId ? wellsMap[p.wellId] : undefined
        });
      }

      rows.sort((a, b) => a.person.name.localeCompare(b.person.name, "ar"));
      setReportData(rows);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, useDateFilter]); // Do not auto-fetch on date change until they click apply

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      alert("الرجاء تحديد تاريخ البداية والنهاية");
      return;
    }
    setUseDateFilter(true);
    fetchReport();
  };

  const handleClearFilter = () => {
    setStartDate("");
    setEndDate("");
    setUseDateFilter(false);
  };

  // Calculations
  const totalAgainst = reportData
    .filter((row) => row.endBalance > 0)
    .reduce((sum, curr) => sum + curr.endBalance, 0);

  const totalFor = reportData
    .filter((row) => row.endBalance < 0)
    .reduce((sum, curr) => sum + Math.abs(curr.endBalance), 0);

  // A4 Printable Report Generator
  const printReport = () => {
    if (reportData.length === 0) {
      alert("لا توجد بيانات لطباعتها في هذا القسم.");
      return;
    }

    const userImgSrc = userProfile?.photoURL || "iconapp.png";
    const userName = userProfile?.name || "الدفتر الآمن";
    const dateStr = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit" });
    const tabLabel = tabs.find((t) => t.id === activeTab)?.label || "";

    const periodStr = useDateFilter ? `من تاريخ ${startDate} إلى ${endDate}` : "تقرير الأرصدة الشامل";

    let printHTML = `
      <div style="direction: rtl; font-family: 'Cairo', sans-serif; padding: 20px; color: black; background: white;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e293b; padding-bottom: 15px; margin-bottom: 25px;">
          <div>
            <div style="border: 2px solid #1e293b; color: #1e293b; padding: 4px 15px; border-radius: 6px; font-weight: 900; font-size: 16px; display: inline-block; margin-bottom: 5px;">كشف الحسابات العام</div>
            <h2 style="margin: 0; font-size: 20px; color: #1e293b;">${userName}</h2>
            <p style="margin: 2px 0 0; font-size: 11px; color: #64748b;">نظام المحاسبة السحابي المتكامل</p>
          </div>
          <div style="text-align: left;">
            <p style="margin: 0; font-size: 12px; color: #64748b;">تاريخ الطباعة: <strong style="color: #1e293b;">${dateStr}</strong></p>
            <p style="margin: 2px 0 0; font-size: 12px; color: #64748b;">القسم: <strong style="color: #1e293b;">${tabLabel}</strong></p>
            <p style="margin: 2px 0 0; font-size: 12px; color: #0891b2; font-weight:bold;">${periodStr}</p>
          </div>
        </div>

        <!-- Summary Widgets -->
        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
          <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #fafafa;">
            <div style="font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 4px;">إجمالي المبالغ لنا (ديون على الغير)</div>
            <div style="font-size: 16px; font-weight: 900; color: #dc2626;">${totalAgainst.toLocaleString("en-US")} ريال</div>
          </div>
          <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #fafafa;">
            <div style="font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 4px;">إجمالي المبالغ علينا (التزامات)</div>
            <div style="font-size: 16px; font-weight: 900; color: #16a34a;">${totalFor.toLocaleString("en-US")} ريال</div>
          </div>
          <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #e0f2fe;">
            <div style="font-size: 11px; color: #0891b2; font-weight: bold; margin-bottom: 4px;">صافي المركز المالي للقسم</div>
            <div style="font-size: 16px; font-weight: 900; color: #0891b2;">${Math.abs(totalAgainst - totalFor).toLocaleString("en-US")} ريال ${totalAgainst > totalFor ? "(فائض لنا)" : "(عجز علينا)"}</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px;">
          <thead>
            <tr style="background-color: #f1f5f9; color: #334155; font-size: 13px;">
              <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: right; width: 40px;">#</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: right;">الاسم</th>
              ${useDateFilter ? `<th style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">رصيد البداية</th>` : ''}
              ${useDateFilter ? `<th style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; color: #dc2626;">المسحوبات (عليه)</th>` : ''}
              ${useDateFilter ? `<th style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; color: #16a34a;">التسديدات (له)</th>` : ''}
              <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">الرصيد النهائي</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">الحالة</th>
            </tr>
          </thead>
          <tbody>
    `;

    reportData.forEach((row, idx) => {
      // Logic for status
      let statusText = "مُصَفّى";
      let statusColor = "#64748b";
      let balanceDisplay = "0";

      if (row.endBalance > 0) {
        statusText = "عليه حساب";
        statusColor = "#dc2626";
        balanceDisplay = row.endBalance.toLocaleString("en-US");
      } else if (row.endBalance < 0) {
        statusText = "له حساب";
        statusColor = "#16a34a";
        balanceDisplay = Math.abs(row.endBalance).toLocaleString("en-US");
      }

      printHTML += `
        <tr>
          <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: right; color: #64748b; font-weight: bold;">${idx + 1}</td>
          <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #1e293b;">
            ${row.person.name}
            ${activeTab === "well_customers" && row.wellName ? `<br><span style="font-size: 10px; color: #64748b; font-weight: normal;">${row.wellName}</span>` : ""}
          </td>
          ${useDateFilter ? `<td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold;">${Math.abs(row.startBalance).toLocaleString("en-US")} ${row.startBalance > 0 ? "(عليه)" : row.startBalance < 0 ? "(له)" : ""}</td>` : ''}
          ${useDateFilter ? `<td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; color: #dc2626;">${row.totalGiven.toLocaleString("en-US")}</td>` : ''}
          ${useDateFilter ? `<td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; color: #16a34a;">${row.totalPaid.toLocaleString("en-US")}</td>` : ''}
          <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 900; color: ${statusColor};" dir="ltr">${balanceDisplay}</td>
          <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold; font-size: 11px; color: ${statusColor};">${statusText}</td>
        </tr>
      `;
    });

    printHTML += `
          </tbody>
        </table>

        <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 15px;">
          هذا التقرير مطبوع آلياً ولا يُعتد به إلا كإجراء تنظيمي للمحاسبة.<br>
          <strong style="color: #64748b;">نظام الدفتر الآمن 2026</strong>
        </div>
      </div>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '-10000px';
    iframe.style.bottom = '-10000px';
    document.body.appendChild(iframe);

    const docBody = iframe.contentWindow?.document;
    if (docBody) {
      docBody.open();
      docBody.write(`
        <html>
          <head>
            <title>طباعة تقرير الحسابات - ${tabLabel}</title>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
            <style>
              @page { size: A4 portrait; margin: 15mm; }
              body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            </style>
          </head>
          <body>${printHTML}</body>
        </html>
      `);
      docBody.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        try {
          if (typeof (window as any).AndroidPrint !== "undefined") {
            const printArea = document.getElementById("print-area");
            if(printArea) {
               printArea.innerHTML = printHTML;
               (window as any).AndroidPrint.print();
            }
          } else {
            iframe.contentWindow?.print();
          }
        } catch(e) {
          console.error("Print error:", e);
        } finally {
          setTimeout(() => document.body.removeChild(iframe), 1500);
        }
      }, 500);
    }
  };

  return (
    <div className="pb-24 pt-4 px-4 max-w-2xl mx-auto" dir="rtl">

      {/* Date Filter Widget */}
      <div className="bg-white rounded-3xl p-5 mb-5 shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 mb-4 text-slate-800 font-black">
          <Filter className="text-cyan-600" size={20} />
          تخصيص فترة التقرير
        </div>

        <form onSubmit={handleApplyFilter} className="flex flex-col gap-4">
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => {
                const today = new Date().toISOString().substring(0, 10);
                setStartDate(today);
                setEndDate(today);
              }}
              className="flex-1 py-2 px-3 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold text-xs transition"
            >
              اليوم
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 7);
                setStartDate(d.toISOString().substring(0, 10));
                setEndDate(new Date().toISOString().substring(0, 10));
              }}
              className="flex-1 py-2 px-3 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold text-xs transition"
            >
              آخر 7 أيام
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setMonth(d.getMonth() - 1);
                setStartDate(d.toISOString().substring(0, 10));
                setEndDate(new Date().toISOString().substring(0, 10));
              }}
              className="flex-1 py-2 px-3 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold text-xs transition"
            >
              آخر شهر
            </button>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="w-full flex-1">
              <label className="block text-xs font-bold text-slate-500 mb-1">من تاريخ</label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-cyan-500 transition-colors"
                  style={{
                    WebkitAppearance: "none",
                  }}
                />
                <CalendarIcon className="absolute left-3 top-3.5 text-slate-400 pointer-events-none" size={18} />
              </div>
            </div>
            <div className="w-full flex-1">
              <label className="block text-xs font-bold text-slate-500 mb-1">إلى تاريخ</label>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-cyan-500 transition-colors"
                  style={{
                    WebkitAppearance: "none",
                  }}
                />
                <CalendarIcon className="absolute left-3 top-3.5 text-slate-400 pointer-events-none" size={18} />
              </div>
            </div>
            <div className="w-full sm:w-auto flex items-end gap-2 mt-2 sm:mt-0">
              <button type="submit" className="flex-1 py-3 px-6 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold shadow-md shadow-cyan-600/20 whitespace-nowrap transition">
                تطبيق
              </button>
              {useDateFilter && (
                <button type="button" onClick={handleClearFilter} className="py-3 px-4 bg-slate-100 text-red-500 hover:bg-red-50 rounded-xl font-bold transition" title="إلغاء التصفية">
                  <RefreshCw size={20} />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 mb-6 pb-2 hide-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 rounded-[1.5rem] font-black text-sm whitespace-nowrap transition ${
              activeTab === tab.id
                ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/30"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Action Bar */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => fetchReport()}
          className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-[1.5rem] flex items-center justify-center gap-2 transition"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          تحديث التقرير
        </button>
        <button
          onClick={printReport}
          className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-[1.5rem] flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition"
        >
          <Printer size={18} />
          طباعة الكشف
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-red-50 border border-red-100 rounded-[2rem] p-5 shadow-sm text-center">
          <p className="text-xs font-black text-red-500 mb-1">ديون على {tabs.find((t) => t.id === activeTab)?.label}</p>
          <p className="text-xl font-black text-red-600">{totalAgainst.toLocaleString("en-US")}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-[2rem] p-5 shadow-sm text-center">
          <p className="text-xs font-black text-emerald-600 mb-1">أرصدة لصالح {tabs.find((t) => t.id === activeTab)?.label}</p>
          <p className="text-xl font-black text-emerald-700">{totalFor.toLocaleString("en-US")}</p>
        </div>
      </div>

      {/* Report List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-slate-400 font-bold">جاري إعداد التقرير المالي...</div>
        ) : reportData.length === 0 ? (
          <div className="text-center py-12 text-slate-400 font-bold bg-white rounded-[2rem] border border-slate-100">
            لا توجد حسابات مسجلة في هذا القسم.
          </div>
        ) : (
          reportData.map((row) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={row.person.id}
              className="bg-white rounded-[1.5rem] p-4 border border-slate-100 shadow-sm flex flex-col gap-3"
            >
              <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                    <BookOpen size={14} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-sm">{row.person.name}</h4>
                    {activeTab === "well_customers" && row.wellName && (
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">{row.wellName}</p>
                    )}
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-black ${
                  row.endBalance > 0 ? "bg-red-100 text-red-600" :
                  row.endBalance < 0 ? "bg-emerald-100 text-emerald-600" :
                  "bg-slate-100 text-slate-500"
                }`}>
                  {row.endBalance > 0 ? "عليه" : row.endBalance < 0 ? "له" : "مُصَفّى"}
                </div>
              </div>

              {useDateFilter ? (
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                  <div className="bg-slate-50 rounded-xl p-2">
                    <p className="text-slate-400 mb-0.5">رصيد أول المدة</p>
                    <p className="text-slate-700">{Math.abs(row.startBalance).toLocaleString("en-US")} {row.startBalance > 0 ? "عليه" : row.startBalance < 0 ? "له" : ""}</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-2 text-red-600">
                    <p className="mb-0.5">مسحوبات (عليه)</p>
                    <p>{row.totalGiven.toLocaleString("en-US")}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-2 text-emerald-600">
                    <p className="mb-0.5">تسديدات (له)</p>
                    <p>{row.totalPaid.toLocaleString("en-US")}</p>
                  </div>
                </div>
              ) : null}

              <div className="flex justify-between items-center bg-slate-50 rounded-xl p-3">
                <span className="text-xs font-black text-slate-500">الرصيد النهائي</span>
                <span className={`text-sm font-black ${
                  row.endBalance > 0 ? "text-red-500" :
                  row.endBalance < 0 ? "text-emerald-500" :
                  "text-slate-400"
                }`} dir="ltr">
                  {Math.abs(row.endBalance).toLocaleString("en-US")} ر.ي
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>

    </div>
  );
}
