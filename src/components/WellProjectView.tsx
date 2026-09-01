import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Person, Transaction } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { 
  Droplets, ArrowRight, Settings, Plus, Search, Contact, Phone, 
  Calendar, Trash2, Share2, DollarSign, Clock, User, Check, 
  Edit2, Compass, CheckCircle2, MessageSquare, Clipboard, Send, X, ClipboardCheck,
  FileText, Printer, Wifi, WifiOff, Activity, ShieldAlert, Fuel, Users
} from "lucide-react";
import { Contacts } from "@capacitor-community/contacts";
import { Capacitor } from "@capacitor/core";
import { runFirestoreDiagnostics } from "../utils/dbSyncDiagnostics";
import { toEnglishDigits } from "../utils/numberUtils";

interface WellProjectViewProps {
  currentUser?: any;
  onGoBack?: () => void;
  selectedWellId?: string;
}

interface WellSettings {
  wellName: string;
  operatorName: string;
  ownerName: string;
  diesel20LPrice: number;
  hourlyWellRate: number;
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

// Converter from "HH:MM" (24h) to 12h pieces
const parse24hTo12h = (timeStr: string) => {
  if (!timeStr) return { hour: 12, minute: 0, period: "AM" as const };
  const [hStr, mStr] = timeStr.split(":");
  let h = parseInt(hStr, 10);
  if (isNaN(h)) h = 12;
  let m = parseInt(mStr, 10);
  if (isNaN(m)) m = 0;
  
  let period: "AM" | "PM" = "AM";
  if (h >= 12) {
    period = "PM";
    if (h > 12) h -= 12;
  } else if (h === 0) {
    h = 12;
  }
  return { hour: h, minute: m, period };
};

// Converter from 12h pieces to "HH:MM" (24h)
const format12hTo24h = (hour: number, minute: number, period: "AM" | "PM"): string => {
  let h = hour;
  if (isNaN(h) || h < 1 || h > 12) h = 12;
  let m = minute;
  if (isNaN(m) || m < 0 || m > 59) m = 0;
  
  if (period === "PM") {
    if (h < 12) h += 12;
  } else {
    if (h === 12) h = 0;
  }
  
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}`;
};

const toArabicDigits = (val: string | number | undefined | null): string => {
  if (val === undefined || val === null) return "";
  if (typeof val === "number") {
    return val.toLocaleString("en-US");
  }
  return toEnglishDigits(String(val));
};

export default function WellProjectView({ currentUser, onGoBack, selectedWellId }: WellProjectViewProps) {
  // Navigation inside Well section
  const [activeTab, setActiveTab] = useState<"farmers" | "settings">("farmers");
  const [selectedFarmer, setSelectedFarmer] = useState<Person | null>(null);

  // Well settings
  const [settings, setSettings] = useState<WellSettings>({
    wellName: "",
    operatorName: "",
    ownerName: "",
    diesel20LPrice: 0,
    hourlyWellRate: 0
  });

  const [saveStatus, setSaveStatus] = useState<"idle" | "typing" | "saving" | "saved" | "error">("idle");
  const [debounceTimeout, setDebounceTimeout] = useState<any>(null);
  const [sharingTransaction, setSharingTransaction] = useState<Transaction | null>(null);

  // Farmers and history
  const [farmers, setFarmers] = useState<Person[]>([]);
  const [farmerTransactions, setFarmerTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isFarmerModalOpen, setIsFarmerModalOpen] = useState(false);
  const [isWateringModalOpen, setIsWateringModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Add/Edit Farmer Form
  const [farmerName, setFarmerName] = useState("");
  const [farmerPhone, setFarmerPhone] = useState("");
  const [editingFarmer, setEditingFarmer] = useState<Person | null>(null);

  // New Watering Form
  const [wateringDate, setWateringDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [dieselDelivered, setDieselDelivered] = useState<number | "">("");
  const [previousBalance, setPreviousBalance] = useState<number | "">("");
  const [dieselUsed, setDieselUsed] = useState<number | "">("");
  const [customHourlyRate, setCustomHourlyRate] = useState<number | "">("");
  const [customDieselPrice, setCustomDieselPrice] = useState<number | "">("");
  const [wateringNote, setWateringNote] = useState("");

  // New Payment Form
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentNote, setPaymentNote] = useState("");

  // Share message state
  const [shareMessage, setShareMessage] = useState("");
  const [copied, setCopied] = useState(false);

  // Saving state for non-blocking immediate feedback
  const [isSaving, setIsSaving] = useState(false);

  // States for 12-hour breakdown input
  const [startHour, setStartHour] = useState("");
  const [startMinute, setStartMinute] = useState("");
  const [startPeriod, setStartPeriod] = useState<"AM" | "PM">("AM");

  const [endHour, setEndHour] = useState("");
  const [endMinute, setEndMinute] = useState("");
  const [endPeriod, setEndPeriod] = useState<"AM" | "PM">("AM");

  // Sync to 12-hour broken states when the modal is opened
  useEffect(() => {
    if (isWateringModalOpen) {
      setStartHour("");
      setStartMinute("");
      setStartPeriod("AM");

      setEndHour("");
      setEndMinute("");
      setEndPeriod("AM");
    }
  }, [isWateringModalOpen]);

  // Sync back to startTime / endTime strings when individual states change
  useEffect(() => {
    if (startHour === "") {
      setStartTime("");
    } else {
      let h = parseInt(startHour, 10);
      let m = startMinute !== "" ? parseInt(startMinute, 10) : 0;
      if (isNaN(h)) h = 8;
      if (isNaN(m)) m = 0;
      setStartTime(format12hTo24h(h, m, startPeriod));
    }
  }, [startHour, startMinute, startPeriod]);

  useEffect(() => {
    if (endHour === "") {
      setEndTime("");
    } else {
      let h = parseInt(endHour, 10);
      let m = endMinute !== "" ? parseInt(endMinute, 10) : 0;
      if (isNaN(h)) h = 12;
      if (isNaN(m)) m = 0;
      setEndTime(format12hTo24h(h, m, endPeriod));
    }
  }, [endHour, endMinute, endPeriod]);

  // Diagnostics State
  const [diagResult, setDiagResult] = useState<{
    isOnline: boolean;
    firestoreConnected: boolean;
    readSuccess: boolean;
    writeSuccess: boolean;
    hasPendingWrites: boolean;
    latencyMs: number;
    message: string;
    timestamp: string;
  } | null>(null);
  const [isDiagRunning, setIsDiagRunning] = useState(false);

  const handleRunDiagnostics = async () => {
    setIsDiagRunning(true);
    try {
      const res = await runFirestoreDiagnostics(currentUser?.uid);
      setDiagResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDiagRunning(false);
    }
  };

  useEffect(() => {
    if (activeTab === "settings") {
      handleRunDiagnostics();
    }
  }, [activeTab]);

  // Physical/Hardware Back Button Handler for Native App
  useEffect(() => {
    (window as any).customBackHandler = () => {
      if (isFarmerModalOpen) {
        setIsFarmerModalOpen(false);
      } else if (isWateringModalOpen) {
        setIsWateringModalOpen(false);
      } else if (isPaymentModalOpen) {
        setIsPaymentModalOpen(false);
      } else if (isShareModalOpen) {
        setIsShareModalOpen(false);
      } else if (selectedFarmer) {
        setSelectedFarmer(null);
      } else if (onGoBack) {
        onGoBack();
      }
    };

    return () => {
      delete (window as any).customBackHandler;
    };
  }, [
    isFarmerModalOpen,
    isWateringModalOpen,
    isPaymentModalOpen,
    isShareModalOpen,
    selectedFarmer,
    onGoBack
  ]);

  // Helper to clean phone numbers
  const getCleanPhone = (phone: string | undefined): string => {
    if (!phone) return "";
    let cleaned = phone.trim().replace(/[\s-()]/g, "");
    if (cleaned.startsWith("+")) {
      cleaned = cleaned.substring(1);
    }
    if (cleaned.startsWith("00")) {
      cleaned = cleaned.substring(2);
    }
    if (cleaned.startsWith("0")) {
      cleaned = cleaned.substring(1);
    }
    if (!cleaned.startsWith("967") && cleaned.length > 0) {
      cleaned = "967" + cleaned;
    }
    return cleaned;
  };

  // 1. Listen to Well Settings (subscribing to both users profile and legacy well_settings, as well as specific well doc)
  useEffect(() => {
    const userId = currentUser?.uid;
    if (!userId) return;

    let unsubSpecificWell = () => {};

    if (selectedWellId) {
       const specificWellDocRef = doc(db, "wells", selectedWellId);
       unsubSpecificWell = onSnapshot(specificWellDocRef, { includeMetadataChanges: true }, (snap) => {
         if (snap.exists()) {
           const specificWellData = snap.data();
           setSettings({
             wellName: specificWellData?.name || "",
             operatorName: specificWellData?.operatorName || "",
             ownerName: specificWellData?.owner || "",
             diesel20LPrice: specificWellData?.diesel20LPrice !== undefined ? Number(specificWellData.diesel20LPrice) : 0,
             hourlyWellRate: specificWellData?.hourlyWellRate !== undefined ? Number(specificWellData.hourlyWellRate) : 0
           });
         }
       });
    }

    return () => {
      unsubSpecificWell();
    };
  }, [selectedWellId, currentUser]);

  // 2. Listen to Well Farmers (type === "well_customers")
  useEffect(() => {
    const userId = currentUser?.uid;
    if (!userId) return;

    const q = query(
      collection(db, "persons"),
      where("userId", "==", userId),
      where("type", "==", "well_customers"), where("wellId", "==", selectedWellId || "default_well")
    );

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const list: Person[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Person);
      });
      // Sort by creation date
      list.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
      setFarmers(list);
      setLoading(false);

      // Keep selected farmer in sync if currently viewed
      if (selectedFarmer) {
        const updated = list.find(f => f.id === selectedFarmer.id);
        if (updated) setSelectedFarmer(updated);
      }
    });

    return unsubscribe;
  }, [selectedFarmer?.id, currentUser]);

  // 3. Listen to selected Farmer's transactions
  useEffect(() => {
    if (!selectedFarmer) {
      setFarmerTransactions([]);
      return;
    }

    const q = query(
      collection(db, "transactions"),
      where("userId", "==", currentUser?.uid || ""),
      where("personId", "==", selectedFarmer.id)
    );

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      // Sort by creation date
      list.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
      setFarmerTransactions(list);
    });

    return unsubscribe;
  }, [selectedFarmer?.id, currentUser]);

  // Contact Picker Support
  const handleSelectContact = async () => {
    localStorage.setItem("ignore_app_lock", "true");
    const clearLockIgnore = setTimeout(() => {
      localStorage.removeItem("ignore_app_lock");
    }, 3000);

    // Android Webview Bridge
    if ((window as any).AndroidContacts && typeof (window as any).AndroidContacts.pickContact === "function") {
      (window as any).onAndroidContactSelected = (name: string, phone: string) => {
        localStorage.removeItem("ignore_app_lock");
        clearTimeout(clearLockIgnore);
        if (name !== "ERROR" && name !== "CANCELLED") {
          let cleanedPhone = phone || "";
          if (cleanedPhone) {
            cleanedPhone = cleanedPhone.replace(/[\s-()]/g, "");
            if (cleanedPhone.startsWith("00")) {
              cleanedPhone = "+" + cleanedPhone.substring(2);
            }
          }
          if (name) setFarmerName(name);
          if (cleanedPhone) setFarmerPhone(cleanedPhone);
        }
      };
      try {
        (window as any).AndroidContacts.pickContact();
      } catch (err) {
        console.error(err);
        localStorage.removeItem("ignore_app_lock");
      }
      return;
    }

    // Native Capacitor App
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
            if (c.phones && c.phones.length > 0) {
              phone = c.phones[0].number || "";
            }
            if (phone) {
              phone = phone.replace(/[\s-()]/g, "");
              if (phone.startsWith("00")) {
                phone = "+" + phone.substring(2);
              }
            }
            if (name) setFarmerName(name);
            if (phone) setFarmerPhone(phone);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        localStorage.removeItem("ignore_app_lock");
        clearTimeout(clearLockIgnore);
      }
      return;
    }

    // Web Contact Picker
    if ("contacts" in navigator && (navigator as any).contacts?.select) {
      try {
        const selected = await (navigator as any).contacts.select(["name", "tel"], { multiple: false });
        if (selected && selected.length > 0) {
          const contact = selected[0];
          let name = contact.name?.[0] || contact.name || "بدون اسم";
          let phone = contact.tel?.[0] || contact.tel || "";
          if (phone) {
            phone = phone.replace(/[\s-()]/g, "");
            if (phone.startsWith("00")) {
              phone = "+" + phone.substring(2);
            }
          }
          if (name) setFarmerName(name);
          if (phone) setFarmerPhone(phone);
        }
      } catch (err) {
        console.log(err);
      }
    } else {
      alert("⚠️ ميزة اختيار جهات الاتصال غير مدعومة في متصفحك الحالي، يرجى كتابة البيانات يدوياً.");
    }
  };

  // Save Well Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const userId = currentUser?.uid;
    if (!userId) return;

    if (!selectedWellId) {
      alert("لم يتم تحديد بئر لحفظ الإعدادات");
      return;
    }

    setIsSaving(true);
    setSaveStatus("saving");

    const newSettings = {
      name: settings.wellName.trim(),
      operatorName: settings.operatorName.trim(),
      owner: settings.ownerName.trim(),
      diesel20LPrice: Number(settings.diesel20LPrice) || 0,
      hourlyWellRate: Number(settings.hourlyWellRate) || 0
    };

    // Write to specific well doc in wells collection
    const wellDocRef = doc(db, "wells", selectedWellId);
    setDoc(wellDocRef, newSettings, { merge: true }).catch(err => {
      console.error("Failed to save settings to wells collection:", err);
      setSaveStatus("error");
    }).then(() => {
        setIsSaving(false);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 4000);
    });
  };

  // Add or Edit Farmer
  const handleSaveFarmer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmerName.trim()) return alert("اسم الرعوي مطلوب");

    const userId = currentUser?.uid;
    if (!userId) return;

    setIsSaving(true);
    const personData = {
      name: farmerName.trim(),
      phone: farmerPhone.trim(),
      type: "well_customers" as const,
      wellId: selectedWellId || "default_well",
      userId: userId,
      balance: editingFarmer ? editingFarmer.balance : 0,
      updatedAt: new Date()
    };

    if (editingFarmer) {
      updateDoc(doc(db, "persons", editingFarmer.id), personData).catch((err) => {
        console.error("Offline/online update error:", err);
      });
    } else {
      addDoc(collection(db, "persons"), {
        ...personData,
        wellId: selectedWellId || "default_well",
        balance: 0,
        createdAt: new Date()
      }).catch((err) => {
        console.error("Offline/online insert error:", err);
      });
    }

    // Instantly close modal and reset inputs (Firestore will apply updates to snapshot listeners immediately)
    setIsSaving(false);
    setIsFarmerModalOpen(false);
    setEditingFarmer(null);
    setFarmerName("");
    setFarmerPhone("");
  };

  // Delete Farmer Account
  const handleDeleteFarmer = (farmer: Person) => {
    if (!window.confirm(`هل أنت متأكد من حذف حساب الرعوي "${farmer.name}"؟ سيتم حذف جميع بياناته وحساباته نهائياً.`)) return;

    deleteDoc(doc(db, "persons", farmer.id)).catch((err) => console.error(err));
    setSelectedFarmer(null);
  };

  // Calculate watering hours automatically
  const getWateringDurationHours = () => {
    if (!startTime || !endTime) return 0;
    const [hStart, mStart] = startTime.split(":").map(Number);
    const [hEnd, mEnd] = endTime.split(":").map(Number);
    let diffMinutes = (hEnd * 60 + mEnd) - (hStart * 60 + mStart);
    if (diffMinutes < 0) diffMinutes += 24 * 60; // crossover midnight
    return Number((diffMinutes / 60).toFixed(2));
  };

  // Calculate Watering Cost Details
  const getWateringCostDetails = () => {
    const totalHours = getWateringDurationHours();
    const rateHour = customHourlyRate !== "" ? Number(customHourlyRate) : settings.hourlyWellRate;
    const diesel20L = customDieselPrice !== "" ? Number(customDieselPrice) : settings.diesel20LPrice;
    const pricePerLiter = diesel20L / 20;

    const hoursCost = Math.round(totalHours * rateHour);
    const delLit = dieselDelivered !== "" ? Number(dieselDelivered) : 0;
    const usedLit = dieselUsed !== "" ? Number(dieselUsed) : 0;
    const remainingLit = Number((delLit - usedLit).toFixed(2));

    // Cost of extra diesel consumed from well (or credit for surplus diesel)
    // used > delivered means well supplied extra diesel -> charge the farmer.
    // used < delivered means farmer brought surplus diesel -> reward/discount.
    const dieselAdjustmentCost = Math.round((usedLit - delLit) * pricePerLiter);
    const totalCost = Math.max(0, hoursCost + dieselAdjustmentCost);

    return {
      totalHours,
      rateHour,
      pricePerLiter,
      hoursCost,
      remainingLit,
      dieselAdjustmentCost,
      totalCost
    };
  };

  // Save Watering Transaction
  const handleSaveWatering = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmer) return;

    const { totalHours, hoursCost, remainingLit, dieselAdjustmentCost, totalCost } = getWateringCostDetails();

    setIsSaving(true);
    const noteStr = wateringNote.trim() || `سقاية مائية من الساعة ${startTime} إلى ${endTime} بمجموع ${totalHours} ساعة. ديزل واصل: ${dieselDelivered || 0}L، مستخدم: ${dieselUsed || 0}L، متبقي: ${remainingLit}L`;

    const tempTxId = "temp-watering-" + Date.now();
    const newTx: Transaction = {
      id: tempTxId,
      userId: currentUser?.uid || "",
      personId: selectedFarmer.id,
      type: "well_watering",
      amount: totalCost,
      note: noteStr,
      section: "well_customers",
      wellId: selectedWellId || "default_well",
      createdAt: new Date(wateringDate + "T12:00:00"),
      wateringDetails: {
        startTime,
        endTime,
        totalHours,
        hoursCost,
        dieselDelivered: dieselDelivered !== "" ? Number(dieselDelivered) : 0,
        dieselUsed: dieselUsed !== "" ? Number(dieselUsed) : 0,
        dieselRemaining: remainingLit,
        dieselAdjustmentCost,
        hourlyRate: customHourlyRate !== "" ? Number(customHourlyRate) : settings.hourlyWellRate,
        diesel20LPrice: customDieselPrice !== "" ? Number(customDieselPrice) : settings.diesel20LPrice
      }
    } as any;

    // Optimistic Update: Update transactions, selected farmer, and farmers list instantly
    setFarmerTransactions(prev => {
      let next = [...prev];
      if (!next.some(t => t.id === tempTxId)) next.unshift(newTx);

      if (previousBalance && Number(previousBalance) > 0) {
        const debtId = "temp-debt-" + Date.now();
        if (!next.some(t => t.id === debtId)) {
          next.unshift({
            id: debtId,
            userId: currentUser?.uid || "",
            personId: selectedFarmer.id,
            type: "debt",
            amount: Number(previousBalance),
            note: "رصيد سابق مرحل",
            section: "well_customers",
            wellId: selectedWellId || "default_well",
            createdAt: new Date(new Date(wateringDate).getTime() - 1000) as unknown as any
          } as Transaction);
        }
      }
      return next;
    });

    const newBalance = selectedFarmer.balance + totalCost + (Number(previousBalance) || 0);
    const updatedFarmer = { ...selectedFarmer, balance: newBalance };
    setSelectedFarmer(updatedFarmer);
    setFarmers(prev => prev.map(f => f.id === selectedFarmer.id ? updatedFarmer : f));


    // Add previous balance transaction if provided
    if (previousBalance && Number(previousBalance) > 0) {
      addDoc(collection(db, "transactions"), {
        userId: currentUser?.uid,
        personId: selectedFarmer.id,
        type: "debt", // Basic debt
        amount: Number(previousBalance),
        note: "رصيد سابق مرحل",
        section: "well_customers",
        wellId: selectedWellId || "default_well",
        createdAt: new Date(new Date(wateringDate).getTime() - 1000) // 1 second before watering
      }).catch((err) => {
        console.error("Failed to add previous balance offline/online:", err);
      });
    }

    // 1. Add transaction document (non-blocking)
    addDoc(collection(db, "transactions"), {
      userId: currentUser?.uid,
      personId: selectedFarmer.id,
      type: "well_watering",
      wellId: selectedWellId || "default_well",
      amount: totalCost,
      note: noteStr,
      section: "well_customers",
      createdAt: new Date(wateringDate + "T12:00:00"),
      // Store granular details for transparency and sharing
      wateringDetails: {
        startTime,
        endTime,
        totalHours,
        hoursCost,
        dieselDelivered: dieselDelivered !== "" ? Number(dieselDelivered) : 0,
        dieselUsed: dieselUsed !== "" ? Number(dieselUsed) : 0,
        dieselRemaining: remainingLit,
        dieselAdjustmentCost,
        hourlyRate: customHourlyRate !== "" ? Number(customHourlyRate) : settings.hourlyWellRate,
        diesel20LPrice: customDieselPrice !== "" ? Number(customDieselPrice) : settings.diesel20LPrice
      }
    }).catch((err) => {
      console.error("Failed to add watering transaction offline/online:", err);
    });

    // 2. Update person balance immediately
    updateDoc(doc(db, "persons", selectedFarmer.id), { balance: newBalance }).catch((err) => {
      console.error("Failed to update person balance offline/online:", err);
    });

    // 3. Immediately close modals and transition UI (zero-latency experience)
    setIsSaving(false);
    setIsWateringModalOpen(false);

    // Prepare Share Message and trigger WhatsApp Modal
    const farakSign = dieselAdjustmentCost > 0
      ? `+${dieselAdjustmentCost.toLocaleString('en-US')} ريال (عجز)`
      : dieselAdjustmentCost < 0
        ? `-${Math.abs(dieselAdjustmentCost).toLocaleString('en-US')} ريال (فائض)`
        : "0 ريال";

    const wDateObj = new Date(wateringDate);
    const dayName = isNaN(wDateObj.getTime()) ? "" : wDateObj.toLocaleDateString("ar-YE", { weekday: 'long' }) + "، ";

    const msg = `💧 *إشعار سقاية* 💧
👤 *العميل:* ${selectedFarmer.name}
📅 *التاريخ:* ${dayName}${wateringDate}

⏱️ *الوقت:* من ${startTime || "-"} إلى ${endTime || "-"} (${totalHours} ساعة)
💵 *قيمة الوقت:* ${hoursCost.toLocaleString('en-US')} ريال
⚖️ *فارق الديزل:* ${farakSign}
💸 *مبلغ السقاية:* ${totalCost.toLocaleString('en-US')} ريال

📈 *صافي الحساب:* ${newBalance.toLocaleString('en-US')} ريال (عليه)

⛽ *الديزل:*
📥 واصل: ${dieselDelivered || 0} لتر
⚡ مستهلك: ${dieselUsed || 0} لتر
🛢️ متبقي: ${remainingLit} لتر

✨ *مشروع:* ${settings.wellName}`;
    
    setShareMessage(msg);
    setIsShareModalOpen(true);

    // Reset form
    setStartTime("08:00");
    setEndTime("12:00");
    setDieselDelivered("");
    setDieselUsed("");
    setCustomHourlyRate("");
    setCustomDieselPrice("");
    setWateringNote("");
  };

  // Save Cash Payment Transaction
  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(paymentAmount);
    if (!amountNum || amountNum <= 0) return alert("الرجاء إدخال مبلغ صحيح");
    if (!selectedFarmer) return;

    setIsSaving(true);
    
    const tempTxId = "temp-payment-" + Date.now();
    const newTx: Transaction = {
      id: tempTxId,
      userId: currentUser?.uid || "",
      personId: selectedFarmer.id,
      type: "well_payment",
      amount: amountNum,
      note: paymentNote.trim() || "تسديد نقدي دفعة تحت الحساب",
      section: "well_customers",
      createdAt: new Date(paymentDate + "T12:00:00")
    } as any;

    // Optimistic Update
    setFarmerTransactions(prev => {
      if (prev.some(t => t.id === tempTxId)) return prev;
      return [newTx, ...prev];
    });

    const newBalance = selectedFarmer.balance - amountNum;
    const updatedFarmer = { ...selectedFarmer, balance: newBalance };
    setSelectedFarmer(updatedFarmer);
    setFarmers(prev => prev.map(f => f.id === selectedFarmer.id ? updatedFarmer : f));

    // 1. Add transaction document (non-blocking)
    addDoc(collection(db, "transactions"), {
      userId: currentUser?.uid,
      personId: selectedFarmer.id,
      type: "well_payment",
      wellId: selectedWellId || "default_well",
      amount: amountNum,
      note: paymentNote.trim() || "تسديد نقدي دفعة تحت الحساب",
      section: "well_customers",
      createdAt: new Date(paymentDate + "T12:00:00")
    }).catch((err) => {
      console.error("Failed to add payment offline/online:", err);
    });

    // 2. Update person balance immediately
    updateDoc(doc(db, "persons", selectedFarmer.id), { balance: newBalance }).catch((err) => {
      console.error("Failed to update farmer balance offline/online:", err);
    });

    // 3. Immediately close payment modal and reset fields (fully responsive)
    setIsSaving(false);
    setIsPaymentModalOpen(false);
    setPaymentAmount("");
    setPaymentNote("");
  };

  // Delete Transaction (Watering or Payment) and reverse balance effect
  const handleDeleteTransaction = (t: Transaction) => {
    if (!selectedFarmer) return;
    if (!window.confirm("هل أنت متأكد من حذف هذه العملية المالية؟ سيتم عكس قيمتها من الرصيد فوراً.")) return;

    // 1. Delete document (non-blocking)
    deleteDoc(doc(db, "transactions", t.id)).catch((err) => {
      console.error("Failed to delete transaction offline/online:", err);
    });

    // 2. Reverse balance immediately
    const isCharge = t.type === "well_watering" || t.type === "debt";
    const effect = isCharge ? -t.amount : t.amount;
    const newBalance = selectedFarmer.balance + effect;
    updateDoc(doc(db, "persons", selectedFarmer.id), { balance: newBalance }).catch((err) => {
      console.error("Failed to update balance after deletion offline/online:", err);
    });

    // 3. Optimistic Update
    setFarmerTransactions(prev => prev.filter(item => item.id !== t.id));
    const updatedFarmer = { ...selectedFarmer, balance: newBalance };
    setSelectedFarmer(updatedFarmer);
    setFarmers(prev => prev.map(f => f.id === selectedFarmer.id ? updatedFarmer : f));
  };

  // Copy to Clipboard Utility
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(shareMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Print Single Transaction Invoice/Receipt as PDF
  const handlePrintSingleTransaction = () => {
    const t = sharingTransaction;
    if (!t) {
      alert("لا تتوفر تفاصيل لهذه العملية للطباعة.");
      return;
    }

    const isCharge = t.type === "well_watering" || t.type === "debt";
                  const isWatering = t.type === "well_watering";
                  const details = (t as any).wateringDetails;
    const dateStr = t.createdAt?.toDate 
      ? t.createdAt.toDate().toLocaleDateString("ar-YE", { year: "numeric", month: "2-digit", day: "2-digit" })
      : new Date().toLocaleDateString("ar-YE", { year: "numeric", month: "2-digit", day: "2-digit" });

    let printHTML = "";

    if (isWatering && details) {
      printHTML = `
        <div style="direction: rtl; font-family: 'Cairo', sans-serif; padding: 30px; color: black; background: white; max-width: 800px; margin: auto;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #06b6d4; padding-bottom: 15px; margin-bottom: 25px;">
            <div>
              <h1 style="margin: 0 0 5px; font-size: 24px; color: #0891b2; font-weight: 900;">${settings.wellName || "مشروع بئر ري مائي"}</h1>
              ${settings.operatorName ? `<p style="margin: 0; font-size: 13px; color: #4b5563;">مشغل البئر: ${settings.operatorName}</p>` : ""}
              ${settings.ownerName ? `<p style="margin: 3px 0 0; font-size: 13px; color: #4b5563;">مالك البئر: ${settings.ownerName}</p>` : ""}
            </div>
            <div style="text-align: left;">
              <div style="border: 1px solid #0891b2; color: #0891b2; padding: 5px 15px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; margin-bottom: 10px;">
                سند سقاية مائية رقم #${t.id?.substring(0, 6) || "W-INV"}
              </div>
              <div style="font-size: 12px; color: #6b7280; font-weight: bold;">تاريخ السند: ${dateStr}</div>
            </div>
          </div>

          <!-- Customer Info -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; margin-bottom: 25px;">
            <h3 style="margin: 0 0 8px; font-size: 14px; color: #0891b2; font-weight: 800;">بيانات الرعوي / العميل:</h3>
            <table style="width: 100%; font-size: 13px; line-height: 1.6; text-align: right;">
              <tr>
                <td style="width: 15%; font-weight: bold; color: #4b5563;">الاسم الكامل:</td>
                <td style="font-weight: bold; color: #1f2937;">${selectedFarmer?.name}</td>
                <td style="width: 15%; font-weight: bold; color: #4b5563;">رقم الجوال:</td>
                <td style="color: #1f2937; direction: ltr; text-align: right;">${selectedFarmer?.phone || "-"}</td>
              </tr>
            </table>
          </div>

          <!-- Details Table -->
          <h3 style="font-size: 14px; color: #1f2937; margin-bottom: 10px; font-weight: 800; border-right: 4px solid #0891b2; padding-right: 8px;">تفاصيل حساب السقاية والوقت:</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px; text-align: center;">
            <thead>
              <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                <th style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold; text-align: right;">الوصف</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold;">القيمة / المدة</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold;">السعر الفردي</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold; text-align: left;">الإجمالي الفرعي</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold;">مدة الري (ساعات)</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">${details.totalHours} ساعة (من ${details.startTime} إلى ${details.endTime})</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">${details.hourlyRate?.toLocaleString('en-US')} ريال</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: left; font-weight: bold;">${details.hoursCost?.toLocaleString('en-US')} ريال</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold;">الديزل الواصل للبئر من الرعوي</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">${details.dieselDelivered} لتر</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">-</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: left;">-</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold;">الديزل المستهلك الفعلي</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">${details.dieselUsed} لتر</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">-</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: left;">-</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold;">المتبقي من ديزل العميل في البئر</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #0891b2;">${details.dieselRemaining} لتر</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">-</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: left;">-</td>
              </tr>
              <tr style="background-color: #fafafa;">
                <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold;">تسوية فارق استهلاك الديزل</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">${(details.dieselUsed - details.dieselDelivered) > 0 ? `عجز ديزل: +${(details.dieselUsed - details.dieselDelivered).toFixed(2)} لتر` : `فائض ديزل: ${(details.dieselUsed - details.dieselDelivered).toFixed(2)} لتر`}</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">${(details.diesel20LPrice / 20 || 0).toFixed(2)} ريال/لتر</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: left; font-weight: bold; color: ${details.dieselAdjustmentCost > 0 ? '#ef4444' : '#22c55e'};">
                  ${details.dieselAdjustmentCost > 0 ? `+${details.dieselAdjustmentCost.toLocaleString('en-US')}` : details.dieselAdjustmentCost.toLocaleString('en-US')} ريال
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Total Summary -->
          <div style="display: flex; justify-content: flex-end; margin-top: 15px;">
            <table style="width: 50%; border-collapse: collapse; font-size: 13px; text-align: right;">
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 0; font-weight: bold; color: #4b5563; text-align: right;">صافي قيمة الفاتورة:</td>
                <td style="padding: 8px 0; text-align: left; font-weight: 900; font-size: 15px; color: #0891b2;">${t.amount?.toLocaleString('en-US')} ريال</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #4b5563; text-align: right;">صافي الحساب الكلي بعد السند:</td>
                <td style="padding: 8px 0; text-align: left; font-weight: 900; font-size: 15px; color: #1e293b;">${selectedFarmer?.balance?.toLocaleString('en-US')} ريال</td>
              </tr>
            </table>
          </div>

          <!-- Footer -->
          <div style="text-align: center; border-top: 2px dashed #e2e8f0; margin-top: 50px; padding-top: 15px; font-size: 11px; color: #6b7280; font-weight: bold;">
            شكرًا لتعاونكم وثقتكم بنا. تم التوليد آلياً بواسطة تطبيق الدفتر الآمن لإدارة الآبار الارتوازية.
          </div>
        </div>
      `;
    } else {
      // It's a payment receipt!
      printHTML = `
        <div style="direction: rtl; font-family: 'Cairo', sans-serif; padding: 40px; color: black; background: white; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);">
          <!-- Header -->
          <div style="text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 15px; margin-bottom: 25px;">
            <h1 style="margin: 0 0 5px; font-size: 22px; color: #059669; font-weight: 900;">سند قبض مالي (تسديد)</h1>
            <p style="margin: 0; font-size: 13px; color: #4b5563;">${settings.wellName || "مشروع البئر الارتوازي"}</p>
          </div>

          <!-- Invoice ID and Date -->
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; margin-bottom: 20px; font-weight: bold;">
            <span>سند رقم: #${t.id?.substring(0, 6) || "P-INV"}</span>
            <span>تاريخ السند: ${dateStr}</span>
          </div>

          <!-- Content Details -->
          <div style="font-size: 14px; line-height: 2; color: #1f2937; margin-bottom: 30px; text-align: right;">
            استلمنا من السيد/المزارع المحترم: <strong style="font-size: 16px; color: #000;">${selectedFarmer?.name}</strong><br>
            مبلغاً وقدره: <strong style="font-size: 18px; color: #059669;">${t.amount?.toLocaleString('en-US')} ريال يمني</strong><br>
            وذلك عن/البيان: <strong style="color: #4b5563;">${t.note}</strong>
          </div>

          <!-- Account State -->
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 15px; text-align: center; margin-bottom: 25px;">
            <span style="font-size: 12px; color: #166534; font-weight: bold; display: block; margin-bottom: 5px;">الحساب الجاري بعد السند</span>
            <strong style="font-size: 20px; color: #166534;">${selectedFarmer?.balance?.toLocaleString('en-US')} ريال</strong>
          </div>

          <!-- Signatures -->
          <div style="display: flex; justify-content: space-between; margin-top: 40px; font-size: 12px; font-weight: bold; color: #4b5563;">
            <div style="text-align: center; width: 45%;">
              <p style="margin-bottom: 35px;">توقيع المستلم (مشغل البئر)</p>
              <p style="border-top: 1px solid #cbd5e1; padding-top: 5px;">${settings.operatorName || "..........................."}</p>
            </div>
            <div style="text-align: center; width: 45%;">
              <p style="margin-bottom: 35px;">توقيع المسدد (الرعوي)</p>
              <p style="border-top: 1px solid #cbd5e1; padding-top: 5px;">${selectedFarmer?.name}</p>
            </div>
          </div>

          <!-- Footer -->
          <div style="text-align: center; border-top: 1px solid #e2e8f0; margin-top: 40px; padding-top: 15px; font-size: 10px; color: #9ca3af; font-weight: bold;">
            تم التوليد والطباعة آلياً بواسطة تطبيق الدفتر الآمن.
          </div>
        </div>
      `;
    }

    const printArea = document.getElementById("print-area");
    if (printArea) {
      printArea.innerHTML = printHTML;
      setTimeout(() => {
        if (typeof (window as any).AndroidPrint !== "undefined") {
          (window as any).AndroidPrint.print();
        } else {
          window.print();
        }
      }, 250);
    }
  };

  // Filter farmers by search query
  // ⚡ Bolt Optimization: Memoize filtered array to avoid O(N) recalculations on render
  const filteredFarmers = useMemo(() => farmers.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.phone.includes(search)
  ), [farmers, search]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-850 pb-36" dir="rtl">
      {/* 1. HEADER CONTAINER */}
      <div className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-20 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={selectedFarmer ? () => setSelectedFarmer(null) : onGoBack}
            className="p-2.5 hover:bg-slate-50 text-slate-500 rounded-2xl active:scale-95 transition"
          >
            <ArrowRight size={22} />
          </button>
          <div>
            <h1 className="font-black text-lg text-slate-800 flex items-center gap-2">
              <Droplets className="text-cyan-500 animate-pulse" size={22} />
              {settings.wellName || "نظام السقايات"}
            </h1>
            <p className="text-xs font-bold text-slate-400">
              {selectedFarmer ? `الحساب الجاري للرعوي: ${selectedFarmer.name}` : "إدارة مياه ري المزارعين والديزل"}
            </p>
          </div>
        </div>

        {!selectedFarmer && (
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => setActiveTab("farmers")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === "farmers" ? "bg-white text-cyan-600 shadow-sm" : "text-slate-400"}`}
            >
              الرعاة والعمليات
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === "settings" ? "bg-white text-cyan-600 shadow-sm" : "text-slate-400"}`}
            >
              <span className="flex items-center gap-1">
                <Settings size={14} />
                الضبط
              </span>
            </button>
          </div>
        )}
      </div>

      <div className="px-4 pt-4 flex-1">
        {selectedFarmer ? (
          /* ======================================================= */
          /* 2. DETAILED FARMER ACCOUNT VIEW */
          /* ======================================================= */
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            {/* Farmer Overview Card */}
            <div className="bg-gradient-to-tr from-cyan-500 via-cyan-600 to-blue-600 rounded-[2rem] p-6 text-white shadow-xl shadow-cyan-500/10 mb-6 relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="bg-white/10 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider block w-fit mb-3 border border-white/15">
                    الملف المالي للرعوي
                  </span>
                  <h2 className="text-2xl font-black mb-1">{selectedFarmer.name}</h2>
                  {selectedFarmer.phone && (
                    <a href={`tel:${selectedFarmer.phone}`} className="text-xs font-bold text-cyan-100 flex items-center gap-1 w-fit hover:underline">
                      <Phone size={13} />
                      {selectedFarmer.phone}
                    </a>
                  )}
                </div>

                <div className="bg-white/10  rounded-3xl p-5 border border-white/20 text-center min-w-[140px]">
                  <p className="text-xs font-black text-cyan-100 mb-1">صافي الحساب الكلي</p>
                  <p className="text-2xl font-black">
                    {Math.abs(selectedFarmer.balance).toLocaleString('en-US')}
                  </p>
                  <p className="text-xs font-bold text-white/80 mt-1">
                    {selectedFarmer.balance > 0 ? "⚠️ مستحق عليه للبئر" : selectedFarmer.balance < 0 ? "✅ رصيد دائن له" : "متزن"}
                  </p>
                </div>
              </div>

              {/* Action Operations Grid */}
              <div className="grid grid-cols-2 gap-3 mt-6 relative z-10">
                <button
                  onClick={() => setIsWateringModalOpen(true)}
                  className="bg-white text-cyan-700 font-black text-xs py-3 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:bg-slate-50 transition active:scale-95"
                >
                  <Droplets size={16} />
                  تسجيل سقاية جديدة
                </button>
                <button
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="bg-cyan-100/20  text-white border border-white/20 font-black text-xs py-3 px-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/10 transition active:scale-95"
                >
                  <DollarSign size={16} />
                  تسجيل دفعة نقدية
                </button>
              </div>
            </div>

            {/* Quick Management row */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => {
                  setEditingFarmer(selectedFarmer);
                  setFarmerName(selectedFarmer.name);
                  setFarmerPhone(selectedFarmer.phone);
                  setIsFarmerModalOpen(true);
                }}
                className="flex-1 py-3 px-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 hover:bg-slate-50 transition"
              >
                <Edit2 size={14} />
                تعديل بيانات الحساب
              </button>
              <button
                onClick={() => handleDeleteFarmer(selectedFarmer)}
                className="py-3 px-4 bg-red-50 text-red-600 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 hover:bg-red-100 transition"
              >
                <Trash2 size={14} />
                حذف الحساب
              </button>
            </div>

            {/* Transaction List Title */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-black text-sm text-slate-700">أرشيف العمليات والسقايات</h3>
              <span className="text-xs font-black bg-slate-100 px-2.5 py-1 text-slate-500 rounded-full">
                {farmerTransactions.length} عملية
              </span>
            </div>

            {/* Transaction Items */}
            {farmerTransactions.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 border border-slate-100 text-center text-slate-400 font-bold text-xs">
                <Compass className="mx-auto mb-3 text-slate-300 animate-spin-slow" size={32} />
                لا يوجد أي عمليات مسجلة في حساب الرعوي بعد.
              </div>
            ) : (
              <div className="space-y-3.5">
                {farmerTransactions.map((t) => {
                  const isWatering = t.type === "well_watering";
                  const details = (t as any).wateringDetails;
                  const isChargeCard = t.type === "well_watering" || t.type === "debt";

                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm relative overflow-hidden"
                    >
                      {/* Color indicator bar */}
                      <div className={`absolute top-0 bottom-0 right-0 w-1.5 ${isChargeCard ? "bg-cyan-500" : "bg-emerald-500"}`} />

                      <div className="flex items-start justify-between gap-4 mr-2">
                        <div className="flex items-start gap-3">
                          <div className={`p-2.5 rounded-xl ${isChargeCard ? "bg-cyan-50 text-cyan-500" : "bg-emerald-50 text-emerald-500"}`}>
                            {isChargeCard ? <Droplets size={18} /> : <DollarSign size={18} />}
                          </div>

                          <div>
                            <h4 className="font-black text-slate-800 text-sm">
                              {isChargeCard ? (t.type === "debt" ? "رصيد سابق مستحق" : "سقاية ري مائي") : "تسجيل سداد مالي"}
                            </h4>
                            <p className="text-xs font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                              <Calendar size={11} />
                              {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString("ar-YE", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : "تاريخ مجهول"}
                            </p>
                          </div>
                        </div>

                        <div className="text-left">
                          <p className={`font-black text-sm ${isChargeCard ? "text-cyan-600" : "text-emerald-600"}`}>
                            <span dir="ltr">{isChargeCard ? "+" : "-"}{t.amount.toLocaleString('en-US')}</span> <span>ريال</span>
                          </p>
                          <p className="text-xs text-slate-400 font-black">
                            {isChargeCard ? "مستحق (عليه)" : "دفع (له)"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 mr-2 bg-slate-50/50 rounded-xl p-3 text-xs text-slate-600 leading-relaxed font-semibold border border-slate-50">
                        {t.note}
                        
                        {/* Optional Detailed Specs */}
                        {isWatering && details && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-200/50 grid grid-cols-2 gap-y-2 gap-x-4 text-xs text-slate-500 font-bold">
                            <span className="flex items-center gap-1.5"><Clock size={12} className="text-cyan-500" /> الساعات: {details.totalHours} ساعة (سعر: {details.hourlyRate})</span>
                            <span className="flex items-center gap-1.5"><DollarSign size={12} className="text-amber-500" /> قيمة الساعات: {details.hoursCost?.toLocaleString('en-US')} ريال</span>
                            <span className="flex items-center gap-1.5"><Fuel size={12} className="text-cyan-500" /> ديزل واصل: {details.dieselDelivered} لتر</span>
                            <span className="flex items-center gap-1.5"><Activity size={12} className="text-red-500" /> ديزل مستهلك: {details.dieselUsed} لتر</span>
                            <span className="flex items-center gap-1.5 col-span-2 text-cyan-600">
                              <Fuel size={12} className="text-cyan-500" /> فارق الديزل: {details.dieselRemaining} لتر ({details.dieselAdjustmentCost > 0 ? `سعر فارق الديزل مضاف عليه: +${details.dieselAdjustmentCost.toLocaleString('en-US')} ريال` : details.dieselAdjustmentCost < 0 ? `خصم ديزل زائد له: ${details.dieselAdjustmentCost.toLocaleString('en-US')} ريال` : "متعادل"})
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Quick item actions */}
                      <div className="mt-3.5 pt-3 border-t border-slate-100 flex justify-between items-center mr-2">
                        {isWatering ? (
                          <button
                            onClick={() => {
                              const totalHours = details?.totalHours || 0;
                              const hoursCost = details?.hoursCost || 0;
                              const currentBal = selectedFarmer.balance; // Approximation of balance at share time
                              const dieselAdj = details?.dieselAdjustmentCost || 0;
                              const farakSign = dieselAdj > 0 
                                ? `+${dieselAdj.toLocaleString('en-US')} ريال (عجز)` 
                                : dieselAdj < 0 
                                  ? `-${Math.abs(dieselAdj).toLocaleString('en-US')} ريال (فائض)` 
                                  : "0 ريال";

                              let dateStr = "";
                              let dayName = "";
                              if (t.createdAt?.toDate) {
                                const d = t.createdAt.toDate();
                                dateStr = d.toLocaleDateString("ar-YE", { year: 'numeric', month: 'numeric', day: 'numeric' });
                                dayName = d.toLocaleDateString("ar-YE", { weekday: 'long' }) + "، ";
                              }

                              const msg = `💧 *إشعار سقاية* 💧
👤 *العميل:* ${selectedFarmer.name}
📅 *التاريخ:* ${dayName}${dateStr}

⏱️ *الوقت:* من ${details?.startTime || "-"} إلى ${details?.endTime || "-"} (${totalHours} ساعة)
💵 *قيمة الوقت:* ${hoursCost.toLocaleString('en-US')} ريال
⚖️ *فارق الديزل:* ${farakSign}
💸 *مبلغ السقاية:* ${t.amount.toLocaleString('en-US')} ريال

📈 *صافي الحساب:* ${currentBal.toLocaleString('en-US')} ريال (عليه)

⛽ *الديزل:*
📥 واصل: ${details?.dieselDelivered || 0} لتر
⚡ مستهلك: ${details?.dieselUsed || 0} لتر
🛢️ متبقي: ${details?.dieselRemaining || 0} لتر

✨ *مشروع:* ${settings.wellName}`;
                              setShareMessage(msg);
                              setIsShareModalOpen(true);
                            }}
                            className="text-cyan-600 hover:text-cyan-700 font-black text-xs flex items-center gap-1 hover:underline active:scale-95 transition"
                          >
                            <Share2 size={13} />
                            مشاركة التفاصيل والتقرير
                          </button>
                        ) : (
                          <span />
                        )}

                        <button
                          onClick={() => handleDeleteTransaction(t)}
                          className="text-red-500 hover:text-red-600 font-bold text-xs flex items-center gap-1 hover:underline active:scale-95 transition"
                        >
                          <Trash2 size={13} />
                          حذف العملية
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : activeTab === "farmers" ? (
          /* ======================================================= */
          /* 3. FARMERS LIST TAB */
          /* ======================================================= */
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Bento Quick-Info Panel */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
                <Users size={20} className="text-cyan-500 mb-1.5 shrink-0" />
                <p className="text-xs font-black text-slate-400">إجمالي الرعاة</p>
                <p className="text-sm font-black text-slate-800 mt-1">{farmers.length}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
                <Fuel size={20} className="text-cyan-500 mb-1.5 shrink-0" />
                <p className="text-xs font-black text-slate-400">الديزل المقدر</p>
                <p className="text-sm font-black text-slate-800 mt-1">{settings.diesel20LPrice.toLocaleString('en-US')}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
                <Clock size={20} className="text-cyan-500 mb-1.5 shrink-0" />
                <p className="text-xs font-black text-slate-400">ساعة البئر</p>
                <p className="text-sm font-black text-slate-800 mt-1">{settings.hourlyWellRate.toLocaleString('en-US')}</p>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex gap-3 mb-5">
              <div className="flex-1 bg-white border border-slate-150 rounded-2xl px-3 flex items-center gap-2 shadow-sm focus-within:border-cyan-500 transition">
                <Search size={18} className="text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث عن رعوي بالاسم أو الهاتف..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full py-3 bg-transparent text-slate-800 text-xs font-bold outline-none border-none placeholder-slate-400"
                />
              </div>

              <button
                onClick={() => {
                  setEditingFarmer(null);
                  setFarmerName("");
                  setFarmerPhone("");
                  setIsFarmerModalOpen(true);
                }}
                className="bg-cyan-500 hover:bg-cyan-600 text-white font-black text-xs px-5 rounded-2xl flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/15 active:scale-95 transition"
              >
                <Plus size={16} />
                إضافة رعوي
              </button>
            </div>

            {/* List */}
            {loading ? (
              <div className="text-center py-10 font-bold text-xs text-slate-400">جاري تحميل مزارعي البئر...</div>
            ) : filteredFarmers.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 border border-slate-100 text-center text-slate-400 font-bold text-xs">
                <Compass className="mx-auto mb-3 text-slate-300 animate-spin-slow" size={36} />
                لا يوجد مزارعين مسجلين يطابقون البحث.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFarmers.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFarmer(f)}
                    className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between cursor-pointer hover:border-cyan-200 transition active:scale-98 select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-500 flex items-center justify-center font-black text-sm shrink-0">
                        {f.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 text-sm">{f.name}</h4>
                        {f.phone && (
                          <p className="text-xs font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                            <Phone size={10} />
                            {f.phone}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-left flex items-center gap-3">
                      <div>
                        <p className={`font-black text-sm ${f.balance > 0 ? "text-red-500" : f.balance < 0 ? "text-emerald-500" : "text-slate-500"}`}>
                          {f.balance === 0 ? "متزن" : `${Math.abs(f.balance).toLocaleString('en-US')} ريال`}
                        </p>
                        {f.balance !== 0 && (
                          <p className="text-xs font-black text-slate-400 uppercase tracking-wider mt-0.5">
                            {f.balance > 0 ? "عليه للبئر" : "له رصيد"}
                          </p>
                        )}
                      </div>
                      <span className="text-slate-300">←</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <>
            {/* ======================================================= */}
            {/* 4. SETTINGS TAB */}
            {/* ======================================================= */}
            <motion.form onSubmit={handleSaveSettings} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Settings size={14} className="text-cyan-500" />
                تعديل إعدادات وبيانات مشروع البئر
              </h3>

              {saveStatus === "saved" && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3.5 rounded-2xl flex items-center gap-2"
                >
                  <span className="text-sm">✅</span>
                  <span>تم حفظ وتحديث إعدادات البئر بنجاح!</span>
                </motion.div>
              )}

              {saveStatus === "error" && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="bg-red-50 border border-red-200 text-red-800 text-xs font-bold p-3.5 rounded-2xl flex items-center gap-2"
                >
                  <span className="text-sm">❌</span>
                  <span>فشل في حفظ الإعدادات، يرجى المحاولة لاحقاً.</span>
                </motion.div>
              )}

              <div className="space-y-3.5">
                <div>
                  <label className="text-xs font-black text-slate-500 block mb-1">اسم البئر / اسم المشروع</label>
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl px-3 flex items-center gap-2 focus-within:border-cyan-500 transition">
                    <Droplets size={16} className="text-slate-400" />
                    <input
                      type="text"
                      required
                      value={settings.wellName}
                      onChange={(e) => setSettings({ ...settings, wellName: e.target.value })}
                      placeholder="مثال: مشروع بئر البركة الارتوازي"
                      className="w-full py-3.5 bg-transparent text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black text-slate-500 block mb-1">اسم مالك البئر</label>
                    <div className="bg-slate-50 border border-slate-150 rounded-2xl px-3 flex items-center gap-2 focus-within:border-cyan-500 transition">
                      <User size={16} className="text-slate-400" />
                      <input
                        type="text"
                        value={settings.ownerName}
                        onChange={(e) => setSettings({ ...settings, ownerName: e.target.value })}
                        placeholder="أدخل اسم المالك"
                        className="w-full py-3.5 bg-transparent text-xs font-bold outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-500 block mb-1">العامل / المشغل</label>
                    <div className="bg-slate-50 border border-slate-150 rounded-2xl px-3 flex items-center gap-2 focus-within:border-cyan-500 transition">
                      <User size={16} className="text-slate-400" />
                      <input
                        type="text"
                        value={settings.operatorName}
                        onChange={(e) => setSettings({ ...settings, operatorName: e.target.value })}
                        placeholder="اسم مشغل البئر"
                        className="w-full py-3.5 bg-transparent text-xs font-bold outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black text-slate-500 block mb-1">سعر العشرين لتر ديزل (ريال)</label>
                    <div className="bg-slate-50 border border-slate-150 rounded-2xl px-3 flex items-center gap-2 focus-within:border-cyan-500 transition">
                      <Fuel size={16} className="text-slate-400 shrink-0" />
                      <input
                        type="number"
                        required
                        value={settings.diesel20LPrice || ""}
                        onChange={(e) => setSettings({ ...settings, diesel20LPrice: Number(e.target.value) })}
                        placeholder="مثال: 20000"
                        className="w-full py-3.5 bg-transparent text-xs font-bold outline-none"
                      />
                    </div>
                    <span className="text-xs text-slate-400 mt-1 block">سعر اللتر الواحد المحسوب: {(settings.diesel20LPrice / 20 || 0).toFixed(2)} ريال</span>
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-500 block mb-1">سعر ساعة الري للبئر (ريال)</label>
                    <div className="bg-slate-50 border border-slate-150 rounded-2xl px-3 flex items-center gap-2 focus-within:border-cyan-500 transition">
                      <Clock size={16} className="text-slate-400 shrink-0" />
                      <input
                        type="number"
                        required
                        value={settings.hourlyWellRate || ""}
                        onChange={(e) => setSettings({ ...settings, hourlyWellRate: Number(e.target.value) })}
                        placeholder="مثال: 5000"
                        className="w-full py-3.5 bg-transparent text-xs font-bold outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className={`w-full py-4 font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition active:scale-95 ${
                saveStatus === "saved" 
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10 text-white" 
                  : "bg-cyan-500 hover:bg-cyan-600 shadow-cyan-500/10 text-white"
              }`}
            >
              {isSaving ? (
                <>جاري حفظ الإعدادات...</>
              ) : saveStatus === "saved" ? (
                <>تم حفظ الإعدادات بنجاح! ✓</>
              ) : (
                <>تحديث وحفظ الإعدادات</>
              )}
            </button>
          </motion.form>

          </>
        )}
      </div>

      {/* ======================================================= */}
      {/* 5. MODALS & DIALOGS */} 
      {/* ======================================================= */}

      {/* A. FARMER MODAL (Add / Edit) */}
      <AnimatePresence>
        {isFarmerModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50  z-50 flex items-end sm:items-center justify-center p-4">
            <motion.form
              onSubmit={handleSaveFarmer}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-white rounded-t-[2.5rem] sm:rounded-[2rem] w-full max-w-md p-6 border border-slate-100 shadow-2xl relative space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-black text-base text-slate-800">
                  {editingFarmer ? "تعديل حساب الرعوي" : "إضافة رعوي جديد"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsFarmerModalOpen(false)}
                  className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-slate-500 block mb-1">اسم الرعوي الكامل</label>
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl px-3 flex items-center gap-2 focus-within:border-cyan-500 transition">
                    <User size={16} className="text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="أدخل الاسم الرباعي"
                      value={farmerName}
                      onChange={(e) => setFarmerName(e.target.value)}
                      className="w-full py-3.5 bg-transparent text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-500 block mb-1">رقم الهاتف الجوال</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-slate-50 border border-slate-150 rounded-2xl px-3 flex items-center gap-2 focus-within:border-cyan-500 transition">
                      <Phone size={16} className="text-slate-400" />
                      <input
                        type="tel"
                        placeholder="مثال: 77xxxxxxx"
                        value={farmerPhone}
                        onChange={(e) => setFarmerPhone(toEnglishDigits(e.target.value))}
                        className="w-full py-3.5 bg-transparent text-xs font-bold outline-none text-left"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSelectContact}
                      className="p-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl flex items-center justify-center shrink-0 transition"
                      title="اختر من الأسماء"
                    >
                      <Contact size={18} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-2 py-3.5 px-4 bg-cyan-500 hover:bg-cyan-600 text-white font-black rounded-2xl cursor-pointer shadow-lg shadow-cyan-500/15"
                >
                  {isSaving ? "جاري الحفظ..." : "حفظ الحساب الجاري"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsFarmerModalOpen(false)}
                  className="flex-1 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-2xl cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* B. WATERING MODAL (سقاية جديدة) */}
      <AnimatePresence>
        {isWateringModalOpen && selectedFarmer && (
          <div className="fixed inset-0 bg-slate-900/50  z-50 flex items-end sm:items-center justify-center p-4 overflow-y-auto">
            <motion.form
              onSubmit={handleSaveWatering}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-white rounded-t-[2.5rem] sm:rounded-[2rem] w-full max-w-md p-6 border border-slate-100 shadow-2xl relative space-y-4 my-auto"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-base text-slate-800">تسجيل سقاية مائية للرعوي</h3>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">الرعوي الحالي: {selectedFarmer.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWateringModalOpen(false)}
                  className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-right max-h-[60vh] overflow-y-auto pr-1">
                {/* Date Selection */}
                <div>
                  <label className="text-xs font-black text-slate-500 block mb-1">تاريخ السقاية</label>
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl px-3 flex items-center gap-2 focus-within:border-cyan-500 transition">
                    <Calendar size={16} className="text-slate-400" />
                    <input
                      type="date"
                      required
                      value={wateringDate}
                      onChange={(e) => setWateringDate(e.target.value)}
                      className="w-full py-3.5 bg-transparent text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                {/* Time Range */}
                <div className="grid grid-cols-1 gap-3">
                  {/* وقت البدء */}
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 space-y-2">
                    <span className="text-sm font-black text-slate-500 block">وقت البدء (من الساعة)</span>
                    <div className="flex items-center gap-2">
                      {/* Hour */}
                      <div className="flex-1 flex flex-col items-center">
                        <span className="text-xs font-bold text-slate-400 mb-0.5">الساعة (1-12)</span>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          required
                          value={startHour}
                          onChange={(e) => {
                            let val = e.target.value;
                            const num = parseInt(val, 10);
                            if (num > 12) val = "12";
                            if (num < 0) val = "0"; // allow temporary 0 while typing
                            setStartHour(val);
                          }}
                          placeholder="8"
                          className="w-full text-center py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black outline-none focus:border-cyan-500 text-slate-800"
                        />
                      </div>
                      
                      <span className="text-slate-400 font-bold self-end mb-2">:</span>

                      {/* Minute */}
                      <div className="flex-1 flex flex-col items-center">
                        <span className="text-xs font-bold text-slate-400 mb-0.5">الدقيقة (0-59)</span>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={startMinute}
                          onChange={(e) => {
                            let val = e.target.value;
                            const num = parseInt(val, 10);
                            if (num > 59) val = "59";
                            if (num < 0) val = "0";
                            setStartMinute(val);
                          }}
                          placeholder="00"
                          className="w-full text-center py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black outline-none focus:border-cyan-500 text-slate-800"
                        />
                      </div>

                      {/* Period Toggle */}
                      <div className="flex-[1.5] flex flex-col items-center">
                        <span className="text-xs font-bold text-slate-400 mb-0.5">الفترة</span>
                        <div className="flex w-full bg-white border border-slate-200 rounded-xl overflow-hidden p-0.5 h-[38px]">
                          <button
                            type="button"
                            onClick={() => setStartPeriod("AM")}
                            className={`flex-1 text-xs font-black rounded-lg transition-all ${
                              startPeriod === "AM"
                                ? "bg-cyan-500 text-white shadow-sm"
                                : "text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            صباحاً
                          </button>
                          <button
                            type="button"
                            onClick={() => setStartPeriod("PM")}
                            className={`flex-1 text-xs font-black rounded-lg transition-all ${
                              startPeriod === "PM"
                                ? "bg-cyan-500 text-white shadow-sm"
                                : "text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            مساءً
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* وقت الانتهاء */}
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 space-y-2">
                    <span className="text-sm font-black text-slate-500 block">وقت الانتهاء (إلى الساعة)</span>
                    <div className="flex items-center gap-2">
                      {/* Hour */}
                      <div className="flex-1 flex flex-col items-center">
                        <span className="text-xs font-bold text-slate-400 mb-0.5">الساعة (1-12)</span>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          required
                          value={endHour}
                          onChange={(e) => {
                            let val = e.target.value;
                            const num = parseInt(val, 10);
                            if (num > 12) val = "12";
                            if (num < 0) val = "0"; // allow temporary 0 while typing
                            setEndHour(val);
                          }}
                          placeholder="12"
                          className="w-full text-center py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black outline-none focus:border-cyan-500 text-slate-800"
                        />
                      </div>
                      
                      <span className="text-slate-400 font-bold self-end mb-2">:</span>

                      {/* Minute */}
                      <div className="flex-1 flex flex-col items-center">
                        <span className="text-xs font-bold text-slate-400 mb-0.5">الدقيقة (0-59)</span>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={endMinute}
                          onChange={(e) => {
                            let val = e.target.value;
                            const num = parseInt(val, 10);
                            if (num > 59) val = "59";
                            if (num < 0) val = "0";
                            setEndMinute(val);
                          }}
                          placeholder="00"
                          className="w-full text-center py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black outline-none focus:border-cyan-500 text-slate-800"
                        />
                      </div>

                      {/* Period Toggle */}
                      <div className="flex-[1.5] flex flex-col items-center">
                        <span className="text-xs font-bold text-slate-400 mb-0.5">الفترة</span>
                        <div className="flex w-full bg-white border border-slate-200 rounded-xl overflow-hidden p-0.5 h-[38px]">
                          <button
                            type="button"
                            onClick={() => setEndPeriod("AM")}
                            className={`flex-1 text-xs font-black rounded-lg transition-all ${
                              endPeriod === "AM"
                                ? "bg-cyan-500 text-white shadow-sm"
                                : "text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            صباحاً
                          </button>
                          <button
                            type="button"
                            onClick={() => setEndPeriod("PM")}
                            className={`flex-1 text-xs font-black rounded-lg transition-all ${
                              endPeriod === "PM"
                                ? "bg-cyan-500 text-white shadow-sm"
                                : "text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            مساءً
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hours Display & Rate override */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-500">مجموع الساعات المحسوبة:</span>
                  <span className="text-cyan-600 font-black">{toArabicDigits(getWateringDurationHours())} ساعة</span>
                </div>

                {/* Diesel Spec */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black text-slate-500 block mb-1">الديزل الواصل (لتر)</label>
                    <div className="bg-slate-50 border border-slate-150 rounded-2xl px-3 flex items-center gap-2 focus-within:border-cyan-500 transition">
                      <span className="text-sm">📥</span>
                      <input
                        type="number"
                        placeholder="الواصل باللتر"
                        value={dieselDelivered}
                        onChange={(e) => { const val = toEnglishDigits(e.target.value); setDieselDelivered(val !== "" ? Number(val) : ""); }}
                        className="w-full py-3.5 bg-transparent text-xs font-bold outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-500 block mb-1">الديزل المستخدم (لتر)</label>
                    <div className="bg-slate-50 border border-slate-150 rounded-2xl px-3 flex items-center gap-2 focus-within:border-cyan-500 transition">
                      <span className="text-sm">📤</span>
                      <input
                        type="number"
                        placeholder="المستخدم باللتر"
                        value={dieselUsed}
                        onChange={(e) => { const val = toEnglishDigits(e.target.value); setDieselUsed(val !== "" ? Number(val) : ""); }}
                        className="w-full py-3.5 bg-transparent text-xs font-bold outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Previous Balance Add-on */}
                <div>
                  <label className="text-xs font-black text-slate-500 block mb-1">مبلغ دين سابق (من بئر غير مسجل)</label>
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl px-3 flex items-center gap-2 focus-within:border-cyan-500 transition">
                    <DollarSign size={16} className="text-slate-400" />
                    <input
                      type="number"
                      placeholder="اختياري - يضاف للرصيد"
                      value={previousBalance}
                      onChange={(e) => { const val = toEnglishDigits(e.target.value); setPreviousBalance(val !== "" ? Number(val) : ""); }}
                      className="w-full py-3.5 bg-transparent text-xs font-bold outline-none text-red-500"
                    />
                  </div>
                </div>

                {/* Overrides and custom rates toggles or collapse */}
                <div className="pt-2">
                  <span className="text-xs font-black text-slate-400 block mb-1">تخصيص أسعار السقاية (تخطي الافتراضي):</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input
                        type="number"
                        placeholder={`ساعة البئر (${toArabicDigits(settings.hourlyWellRate)})`}
                        value={customHourlyRate}
                        onChange={(e) => { const val = toEnglishDigits(e.target.value); setCustomHourlyRate(val !== "" ? Number(val) : ""); }}
                        className="w-full p-3 bg-slate-50 border border-slate-150 rounded-2xl text-xs font-bold outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        placeholder={`ديزل ٢٠ لتر (${toArabicDigits(settings.diesel20LPrice)})`}
                        value={customDieselPrice}
                        onChange={(e) => { const val = toEnglishDigits(e.target.value); setCustomDieselPrice(val !== "" ? Number(val) : ""); }}
                        className="w-full p-3 bg-slate-50 border border-slate-150 rounded-2xl text-xs font-bold outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Water Notes */}
                <div>
                  <label className="text-xs font-black text-slate-500 block mb-1">ملاحظات السقاية (اختياري)</label>
                  <input
                    type="text"
                    value={wateringNote}
                    onChange={(e) => setWateringNote(e.target.value)}
                    placeholder="ملاحظات لتسجيلها في الفاتورة والأرشيف"
                    className="w-full p-3.5 bg-slate-50 border border-slate-150 rounded-2xl text-xs font-bold outline-none"
                  />
                </div>

                {/* Calculation breakdown */}
                <div className="p-4 bg-cyan-50/50 rounded-2xl border border-cyan-100 text-xs space-y-2 font-bold text-slate-700 mt-2">
                  <div className="flex justify-between">
                    <span>قيمة الساعات:</span>
                    <span>{toArabicDigits(getWateringCostDetails().hoursCost)} ريال</span>
                  </div>
                  <div className="flex justify-between">
                    <span>الديزل المتبقي:</span>
                    <span className={getWateringCostDetails().remainingLit >= 0 ? "text-emerald-600" : "text-red-500"}>
                      {toArabicDigits(getWateringCostDetails().remainingLit)} لتر
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>تسوية فارق الديزل:</span>
                    <span className={getWateringCostDetails().dieselAdjustmentCost >= 0 ? "text-red-500" : "text-emerald-600"}>
                      {getWateringCostDetails().dieselAdjustmentCost > 0 ? `+${toArabicDigits(getWateringCostDetails().dieselAdjustmentCost)} ريال (عليه)` : `${toArabicDigits(getWateringCostDetails().dieselAdjustmentCost)} ريال (خصم له)`}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-cyan-200 font-black text-slate-800 text-sm">
                    <span>المبلغ المستحق الإجمالي:</span>
                    <span className="text-cyan-700">{toArabicDigits(getWateringCostDetails().totalCost)} ريال</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-2 py-3.5 px-4 bg-cyan-500 hover:bg-cyan-600 text-white font-black rounded-2xl cursor-pointer shadow-lg shadow-cyan-500/15"
                >
                  {isSaving ? "جاري تسجيل السقاية..." : "تسجيل السقاية المائية"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsWateringModalOpen(false)}
                  className="flex-1 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-2xl cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* C. PAYMENT MODAL (تسجيل دفعة مالي) */}
      <AnimatePresence>
        {isPaymentModalOpen && selectedFarmer && (
          <div className="fixed inset-0 bg-slate-900/50  z-50 flex items-end sm:items-center justify-center p-4">
            <motion.form
              onSubmit={handleSavePayment}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-white rounded-t-[2.5rem] sm:rounded-[2rem] w-full max-w-md p-6 border border-slate-100 shadow-2xl relative space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-base text-slate-800">تسجيل دفعة نقدية (سداد)</h3>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">الحساب: {selectedFarmer.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-slate-500 block mb-1">تاريخ الدفعة</label>
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl px-3 flex items-center gap-2 focus-within:border-cyan-500 transition">
                    <Calendar size={16} className="text-slate-400" />
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full py-3.5 bg-transparent text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-500 block mb-1">المبلغ المسدد (ريال)</label>
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl px-3 flex items-center gap-2 focus-within:border-cyan-500 transition">
                    <DollarSign size={16} className="text-slate-400" />
                    <input
                      type="number"
                      required
                      placeholder="أدخل مبلغ السداد"
                      value={paymentAmount}
                      onChange={(e) => { const val = toEnglishDigits(e.target.value); setPaymentAmount(val !== "" ? Number(val) : ""); }}
                      className="w-full py-3.5 bg-transparent text-xs font-bold outline-none text-slate-850"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-500 block mb-1">البيان / ملاحظات الدفع</label>
                  <input
                    type="text"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="مثال: سداد نقد دفعة من الحساب"
                    className="w-full p-3.5 bg-slate-50 border border-slate-150 rounded-2xl text-xs font-bold outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-2 py-3.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl cursor-pointer shadow-lg shadow-emerald-500/15"
                >
                  {isSaving ? "جاري الحفظ..." : "تسجيل الدفعة المالية"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="flex-1 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-2xl cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* D. SHARE & WHATSAPP MODAL */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50  z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-white rounded-t-[2.5rem] sm:rounded-[2rem] w-full max-w-md p-6 border border-slate-100 shadow-2xl relative space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                  <MessageSquare size={18} className="text-cyan-500 animate-bounce" />
                  مشاركة تفاصيل السقاية
                </h3>
                <button
                  onClick={() => setIsShareModalOpen(false)}
                  className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 text-xs text-slate-700 leading-relaxed font-semibold whitespace-pre-wrap text-right max-h-[30vh] overflow-y-auto">
                {shareMessage}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                {/* 1. WhatsApp */}
                <a
                  href={
                    selectedFarmer?.phone
                      ? `https://wa.me/${getCleanPhone(selectedFarmer.phone)}?text=${encodeURIComponent(shareMessage)}`
                      : `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    localStorage.setItem("ignore_app_lock", "true");
                    setTimeout(() => localStorage.removeItem("ignore_app_lock"), 4000);
                  }}
                  className="py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/15 transition active:scale-95 text-xs text-center animate-pulse"
                >
                  <Send size={14} />
                  مشاركة واتساب
                </a>

                {/* 2. SMS / Text Message */}
                <a
                  href={
                    selectedFarmer?.phone
                      ? `sms:${getCleanPhone(selectedFarmer.phone)}?body=${encodeURIComponent(shareMessage)}`
                      : `sms:?body=${encodeURIComponent(shareMessage)}`
                  }
                  onClick={() => {
                    localStorage.setItem("ignore_app_lock", "true");
                    setTimeout(() => localStorage.removeItem("ignore_app_lock"), 4000);
                  }}
                  className="py-3 px-4 bg-cyan-600 hover:bg-cyan-700 text-white font-black rounded-2xl flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-600/15 transition active:scale-95 text-xs text-center"
                >
                  <MessageSquare size={14} />
                  رسالة نصية SMS
                </a>

                {/* 3. PDF Printing */}
                <button
                  type="button"
                  onClick={handlePrintSingleTransaction}
                  className="py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/15 transition active:scale-95 text-xs text-center cursor-pointer"
                >
                  <Printer size={14} />
                  تحويل وطباعة PDF
                </button>

                {/* 4. Copy Text */}
                <button
                  type="button"
                  onClick={handleCopyToClipboard}
                  className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl flex items-center justify-center gap-1.5 transition active:scale-95 text-xs text-center cursor-pointer"
                >
                  {copied ? <ClipboardCheck size={14} className="text-emerald-500" /> : <Clipboard size={14} />}
                  {copied ? "تم نسخ النص!" : "نسخ النص"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
