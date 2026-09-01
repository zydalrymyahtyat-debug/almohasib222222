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
  const [activeTab, setActiveTab] = useState<"entry" | "rawi-rep" | "mqawet-rep" | "master-rep">("entry");

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

  // Dropdown States
  const [openRawiDropdown, setOpenRawiDropdown] = useState(false);
  const [openMqawetDropdownIndex, setOpenMqawetDropdownIndex] = useState<number | null>(null);

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

    return () => {
      unsubPersons();
      unsubBatches();
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
    try {
      if (!Contacts || !Contacts.requestPermissions) {
        alert("ميزة جهات الاتصال مدعومة فقط في تطبيق الهاتف.");
        return;
      }
      const permission = await Contacts.requestPermissions();
      if (permission.contacts !== "granted") {
        alert("يرجى منح صلاحية الوصول لجهات الاتصال من إعدادات الجهاز.");
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

    const confirm = window.confirm(`هل أنت متأكد من تصفية واعتماد الشحنة للرعوي (${rawiName}) وترحيلها للحسابات بشكل نهائي؟`);
    if (!confirm) return;

    setIsSaving(true);
    try {
      const batchRef = writeBatch(db);

      // 1. Process Rawi (Supplier)
      let rId = "";
      const existingRawi = persons.find(p => p.name === rawiName.trim() && p.type === "suppliers");
      if (existingRawi) {
        rId = existingRawi.id;
        const newBalance = existingRawi.balance - netRawi; // "له" means negative balance in our system
        batchRef.update(doc(db, "persons", rId), { balance: newBalance });
      } else {
        const newRawiRef = doc(collection(db, "persons"));
        rId = newRawiRef.id;
        batchRef.set(newRawiRef, {
          userId: currentUser.uid,
          name: rawiName.trim(),
          phone: rawiPhone.trim(),
          type: "suppliers",
          balance: -netRawi,
          createdAt: serverTimestamp()
        });
      }

      // Record Rawi Transaction
      const rTxRef = doc(collection(db, "transactions"));
      batchRef.set(rTxRef, {
         userId: currentUser.uid,
         personId: rId,
         type: "credit", // له
         amount: netRawi,
         note: `مشتريات/توريد مقوت السوق (كمية ${qtyVal})`,
         section: "suppliers",
         createdAt: new Date(opDate + "T12:00:00")
      });

      // 2. Process Mqawets (Customers)
      const validMqawets = computedMqawetList.filter(m => m.name && m.qty > 0);
      for (const m of validMqawets) {
        let mId = m.personId || "";
        const existingM = persons.find(p => p.name === m.name.trim() && p.type === "customers");

        if (existingM) {
          mId = existingM.id;
          const newBalance = existingM.balance + m.totalRequired; // "عليه" means positive balance
          batchRef.update(doc(db, "persons", mId), { balance: newBalance });
        } else {
          const newMRef = doc(collection(db, "persons"));
          mId = newMRef.id;
          batchRef.set(newMRef, {
            userId: currentUser.uid,
            name: m.name.trim(),
            phone: m.phone.trim(),
            type: "customers",
            balance: m.totalRequired,
            createdAt: serverTimestamp()
          });
          m.personId = mId; // update local ref
        }

        // Record Mqawet Transaction
        const mTxRef = doc(collection(db, "transactions"));
        batchRef.set(mTxRef, {
           userId: currentUser.uid,
           personId: mId,
           type: "debt", // عليه
           amount: m.totalRequired,
           note: `مسحوبات مقوت السوق من الرعوي (${rawiName.trim()}) - كمية ${m.qty}`,
           section: "customers",
           createdAt: new Date(opDate + "T12:00:00")
        });
      }

      // 3. Mark Batch as completed
      const batchData = {
        userId: currentUser.uid,
        date: opDate,
        rawiId: rId,
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
      alert("تم اعتماد الشحنة وترحيل الحسابات بنجاح!");
      setActiveBatchId(null); // start fresh
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء التصفية والترحيل.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    const confirmDelete = window.confirm("هل أنت متأكد من حذف هذه العملية؟ سيتم حذف جميع البيانات وعكس الحسابات المرتبطة بها.");
    if (!confirmDelete) return;

    const b = batches.find(x => x.id === batchId);
    if (!b) return;

    setIsSaving(true);
    try {
      if (b.status === "in_progress") {
        // Just delete the batch, no ledger changes
        await deleteDoc(doc(db, "market_batches", batchId));
        alert("تم الحذف بنجاح!");
      } else if (b.status === "completed") {
        // Need to reverse ledger transactions
        const batchRef = writeBatch(db);

        // 1. Reverse Rawi (Supplier)
        let totalVal = b.rawiQty * b.rawiPrice;
        let commVal = totalVal * (b.commRawiPct / 100);
        let taxVal = totalVal * (b.taxPct / 100);
        let rNet = totalVal - commVal - taxVal;

        if (b.rawiId) {
          const rawiPerson = persons.find(p => p.id === b.rawiId);
          if (rawiPerson) {
             // He was credited (-), so we add back (+)
             batchRef.update(doc(db, "persons", b.rawiId), { balance: rawiPerson.balance + rNet });

             // Add reversing transaction
             const rTxRef = doc(collection(db, "transactions"));
             batchRef.set(rTxRef, {
                userId: currentUser.uid,
                personId: b.rawiId,
                type: "debt", // عكس credit
                amount: rNet,
                note: `عكس قيد تسوية مقوت السوق (إلغاء شحنة ${b.date})`,
                section: "suppliers",
                createdAt: serverTimestamp()
             });
          }
        }

        // 2. Reverse Mqawets (Customers)
        for (const m of b.mqawetList) {
          if (m.personId) {
            const mPerson = persons.find(p => p.id === m.personId);
            if (mPerson) {
              // He was debited (+), so we subtract (-)
              batchRef.update(doc(db, "persons", m.personId), { balance: mPerson.balance - m.totalRequired });

              // Add reversing transaction
              const mTxRef = doc(collection(db, "transactions"));
              batchRef.set(mTxRef, {
                 userId: currentUser.uid,
                 personId: m.personId,
                 type: "credit", // عكس debt
                 amount: m.totalRequired,
                 note: `عكس قيد تسوية مقوت السوق (إلغاء شحنة ${b.date})`,
                 section: "customers",
                 createdAt: serverTimestamp()
              });
            }
          }
        }

        // Delete the batch doc entirely or mark as deleted
        batchRef.delete(doc(db, "market_batches", batchId));
        await batchRef.commit();
        alert("تم الحذف وعكس القيود بنجاح!");
      }

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

  const shareRawiWhatsApp = (b: MarketBatch) => {
      let totalVal = b.rawiQty * b.rawiPrice;
      let commVal = totalVal * (b.commRawiPct / 100);
      let taxVal = totalVal * (b.taxPct / 100);
      let net = totalVal - commVal - taxVal;
      let distributedQty = b.mqawetList.reduce((s, m) => s + m.qty, 0);
      let remQty = b.rawiQty - distributedQty;

      let msg = `*تصفية وتفريغ شحنة الأخ / ${b.rawiName}*
`;
      msg += `📅 *تاريخ التوريد:* ${b.date}
`;
      msg += `📦 *إجمالي الكمية الموردة:* (${b.rawiQty}) بسعر (${b.rawiPrice.toLocaleString()}) = ${totalVal.toLocaleString()} ريال
`;
      msg += `--------------------------------
`;
      msg += `*تفاصيل توزيع بضاعتك على المقاوتة:*
`;

      if (b.mqawetList.length === 0) {
          msg += `لم يتم تصريف أي كمية حتى الآن.
`;
      } else {
          b.mqawetList.forEach((m, idx) => {
              msg += `${idx + 1}) أخذ المقوت *(${m.name})* من حسابك كمية *(${m.qty})* بحساب *(${b.rawiPrice.toLocaleString()})* = *${m.baseVal.toLocaleString()}* ريال
`;
          });
      }

      msg += `--------------------------------
`;
      msg += `📦 *المصرف:* (${distributedQty}) | *المتبقي طرفنا:* (${remQty})
`;
      msg += `💰 *إجمالي قيمة البضاعة:* ${totalVal.toLocaleString()} ريال
`;
      msg += `🔻 *يخصم عمولة المصلح (${b.commRawiPct}%):* - ${commVal.toLocaleString()} ريال
`;
      if (taxVal > 0) {
          msg += `🔻 *يخصم الضريبة (${b.taxPct}%):* - ${taxVal.toLocaleString()} ريال
`;
      }
      msg += `--------------------------------
`;
      msg += `💵 *صافي المبلغ المستحق لك بالكامل (خالص):* ${net.toLocaleString()} ريال

`;
      msg += `شاكرين تعاملكم معنا.`;

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

      let msg = `*كشف حساب الأخ / ${name}*
`;
      msg += `تحية طيبة، تفاصيل مسحوباتكم كالتالي:
`;
      msg += `--------------------------------
`;

      records.forEach((r, idx) => {
          msg += `${idx + 1}) *بتاريخ:* ${r.date}
`;
          msg += `أخذت من الرعوي *(${r.rawiName})* كمية *(${r.qty})* من حساب *(${r.price.toLocaleString()})*، القيمة *(${r.baseVal.toLocaleString()})* + عمولة *(${r.comm.toLocaleString()})*
`;
          msg += `👈 *المطلوب:* ${r.totalRequired.toLocaleString()} ريال

`;
      });

      msg += `--------------------------------
`;
      msg += `💰 *إجمالي المبلغ المطلوب سداده:* ${total.toLocaleString()} ريال
`;
      msg += `شاكرين حسن تعاونكم معنا.`;

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
            { id: "rawi-rep", label: "كشف الرعية" },
            { id: "mqawet-rep", label: "كشف المقاوتة" },
            { id: "master-rep", label: "التقرير الشامل" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 min-w-[80px] py-2 px-2 text-xs font-black rounded-xl transition-all whitespace-nowrap ${
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

              <h3 className="font-black text-slate-800 text-sm mb-3 pt-4 border-t border-slate-100">النسب والعمولات (%)</h3>
              <div className="flex gap-2 mb-6 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                <div className="flex-1 flex flex-col items-center">
                  <label className="text-[10px] font-black text-slate-500 block mb-1">من الرعوي</label>
                  <input type="number" value={commRawiPct} onChange={(e) => setCommRawiPct(e.target.value ? Number(toEnglishDigits(e.target.value)) : "")} placeholder="0%" className="w-full bg-white border border-slate-200 py-1.5 px-1 rounded-lg text-sm font-bold outline-none focus:border-amber-500 text-center" />
                </div>
                <div className="flex-1 flex flex-col items-center border-r border-slate-200 pr-2">
                  <label className="text-[10px] font-black text-slate-500 block mb-1">من المقوت</label>
                  <input type="number" value={commMqawetPct} onChange={(e) => setCommMqawetPct(e.target.value ? Number(toEnglishDigits(e.target.value)) : "")} placeholder="0%" className="w-full bg-white border border-slate-200 py-1.5 px-1 rounded-lg text-sm font-bold outline-none focus:border-amber-500 text-center" />
                </div>
                <div className="flex-1 flex flex-col items-center border-r border-slate-200 pr-2">
                  <label className="text-[10px] font-black text-slate-500 block mb-1">الضريبة</label>
                  <input type="number" value={taxPct} onChange={(e) => setTaxPct(e.target.value ? Number(toEnglishDigits(e.target.value)) : "")} placeholder="0%" className="w-full bg-white border border-rose-200 py-1.5 px-1 rounded-lg text-sm font-bold outline-none focus:border-rose-500 text-center text-rose-600" />
                </div>
              </div>

              {/* Distribution */}
              <h3 className="font-black text-slate-800 text-sm mb-3 flex justify-between items-center">
                <span>توزيع الكمية على المقاوتة</span>
                {remainingQty < 0 && <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-lg">تجاوزت الكمية الموردة!</span>}
              </h3>

              <div className="space-y-3 mb-4">
                {computedMqawetList.map((m, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                    <div className="flex gap-2 mb-2">
                      <div className="flex-1 relative">
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
                          className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-sm font-bold outline-none focus:border-amber-500"
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
                                className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-bold border-b border-slate-50 last:border-0 flex justify-between items-center"
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
                                className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-bold border-b border-slate-50 last:border-0"
                              >
                                {n}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => handlePickMqawetContact(idx)} className="w-10 flex items-center justify-center bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition shrink-0" title="اختيار من جهات الاتصال">
                        <Phone size={16} />
                      </button>
                      <div className="w-20 shrink-0">
                        <input type="number" placeholder="الكمية" value={m.qty || ""} onChange={(e) => handleUpdateMqawetRow(idx, "qty", e.target.value ? Number(toEnglishDigits(e.target.value)) : "")} className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-sm font-bold outline-none focus:border-amber-500 text-center" />
                      </div>
                      <button onClick={() => handleRemoveMqawetRow(idx)} className="w-10 flex items-center justify-center bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition shrink-0" title="حذف المقوت">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {/* Computed feedback */}
                    <div className="flex justify-between text-[10px] font-black text-slate-500 bg-slate-100 p-1.5 rounded-lg">
                      <span>السعر: {toArabicDigits(m.price)}</span>
                      <span>إجمالي المطلوب: <span className="text-amber-600">{toArabicDigits(m.totalRequired)}</span></span>
                    </div>
                    {m.name && (
                      <div className="mt-1 text-[10px] font-bold text-indigo-500 flex justify-between">
                         <span>السحبيات السابقة للمقوت: {toArabicDigits(getMqawetHistoricalDebt(m.name, activeBatchId || undefined))} ريال</span>
                         {m.phone && <span dir="ltr">{m.phone}</span>}
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

                        <div className="flex gap-2 mt-4">
                           <button onClick={() => handleDeleteBatch(op.id)} className="w-12 flex items-center justify-center bg-rose-50 text-rose-500 font-black rounded-xl hover:bg-rose-100 transition shadow-sm">
                              <Trash2 size={18} />
                           </button>
                           <button onClick={() => shareRawiWhatsApp(op)} className="flex-1 py-3 bg-[#25d366] text-white font-black rounded-xl hover:bg-[#20bd5a] transition flex items-center justify-center gap-2 shadow-sm">
                              مشاركة التصفية عبر واتساب
                           </button>
                           <button onClick={() => shareRawiSMS(op)} className="w-12 flex items-center justify-center bg-blue-50 text-blue-500 font-black rounded-xl hover:bg-blue-100 transition shadow-sm" title="رسالة نصية">
                              <span className="font-black text-[10px]">SMS</span>
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
                   const total = data.records.reduce((s: number, r: any) => s + r.totalRequired, 0);

                   return (
                     <div key={name} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 mb-4 border-t-4 border-t-indigo-500">
                        <div className="flex justify-between items-center mb-4">
                           <h3 className="font-black text-slate-800 text-base">👤 المقوت: {name}</h3>
                           <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg text-[10px] font-black">{data.records.length} مسحوبات</span>
                        </div>

                        <div className="space-y-3 mb-4">
                           {data.records.map((r: any, idx: number) => (
                              <div key={idx} className="bg-slate-50 border-r-4 border-indigo-400 p-3 rounded-lg text-xs leading-relaxed text-slate-700 font-bold border border-slate-100">
                                 📅 التاريخ: {r.date} <br/>
                                 📌 أخذت من الرعوي <strong>({r.rawiName})</strong> كمية <strong>({r.qty})</strong> بسعر <strong>({r.price.toLocaleString()})</strong> <br/>
                                 القيمة ({r.baseVal.toLocaleString()}) + عمولة ({r.comm.toLocaleString()}) <br/>
                                 <div className="mt-1 pt-1 border-t border-slate-200 text-indigo-600 font-black">
                                    المطلوب في هذه السحبة: {r.totalRequired.toLocaleString()} ريال
                                 </div>
                              </div>
                           ))}
                        </div>

                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-sm font-black flex justify-between items-center text-blue-800">
                           <span>💰 إجمالي المطلوب سداده:</span>
                           <span className="text-rose-600">{total.toLocaleString()} ريال</span>
                        </div>

                        <div className="flex gap-2 mt-4">
                           <button onClick={() => shareMqawetWhatsApp(name, data.phone)} className="flex-1 py-3 bg-[#25d366] text-white font-black rounded-xl hover:bg-[#20bd5a] transition flex items-center justify-center gap-2 shadow-sm">
                              مشاركة الكشف عبر واتساب
                           </button>
                           <button onClick={() => {
                              let msg = `فاتورة المقوت: ${name}\nالمطلوب إجمالي: ${total.toLocaleString()} ريال\n`;
                              let url = `sms:${data.phone || ''}?body=${encodeURIComponent(msg)}`;
                              window.open(url, '_self');
                           }} className="w-12 flex items-center justify-center bg-blue-50 text-blue-500 font-black rounded-xl hover:bg-blue-100 transition shadow-sm" title="رسالة نصية">
                              <span className="font-black text-[10px]">SMS</span>
                           </button>
                        </div>
                     </div>
                   );
                })
             )}
          </div>
        )}

        {activeTab === "master-rep" && (
          <div className="space-y-4 max-w-4xl mx-auto overflow-x-auto pb-4">
             <div className="flex justify-between items-center">
                <h3 className="font-black text-slate-800 text-lg">التقرير المجمع الشامل</h3>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-50 text-indigo-600 font-black rounded-xl hover:bg-indigo-100 transition flex items-center gap-2"
                >
                  <Printer size={16} />
                  طباعة الكشف
                </button>
             </div>

             <div className="bg-slate-900 rounded-3xl p-5 text-white shadow-lg flex flex-wrap gap-4 justify-between items-center min-w-[600px] print:hidden">
                <div>
                   <span className="block text-xs text-slate-400 font-bold mb-1">مجموع التوريد</span>
                   <span className="text-lg font-black">{toArabicDigits(batches.reduce((s,b) => s + (b.rawiQty*b.rawiPrice),0).toLocaleString())} ريال</span>
                </div>
                <div>
                   <span className="block text-xs text-slate-400 font-bold mb-1">إجمالي أرباح المصلح</span>
                   <span className="text-lg font-black text-amber-400">{toArabicDigits(batches.reduce((s,b) => s + (b.rawiQty*b.rawiPrice*(b.commRawiPct/100)) + b.mqawetList.reduce((ss,m)=>ss+m.comm,0),0).toLocaleString())} ريال</span>
                </div>
                <div>
                   <span className="block text-xs text-slate-400 font-bold mb-1">إجمالي الضرائب</span>
                   <span className="text-lg font-black text-rose-400">{toArabicDigits(batches.reduce((s,b) => s + (b.rawiQty*b.rawiPrice*(b.taxPct/100)),0).toLocaleString())} ريال</span>
                </div>
             </div>

             <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden min-w-[800px]">
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
