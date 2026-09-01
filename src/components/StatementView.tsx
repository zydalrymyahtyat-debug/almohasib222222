import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Person, Transaction, TransactionType, UserProfile, MessageTemplate, TemplateType } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, Settings, MessageSquare, Phone, MessageCircle, FileText,
  Plus, Edit2, Trash2, X, DollarSign, PenTool, Droplets, Info, Contact, Search
} from "lucide-react";
import { Calculator } from "lucide-react";
import { Contacts } from "@capacitor-community/contacts";
import { Capacitor } from "@capacitor/core";
import { toEnglishDigits } from "../utils/numberUtils";

interface StatementViewProps {
  currentUser?: any;
  personId: string;
  personName?: string;
  personPhone?: string;
  initialBalance?: number;
  section: string; // e.g. "suppliers", "customers", "employees", "well_customers", "qat_fields"
  onGoBack: () => void;
  userProfile?: UserProfile | null;
}

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

export default function StatementView({ currentUser, personId, personName, personPhone, initialBalance, section, userProfile, onGoBack }: StatementViewProps) {
  const [person, setPerson] = useState<Person | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isEditPersonOpen, setIsEditPersonOpen] = useState(false);
  const [isTransOpen, setIsTransOpen] = useState(false);
  const [isWellOpOpen, setIsWellOpOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // WhatsApp Share Modal
  const [isWaOptionsOpen, setIsWaOptionsOpen] = useState(false);

  // Edit Person Form
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editFieldsCount, setEditFieldsCount] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editSalary, setEditSalary] = useState("");



  // Transaction Form state
  const [transEditId, setTransEditId] = useState("");
  const [tAmount, setTAmount] = useState("");
  const [tNote, setTNote] = useState("");
  const [pendingTransType, setPendingTransType] = useState<TransactionType>("debt");
  
  // Specific employee type selection
  const [empTransType, setEmpTransType] = useState<"salary" | "withdrawal" | "deduction" | "bonus">("withdrawal");

  // Well Operation Form state
  const [wType, setWType] = useState("طاقة شمسية");
  const [wHours, setWHours] = useState("");
  const [wMinutes, setWMinutes] = useState("");
  const [wPrice, setWPrice] = useState("");
  const [wDiesel, setWDiesel] = useState("");
  const [wPaid, setWPaid] = useState("");
  const [wNote, setWNote] = useState("");

  // Keep track of latest person state for the auto-align logic
  const personRef = React.useRef<Person | null>(null);

  useEffect(() => {
    if (!currentUser || !personId) return;
    setLoading(true);

    // 1. Subscribe to single person document
    const personUnsub = onSnapshot(doc(db, "persons", personId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const p = { id: snapshot.id, ...data } as Person;
        setPerson(p);
        personRef.current = p;
        
        // Initialize editing fields
        setEditName(data.name || "");
        setEditPhone(data.phone || "");
        setEditRegion(data.region || "");
        setEditFieldsCount(data.fieldsCount || "");
        setEditCompany(data.company || "");
        setEditSalary(String(data.salary || ""));
      } else {
        // Person was deleted
        onGoBack();
      }
    });

    // 2. Subscribe to transactions
    const transQ = query(
      collection(db, "transactions"),
      where("userId", "==", currentUser.uid),
      where("personId", "==", personId)
    );

    const transUnsub = onSnapshot(transQ, { includeMetadataChanges: true }, (snapshot) => {
      const loadedTrans: Transaction[] = [];
      let totalCalculatedBalance = 0;

      snapshot.forEach((d) => {
        const data = d.data();
        loadedTrans.push({ id: d.id, ...data } as Transaction);

        // Calculate theoretical running balance to double check with Firebase doc balance
        const isDebit = ["debt", "withdrawal", "deduction", "qat_expense", "well_watering"].includes(data.type);
        totalCalculatedBalance += isDebit ? data.amount : -data.amount;
      });

      // Sort descending by creation date
      loadedTrans.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
      setTransactions(loadedTrans);
      setLoading(false);

      // Auto-align database balance if mismatch occurs (highly robust pattern)
      const currentPerson = personRef.current;
      if (currentPerson && currentPerson.balance !== totalCalculatedBalance) {
        updateDoc(doc(db, "persons", personId), { balance: totalCalculatedBalance }).catch(console.error);
      }
    });

    // 3. Subscribe to templates
    const templatesQ = query(collection(db, "message_templates"), where("userId", "==", currentUser.uid));
    const templatesUnsub = onSnapshot(templatesQ, (snapshot) => {
      const list: MessageTemplate[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as MessageTemplate));
      setTemplates(list);
    });

    return () => {
      personUnsub();
      transUnsub();
      templatesUnsub();
    };
  }, [personId, currentUser]);

  if (!person) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-bold gap-3" dir="rtl">
        <span className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
        <span>جاري تحميل بيانات كشف الحساب...</span>
      </div>
    );
  }

  const absBal = Math.abs(person.balance);
  const colorClass = person.balance > 0 ? "text-red-500" : person.balance < 0 ? "text-emerald-600" : "text-slate-800";
  const statusLabel = person.balance > 0 ? "(عليه)" : person.balance < 0 ? "(له)" : "(مصفر)";

  // Compute new transactions based on the lastStatementSentAt timestamp
  const getNewTransactions = () => {
    if (!person.lastStatementSentAt) {
      // If never sent before, and we want "new", we just return the most recent one to be safe,
      // or all. Based on request, if they select "new operations" it should just get un-sent.
      // If it's never sent, everything is unsent. But usually that's too much, so we'll just return all.
      return transactions;
    }
    const lastSentMillis = getMillis(person.lastStatementSentAt);
    return transactions.filter(t => getMillis(t.createdAt) > lastSentMillis);
  };

  const getCleanPhone = () => {
    if (!person.phone) return null;
    let phoneClean = person.phone.trim().replace(/[\s-()]/g, "");
    if (phoneClean.startsWith("+")) phoneClean = phoneClean.substring(1);
    if (phoneClean.startsWith("00")) phoneClean = phoneClean.substring(2);
    if (phoneClean.startsWith("0")) phoneClean = phoneClean.substring(1);
    if (!phoneClean.startsWith("967") && phoneClean.length > 0) {
      phoneClean = "967" + phoneClean;
    }
    return phoneClean;
  };

  const getPersonPrefix = () => {
    if (section === "qat_fields") return "المشروع";
    if (person.gender === "male") return "السيد";
    if (person.gender === "female") return "السيدة";
    return "السيد/ة";
  };

  // Dedicated SMS sender: highly brief
  const handleSMS = () => {
    const phoneClean = getCleanPhone();
    if (!phoneClean) {
      alert("الرجاء تسجيل رقم هاتف للحساب أولاً لتفعيل خاصية المراسلة.");
      return;
    }

    if (transactions.length === 0) {
      alert("لا توجد عمليات مقيدة.");
      return;
    }

    const t = transactions[0]; // The newest transaction (transactions array is sorted desc)
    const isDebit = ["debt", "withdrawal", "deduction", "qat_expense", "well_watering"].includes(t.type);

    const prevBalance = person.balance - (isDebit ? t.amount : -t.amount);
    const prevBalWord = prevBalance > 0 ? "عليك" : prevBalance < 0 ? "لك" : "";
    const prevBalStr = prevBalance === 0 ? "0 ر.ي" : `${Math.abs(prevBalance).toLocaleString('en-US')} ر.ي ${prevBalWord}`;

    const currentBalWord = person.balance > 0 ? "عليك" : person.balance < 0 ? "لك" : "";
    const currentBalStr = person.balance === 0 ? "0 ر.ي" : `${Math.abs(person.balance).toLocaleString('en-US')} ر.ي ${currentBalWord}`;

    const addedWord = isDebit ? "عليك" : "لك";
    const prefix = getPersonPrefix();

    // Find active SMS template
    let message = "";
    const activeSmsTemplate = templates.find(t => t.type === "sms_single" && t.isActive && t.isDefault) || templates.find(t => t.type === "sms_single" && t.isActive);

    if (activeSmsTemplate) {
      message = activeSmsTemplate.content
        .replace(/{الاسم}/g, person.name)
        .replace(/{اللقب}/g, prefix)
        .replace(/{الرصيد_السابق}/g, prevBalStr)
        .replace(/{المبلغ_المضاف}/g, t.amount.toLocaleString('en-US'))
        .replace(/{اتجاه_الاضافة}/g, addedWord)
        .replace(/{بيان_العملية}/g, t.note || "بدون بيان")
        .replace(/{الرصيد_الحالي}/g, Math.abs(person.balance).toLocaleString('en-US'))
        .replace(/{اتجاه_الرصيد}/g, currentBalWord)
        .replace(/{التاريخ}/g, new Date().toLocaleDateString('ar-EG'))
        .replace(/{عدد_العمليات}/g, "1");
    } else {
      message = `مرحباً ${prefix} ${person.name}،\n`;
      message += `تم تحديث حسابكم في الدفتر الآمن.\n`;
      message += `تم إضافة ${t.amount.toLocaleString('en-US')} ر.ي ${addedWord} — البيان: ${t.note || "بدون بيان"}.\n`;
      message += `الرصيد الحالي: ${currentBalStr}`;
    }

    const encoded = encodeURIComponent(message);
    localStorage.setItem("ignore_app_lock", "true");
    window.open(`sms:${phoneClean}?body=${encoded}`, "_blank");
  };

  // Dedicated WhatsApp sender: detailed format
  const handleWhatsApp = (waSendType: "all" | "new" | "last" | "recent") => {
    const phoneClean = getCleanPhone();
    if (!phoneClean) {
      alert("الرجاء تسجيل رقم هاتف للحساب أولاً لتفعيل خاصية المراسلة.");
      return;
    }

    let transToSend = transactions;

    if (waSendType === "new") {
      transToSend = getNewTransactions();
    } else if (waSendType === "last") {
      transToSend = transactions.slice(0, 1);
    } else if (waSendType === "recent") {
      transToSend = transactions.slice(0, 5);
    } // "all" uses full transactions array

    if (transToSend.length === 0 && waSendType === "new") {
      alert("لا توجد أي عمليات جديدة لإرسالها.");
      return;
    }

    // Sort chronologically for display
    transToSend = [...transToSend].sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt));

    const prefix = getPersonPrefix();
    let message = "";

    // Variables calculation
    const currentBalWord = person.balance > 0 ? "عليك" : person.balance < 0 ? "لك" : "";
    const currentBalStr = person.balance === 0 ? "0" : Math.abs(person.balance).toLocaleString('en-US');

    // Determine the template type to use
    let templateTypeStr: TemplateType = "wa_all";
    if (waSendType === "last" || (waSendType === "new" && transToSend.length === 1)) templateTypeStr = "wa_single";
    else if (waSendType === "new" || waSendType === "recent") templateTypeStr = "wa_multiple";

    const activeTemplate = templates.find(t => t.type === templateTypeStr && t.isActive && t.isDefault) || templates.find(t => t.type === templateTypeStr && t.isActive);

    if (transToSend.length === 0) {
      message = `لا توجد عمليات مقيدة.`;
    } else if (activeTemplate) {
      // Build transactions list string
      const typesMap: Record<string, string> = {
        debt: "عليه", credit: "له", salary: "راتب", withdrawal: "سحب",
        deduction: "خصم", bonus: "مكافأة", well_watering: "سقاية",
        well_payment: "تسديد", qat_expense: "خرج", qat_sale: "مبيعات"
      };

      let transactionsListStr = "";
      transToSend.forEach(t => {
        const date = t.createdAt.toDate().toLocaleDateString("ar-EG");
        const isDebit = ["debt", "withdrawal", "deduction", "qat_expense", "well_watering"].includes(t.type);
        transactionsListStr += `🔹 ${typesMap[t.type] || "عملية"} — ${t.note || "بدون بيان"}\n`;
        transactionsListStr += `💰 ${isDebit ? "+" : "-"}${t.amount.toLocaleString('en-US')} ر.ي\n`;
        transactionsListStr += `📅 ${date}\n\n`;
      });

      // Compute variables for singular (if applicable)
      const tSingle = transToSend[0];
      const isDebitSingle = tSingle ? ["debt", "withdrawal", "deduction", "qat_expense", "well_watering"].includes(tSingle.type) : false;
      const prevBalanceSingle = person.balance - (isDebitSingle ? (tSingle?.amount || 0) : -(tSingle?.amount || 0));
      const prevBalWordSingle = prevBalanceSingle > 0 ? "عليك" : prevBalanceSingle < 0 ? "لك" : "";
      const prevBalStrSingle = prevBalanceSingle === 0 ? "0 ر.ي" : `${Math.abs(prevBalanceSingle).toLocaleString('en-US')} ر.ي ${prevBalWordSingle}`;
      const addedWordSingle = isDebitSingle ? "عليك" : "لك";

      message = activeTemplate.content
        .replace(/{الاسم}/g, person.name)
        .replace(/{اللقب}/g, prefix)
        .replace(/{الرصيد_السابق}/g, prevBalStrSingle)
        .replace(/{المبلغ_المضاف}/g, tSingle ? tSingle.amount.toLocaleString('en-US') : "0")
        .replace(/{اتجاه_الاضافة}/g, addedWordSingle)
        .replace(/{بيان_العملية}/g, tSingle?.note || "بدون بيان")
        .replace(/{الرصيد_الحالي}/g, currentBalStr)
        .replace(/{اتجاه_الرصيد}/g, currentBalWord)
        .replace(/{التاريخ}/g, new Date().toLocaleDateString('ar-EG'))
        .replace(/{العمليات_المتعددة}/g, transactionsListStr)
        .replace(/{عدد_العمليات}/g, transToSend.length.toString());

    } else {
      // Fallback
      message = `تطبيق الدفتر الآمن\n📋 كشف حساب\n\n${prefix} ${person.name}\n💰 الرصيد الحالي: ${currentBalStr} ر.ي ${currentBalWord}\n\n`;
      const typesMap: Record<string, string> = {
        debt: "عليه", credit: "له", salary: "راتب", withdrawal: "سحب",
        deduction: "خصم", bonus: "مكافأة", well_watering: "سقاية",
        well_payment: "تسديد", qat_expense: "خرج", qat_sale: "مبيعات"
      };

      if (waSendType === "last") message += `آخر عملية:\n`;
      else if (waSendType === "recent") message += `العمليات الأخيرة:\n`;
      else if (waSendType === "new") message += `العمليات الجديدة المضافة:\n`;
      else message += `سجل العمليات:\n`;

      transToSend.forEach((t) => {
        const date = t.createdAt.toDate().toLocaleDateString("ar-EG");
        const isDebit = ["debt", "withdrawal", "deduction", "qat_expense", "well_watering"].includes(t.type);
        message += `🔹 ${typesMap[t.type] || "عملية"} — ${t.note || "بدون بيان"}\n`;
        message += `💰 ${isDebit ? "+" : "-"}${t.amount.toLocaleString('en-US')} ر.ي\n`;
        message += `📅 ${date}\n\n`;
      });
      message += `نسعد بخدمتكم، وشكراً لثقتكم.`;
    }

    const encoded = encodeURIComponent(message);
    localStorage.setItem("ignore_app_lock", "true");
    window.open(`https://wa.me/${phoneClean}?text=${encoded}`, "_blank");

    // Update lastStatementSentAt in Firestore if sending new transactions
    if (waSendType === "new") {
      const newestTrans = getNewTransactions()[0]; // newest is first in getNewTransactions() returning from 'transactions' (which is desc)
      if (newestTrans) {
        updateDoc(doc(db, "persons", personId), {
          lastStatementSentAt: newestTrans.createdAt
        }).catch(err => console.error("Failed to update lastStatementSentAt", err));
      }
    }

    setIsWaOptionsOpen(false);
  };

  const handleCall = () => {
    const phoneClean = getCleanPhone();
    if (!phoneClean) {
      alert("الرجاء تسجيل رقم هاتف للحساب أولاً لتفعيل الاتصال.");
      return;
    }
    localStorage.setItem("ignore_app_lock", "true");
    window.open(`tel:+${phoneClean}`, "_blank");
  };

  const userProfileName = () => {
    return userProfile?.name || "الدفتر الآمن";
  };

  // Dedicated HTML A4 printing layout (matches custom PDF template)
  const generatePDFPrint = () => {
    const userImgSrc = userProfile?.photoURL || "iconapp.png";
    const dateStr = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit" });

    let printHTML = `
      <div style="direction: rtl; font-family: 'Cairo', sans-serif; padding: 20px; color: black; background: white;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e293b; padding-bottom: 15px; margin-bottom: 25px;">
          <div>
            <div style="border: 2px solid #1e293b; color: #1e293b; padding: 4px 15px; border-radius: 6px; font-weight: 900; font-size: 16px; display: inline-block; margin-bottom: 5px;">كشف حساب تفصيلي</div>
            <h2 style="margin: 0; font-size: 20px; color: #1e293b;">${userProfileName()}</h2>
            <p style="margin: 2px 0 0; font-size: 11px; color: #64748b;">نظام المحاسبة السحابي المتكامل</p>
          </div>
          <div style="text-align: left;">
            <img src="${userImgSrc}" style="width: 55px; height: 55px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 5px; object-fit: contain; background-color: #ffffff;">
            <div style="font-size: 12px; font-weight: bold; color: #475569;">تاريخ الطباعة: ${dateStr}</div>
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 22px; font-weight: 800; color: #0f172a;">حساب السيد: ${person.name}</h2>
          <p style="margin: 4px 0 0; font-size: 13px; color: #475569; font-weight:bold;">رقم الهاتف: ${person.phone || "غير مسجل"}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; text-align: center; margin-top: 15px;">
          <thead>
            <tr style="background-color: #f8fafc; color: #0f172a; border-bottom: 2px solid #e2e8f0;">
              <th style="border: 1px solid #e2e8f0; padding: 10px; font-size: 13px; font-weight: 800;">التاريخ</th>
              <th style="border: 1px solid #e2e8f0; padding: 10px; font-size: 13px; font-weight: 800; width: 45%;">البيان والتفاصيل</th>
              <th style="border: 1px solid #e2e8f0; padding: 10px; font-size: 13px; font-weight: 800; color: #ef4444;">عليه (+)</th>
              <th style="border: 1px solid #e2e8f0; padding: 10px; font-size: 13px; font-weight: 800; color: #22c55e;">له (-)</th>
              <th style="border: 1px solid #e2e8f0; padding: 10px; font-size: 13px; font-weight: 800; background-color: #f1f5f9;">الرصيد الجاري</th>
            </tr>
          </thead>
          <tbody>
    `;

    let runningBalance = 0;
    // Reverse transactions to compute chronological running balance
    const reversedTrans = [...transactions].reverse();

    if (reversedTrans.length === 0) {
      printHTML += `<tr><td colspan="5" style="border: 1px solid #e2e8f0; padding: 15px; color: #64748b;">لا توجد عمليات مقيدة حالياً في السجل.</td></tr>`;
    } else {
      reversedTrans.forEach((t) => {
        const isDebit = ["debt", "withdrawal", "deduction", "qat_expense", "well_watering"].includes(t.type);
        const amtAgainst = isDebit ? t.amount : 0;
        const amtFor = !isDebit ? t.amount : 0;
        runningBalance += (amtAgainst - amtFor);

        const typesMap: any = {
          debt: "عليه", credit: "له", salary: "راتب", withdrawal: "سحب",
          deduction: "خصم", bonus: "مكافأة", well_watering: "سقاية",
          well_payment: "تسديد", qat_expense: "خرج", qat_sale: "مبيعات"
        };

        const tDate = t.createdAt.toDate().toLocaleDateString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit" });
        const desc = `<strong>${typesMap[t.type] || "عملية"}</strong>${t.note ? `<br><span style="font-size:11px; color:#475569;">${t.note}</span>` : ""}`;

        printHTML += `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="border: 1px solid #e2e8f0; padding: 8px; font-size: 12px; font-family: monospace;">${tDate}</td>
            <td style="border: 1px solid #e2e8f0; padding: 8px; font-size: 12px; text-align: right;">${desc}</td>
            <td style="border: 1px solid #e2e8f0; padding: 8px; font-size: 13px; font-weight: bold; color: ${amtAgainst > 0 ? '#ef4444' : '#000'};">${amtAgainst > 0 ? amtAgainst.toLocaleString('en-US') : ""}</td>
            <td style="border: 1px solid #e2e8f0; padding: 8px; font-size: 13px; font-weight: bold; color: ${amtFor > 0 ? '#22c55e' : '#000'};">${amtFor > 0 ? amtFor.toLocaleString('en-US') : ""}</td>
            <td style="border: 1px solid #e2e8f0; padding: 8px; font-size: 13px; font-weight: 900; background-color: #f8fafc;">
              ${Math.abs(runningBalance).toLocaleString('en-US')} 
              <span style="font-size:9px; font-weight:bold; color:${runningBalance > 0 ? '#ef4444' : (runningBalance < 0 ? '#22c55e' : '#64748b')}">
                ${runningBalance > 0 ? "عليه" : (runningBalance < 0 ? "له" : "مصفر")}
              </span>
            </td>
          </tr>
        `;
      });
    }

    const finalStatus = person.balance > 0 ? "عليه" : person.balance < 0 ? "له" : "مصفر";
    const finalColor = person.balance > 0 ? "#ef4444" : person.balance < 0 ? "#22c55e" : "#475569";

    printHTML += `
          </tbody>
        </table>

        <div style="margin-top: 30px; display: flex; justify-content: flex-start;">
          <div style="border: 2px solid #e2e8f0; padding: 12px 24px; border-radius: 8px; background: #f8fafc; font-weight: 900; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            الرصيد الإجمالي النهائي الملتزم: <span style="color: ${finalColor}; font-size: 18px;">${absBal.toLocaleString('en-US')} ر.ي ${finalStatus}</span>
          </div>
        </div>
      </div>
    `;

    // Write printable content to our print-area container
    const printArea = document.getElementById("print-area");
    if (printArea) {
      printArea.innerHTML = printHTML;
      setTimeout(() => {
        if ((window as any).AndroidPrint) {
          (window as any).AndroidPrint.print();
        } else {
          window.print();
        }
      }, 250);
    }
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
          if (name) setEditName(name);
          if (cleanedPhone) setEditPhone(cleanedPhone);
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
            
            if (name) setEditName(name);
            if (phone) setEditPhone(phone);
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
          
          if (name) setEditName(name);
          if (phone) setEditPhone(phone);
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

  // Save Person Details Edit
  const handleSavePersonEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return alert("الاسم مطلوب");
    if (isSaving) return;

    setIsSaving(true);
    try {
      const data: any = {
        name: editName.trim(),
        phone: editPhone.trim(),
        region: editRegion.trim(),
        fieldsCount: editFieldsCount.trim()
      };

      if (section === "suppliers") data.company = editCompany.trim();
      if (section === "employees") data.salary = Number(editSalary) || 0;

      // Non-blocking write to avoid freeze on slow/no internet
      updateDoc(doc(db, "persons", personId), data).catch(err => console.error(err));
      setIsEditPersonOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePerson = () => {
    if (confirm("تحذير أمني شديد: سيتم حذف هذا الحساب نهائياً مع كافة العمليات المرتبطة به ولا يمكن التراجع عن ذلك! هل تريد المتابعة؟")) {
      deleteDoc(doc(db, "persons", personId)).catch(err => console.error(err));
      // Clean up transactions in background
      transactions.forEach((t) => {
        deleteDoc(doc(db, "transactions", t.id)).catch(err => console.error(err));
      });
      onGoBack();
    }
  };

  // Transaction Actions (Add/Edit)
  const handleOpenAddTrans = (type: TransactionType) => {
    setTransEditId("");
    setTAmount("");
    setTNote("");
    setPendingTransType(type);
    setIsTransOpen(true);
  };

  const handleOpenEditTrans = (t: Transaction) => {
    setTransEditId(t.id);
    setTAmount(String(t.amount));
    setTNote(t.note);
    setPendingTransType(t.type);
    
    if (["salary", "withdrawal", "deduction", "bonus"].includes(t.type)) {
      setEmpTransType(t.type as any);
    }
    setIsTransOpen(true);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(tAmount);
    if (!amountNum || amountNum <= 0) return alert("الرجاء إدخال مبلغ صحيح");
    if (isSaving) return;

    setIsSaving(true);
    try {
      // Determine final transaction type
      let finalType = pendingTransType;
      if (section === "employees") {
        finalType = empTransType;
      }

      const isDebit = ["debt", "withdrawal", "deduction", "qat_expense", "well_watering"].includes(finalType);

      let updatedBalance = person.balance;

      if (transEditId) {
        // Reverse old
        const oldTrans = transactions.find((t) => t.id === transEditId);
        if (oldTrans) {
          const oldIsDebit = ["debt", "withdrawal", "deduction", "qat_expense", "well_watering"].includes(oldTrans.type);
          updatedBalance += oldIsDebit ? -oldTrans.amount : oldTrans.amount;
        }
        
        // Add new
        updatedBalance += isDebit ? amountNum : -amountNum;

        // Update transaction non-blocking
        updateDoc(doc(db, "transactions", transEditId), {
          amount: amountNum,
          note: tNote.trim(),
          type: finalType
        }).catch(err => console.error(err));
      } else {
        // Create new
        updatedBalance += isDebit ? amountNum : -amountNum;

        // Non-blocking add
        addDoc(collection(db, "transactions"), {
          userId: currentUser?.uid,
          personId: personId,
          type: finalType,
          amount: amountNum,
          note: tNote.trim(),
          section: section,
          createdAt: new Date()
        }).catch(err => console.error(err));
      }

      // Update person document balance non-blocking
      updateDoc(doc(db, "persons", personId), { 
        balance: updatedBalance,
        lastTransactionAt: new Date()
      }).catch(err => console.error(err));
      setIsTransOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTransaction = (t: Transaction) => {
    if (confirm("هل أنت متأكد من رغبتك في حذف هذه العملية المالية؟")) {
      const isDebit = ["debt", "withdrawal", "deduction", "qat_expense", "well_watering"].includes(t.type);
      const updatedBalance = person.balance + (isDebit ? -t.amount : t.amount);
      
      deleteDoc(doc(db, "transactions", t.id)).catch(err => console.error(err));
      updateDoc(doc(db, "persons", personId), { 
        balance: updatedBalance,
        lastTransactionAt: new Date()
      }).catch(err => console.error(err));
    }
  };

  // Well Operation Watering Save
  const handleSaveWellWatering = async (e: React.FormEvent) => {
    e.preventDefault();
    const hoursNum = Number(wHours) || 0;
    const minsNum = Number(wMinutes) || 0;
    const rateNum = Number(wPrice) || 0;
    const paidNum = Number(wPaid) || 0;

    if (hoursNum === 0 && minsNum === 0) return alert("الرجاء تحديد زمن السقاية بالساعات أو الدقائق");
    if (rateNum <= 0) return alert("الرجاء إدخال سعر الساعة المتفق عليه");
    if (isSaving) return;

    setIsSaving(true);
    try {
      const totalHours = hoursNum + (minsNum / 60);
      const totalAmount = Math.round(rateNum * totalHours);

      let timeText = [];
      if (hoursNum > 0) timeText.push(`${hoursNum} ساعة`);
      if (minsNum > 0) timeText.push(`${minsNum} دقيقة`);
      const timeString = timeText.join(" و ") || "0 ساعة";

      let fullNote = `النوع: ${wType} | الوقت: ${timeString} | السعر: ${rateNum}`;
      if (wDiesel && wType === "ديزل") fullNote += ` | ديزل: ${wDiesel}`;
      if (wNote.trim()) fullNote += ` | ${wNote.trim()}`;

      let runningBal = person.balance + totalAmount;

      // 1. Save Watering Transaction (Debit/عليه) - non-blocking
      addDoc(collection(db, "transactions"), {
        userId: currentUser?.uid,
        personId: personId,
        type: "well_watering",
        amount: totalAmount,
        note: fullNote,
        section: "well_customers",
        createdAt: new Date()
      }).catch(err => console.error(err));

      // 2. Save cash payment right during watering (if provided) - non-blocking
      if (paidNum > 0) {
        runningBal -= paidNum;
        addDoc(collection(db, "transactions"), {
          userId: currentUser?.uid,
          personId: personId,
          type: "well_payment",
          amount: paidNum,
          note: "سداد نقدي مباشر دفعة تحت الحساب أثناء السقاية",
          section: "well_customers",
          createdAt: new Date()
        }).catch(err => console.error(err));
      }

      // 3. Save calculated balance to person doc - non-blocking
      updateDoc(doc(db, "persons", personId), { 
        balance: runningBal,
        lastTransactionAt: new Date()
      }).catch(err => console.error(err));
      setIsWellOpOpen(false);

      // Reset form
      setWHours("");
      setWMinutes("");
      setWPrice("");
      setWDiesel("");
      setWPaid("");
      setWNote("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 pt-4 pb-36 px-4" dir="rtl">
      {/* Header Info Banner */}
      <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 flex flex-col items-center relative mb-6">
        <button
          onClick={() => setIsEditPersonOpen(true)}
          className="absolute top-5 left-5 p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl transition cursor-pointer"
          title="إعدادات وتعديل الحساب"
        >
          <Settings size={20} />
        </button>

        <span className="text-sm font-bold text-slate-400 mb-1">
          {section === "qat_fields" ? "صافي جرب الحقل" : "الرصيد الإجمالي الحالي"}
        </span>
        <span className={`text-3xl font-black font-mono ${colorClass}`}>
          {absBal.toLocaleString('en-US')}
        </span>
        <span className="text-xs font-black text-slate-500 mt-1">{statusLabel} ر.ي</span>

        {/* Quick Contacts Actions */}
        <div className="flex justify-center gap-4 mt-5 w-full max-w-xs">
          <button
            onClick={generatePDFPrint}
            className="flex-1 py-3 px-2.5 bg-red-500 hover:bg-red-600 text-white rounded-2xl flex flex-col items-center gap-1 transition shadow-md shadow-red-500/10 cursor-pointer"
            title="طباعة وتنزيل PDF"
          >
            <FileText size={18} />
            <span className="text-xs font-black">تقرير A4</span>
          </button>
          
          {person.phone && (
            <>
              <button
                onClick={() => setIsWaOptionsOpen(true)}
                className="flex-1 py-3 px-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl flex flex-col items-center gap-1 transition shadow-md shadow-emerald-500/10 cursor-pointer"
                title="مراسلة واتس اب"
              >
                <MessageCircle size={18} />
                <span className="text-xs font-black">واتس اب</span>
              </button>

              <button
                onClick={handleSMS}
                className="flex-1 py-3 px-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl flex flex-col items-center gap-1 transition shadow-md shadow-amber-500/10 cursor-pointer"
                title="إرسال رسالة نصية SMS"
              >
                <MessageSquare size={18} />
                <span className="text-xs font-black">رسالة</span>
              </button>

              <button
                onClick={handleCall}
                className="flex-1 py-3 px-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl flex flex-col items-center gap-1 transition shadow-md shadow-blue-500/10 cursor-pointer"
                title="اتصال هاتفي مباشر"
              >
                <Phone size={18} />
                <span className="text-xs font-black">اتصال</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Transaction Control Actions Grid */}
      <div className="mb-6">
        {section === "employees" ? (
          <div className="flex gap-3">
            <button
              onClick={() => {
                setEmpTransType("withdrawal");
                handleOpenAddTrans("withdrawal");
              }}
              className="flex-1 py-3.5 bg-slate-700 hover:bg-slate-800 text-white rounded-2xl font-bold transition shadow-md shadow-slate-700/15 cursor-pointer"
            >
              تقييد عملية موظف
            </button>
          </div>
        ) : section === "well_customers" ? (
          <div className="flex gap-3">
            <button
              onClick={() => setIsWellOpOpen(true)}
              className="flex-1 py-3.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition shadow-md shadow-cyan-500/15 cursor-pointer"
            >
              <Droplets size={18} />
              سقاية جديدة
            </button>
            <button
              onClick={() => handleOpenAddTrans("well_payment")}
              className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold transition shadow-md shadow-emerald-500/15 cursor-pointer"
            >
              تسديد نقد
            </button>
          </div>
        ) : section === "qat_fields" ? (
          <div className="flex gap-3">
            <button
              onClick={() => handleOpenAddTrans("qat_sale")}
              className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold transition shadow-md shadow-emerald-500/15 cursor-pointer"
            >
              تسجيل مبيعات
            </button>
            <button
              onClick={() => handleOpenAddTrans("qat_expense")}
              className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold transition shadow-md shadow-red-500/15 cursor-pointer"
            >
              خرج يومي
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => handleOpenAddTrans("debt")}
              className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold transition shadow-md shadow-red-500/15 cursor-pointer"
            >
              عليه (+)
            </button>
            <button
              onClick={() => handleOpenAddTrans("credit")}
              className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold transition shadow-md shadow-emerald-500/15 cursor-pointer"
            >
              له (-)
            </button>
          </div>
        )}
      </div>

      {/* Ledger Transactions List */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex-1">
        <h3 className="font-extrabold text-slate-800 text-base mb-4">سجل العمليات المالية</h3>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 font-semibold gap-2">
            <span className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
            <span>جاري تحميل العمليات...</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-16 text-slate-400 font-bold">لا توجد أي معاملات مقيدة في السجل لهذا الحساب.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {transactions.map((t) => {
              const isDebit = ["debt", "withdrawal", "deduction", "qat_expense", "well_watering"].includes(t.type);
              const color = isDebit ? "text-red-500" : "text-emerald-600";
              const prefix = isDebit ? "+" : "-";

              const typesMap: any = {
                debt: "عليه", credit: "له", salary: "راتب", withdrawal: "سحب/سلفية",
                deduction: "خصم", bonus: "مكافأة", well_watering: "سقاية بئر",
                well_payment: "تسديد بئر", qat_expense: "خرج مقاوتة", qat_sale: "مبيعات مقاوتة"
              };

              const dateText = t.createdAt.toDate().toLocaleDateString("ar-EG", {
                weekday: "long", year: "numeric", month: "numeric", day: "numeric"
              });

              return (
                <div key={t.id} className="py-4 flex justify-between items-center group">
                  <div className="max-w-[70%]">
                    <h4 className="font-extrabold text-slate-800 text-sm">
                      {typesMap[t.type] || "عملية مالية"}
                      <span className="block text-xs text-slate-400 font-bold mt-1">{dateText}</span>
                    </h4>
                    {t.note && (
                      <p className="text-sm text-slate-500 font-medium mt-1 leading-relaxed bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 inline-block">
                        {t.note}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span className={`text-base font-black font-mono ${color}`}>
                      {prefix} {t.amount.toLocaleString('en-US')}
                    </span>
                    
                    {/* Operation Options */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenEditTrans(t)}
                        className="p-1 text-blue-500 hover:bg-blue-50 rounded transition cursor-pointer"
                        title="تعديل"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteTransaction(t)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded transition cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Person Metadata Dialog */}
      <AnimatePresence>
        {isEditPersonOpen && (
          <div className="fixed inset-0 bg-slate-900/90  z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl overflow-y-auto max-h-[85vh] border border-slate-100"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-slate-800">
                  {transEditId ? "تعديل العملية المالية" : "تسجيل مبلغ مالي"}
                </h3>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-calculator"))} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition cursor-pointer" title="آلة حاسبة">
                    <Calculator size={18} />
                  </button>
                  <button type="button" onClick={() => setIsTransOpen(false)} className="p-1.5 bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full cursor-pointer">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSavePersonEdit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">الاسم الكامل</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">رقم الهاتف</label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className={`w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition ${editPhone ? "text-left" : "text-right"}`}
                      dir={editPhone ? "ltr" : "rtl"}
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

                {section === "suppliers" && (
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">الشركة أو البضاعة الموردة</label>
                    <input
                      type="text"
                      value={editCompany}
                      onChange={(e) => setEditCompany(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition"
                    />
                  </div>
                )}

                {section === "employees" && (
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">الراتب الأساسي الشهري (ر.ي)</label>
                    <input
                      type="number"
                      value={editSalary}
                      onChange={(e) => setEditSalary(e.target.value)}
                      className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition font-mono ${editSalary ? "text-left" : "text-right"}`}
                      dir={editSalary ? "ltr" : "rtl"}
                    />
                  </div>
                )}

                {(section === "well_customers" || section === "qat_fields") && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">المنطقة / العزلة</label>
                      <input
                        type="text"
                        value={editRegion}
                        onChange={(e) => setEditRegion(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">عدد الجرب (المقاطع)</label>
                      <input
                        type="number"
                        value={editFieldsCount}
                        onChange={(e) => setEditFieldsCount(e.target.value)}
                        className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition font-mono ${editFieldsCount ? "text-left" : "text-right"}`}
                        dir={editFieldsCount ? "ltr" : "rtl"}
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className={`flex-2 py-3.5 px-4 bg-gradient-to-tr from-violet-600 to-indigo-600 text-white font-bold rounded-2xl cursor-pointer shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-2 ${isSaving ? "opacity-70 cursor-not-allowed" : ""}`}
                  >
                    {isSaving ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        جاري الحفظ...
                      </>
                    ) : (
                      "حفظ التغييرات"
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setIsEditPersonOpen(false)}
                    className="flex-1 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-2xl cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>

              {/* Advanced Destructive Action Panel */}
              <button
                onClick={handleDeletePerson}
                className="w-full mt-4 py-3.5 px-4 text-red-500 bg-red-50 hover:bg-red-100 font-bold rounded-2xl transition cursor-pointer flex items-center justify-center gap-2 border border-red-100 text-sm"
              >
                <Trash2 size={16} />
                <span>حذف هذا الحساب نهائياً</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Financial Transaction Add/Edit Dialog */}
      <AnimatePresence>
        {isTransOpen && (
          <div className="fixed inset-0 bg-slate-900/90  z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-slate-800">
                  {transEditId ? "تعديل العملية المالية" : "تسجيل مبلغ مالي"}
                </h3>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-calculator"))} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition" title="آلة حاسبة">
                    <Calculator size={18} />
                  </button>
                  <button type="button" onClick={() => setIsTransOpen(false)} className="p-1.5 bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full cursor-pointer">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveTransaction} className="space-y-4">
                {section === "employees" && (
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">نوع العملية</label>
                    <select
                      value={empTransType}
                      onChange={(e: any) => setEmpTransType(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition cursor-pointer appearance-none"
                    >
                      <option value="withdrawal">سلفة / سحب (عليه)</option>
                      <option value="deduction">خصميات (عليه)</option>
                      <option value="salary">راتب شهري (له)</option>
                      <option value="bonus">مكافآت وإكراميات (له)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">المبلغ المالي (ر.ي)</label>
                  <div className="relative">
                    <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="number"
                      placeholder="أدخل قيمة المعاملة بالأرقام..."
                      value={tAmount}
                      onChange={(e) => setTAmount(toEnglishDigits(e.target.value))}
                      className={`w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition font-mono ${tAmount ? "text-left" : "text-right"}`}
                      dir={tAmount ? "ltr" : "rtl"}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">البيان / تفاصيل الملاحظة</label>
                  <input
                    type="text"
                    placeholder="بيان تفصيلي أو سبب المعاملة..."
                    value={tNote}
                    onChange={(e) => setTNote(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className={`flex-2 py-3.5 px-4 bg-gradient-to-tr from-violet-600 to-indigo-600 text-white font-bold rounded-2xl cursor-pointer shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-2 ${isSaving ? "opacity-70 cursor-not-allowed" : ""}`}
                  >
                    {isSaving ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        جاري الحفظ...
                      </>
                    ) : (
                      "تأكيد وتسجيل"
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setIsTransOpen(false)}
                    className="flex-1 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-2xl cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Artesian Well Watering Transaction Dialog */}
      <AnimatePresence>
        {isWellOpOpen && (
          <div className="fixed inset-0 bg-slate-900/90  z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl overflow-y-auto max-h-[85vh] border border-slate-100"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-black text-cyan-600 flex items-center gap-2">
                  <Droplets size={22} />
                  تسجيل سقاية بئر ارتوازي
                </h3>
                <button
                  onClick={() => setIsWellOpOpen(false)}
                  className="p-1.5 bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveWellWatering} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">مصدر الطاقة للسقاية</label>
                  <select
                    value={wType}
                    onChange={(e) => setWType(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition cursor-pointer appearance-none"
                  >
                    <option value="طاقة شمسية">سقاية بالطاقة الشمسية</option>
                    <option value="ديزل">سقاية بمولد الديزل</option>
                    <option value="جربة">سقاية مقطوعية (بالجربة)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">زمن السقاية الكلي</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="الساعات..."
                      value={wHours}
                      onChange={(e) => setWHours(toEnglishDigits(e.target.value))}
                      className={`w-1/2 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition font-mono ${wHours ? "text-left" : "text-right"}`}
                      dir={wHours ? "ltr" : "rtl"}
                    />
                    <input
                      type="number"
                      placeholder="الدقائق..."
                      value={wMinutes}
                      onChange={(e) => setWMinutes(toEnglishDigits(e.target.value))}
                      className={`w-1/2 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition font-mono ${wMinutes ? "text-left" : "text-right"}`}
                      dir={wMinutes ? "ltr" : "rtl"}
                      max={59}
                      min={0}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">سعر ساعة السقاية المتفق عليه (ر.ي)</label>
                  <input
                    type="number"
                    placeholder="أدخل السعر للساعة..."
                    value={wPrice}
                    onChange={(e) => setWPrice(toEnglishDigits(e.target.value))}
                    className={`w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition font-mono ${wPrice ? "text-left" : "text-right"}`}
                    dir={wPrice ? "ltr" : "rtl"}
                    required
                  />
                </div>

                {wType === "ديزل" && (
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">كمية الديزل المستهلكة (لتر)</label>
                    <input
                      type="number"
                      placeholder="مثال: 20 لتر..."
                      value={wDiesel}
                      onChange={(e) => setWDiesel(toEnglishDigits(e.target.value))}
                      className={`w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition font-mono ${wDiesel ? "text-left" : "text-right"}`}
                      dir={wDiesel ? "ltr" : "rtl"}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">المبلغ المدفوع كاش حالاً (اختياري)</label>
                  <input
                    type="number"
                    placeholder="المبلغ المسدد تحت الحساب الآن..."
                    value={wPaid}
                    onChange={(e) => setWPaid(toEnglishDigits(e.target.value))}
                    className={`w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition font-mono ${wPaid ? "text-left" : "text-right"}`}
                    dir={wPaid ? "ltr" : "rtl"}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">أي ملاحظات إضافية</label>
                  <input
                    type="text"
                    placeholder="ملاحظات السقاية..."
                    value={wNote}
                    onChange={(e) => setWNote(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className={`flex-2 py-3.5 px-4 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-2xl cursor-pointer shadow-lg shadow-cyan-500/15 flex items-center justify-center gap-2 ${isSaving ? "opacity-70 cursor-not-allowed" : ""}`}
                  >
                    {isSaving ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        جاري تسجيل السقاية...
                      </>
                    ) : (
                      "تسجيل السقاية المالية"
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setIsWellOpOpen(false)}
                    className="flex-1 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-2xl cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {/* WhatsApp Send Options Modal */}
        {isWaOptionsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsWaOptionsOpen(false)}></div>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl relative z-10 p-6 flex flex-col gap-4"
              dir="rtl"
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <MessageCircle className="text-emerald-500" />
                  خيارات الإرسال
                </h3>
                <button
                  onClick={() => setIsWaOptionsOpen(false)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleWhatsApp("new")}
                  className="w-full py-4 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-2xl cursor-pointer text-right flex items-center gap-3 transition"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">N</div>
                  إرسال العمليات الجديدة
                </button>
                <button
                  onClick={() => handleWhatsApp("last")}
                  className="w-full py-4 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-2xl cursor-pointer text-right flex items-center gap-3 transition"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">1</div>
                  إرسال آخر عملية فقط
                </button>
                <button
                  onClick={() => handleWhatsApp("recent")}
                  className="w-full py-4 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-2xl cursor-pointer text-right flex items-center gap-3 transition"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">5</div>
                  إرسال آخر 5 عمليات
                </button>
                <button
                  onClick={() => handleWhatsApp("all")}
                  className="w-full py-4 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-2xl cursor-pointer text-right flex items-center gap-3 transition"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <FileText size={18} />
                  </div>
                  إرسال كامل الكشف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
