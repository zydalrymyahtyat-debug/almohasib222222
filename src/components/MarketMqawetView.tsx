import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, getDocs, writeBatch, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Person, MarketBatch, MarketMqawetItem, UserProfile } from "../types";
import { ArrowRight, Plus, Save, Trash2, Printer, Search, Phone, User, Package, Leaf, Store } from "lucide-react";
import { toEnglishDigits } from "../utils/numberUtils";
import { Contacts } from "@capacitor-community/contacts";

const toArabicDigits = (num: number | string) => {
  return typeof num === "number" ? num.toLocaleString("en-US") : num;
};

interface Props {
  currentUser: any;
  userProfile: UserProfile | null;
  onNavigate: (view: string, title: string) => void;
}

export default function MarketMqawetView({ currentUser, userProfile, onNavigate }: Props) {
  const [activeTab, setActiveTab] = useState<"entry" | "clients" | "rawi-rep" | "mqawet-rep" | "master-rep">("entry");

  // Data State
  const [batches, setBatches] = useState<MarketBatch[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);

  // Active Batch State
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [opDate, setOpDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [rawiName, setRawiName] = useState("");
  const [rawiPhone, setRawiPhone] = useState("");
  const [rawiQty, setRawiQty] = useState<number | "">("");
  const [rawiPrice, setRawiPrice] = useState<number | "">("");
  const [commRawiPct, setCommRawiPct] = useState<number | "">("");
  const [commMqawetPct, setCommMqawetPct] = useState<number | "">("");
  const [taxPct, setTaxPct] = useState<number | "">("");
  const [mqawetList, setMqawetList] = useState<MarketMqawetItem[]>([]);

  // Filter States
  const [rawiFilter, setRawiFilter] = useState("ALL");
  const [mqawetFilter, setMqawetFilter] = useState("ALL");
  const [isSaving, setIsSaving] = useState(false);

  // Isolated Market Customers (from market_batches)
  const getIsolatedClients = () => {
     const clientsMap = new Map();

     batches.forEach(b => {
        // Rawi Client
        if (b.rawiName) {
           let totalVal = b.rawiQty * b.rawiPrice;
           let commVal = totalVal * (b.commRawiPct / 100);
           let taxVal = totalVal * (b.taxPct / 100);
           let net = totalVal - commVal - taxVal;

           if (!clientsMap.has(b.rawiName)) {
              clientsMap.set(b.rawiName, { name: b.rawiName, phone: b.rawiPhone, type: 'rawi', balance: 0 });
           }
           const client = clientsMap.get(b.rawiName);
           client.balance -= net; // له (Negative)
           client.phone = client.phone || b.rawiPhone;
        }

        // Mqawet Clients
        b.mqawetList.forEach(m => {
           if (m.name) {
              if (!clientsMap.has(m.name)) {
                 clientsMap.set(m.name, { name: m.name, phone: m.phone, type: 'mqawet', balance: 0 });
              }
              const client = clientsMap.get(m.name);
              client.balance += m.totalRequired; // عليه (Positive)
              client.phone = client.phone || m.phone;
           }
        });
     });

     return Array.from(clientsMap.values());
  };


  // Dropdown States
  const [openRawiDropdown, setOpenRawiDropdown] = useState(false);
  const [openMqawetDropdownIndex, setOpenMqawetDropdownIndex] = useState<number | null>(null);

  const [messageTemplates, setMessageTemplates] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser) return;

    // Fetch Persons (Customers & Suppliers) for autocomplete/linking
    const pQ = query(collection(db, "persons"), where("userId", "==", currentUser.uid));
    const unsubPersons = onSnapshot(pQ, (snap) => {
      setPersons(snap.docs.map(d => ({ id: d.id, ...d.data() } as Person)));
    });

    // Fetch Market Batches
    const bQ = query(collection(db, "market_batches"), where("userId", "==", currentUser.uid));
    const unsubBatches = onSnapshot(bQ, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketBatch));
      // Sort by date/createdAt descending
      data.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis() || 0);
      setBatches(data);
    });

    // Fetch Templates
    const tQ = query(collection(db, "message_templates"), where("userId", "==", currentUser.uid));
    const unsubTemplates = onSnapshot(tQ, (snap) => {
      setMessageTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubPersons();
      unsubBatches();
      unsubTemplates();
    };
  }, [currentUser]);

  // Sync Form when active batch changes
  useEffect(() => {
    if (activeBatchId) {
      const b = batches.find(x => x.id === activeBatchId);
      if (b) {
        setOpDate(b.date);
        setRawiName(b.rawiName);
        setRawiPhone(b.rawiPhone);
        setRawiQty(b.rawiQty || "");
        setRawiPrice(b.rawiPrice || "");
        setCommRawiPct(b.commRawiPct || "");
        setCommMqawetPct(b.commMqawetPct || "");
        setTaxPct(b.taxPct || "");

        // Ensure at least one empty row if list is empty
        if (b.mqawetList.length === 0) {
           setMqawetList([{ name: "", phone: "", qty: 0, price: 0, baseVal: 0, comm: 0, totalRequired: 0 }]);
        } else {
           setMqawetList(b.mqawetList);
        }
      }
    } else {
      // Init new blank
      setOpDate(new Date().toISOString().substring(0, 10));
      setRawiName("");
      setRawiPhone("");
      setRawiQty("");
      setRawiPrice("");
      setCommRawiPct("");
      setCommMqawetPct("");
      setTaxPct("");
      setMqawetList([{ name: "", phone: "", qty: 0, price: 0, baseVal: 0, comm: 0, totalRequired: 0 }]);
    }
  }, [activeBatchId]);

  // Derived state for summary
  const qtyVal = Number(rawiQty) || 0;
  const priceVal = Number(rawiPrice) || 0;
  const rawiTotalValue = qtyVal * priceVal;

  const cRPct = Number(commRawiPct) || 0;
  const cMPct = Number(commMqawetPct) || 0;
  const tPct = Number(taxPct) || 0;

  let totalDistributedQty = 0;
  let totalMqawetCommissions = 0;

  const computedMqawetList = mqawetList.map(m => {
    const qty = Number(m.qty) || 0;
    totalDistributedQty += qty;
    const value = qty * priceVal;
    const comm = value * (cMPct / 100);
    const total = value + comm;
    totalMqawetCommissions += comm;
    return { ...m, price: priceVal, baseVal: value, comm, totalRequired: total };
  });

  const rawiCommValue = rawiTotalValue * (cRPct / 100);
  const taxValue = rawiTotalValue * (tPct / 100);
  const netRawi = rawiTotalValue - rawiCommValue - taxValue;
  const remainingQty = qtyVal - totalDistributedQty;
  const totalProfit = rawiCommValue + totalMqawetCommissions;

  const inProgressBatches = batches.filter(b => b.status === "in_progress" && (b.rawiName || b.rawiQty > 0));

  const handleAddMqawetRow = () => {
    setMqawetList([...mqawetList, { name: "", phone: "", qty: 0, price: 0, baseVal: 0, comm: 0, totalRequired: 0 }]);
  };

  const handleUpdateMqawetRow = (index: number, field: keyof MarketMqawetItem, value: any) => {
    const updated = [...mqawetList];
    (updated[index] as any)[field] = value;
    // Auto populate phone if person selected from list
    if (field === "name") {
      const person = persons.find(p => p.name === value && p.type === "customers");
      if (person) {
        updated[index].phone = person.phone || "";
        updated[index].personId = person.id;
      }
    }
    setMqawetList(updated);
  };

  const handleRemoveMqawetRow = (index: number) => {
    if (mqawetList.length > 1) {
      setMqawetList(mqawetList.filter((_, i) => i !== index));
    } else {
      setMqawetList([{ name: "", phone: "", qty: 0, price: 0, baseVal: 0, comm: 0, totalRequired: 0 }]);
    }
  };

  // Helper to get historical debt for a Mqawet across ALL batches
  const getMqawetHistoricalDebt = (name: string, excludeBatchId?: string) => {
    if (!name) return 0;
    let debt = 0;
    batches.forEach(b => {
      if (b.id !== excludeBatchId) {
        b.mqawetList.forEach(m => {
          if (m.name.trim() === name.trim()) {
            debt += m.totalRequired;
          }
        });
      }
    });
    // Also include their actual balance if they exist as a customer?
    // The HTML just computed from batches. We will show actual balance if person exists.
    const person = persons.find(p => p.name.trim() === name.trim() && p.type === "customers");
    if (person) {
        return person.balance; // This is the real Ledger balance!
    }
    return debt;
  };

  const pickContact = async (callback: (name: string, phone: string) => void) => {
    // Prevent App Lock overlay from dismissing the app during intent
    localStorage.setItem("ignore_app_lock", "true");
    const clearLockIgnore = setTimeout(() => {
      localStorage.removeItem("ignore_app_lock");
    }, 3000);

    // 0. Use Native Android Bridge if present (main priority for standard app wrappers)
    if ((window as any).AndroidContacts && typeof (window as any).AndroidContacts.pickContact === "function") {
      (window as any).onAndroidContactSelected = (name: string, phone: string) => {
        localStorage.removeItem("ignore_app_lock");
        clearTimeout(clearLockIgnore);
        if (name === "ERROR") {
          alert("⚠️ حدث خطأ أثناء جلب جهة الاتصال");
        } else if (name !== "CANCELLED") {
          let cleanedPhone = phone || "";
          if (cleanedPhone) {
            cleanedPhone = cleanedPhone.replace(/[\s-()]/g, "");
            if (cleanedPhone.startsWith("00")) cleanedPhone = "+" + cleanedPhone.substring(2);
          }
          callback(name, cleanedPhone);
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

    // 1. Capacitor Native Plugin fallback
    try {
      if (!Contacts || !Contacts.requestPermissions) {
        alert("ميزة جهات الاتصال غير متوفرة على هذا الجهاز.");
        localStorage.removeItem("ignore_app_lock");
        return;
      }
      const permission = await Contacts.requestPermissions();
      if (permission.contacts !== "granted") {
        alert("يرجى منح صلاحية الوصول لجهات الاتصال من إعدادات الجهاز.");
        localStorage.removeItem("ignore_app_lock");
        return;
      }
      const result = await Contacts.pickContact({
        projection: { name: true, phones: true }
      });
      if (result.contact) {
        const name = result.contact.name?.display || "";
        const phone = result.contact.phones?.[0]?.number || "";
        callback(name, phone);
      }
    } catch (e: any) {
      console.error("Error picking contact:", e);
      if (e?.message?.includes("implemented on web")) {
        alert("ميزة اختيار جهات الاتصال تعمل فقط من خلال تطبيق الهاتف.");
      }
    } finally {
      localStorage.removeItem("ignore_app_lock");
      clearTimeout(clearLockIgnore);
    }
  };

  const handlePickRawiContact = () => {
    pickContact((name, phone) => {
      if (name) setRawiName(name);
      if (phone) setRawiPhone(toEnglishDigits(phone.replace(/[^0-9+]/g, '')));
    });
  };

  const handlePickMqawetContact = (index: number) => {
    pickContact((name, phone) => {
      if (name) handleUpdateMqawetRow(index, "name", name);
      if (phone) handleUpdateMqawetRow(index, "phone", toEnglishDigits(phone.replace(/[^0-9+]/g, '')));
    });
  };

  const startNewBatch = () => {
    setActiveBatchId(null);
  };

  const saveToQueue = async () => {
    if (!rawiName) {
      return alert("الرجاء إدخال اسم الرعوي أولاً.");
    }

    setIsSaving(true);
    try {
      const batchData = {
        userId: currentUser.uid,
        date: opDate,
        rawiName: rawiName.trim(),
        rawiPhone: rawiPhone.trim(),
        rawiQty: Number(rawiQty) || 0,
        rawiPrice: Number(rawiPrice) || 0,
        commRawiPct: Number(commRawiPct) || 0,
        commMqawetPct: Number(commMqawetPct) || 0,
        taxPct: Number(taxPct) || 0,
        mqawetList: computedMqawetList.filter(m => m.name || m.qty > 0),
        status: "in_progress",
      };

      if (activeBatchId) {
        await updateDoc(doc(db, "market_batches", activeBatchId), {
           ...batchData,
           updatedAt: serverTimestamp()
        });
        alert("تم تحديث الشحنة في الانتظار.");
      } else {
        const docRef = await addDoc(collection(db, "market_batches"), {
          ...batchData,
          createdAt: serverTimestamp()
        });
        setActiveBatchId(docRef.id);
        alert("تم حفظ الشحنة الجديدة في الانتظار.");
      }
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء الحفظ");
    } finally {
      setIsSaving(false);
    }
  };

  const finalizeBatch = async () => {
    if (!rawiName || Number(rawiQty) <= 0) {
      return alert("يرجى كتابة اسم الرعوي والكمية قبل التصفية النهائية.");
    }
    if (remainingQty < 0) {
      return alert("الكمية الموزعة أكبر من الكمية الموردة! يرجى تصحيح الكميات.");
    }

    const confirm = window.confirm(`هل أنت متأكد من اعتماد الشحنة للرعوي (${rawiName})؟ (لن يتم ترحيلها للحسابات العامة).`);
    if (!confirm) return;

    setIsSaving(true);
    try {
      const batchRef = writeBatch(db);

      const validMqawets = computedMqawetList.filter(m => m.name && m.qty > 0);

      // Mark Batch as completed (Isolated from Main Ledger)
      const batchData = {
        userId: currentUser.uid,
        date: opDate,
        rawiName: rawiName.trim(),
        rawiPhone: rawiPhone.trim(),
        rawiQty: qtyVal,
        rawiPrice: priceVal,
        commRawiPct: cRPct,
        commMqawetPct: cMPct,
        taxPct: tPct,
        mqawetList: validMqawets,
        status: "completed",
        updatedAt: serverTimestamp()
      };

      if (activeBatchId) {
        batchRef.update(doc(db, "market_batches", activeBatchId), batchData);
      } else {
        const newBatchRef = doc(collection(db, "market_batches"));
        batchRef.set(newBatchRef, { ...batchData, createdAt: serverTimestamp() });
      }

      await batchRef.commit();
      alert("تم اعتماد الشحنة بنجاح في قسم المقاوتة!");
      setActiveBatchId(null); // start fresh
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء الاعتماد.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    const confirmDelete = window.confirm("هل أنت متأكد من حذف هذه العملية؟");
    if (!confirmDelete) return;

    const b = batches.find(x => x.id === batchId);
    if (!b) return;

    setIsSaving(true);
    try {
      await deleteDoc(doc(db, "market_batches", batchId));
      alert("تم الحذف بنجاح!");

      if (activeBatchId === batchId) {
        setActiveBatchId(null);
      }
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء محاولة الحذف");
    } finally {
      setIsSaving(false);
    }
  };

  const getTemplate = (type: string) => {
    return messageTemplates.find(t => t.type === type && t.isActive)
           || messageTemplates.find(t => t.type === type && t.isDefault)
           || null;
  };

  const shareRawiWhatsApp = (b: MarketBatch) => {
      let totalVal = b.rawiQty * b.rawiPrice;
      let commVal = totalVal * (b.commRawiPct / 100);
      let taxVal = totalVal * (b.taxPct / 100);
      let net = totalVal - commVal - taxVal;
      let distributedQty = b.mqawetList.reduce((s, m) => s + m.qty, 0);
      let remQty = b.rawiQty - distributedQty;

      let msg = "";
      const template = getTemplate("market_rawi");

      let detailsStr = "";
      if (b.mqawetList.length === 0) {
          detailsStr = "لم يتم تصريف أي كمية حتى الآن.\n";
      } else {
          b.mqawetList.forEach((m, idx) => {
              detailsStr += `${idx + 1}) أخذ المقوت *(${m.name})* من حسابك كمية *(${m.qty})* بحساب *(${b.rawiPrice.toLocaleString()})* = *${m.baseVal.toLocaleString()}* ريال\n`;
          });
      }

      if (template) {
         msg = template.content
           .replace(/{الاسم}/g, b.rawiName)
           .replace(/{التاريخ}/g, b.date)
           .replace(/{إجمالي_الكمية}/g, b.rawiQty.toString())
           .replace(/{سعر_الوحدة}/g, b.rawiPrice.toLocaleString())
           .replace(/{تفاصيل_المقاوتة}/g, detailsStr)
           .replace(/{صافي_الرعوي}/g, net.toLocaleString())
           .replace(/{الرصيد_السابق}/g, "") // Not applicable here unless we calculate it
           .replace(/{المبلغ_المضاف}/g, net.toLocaleString())
           .replace(/{الرصيد_الحالي}/g, net.toLocaleString()); // simplified
      } else {
          // Fallback
          msg = `*تصفية وتفريغ شحنة الأخ / ${b.rawiName}*\n`;
          msg += `📅 *تاريخ التوريد:* ${b.date}\n`;
          msg += `📦 *إجمالي الكمية الموردة:* (${b.rawiQty}) بسعر (${b.rawiPrice.toLocaleString()}) = ${totalVal.toLocaleString()} ريال\n`;
          msg += `--------------------------------\n`;
          msg += `*تفاصيل توزيع بضاعتك على المقاوتة:*\n`;
          msg += detailsStr;
          msg += `--------------------------------\n`;
          msg += `📦 *المصرف:* (${distributedQty}) | *المتبقي طرفنا:* (${remQty})\n`;
          msg += `💰 *إجمالي قيمة البضاعة:* ${totalVal.toLocaleString()} ريال\n`;
          msg += `🔻 *يخصم عمولة المصلح (${b.commRawiPct}%):* - ${commVal.toLocaleString()} ريال\n`;
          if (taxVal > 0) {
              msg += `🔻 *يخصم الضريبة (${b.taxPct}%):* - ${taxVal.toLocaleString()} ريال\n`;
          }
          msg += `--------------------------------\n`;
          msg += `💵 *صافي المبلغ المستحق لك بالكامل (خالص):* ${net.toLocaleString()} ريال\n\n`;
          msg += `شاكرين تعاملكم معنا.`;
      }

      let cleanPhone = b.rawiPhone ? b.rawiPhone.replace(/[^0-9]/g, '') : '';
      if (cleanPhone.startsWith('0')) cleanPhone = '967' + cleanPhone.substring(1);

      let url = cleanPhone
          ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`
          : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

      window.open(url, '_blank');
  };

  const shareRawiSMS = (b: MarketBatch) => {
      let totalVal = b.rawiQty * b.rawiPrice;
      let commVal = totalVal * (b.commRawiPct / 100);
      let taxVal = totalVal * (b.taxPct / 100);
      let net = totalVal - commVal - taxVal;

      // Keep it short for SMS
      let msg = `فاتورة الرعوي: ${b.rawiName}\n`;
      msg += `تاريخ: ${b.date}\n`;
      msg += `الكمية: ${b.rawiQty} بسعر ${b.rawiPrice.toLocaleString()}\n`;
      msg += `العمولة: ${commVal.toLocaleString()}\n`;
      if (taxVal > 0) msg += `الضريبة: ${taxVal.toLocaleString()}\n`;
      msg += `الصافي: ${net.toLocaleString()} ريال\n`;

      let cleanPhone = b.rawiPhone ? b.rawiPhone.replace(/[^0-9]/g, '') : '';
      if (!cleanPhone) {
        alert("لا يوجد رقم هاتف للرعوي.");
        return;
      }

      let url = `sms:${cleanPhone}?body=${encodeURIComponent(msg)}`;
      window.open(url, '_self');
  };

  const doPrint = (printHTML: string) => {
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

  const printRawiReport = (b: MarketBatch) => {
      let totalVal = b.rawiQty * b.rawiPrice;
      let commVal = totalVal * (b.commRawiPct / 100);
      let taxVal = totalVal * (b.taxPct / 100);
      let net = totalVal - commVal - taxVal;
      let distributedQty = b.mqawetList.reduce((s, m) => s + m.qty, 0);
      let remQty = b.rawiQty - distributedQty;

      let html = `
        <div style="direction: rtl; font-family: 'Cairo', sans-serif; padding: 20px; color: black; background: white;">
          <h2 style="text-align:center; border-bottom: 2px solid #333; padding-bottom: 10px;">فاتورة تصفية مورد (الرعوي)</h2>
          <div style="margin-bottom: 20px; line-height: 1.6;">
            <strong>الرعوي:</strong> ${b.rawiName}<br/>
            <strong>التاريخ:</strong> ${b.date}<br/>
            <strong>الكمية الموردة:</strong> ${b.rawiQty} بسعر ${b.rawiPrice.toLocaleString()} ريال = ${totalVal.toLocaleString()} ريال
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f1f5f9;">
                <th style="border: 1px solid #cbd5e1; padding: 8px;">م</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px;">اسم المقوت</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px;">الكمية</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px;">القيمة</th>
              </tr>
            </thead>
            <tbody>
      `;

      b.mqawetList.forEach((m, idx) => {
        html += `
              <tr>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align:center;">${idx + 1}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align:center;">${m.name}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align:center;">${m.qty}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align:center;">${m.baseVal.toLocaleString()} ريال</td>
              </tr>
        `;
      });

      html += `
            </tbody>
          </table>

          <div style="margin-top: 20px; border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
              <span><strong>إجمالي الكمية المصرفة:</strong> ${distributedQty}</span>
              <span style="color: red;"><strong>المتبقي:</strong> ${remQty}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
              <span><strong>قيمة المبيعات الإجمالية:</strong></span>
              <span>${totalVal.toLocaleString()} ريال</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; color:red;">
              <span><strong>عمولة المصلح (${b.commRawiPct}%):</strong></span>
              <span>- ${commVal.toLocaleString()} ريال</span>
            </div>
            ${taxVal > 0 ? `<div style="display:flex; justify-content:space-between; margin-bottom:8px; color:red;">
              <span><strong>الضريبة (${b.taxPct}%):</strong></span>
              <span>- ${taxVal.toLocaleString()} ريال</span>
            </div>` : ''}
            <div style="display:flex; justify-content:space-between; margin-top:15px; padding-top:15px; border-top: 2px solid #333; font-size: 18px;">
              <span><strong>صافي المستحق (خالص):</strong></span>
              <span><strong>${net.toLocaleString()} ريال</strong></span>
            </div>
          </div>
        </div>
      `;
      doPrint(html);
  };

  const printMasterReport = () => {
    let totalSupply = batches.reduce((s, b) => s + (b.rawiQty * b.rawiPrice), 0);
    let totalComm = batches.reduce((s, b) => s + (b.rawiQty * b.rawiPrice * (b.commRawiPct / 100)) + b.mqawetList.reduce((ss, m) => ss + m.comm, 0), 0);
    let totalTax = batches.reduce((s, b) => s + (b.rawiQty * b.rawiPrice * (b.taxPct / 100)), 0);

    let html = `
      <div style="direction: rtl; font-family: 'Cairo', sans-serif; padding: 20px; color: black; background: white;">
        <h2 style="text-align:center; border-bottom: 2px solid #333; padding-bottom: 10px;">التقرير المجمع الشامل (مقوت السوق)</h2>

        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px;">
           <div>
             <strong>مجموع التوريد:</strong> ${totalSupply.toLocaleString()} ريال
           </div>
           <div>
             <strong>إجمالي أرباح المصلح:</strong> ${totalComm.toLocaleString()} ريال
           </div>
           <div>
             <strong>إجمالي الضرائب:</strong> ${totalTax.toLocaleString()} ريال
           </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="border: 1px solid #cbd5e1; padding: 8px;">التاريخ</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">الرعوي</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">كمية/سعر</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">المقوت (المستلم)</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">كمية السحب</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">مطلوب من المقوت</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">صافي الرعوي</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (batches.length === 0) {
      html += `<tr><td colspan="7" style="border: 1px solid #cbd5e1; padding: 8px; text-align:center;">لا توجد حركات مسجلة.</td></tr>`;
    } else {
      batches.forEach(op => {
        op.mqawetList.forEach((m, idx) => {
          let rawiNet = ((m.baseVal) - (m.baseVal * (op.commRawiPct / 100))).toLocaleString();
          html += `
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align:center;">${op.date}</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align:center;">${op.rawiName}</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align:center;">${op.rawiQty} بـ ${op.rawiPrice.toLocaleString()}</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align:center;">${m.name}</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align:center;">${m.qty}</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align:center;">${m.totalRequired.toLocaleString()}</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align:center;">${rawiNet}</td>
            </tr>
          `;
        });
      });
    }

    html += `
          </tbody>
        </table>
      </div>
    `;
    doPrint(html);
  };

  const printMqawetReport = (name: string) => {
      let records: any[] = [];
      batches.forEach(op => {
          op.mqawetList.forEach(m => {
              if (m.name === name) {
                  records.push({
                      date: op.date,
                      rawiName: op.rawiName || 'رعوي مجهول',
                      qty: m.qty,
                      price: m.price,
                      baseVal: m.baseVal,
                      comm: m.comm,
                      totalRequired: m.totalRequired
                  });
              }
          });
      });

      if (records.length === 0) return;

      let total = records.reduce((s, r) => s + r.totalRequired, 0);
      const pExist = persons.find(p => p.name === name && p.type === "customers");
      const actualBalance = pExist ? pExist.balance : total;
      const diff = actualBalance - total;

      let html = `
        <div style="direction: rtl; font-family: 'Cairo', sans-serif; padding: 20px; color: black; background: white;">
          <h2 style="text-align:center; border-bottom: 2px solid #333; padding-bottom: 10px;">كشف حساب المقوت</h2>
          <div style="margin-bottom: 20px; font-size: 18px;">
            <strong>اسم المقوت:</strong> ${name}
          </div>
          ${diff !== 0 ? `<div style="margin-bottom: 10px; padding: 10px; background-color: #f1f5f9; border-radius: 6px;">
            <strong>رصيد أو دفعات سابقة (خارج هذه الشحنات):</strong> ${diff > 0 ? `+${diff.toLocaleString()} (عليه)` : `${diff.toLocaleString()} (له)`}
          </div>` : ''}
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f1f5f9;">
                <th style="border: 1px solid #cbd5e1; padding: 8px;">م</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px;">التاريخ</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px;">الرعوي</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px;">الكمية</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px;">السعر</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px;">القيمة</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px;">العمولة</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px;">المطلوب</th>
              </tr>
            </thead>
            <tbody>
      `;

      records.forEach((r, idx) => {
        html += `
              <tr>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align:center;">${idx + 1}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align:center;">${r.date}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align:center;">${r.rawiName}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align:center;">${r.qty}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align:center;">${r.price.toLocaleString()}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align:center;">${r.baseVal.toLocaleString()}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align:center;">${r.comm.toLocaleString()}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align:center; font-weight:bold;">${r.totalRequired.toLocaleString()}</td>
              </tr>
        `;
      });

      html += `
            </tbody>
          </table>
          <div style="margin-top: 20px; padding: 15px; border: 2px solid #333; border-radius: 8px; font-size: 18px; display:flex; justify-content:space-between;">
            <span><strong>الرصيد الإجمالي المطلوب سداده:</strong></span>
            <span style="color:red;"><strong>${actualBalance.toLocaleString()} ريال</strong></span>
          </div>
        </div>
      `;
      doPrint(html);
  };

  const shareMqawetWhatsApp = (name: string, phone: string) => {
      let records: any[] = [];
      batches.forEach(op => {
          op.mqawetList.forEach(m => {
              if (m.name === name) {
                  records.push({
                      date: op.date,
                      rawiName: op.rawiName || 'رعوي مجهول',
                      qty: m.qty,
                      price: m.price,
                      baseVal: m.baseVal,
                      comm: m.comm,
                      totalRequired: m.totalRequired
                  });
              }
          });
      });

      if (records.length === 0) return;

      let total = records.reduce((s, r) => s + r.totalRequired, 0);
      const pExist = persons.find(p => p.name === name && p.type === "customers");
      const actualBalance = pExist ? pExist.balance : total;

      const template = getTemplate("market_mqawet");
      let msg = "";

      let detailsStr = "";
      records.forEach((r, idx) => {
          detailsStr += `${idx + 1}) *بتاريخ:* ${r.date}\n`;
          detailsStr += `أخذت من الرعوي *(${r.rawiName})* كمية *(${r.qty})* من حساب *(${r.price.toLocaleString()})*، القيمة *(${r.baseVal.toLocaleString()})* + عمولة *(${r.comm.toLocaleString()})*\n`;
          detailsStr += `👈 *المطلوب:* ${r.totalRequired.toLocaleString()} ريال\n\n`;
      });

      if (template) {
         msg = template.content
           .replace(/{الاسم}/g, name)
           .replace(/{التاريخ}/g, new Date().toLocaleDateString('ar-EG'))
           .replace(/{تفاصيل_المقاوتة}/g, detailsStr)
           .replace(/{إجمالي_المطلوب}/g, actualBalance.toLocaleString())
           .replace(/{الرصيد_السابق}/g, "")
           .replace(/{المبلغ_المضاف}/g, total.toLocaleString())
           .replace(/{الرصيد_الحالي}/g, actualBalance.toLocaleString());
      } else {
          msg = `*كشف حساب الأخ / ${name}*\n`;
          msg += `تحية طيبة، تفاصيل مسحوباتكم كالتالي:\n`;
          msg += `--------------------------------\n`;
          msg += detailsStr;
          msg += `--------------------------------\n`;
          msg += `💰 *الرصيد الإجمالي المطلوب سداده:* ${actualBalance.toLocaleString()} ريال\n`;
          msg += `شاكرين حسن تعاونكم معنا.`;
      }

      let cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
      if (cleanPhone.startsWith('0')) cleanPhone = '967' + cleanPhone.substring(1);

      let url = cleanPhone
          ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`
          : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

      window.open(url, '_blank');
  };

  // Render variables for reports
  const rawiNames = Array.from(new Set(batches.filter(x => x.rawiName).map(x => x.rawiName)));
  const targetRawiOps = rawiFilter === "ALL" ? batches.filter(x => x.rawiName) : batches.filter(x => x.rawiName === rawiFilter);

  const mqawetNames = Array.from(new Set(batches.flatMap(op => op.mqawetList.filter(m => m.name).map(m => m.name)))) as string[];

  let mqawetGroups: any = {};
  batches.forEach(op => {
      op.mqawetList.forEach(m => {
          if (mqawetFilter === "ALL" || m.name === mqawetFilter) {
              if (!mqawetGroups[m.name]) mqawetGroups[m.name] = { phone: m.phone, records: [] };
              if (m.phone && m.phone !== '-') mqawetGroups[m.name].phone = m.phone;
              mqawetGroups[m.name].records.push({
                  batchId: op.id,
                  date: op.date,
                  rawiName: op.rawiName || 'رعوي مجهول',
                  qty: m.qty,
                  price: m.price,
                  baseVal: m.baseVal,
                  comm: m.comm,
                  totalRequired: m.totalRequired
              });
          }
      });
  });

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800" dir="rtl">
      {/* Header */}
      <div className="px-6 pt-4 pb-6 bg-gradient-to-b from-amber-600 to-amber-500 rounded-b-[2rem] relative shadow-lg text-white">
        <header className="flex justify-between items-center mb-4">
          <button
            onClick={() => onNavigate("qat_dashboard", "إدارة القات")}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition cursor-pointer"
          >
            <ArrowRight size={20} />
          </button>
          <div className="flex flex-col items-center">
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
              <Store size={22} />
              مقوت من السوق
            </h1>
          </div>
          <div className="w-10"></div>
        </header>

        {/* Tabs */}
        <div className="flex bg-white/20 p-1 rounded-2xl gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: "entry", label: "التوزيع" },
            { id: "clients", label: "العملاء" },
            { id: "rawi-rep", label: "كشف الرعية" },
            { id: "mqawet-rep", label: "كشف المقاوتة" },
            { id: "master-rep", label: "التقرير الشامل" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 min-w-[55px] py-2 px-1 text-[9px] sm:text-[11px] font-black rounded-xl transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-white text-amber-600 shadow-sm"
                  : "text-amber-50 hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 pb-24">
        {activeTab === "clients" && (
          <div className="space-y-4 max-w-2xl mx-auto">
             <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-4">
                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2 mb-2"><User size={20} className="text-amber-500"/> أرصدة عملاء السوق (مستقلة)</h3>
                <p className="text-xs text-slate-500 font-bold leading-relaxed">
                   تعرض هذه الشاشة حسابات (الرعية والمقاوتة) المستنتجة من حركة شحنات التوزيع فقط، وهي مفصولة تماماً عن الحسابات العامة (سندات القبض والصرف).
                </p>
             </div>

             <div className="space-y-3">
               {getIsolatedClients().map((client, i) => (
                 <div key={i} className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center ${client.type === 'rawi' ? 'border-r-4 border-r-amber-500' : 'border-r-4 border-r-indigo-500'}`}>
                   <div>
                      <div className="font-black text-slate-800 text-base">{client.name}</div>
                      <div className="text-[10px] font-bold text-slate-500 flex gap-2 mt-1">
                         <span className={`px-2 py-0.5 rounded-md ${client.type === 'rawi' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>{client.type === 'rawi' ? 'رعوي (مورد)' : 'مقوت (مستلم)'}</span>
                         {client.phone && <span dir="ltr">{client.phone}</span>}
                      </div>
                   </div>
                   <div className="text-left">
                      <span className="block text-[10px] text-slate-400 font-bold">الرصيد الكلي</span>
                      <span className={`font-black text-lg ${client.balance > 0 ? 'text-rose-500' : client.balance < 0 ? 'text-emerald-500' : 'text-slate-600'}`}>
                         {Math.abs(client.balance).toLocaleString()} ريال
                      </span>
                      <span className={`block text-[10px] font-black ${client.balance > 0 ? 'text-rose-500' : client.balance < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                         {client.balance > 0 ? '(عليه - مطلوب)' : client.balance < 0 ? '(له - مستحق)' : 'صفر'}
                      </span>
                   </div>
                 </div>
               ))}
               {getIsolatedClients().length === 0 && (
                 <div className="text-center p-8 bg-slate-100 rounded-2xl text-slate-400 font-bold text-sm">لا يوجد عملاء مسجلين في السوق بعد.</div>
               )}
             </div>
          </div>
        )}

        {activeTab === "entry" && (
          <div className="space-y-4 max-w-2xl mx-auto">
            {/* Queue Box */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <span className="font-bold text-amber-800 text-sm flex items-center gap-1.5"><Package size={16}/> شحنات الرعية قيد التصريف:</span>
                <span className="bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full text-xs font-black">{inProgressBatches.length} شحنات</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {inProgressBatches.length === 0 ? (
                  <div className="text-xs text-amber-700/70 font-bold">لا توجد شحنات معلقة.</div>
                ) : (
                  inProgressBatches.map(b => {
                    const isActive = b.id === activeBatchId;
                    const dQty = b.mqawetList.reduce((s, m) => s + m.qty, 0);
                    return (
                      <div
                        key={b.id}
                        onClick={() => setActiveBatchId(b.id)}
                        className={`min-w-[160px] p-3 rounded-xl border cursor-pointer transition ${isActive ? 'bg-white border-amber-500 shadow-md ring-2 ring-amber-500/20' : 'bg-white/60 border-amber-200 hover:bg-white'}`}
                      >
                        <div className="font-black text-slate-800 text-sm truncate mb-1">👤 {b.rawiName || 'بدون اسم'}</div>
                        <div className="text-xs font-bold text-slate-500 flex justify-between">
                          <span>الكمية: {b.rawiQty}</span>
                          <span className="text-rose-500">باقي: {b.rawiQty - dQty}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <button
              onClick={startNewBatch}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-sm transition"
            >
              <Plus size={18} />
              فتح شحنة لرعوي جديد (وإبقاء الحالي في الانتظار)
            </button>

            {/* Active Batch Form */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                <h3 className="font-black text-slate-800 flex items-center gap-2"><User size={18} className="text-amber-500"/> بيانات الرعوي (المورد)</h3>
                <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-[10px] font-black">{activeBatchId ? 'تعديل شحنة' : 'شحنة جديدة'}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-2">
                  <label className="text-xs font-black text-slate-500 block mb-1.5">التاريخ</label>
                  <input type="date" value={opDate} onChange={(e) => setOpDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-amber-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-black text-slate-500 block mb-1.5">اسم الرعوي</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={rawiName}
                        onFocus={() => setOpenRawiDropdown(true)}
                        onBlur={() => setTimeout(() => setOpenRawiDropdown(false), 200)}
                        onChange={(e) => {
                          setRawiName(e.target.value);
                          setOpenRawiDropdown(true);
                          const exist = persons.find(p => p.name === e.target.value && p.type === "suppliers");
                          if(exist && exist.phone) setRawiPhone(exist.phone);
                        }}
                        placeholder="اسم المورد..."
                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-amber-500"
                      />
                      {openRawiDropdown && (
                        <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto mt-1 py-1">
                          {persons.filter(p => p.type === "suppliers" && (p.name.includes(rawiName) || p.phone?.includes(rawiName))).map(p => (
                            <div key={p.id} onClick={() => { setRawiName(p.name); setRawiPhone(p.phone || ""); setOpenRawiDropdown(false); }} className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-bold border-b border-slate-50 last:border-0 flex justify-between items-center">
                              <span>{p.name}</span>
                              {p.phone && <span className="text-[10px] text-slate-400" dir="ltr">{p.phone}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={handlePickRawiContact} className="w-12 flex items-center justify-center bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition shrink-0" title="اختيار من جهات الاتصال">
                      <Phone size={18} />
                    </button>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-black text-slate-500 block mb-1.5">رقم الجوال (اختياري)</label>
                  <input type="tel" value={rawiPhone} onChange={(e) => setRawiPhone(toEnglishDigits(e.target.value))} placeholder="07..." className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-amber-500 text-left" dir="ltr" />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 block mb-1.5">الكمية الموردة</label>
                  <input type="number" value={rawiQty} onChange={(e) => setRawiQty(e.target.value ? Number(toEnglishDigits(e.target.value)) : "")} placeholder="0" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 block mb-1.5">سعر الوحدة</label>
                  <input type="number" value={rawiPrice} onChange={(e) => setRawiPrice(e.target.value ? Number(toEnglishDigits(e.target.value)) : "")} placeholder="0" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-amber-500" />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
                <h3 className="font-black text-slate-800 text-sm mb-3 flex items-center gap-2">
                   <Leaf size={16} className="text-emerald-500"/> النسب والعمولات (%)
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col items-center bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                    <label className="text-[10px] font-black text-slate-500 block mb-1">من الرعوي</label>
                    <input type="number" value={commRawiPct} onChange={(e) => setCommRawiPct(e.target.value ? Number(toEnglishDigits(e.target.value)) : "")} placeholder="0%" className="w-full bg-slate-50 border border-slate-100 py-1.5 px-1 rounded-lg text-sm font-bold outline-none focus:border-amber-500 focus:bg-white transition text-center" />
                  </div>
                  <div className="flex flex-col items-center bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                    <label className="text-[10px] font-black text-slate-500 block mb-1">من المقوت</label>
                    <input type="number" value={commMqawetPct} onChange={(e) => setCommMqawetPct(e.target.value ? Number(toEnglishDigits(e.target.value)) : "")} placeholder="0%" className="w-full bg-slate-50 border border-slate-100 py-1.5 px-1 rounded-lg text-sm font-bold outline-none focus:border-amber-500 focus:bg-white transition text-center" />
                  </div>
                  <div className="flex flex-col items-center bg-rose-50 p-2 rounded-xl shadow-sm border border-rose-100">
                    <label className="text-[10px] font-black text-rose-500 block mb-1">الضريبة</label>
                    <input type="number" value={taxPct} onChange={(e) => setTaxPct(e.target.value ? Number(toEnglishDigits(e.target.value)) : "")} placeholder="0%" className="w-full bg-white border border-rose-200 py-1.5 px-1 rounded-lg text-sm font-bold outline-none focus:border-rose-500 text-center text-rose-600 transition" />
                  </div>
                </div>
              </div>

              {/* Distribution */}
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                  <Store size={18} className="text-indigo-500"/> توزيع الكمية على المقاوتة
                </h3>
                {remainingQty < 0 && <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-lg shadow-sm border border-rose-200 animate-pulse">⚠️ تجاوزت الكمية الموردة!</span>}
              </div>

              <div className="space-y-3 mb-4">
                {computedMqawetList.map((m, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm hover:border-amber-300 transition-colors group">
                    <div className="flex gap-2 mb-2 relative">
                      <div className="absolute -right-2 -top-2 bg-slate-800 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm z-10">
                         {idx + 1}
                      </div>
                      <div className="flex-1 relative mr-3">
                        <input
                          type="text"
                          placeholder="اسم المقوت..."
                          value={m.name}
                          onFocus={() => setOpenMqawetDropdownIndex(idx)}
                          onBlur={() => setTimeout(() => setOpenMqawetDropdownIndex(null), 200)}
                          onChange={(e) => {
                            handleUpdateMqawetRow(idx, "name", e.target.value);
                            setOpenMqawetDropdownIndex(idx);
                          }}
                          className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold outline-none focus:border-amber-500 focus:bg-white transition"
                        />
                        {openMqawetDropdownIndex === idx && (
                          <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto mt-1 py-1">
                            {persons
                              .filter(p => p.type === "customers" && (p.name.includes(m.name) || p.phone?.includes(m.name)))
                              .map(p => (
                              <div
                                key={p.id}
                                onClick={() => {
                                  handleUpdateMqawetRow(idx, "name", p.name);
                                  handleUpdateMqawetRow(idx, "phone", p.phone || "");
                                  setOpenMqawetDropdownIndex(null);
                                }}
                                className="px-4 py-2 hover:bg-amber-50 cursor-pointer text-sm font-bold border-b border-slate-50 last:border-0 flex justify-between items-center"
                              >
                                <span>{p.name}</span>
                                {p.phone && <span className="text-[10px] text-slate-400" dir="ltr">{p.phone}</span>}
                              </div>
                            ))}
                            {/* Unique names from batches that aren't in persons list yet */}
                            {mqawetNames
                              .filter(n => n.includes(m.name) && !persons.some(p => p.type === "customers" && p.name === n))
                              .map(n => (
                              <div
                                key={n}
                                onClick={() => {
                                  handleUpdateMqawetRow(idx, "name", n);
                                  setOpenMqawetDropdownIndex(null);
                                }}
                                className="px-4 py-2 hover:bg-amber-50 cursor-pointer text-sm font-bold border-b border-slate-50 last:border-0"
                              >
                                {n}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => handlePickMqawetContact(idx)} className="w-10 flex items-center justify-center bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 hover:text-slate-800 transition shrink-0" title="اختيار من جهات الاتصال">
                        <Phone size={16} />
                      </button>
                      <div className="w-20 shrink-0">
                        <input type="number" placeholder="الكمية" value={m.qty || ""} onChange={(e) => handleUpdateMqawetRow(idx, "qty", e.target.value ? Number(toEnglishDigits(e.target.value)) : "")} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold outline-none focus:border-amber-500 focus:bg-white transition text-center" />
                      </div>
                      <button onClick={() => handleRemoveMqawetRow(idx)} className="w-10 flex items-center justify-center bg-rose-50 text-rose-400 rounded-xl hover:bg-rose-500 hover:text-white transition shrink-0" title="حذف المقوت">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {/* Computed feedback */}
                    <div className="flex justify-between text-[10px] font-black text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 ml-12">
                      <span>السعر: {toArabicDigits(m.price)}</span>
                      <span>إجمالي المطلوب: <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">{toArabicDigits(m.totalRequired)}</span></span>
                    </div>
                    {m.name && (
                      <div className="mt-2 ml-12 text-[10px] font-bold text-indigo-500 flex justify-between items-center bg-indigo-50/50 p-1.5 rounded-lg border border-indigo-100/50">
                         <span>سحبيات سابقة: {toArabicDigits(getMqawetHistoricalDebt(m.name, activeBatchId || undefined))} ريال</span>
                         {m.phone && <span dir="ltr" className="text-slate-400 bg-white px-1 rounded text-[9px] border border-slate-200">{m.phone}</span>}
                      </div>
                    )}
                  </div>
                ))}

                <button onClick={handleAddMqawetRow} className="w-full py-2.5 border-2 border-dashed border-slate-300 text-slate-500 font-bold rounded-xl hover:bg-slate-50 transition text-xs flex justify-center items-center gap-1">
                  <Plus size={14} /> إضافة مقوت آخر
                </button>
              </div>

              {/* Live Summary */}
              <div className="bg-slate-900 rounded-2xl p-4 text-white mb-6 shadow-md">
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div className="bg-slate-800 p-2 rounded-xl text-center">
                    <span className="block text-[10px] text-slate-400 font-bold mb-0.5">قيمة التوريد الإجمالية</span>
                    <span className="font-black text-sm">{toArabicDigits(rawiTotalValue)}</span>
                  </div>
                  <div className="bg-slate-800 p-2 rounded-xl text-center">
                    <span className="block text-[10px] text-slate-400 font-bold mb-0.5">صافي الرعوي (المورد)</span>
                    <span className="font-black text-sm text-emerald-400">{toArabicDigits(netRawi)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800 p-2 rounded-xl text-center">
                    <span className="block text-[10px] text-slate-400 font-bold mb-0.5">الموزع / المتبقي</span>
                    <span className={`font-black text-sm ${remainingQty < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                      {toArabicDigits(totalDistributedQty)} / {toArabicDigits(remainingQty)}
                    </span>
                  </div>
                  <div className="bg-amber-500/20 p-2 rounded-xl text-center border border-amber-500/30">
                    <span className="block text-[10px] text-amber-200 font-bold mb-0.5">إجمالي أرباح المصلح</span>
                    <span className="font-black text-sm text-amber-400">{toArabicDigits(totalProfit)}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={saveToQueue}
                  disabled={isSaving}
                  className="w-full py-3.5 bg-amber-50 text-amber-600 font-black rounded-2xl hover:bg-amber-100 transition shadow-sm border border-amber-200"
                >
                  حفظ في صندوق الانتظار مؤقتاً
                </button>
                <button
                  onClick={finalizeBatch}
                  disabled={isSaving}
                  className="w-full py-4 bg-emerald-500 text-white font-black rounded-2xl hover:bg-emerald-600 transition shadow-md shadow-emerald-500/20"
                >
                  إغلاق وتصفية نهائية (ترحيل للحسابات)
                </button>
                {activeBatchId && (
                  <button
                    onClick={() => handleDeleteBatch(activeBatchId)}
                    disabled={isSaving}
                    className="w-full py-3 text-rose-500 font-black rounded-2xl hover:bg-rose-50 transition border border-transparent hover:border-rose-200 flex items-center justify-center gap-2"
                  >
                    <Trash2 size={18} />
                    حذف العملية نهائياً
                  </button>
                )}
              </div>

            </div>
          </div>
        )}

        {activeTab === "rawi-rep" && (
          <div className="space-y-4 max-w-2xl mx-auto">
             <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <label className="text-xs font-black text-slate-500 block mb-2">تحديد الرعوي (المورد)</label>
                <select value={rawiFilter} onChange={(e) => setRawiFilter(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none">
                  <option value="ALL">-- كل الرعية (كشف مجمع) --</option>
                  {rawiNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
             </div>

             {targetRawiOps.length === 0 ? (
                <div className="text-center p-8 bg-slate-100 rounded-2xl text-slate-400 font-bold text-sm">لا توجد شحنات مسجلة.</div>
             ) : (
                targetRawiOps.map(op => {
                   let totalVal = op.rawiQty * op.rawiPrice;
                   let commVal = totalVal * (op.commRawiPct / 100);
                   let taxVal = totalVal * (op.taxPct / 100);
                   let net = totalVal - commVal - taxVal;
                   let distributedQty = op.mqawetList.reduce((s, m) => s + m.qty, 0);
                   let remQty = op.rawiQty - distributedQty;
                   let isDone = op.status === 'completed';

                   return (
                     <div key={op.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 mb-4 border-t-4 border-t-amber-500">
                        <div className="flex justify-between items-start mb-3">
                           <div>
                              <h3 className="font-black text-slate-800 text-base">👤 الرعوي: {op.rawiName}</h3>
                              <p className="text-[10px] text-slate-400 font-bold">{op.rawiPhone || 'بدون رقم'}</p>
                           </div>
                           <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${isDone ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                             {isDone ? 'شحنة مصفاة' : 'قيد التصريف'}
                           </span>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl text-xs font-bold text-slate-600 mb-4 border border-slate-100">
                          📅 تاريخ التوريد: {op.date} <br/>
                          📦 إجمالي التوريد: {op.rawiQty} بسعر {op.rawiPrice.toLocaleString()} = <span className="text-slate-800 font-black">{totalVal.toLocaleString()} ريال</span>
                        </div>

                        <div className="text-xs font-black text-amber-600 mb-2">📋 تفاصيل تفريغ البضاعة:</div>
                        <div className="space-y-2 mb-4">
                           {op.mqawetList.map((m, idx) => (
                              <div key={idx} className="bg-amber-50/50 border-r-4 border-amber-400 p-2.5 rounded-lg text-xs leading-relaxed text-slate-700 font-bold">
                                {idx + 1}) أخذ المقوت <strong>({m.name})</strong> كمية <strong>({m.qty})</strong> بحساب <strong>({op.rawiPrice.toLocaleString()})</strong> <br/>
                                الإجمالي = <strong className="text-amber-600">{m.baseVal.toLocaleString()} ريال</strong>
                              </div>
                           ))}
                           {op.mqawetList.length === 0 && <div className="text-xs text-slate-400">لم يتم تصريف أي كمية بعد.</div>}
                        </div>

                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-xs font-bold space-y-2 text-slate-700">
                           <div className="flex justify-between"><span>📦 إجمالي المصرف: {distributedQty}</span> <span className="text-rose-500">المتبقي: {remQty}</span></div>
                           <div className="flex justify-between"><span>💰 إجمالي قيمة البضاعة:</span> <span>{totalVal.toLocaleString()} ريال</span></div>
                           <div className="flex justify-between text-rose-500"><span>🔻 عمولة المصلح ({op.commRawiPct}%):</span> <span>- {commVal.toLocaleString()} ريال</span></div>
                           <div className="flex justify-between text-rose-500"><span>🔻 الضريبة ({op.taxPct}%):</span> <span>- {taxVal.toLocaleString()} ريال</span></div>
                           <div className="border-t border-emerald-200/50 pt-2 mt-2 flex justify-between items-center text-sm font-black text-emerald-700">
                              <span>💵 صافي المستحق (خالص):</span>
                              <span>{net.toLocaleString()} ريال</span>
                           </div>
                        </div>

                        <div className="flex gap-2 mt-4 flex-wrap sm:flex-nowrap">
                           <button onClick={() => handleDeleteBatch(op.id)} className="w-12 py-3 flex items-center justify-center bg-rose-50 text-rose-500 font-black rounded-xl hover:bg-rose-100 transition shadow-sm">
                              <Trash2 size={18} />
                           </button>
                           <button onClick={() => printRawiReport(op)} className="w-12 py-3 flex items-center justify-center bg-indigo-50 text-indigo-500 font-black rounded-xl hover:bg-indigo-100 transition shadow-sm" title="طباعة الكشف">
                              <Printer size={18} />
                           </button>
                           <button onClick={() => shareRawiSMS(op)} className="w-12 py-3 flex items-center justify-center bg-blue-50 text-blue-500 font-black rounded-xl hover:bg-blue-100 transition shadow-sm" title="رسالة نصية">
                              <span className="font-black text-[10px]">SMS</span>
                           </button>
                           <button onClick={() => shareRawiWhatsApp(op)} className="flex-1 min-w-[150px] py-3 bg-[#25d366] text-white font-black rounded-xl hover:bg-[#20bd5a] transition flex items-center justify-center gap-2 shadow-sm">
                              عبر واتساب
                           </button>
                        </div>
                     </div>
                   );
                })
             )}
          </div>
        )}

        {activeTab === "mqawet-rep" && (
          <div className="space-y-4 max-w-2xl mx-auto">
             <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <label className="text-xs font-black text-slate-500 block mb-2">تحديد المقوت (السوق)</label>
                <select value={mqawetFilter} onChange={(e) => setMqawetFilter(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none">
                  <option value="ALL">-- كل المقاوتة (تقرير شامل) --</option>
                  {mqawetNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
             </div>

             {Object.keys(mqawetGroups).length === 0 ? (
                <div className="text-center p-8 bg-slate-100 rounded-2xl text-slate-400 font-bold text-sm">لا توجد مسحوبات مسجلة للمقاوتة.</div>
             ) : (
                Object.keys(mqawetGroups).map(name => {
                   const data = mqawetGroups[name];
                   const batchTotal = data.records.reduce((s: number, r: any) => s + r.totalRequired, 0);
                   const pExist = persons.find(p => p.name === name && p.type === "customers");
                   const actualBalance = pExist ? pExist.balance : batchTotal;
                   const diff = actualBalance - batchTotal;

                   return (
                     <div key={name} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 mb-4 border-t-4 border-t-indigo-500">
                        <div className="flex justify-between items-center mb-4">
                           <h3 className="font-black text-slate-800 text-base">👤 المقوت: {name}</h3>
                           <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg text-[10px] font-black">{data.records.length} مسحوبات</span>
                        </div>

                        <div className="space-y-3 mb-4">
                           {diff !== 0 && (
                             <div className="bg-slate-100 border-r-4 border-slate-400 p-3 rounded-lg text-xs font-bold text-slate-600">
                                📌 <strong>رصيد أو دفعات سابقة (خارج هذه الشحنات):</strong> {diff > 0 ? `+${diff.toLocaleString()} (عليه)` : `${diff.toLocaleString()} (له)`}
                             </div>
                           )}
                           {data.records.map((r: any, idx: number) => (
                              <div key={idx} className="bg-slate-50 border-r-4 border-indigo-400 p-3 rounded-lg text-xs leading-relaxed text-slate-700 font-bold border border-slate-100 relative group">
                                 📅 التاريخ: {r.date} <br/>
                                 📌 أخذت من الرعوي <strong>({r.rawiName})</strong> كمية <strong>({r.qty})</strong> بسعر <strong>({r.price.toLocaleString()})</strong> <br/>
                                 القيمة ({r.baseVal.toLocaleString()}) + عمولة ({r.comm.toLocaleString()}) <br/>
                                 <div className="mt-1 pt-1 border-t border-slate-200 text-indigo-600 font-black flex justify-between items-center">
                                    <span>المطلوب في هذه السحبة: {r.totalRequired.toLocaleString()} ريال</span>
                                    <button onClick={() => handleDeleteBatch(r.batchId)} className="w-8 h-8 flex items-center justify-center bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 transition shrink-0" title="حذف العملية">
                                      <Trash2 size={14} />
                                    </button>
                                 </div>
                              </div>
                           ))}
                        </div>

                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-sm font-black flex justify-between items-center text-blue-800">
                           <span>💰 الرصيد الإجمالي المطلوب سداده:</span>
                           <span className="text-rose-600">{actualBalance.toLocaleString()} ريال</span>
                        </div>

                        <div className="flex gap-2 mt-4 flex-wrap sm:flex-nowrap">
                           <button onClick={() => printMqawetReport(name)} className="w-12 py-3 flex items-center justify-center bg-indigo-50 text-indigo-500 font-black rounded-xl hover:bg-indigo-100 transition shadow-sm" title="طباعة الكشف">
                              <Printer size={18} />
                           </button>
                           <button onClick={() => {
                              let msg = `فاتورة المقوت: ${name}\nالمطلوب إجمالي: ${actualBalance.toLocaleString()} ريال\n`;
                              let url = `sms:${data.phone || ''}?body=${encodeURIComponent(msg)}`;
                              window.open(url, '_self');
                           }} className="w-12 py-3 flex items-center justify-center bg-blue-50 text-blue-500 font-black rounded-xl hover:bg-blue-100 transition shadow-sm" title="رسالة نصية">
                              <span className="font-black text-[10px]">SMS</span>
                           </button>
                           <button onClick={() => shareMqawetWhatsApp(name, data.phone)} className="flex-1 min-w-[150px] py-3 bg-[#25d366] text-white font-black rounded-xl hover:bg-[#20bd5a] transition flex items-center justify-center gap-2 shadow-sm">
                              عبر واتساب
                           </button>
                        </div>
                     </div>
                   );
                })
             )}
          </div>
        )}

        {activeTab === "master-rep" && (
          <div className="space-y-4 max-w-4xl mx-auto pb-4 w-full">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-slate-800 text-lg">التقرير المجمع الشامل</h3>
                <button
                  onClick={printMasterReport}
                  className="px-4 py-2 bg-indigo-50 text-indigo-600 font-black rounded-xl hover:bg-indigo-100 transition flex items-center gap-2"
                >
                  <Printer size={16} />
                  <span className="hidden sm:inline">طباعة الكشف</span>
                </button>
             </div>

             <div className="bg-slate-900 rounded-3xl p-5 text-white shadow-lg grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden w-full">
                <div className="bg-slate-800 p-3 rounded-xl flex flex-col items-center justify-center text-center">
                   <span className="block text-xs text-slate-400 font-bold mb-1">مجموع التوريد</span>
                   <span className="text-lg font-black">{toArabicDigits(batches.reduce((s,b) => s + (b.rawiQty*b.rawiPrice),0).toLocaleString())} ريال</span>
                </div>
                <div className="bg-slate-800 p-3 rounded-xl flex flex-col items-center justify-center text-center">
                   <span className="block text-xs text-slate-400 font-bold mb-1">إجمالي أرباح المصلح</span>
                   <span className="text-lg font-black text-amber-400">{toArabicDigits(batches.reduce((s,b) => s + (b.rawiQty*b.rawiPrice*(b.commRawiPct/100)) + b.mqawetList.reduce((ss,m)=>ss+m.comm,0),0).toLocaleString())} ريال</span>
                </div>
                <div className="bg-slate-800 p-3 rounded-xl flex flex-col items-center justify-center text-center">
                   <span className="block text-xs text-slate-400 font-bold mb-1">إجمالي الضرائب</span>
                   <span className="text-lg font-black text-rose-400">{toArabicDigits(batches.reduce((s,b) => s + (b.rawiQty*b.rawiPrice*(b.taxPct/100)),0).toLocaleString())} ريال</span>
                </div>
             </div>

             <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-x-auto w-full">
                <table className="w-full text-sm text-right">
                   <thead className="bg-slate-50 text-slate-500 font-black text-xs">
                      <tr>
                         <th className="p-4 border-b">التاريخ</th>
                         <th className="p-4 border-b">الرعوي</th>
                         <th className="p-4 border-b">كمية/سعر</th>
                         <th className="p-4 border-b">المقوت (المستلم)</th>
                         <th className="p-4 border-b">كمية السحب</th>
                         <th className="p-4 border-b">مطلوب من المقوت</th>
                         <th className="p-4 border-b">صافي الرعوي</th>
                      </tr>
                   </thead>
                   <tbody className="font-bold text-slate-700 divide-y divide-slate-100">
                      {batches.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400">لا توجد حركات مسجلة.</td></tr>}
                      {batches.map(op => (
                         op.mqawetList.map((m, idx) => (
                            <tr key={`${op.id}-${idx}`} className="hover:bg-slate-50 transition">
                               <td className="p-4 whitespace-nowrap">{op.date}</td>
                               <td className="p-4 whitespace-nowrap">{op.rawiName}</td>
                               <td className="p-4 whitespace-nowrap">{op.rawiQty} بـ {op.rawiPrice.toLocaleString()}</td>
                               <td className="p-4 whitespace-nowrap text-indigo-600">{m.name}</td>
                               <td className="p-4 whitespace-nowrap">{m.qty}</td>
                               <td className="p-4 whitespace-nowrap text-rose-500">{m.totalRequired.toLocaleString()}</td>
                               <td className="p-4 whitespace-nowrap text-emerald-600">
                                 {((m.baseVal) - (m.baseVal*(op.commRawiPct/100))).toLocaleString()}
                               </td>
                            </tr>
                         ))
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
