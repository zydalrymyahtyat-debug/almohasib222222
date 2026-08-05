import React, { useState, useEffect, useMemo } from "react";
import { Contacts } from "@capacitor-community/contacts";
import { Capacitor } from "@capacitor/core";
import { ArrowRight, Printer, Share2, Receipt, Phone, Package, AlertTriangle, Barcode, ClipboardList, TrendingUp, Search, Plus, X, Save, ScanLine, Edit2, Trash2 } from "lucide-react";
import { UserProfile, InventoryItem, InventoryMovement } from "../types";
import { auth, db } from "../firebase";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from "firebase/firestore";
import BarcodeScannerModal from "./BarcodeScannerModal";

interface Props {
  currentUser?: any;
  onGoBack: () => void;
  userProfile: UserProfile | null;
  onNavigate: (viewId: string, title: string) => void;
}

export default function InventoryDashboard({ currentUser, onGoBack, userProfile, onNavigate }: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "items" | "movements" | "pos" | "invoices">("pos");
  const [posSearchQuery, setPosSearchQuery] = useState("");
  const [posCart, setPosCart] = useState<{item: InventoryItem, quantity: number}[]>([]);
  const [posCustomerName, setPosCustomerName] = useState("");
  const [posCustomerPhone, setPosCustomerPhone] = useState("");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesSearch, setInvoicesSearch] = useState("");
  const [movementsSearch, setMovementsSearch] = useState("");
  const [showInvoiceModal, setShowInvoiceModal] = useState<any>(null);
  const [items, setItems] = useState<InventoryItem[]>(() => {
    const cached = localStorage.getItem("cached_inventory_items");
    if (cached) {
      try {
        const parsed = JSON.parse(decodeURIComponent(escape(atob(cached))));
        return parsed.map((i: any) => ({
          ...i,
          createdAt: i.createdAt ? { toMillis: () => new Date(i.createdAt).getTime(), toDate: () => new Date(i.createdAt) } : null
        }));
      } catch(e) { return []; }
    }
    return [];
  });
  const [movements, setMovements] = useState<InventoryMovement[]>(() => {
    const cached = localStorage.getItem("cached_inventory_movements");
    if (cached) {
      try {
        const parsed = JSON.parse(decodeURIComponent(escape(atob(cached))));
        return parsed.map((m: any) => ({
          ...m,
          createdAt: m.createdAt ? { toMillis: () => new Date(m.createdAt).getTime(), toDate: () => new Date(m.createdAt) } : null
        }));
      } catch(e) { return []; }
    }
    return [];
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(() => {
    return items.length === 0 && movements.length === 0;
  });

  // Modals
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<"search" | "form">("search");

  // Form states
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState({ name: "", category: "", quantity: "" as string | number, minQuantity: "" as string | number, cost: "" as string | number, price: "" as string | number, barcode: "" });
  const [movementForm, setMovementForm] = useState({ itemId: "", type: "in", quantity: "" as string | number, note: "" });


  useEffect(() => {
    if (isAddItemModalOpen || isMovementModalOpen || isScannerOpen) {
      (window as any).customBackHandler = () => {
        setIsAddItemModalOpen(false);
        setIsMovementModalOpen(false);
        setIsScannerOpen(false);
      };
    } else {
      delete (window as any).customBackHandler;
    }
    return () => {
      delete (window as any).customBackHandler;
    };
  }, [isAddItemModalOpen, isMovementModalOpen, isScannerOpen]);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    
    let isMounted = true;
    const itemsQ = query(collection(db, "inventory_items"), where("userId", "==", currentUser.uid));
    const unsubItems = onSnapshot(itemsQ, { includeMetadataChanges: true }, (snap) => {
      const itms: InventoryItem[] = [];
      snap.forEach((doc) => {
        itms.push({ id: doc.id, ...doc.data() } as InventoryItem);
      });
      if (isMounted) {
        setItems(itms);
        try {
          const serialized = itms.map(i => ({
             ...i,
             createdAt: i.createdAt ? i.createdAt.toDate().toISOString() : null
          }));
          localStorage.setItem("cached_inventory_items", btoa(unescape(encodeURIComponent(JSON.stringify(serialized)))));
        } catch (e) { console.error("Cache error", e); }
        setLoading(false);
      }
    }, (error) => {
      console.error("Error fetching inventory items:", error);
      if (isMounted) setLoading(false);
    });

    const movesQ = query(collection(db, "inventory_movements"), where("userId", "==", currentUser.uid));
    const unsubMoves = onSnapshot(movesQ, { includeMetadataChanges: true }, (snap) => {
      const mvs: InventoryMovement[] = [];
      snap.forEach((doc) => {
        mvs.push({ id: doc.id, ...doc.data() } as InventoryMovement);
      });
      mvs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      if (isMounted) {
        setMovements(mvs);
        try {
          const serialized = mvs.map(m => ({
             ...m,
             createdAt: m.createdAt ? m.createdAt.toDate().toISOString() : null
          }));
          localStorage.setItem("cached_inventory_movements", btoa(unescape(encodeURIComponent(JSON.stringify(serialized)))));
        } catch (e) { console.error("Cache error", e); }
      }
    }, (error) => {
      console.error("Error fetching inventory movements:", error);
      if (isMounted) setLoading(false);
    });

    const invoicesQ = query(collection(db, "pos_invoices"), where("userId", "==", currentUser.uid));
    const unsubInvoices = onSnapshot(invoicesQ, { includeMetadataChanges: true }, (snap) => {
      const invs: any[] = [];
      snap.forEach((doc) => {
        invs.push({ id: doc.id, ...doc.data() });
      });
      invs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      if (isMounted) setInvoices(invs);
    });

    return () => {
      isMounted = false;
      unsubItems();
      unsubMoves();
      unsubInvoices();
    };
  }, []);

  // ⚡ Bolt Optimization: Memoize out-of-stock list to avoid recalculation on every render
  const outOfStockItems = useMemo(() => items.filter(it => it.quantity <= it.minQuantity), [items]);

  // ⚡ Bolt Optimization: Memoize filtered items to prevent O(N) array traversal on every render (e.g. when modals open)
  const filteredItems = useMemo(() => {
    let filtered = items.filter(it =>
      it.name.includes(searchQuery) ||
      it.barcode.includes(searchQuery) ||
      it.category.includes(searchQuery)
    );
    // Sort items: Out of stock/low stock first, then by quantity ascending
    filtered.sort((a, b) => {
      const aIsLow = a.quantity <= a.minQuantity;
      const bIsLow = b.quantity <= b.minQuantity;
      if (aIsLow && !bIsLow) return -1;
      if (!aIsLow && bIsLow) return 1;
      return a.quantity - b.quantity;
    });
    return filtered;
  }, [items, searchQuery]);

  // ⚡ Bolt Optimization: Memoize total cost calculation
  const totalInventoryCost = useMemo(() =>
    items.reduce((a,b) => a + ((b.cost || 0) * (b.quantity || 0)), 0),
  [items]);

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !itemForm.name) return;

    try {
      const payload = {
        name: itemForm.name,
        category: itemForm.category,
        quantity: Number(itemForm.quantity) || 0,
        minQuantity: Number(itemForm.minQuantity) || 0,
        cost: Number(itemForm.cost) || 0,
        price: Number(itemForm.price) || 0,
        barcode: itemForm.barcode
      };

      if (editingItem) {
        await updateDoc(doc(db, "inventory_items", editingItem.id), payload);
      } else {
        await addDoc(collection(db, "inventory_items"), {
          userId: currentUser.uid,
          ...payload,
          createdAt: serverTimestamp()
        });
      }
      setIsAddItemModalOpen(false);
      setEditingItem(null);
      setItemForm({ name: "", category: "", quantity: "", minQuantity: "", cost: "", price: "", barcode: "" });
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الحفظ.");
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (window.confirm("هل أنت متأكد من حذف هذا الصنف؟")) {
      try {
        await deleteDoc(doc(db, "inventory_items", id));
      } catch(err) {
        console.error(err);
      }
    }
  };

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedQty = Number(movementForm.quantity) || 0;
    if (!currentUser || !movementForm.itemId || parsedQty <= 0) return;

    const targetItem = items.find(it => it.id === movementForm.itemId);
    if (!targetItem) return;

    let newQty = targetItem.quantity;
    if (movementForm.type === "in" || movementForm.type === "return") {
      newQty += parsedQty;
    } else if (movementForm.type === "out") {
      newQty -= parsedQty;
      if (newQty < 0) {
        alert("الكمية غير كافية في المخزون!");
        return;
      }
    }

    try {
      await addDoc(collection(db, "inventory_movements"), {
        userId: currentUser.uid,
        itemId: targetItem.id,
        itemName: targetItem.name,
        type: movementForm.type,
        quantity: parsedQty,
        note: movementForm.note,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, "inventory_items", targetItem.id), {
        quantity: newQty
      });

      setIsMovementModalOpen(false);
      setMovementForm({ itemId: "", type: "in", quantity: "", note: "" });
    } catch(err) {
      console.error(err);
      alert("حدث خطأ.");
    }
  };

  const renderOverview = () => (
    <>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div 
          onClick={() => setActiveTab("items")}
          className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center cursor-pointer hover:shadow-md transition">
          <Package size={24} className="text-indigo-500 mx-auto mb-2" />
          <h3 className="font-extrabold text-sm text-slate-800">الأصناف ({items.length})</h3>
          <p className="text-xs text-slate-400 mt-1">إدارة المنتجات المتوفرة</p>
        </div>
        <div 
          onClick={() => setActiveTab("items")}
          className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center cursor-pointer hover:shadow-md transition">
          <AlertTriangle size={24} className={outOfStockItems.length > 0 ? "text-rose-500 mx-auto mb-2 animate-pulse" : "text-rose-500 mx-auto mb-2"} />
          <h3 className="font-extrabold text-sm text-slate-800">نواقص ({outOfStockItems.length})</h3>
          <p className="text-xs text-slate-400 mt-1">تنبيهات بنفاد الكمية</p>
        </div>
        <div 
          onClick={() => { setScannerTarget("search"); setIsScannerOpen(true); }}
          className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center cursor-pointer hover:shadow-md transition">
          <Barcode size={24} className="text-slate-600 mx-auto mb-2" />
          <h3 className="font-extrabold text-sm text-slate-800">الباركود والجرد</h3>
          <p className="text-xs text-slate-400 mt-1">قراءة وتوليد باركود</p>
        </div>
        <div 
          onClick={() => setActiveTab("movements")}
          className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center cursor-pointer hover:shadow-md transition">
          <TrendingUp size={24} className="text-emerald-500 mx-auto mb-2" />
          <h3 className="font-extrabold text-sm text-slate-800">سجل الحركة</h3>
          <p className="text-xs text-slate-400 mt-1">بيع، شراء، ومرتجعات</p>
        </div>
      </div>

      <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100 text-center mb-6">
          <ClipboardList size={32} className="text-indigo-400 mx-auto mb-2" />
          <h3 className="font-extrabold text-indigo-900 mb-1">الكميات المتوفرة</h3>
          <p className="text-xs text-indigo-700/80 mb-3">إجمالي قيمة المخزون بسعر التكلفة: <br/><strong className="text-lg">{totalInventoryCost.toLocaleString()} ر.ي</strong></p>
          <div className="flex gap-2 justify-center">
            <button 
              onClick={() => {
                setEditingItem(null);
                setItemForm({ name: "", category: "", quantity: "", minQuantity: "", cost: "", price: "", barcode: "" });
                setIsAddItemModalOpen(true);
              }}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md shadow-indigo-500/20 transition inline-flex items-center gap-2">
                <Plus size={16} />
                صنف جديد
            </button>
            <button 
              onClick={() => setIsMovementModalOpen(true)}
              className="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-5 py-2 rounded-xl text-sm font-bold transition inline-flex items-center gap-2">
                <TrendingUp size={16} />
                حركة مخزون
            </button>
          </div>
      </div>
    </>
  );

  const renderItems = () => (
    <>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center flex-1 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <Search size={18} className="text-slate-400 ml-2 shrink-0" />
          <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن صنف بالاسم أو الباركود..."
              className="bg-transparent outline-none w-full text-sm font-bold placeholder:text-slate-400"
          />
        </div>
        <button 
          onClick={() => { setScannerTarget("search"); setIsScannerOpen(true); }}
          className="p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl shrink-0 transition"
        >
          <ScanLine size={24} />
        </button>
      </div>

      <div className="space-y-3">
        {filteredItems.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.quantity <= item.minQuantity ? 'bg-rose-100 text-rose-500' : 'bg-indigo-50 text-indigo-500'}`}>
                <Package size={20} />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">{item.name}</h4>
                <p className="text-xs font-bold text-slate-400">{item.category} {item.barcode && `| ${item.barcode}`}</p>
              </div>
            </div>
            <div className="text-left flex items-center gap-4">
              <div>
                <span className={`text-base font-black font-mono block ${item.quantity <= item.minQuantity ? 'text-rose-500' : 'text-slate-800'}`}>{item.quantity}</span>
                <span className="text-xs text-slate-400 font-bold block">متوفر</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => {
                  setEditingItem(item);
                  setItemForm({ name: item.name, category: item.category, quantity: item.quantity, minQuantity: item.minQuantity, cost: item.cost, price: item.price, barcode: item.barcode || "" });
                  setIsAddItemModalOpen(true);
                }} className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filteredItems.length === 0 && (
          <div className="text-center py-10">
            <p className="text-sm font-bold text-slate-400">لا توجد أصناف في المخزون حالياً.</p>
          </div>
        )}
      </div>
    </>
  );

  // ⚡ Bolt Optimization: Lifted filtered arrays to top level and memoized to avoid O(N) recalculations on render
  const filteredMovements = useMemo(() => movements.filter(m => {
    const q = movementsSearch.toLowerCase();
    return m.itemName?.toLowerCase().includes(q) || (m.note || "").toLowerCase().includes(q);
  }), [movements, movementsSearch]);

  const filteredInvoices = useMemo(() => invoices.filter((inv) => {
    const q = invoicesSearch.toLowerCase();
    return inv.invoiceNumber?.includes(q) || inv.customerName?.toLowerCase().includes(q) || inv.customerPhone?.includes(q);
  }), [invoices, invoicesSearch]);

  const posFilteredItems = useMemo(() => posSearchQuery ? items.filter(it =>
    it.name.includes(posSearchQuery) ||
    it.barcode.includes(posSearchQuery)
  ) : [], [items, posSearchQuery]);

  const totalAmount = useMemo(() => posCart.reduce((sum, c) => sum + (c.item.price * c.quantity), 0), [posCart]);

  const renderMovements = () => {
    return (
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="ابحث في السجل..."
              value={movementsSearch}
              onChange={(e) => setMovementsSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3.5 text-sm font-bold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>
        <div className="space-y-3">
          {filteredMovements.map(m => (
            <div key={m.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${m.type === 'in' ? 'bg-emerald-100 text-emerald-600' : m.type === 'out' ? 'bg-rose-100 text-rose-500' : 'bg-blue-100 text-blue-500'}`}>
                  <TrendingUp size={20} className={m.type === 'out' ? 'rotate-180' : ''} />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm">{m.itemName}</h4>
                  <p className="text-xs font-bold text-slate-400">{m.type === 'in' ? 'إدخال' : m.type === 'out' ? 'إخراج' : 'مرتجع'} | {m.createdAt?.toDate?.().toLocaleDateString('ar-YE') || ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-base font-black font-mono block ${m.type === 'in' || m.type === 'return' ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {m.type === 'out' ? '-' : '+'}{m.quantity}
                </span>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteMovement(m.id); }}
                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-md transition"
                  title="حذف السجل"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {filteredMovements.length === 0 && (
            <div className="text-center py-10">
              <p className="text-sm font-bold text-slate-400">لا توجد حركة مسجلة.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const addToPosCart = (item: InventoryItem) => {
    if (item.quantity <= 0) {
      alert("الكمية غير كافية في المخزون");
      return;
    }
    const existing = posCart.find(c => c.item.id === item.id);
    if (existing) {
      if (existing.quantity >= item.quantity) {
        alert("لا يمكن تجاوز الكمية المتاحة");
        return;
      }
      setPosCart(posCart.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setPosCart([...posCart, { item, quantity: 1 }]);
    }
    setPosSearchQuery("");
  };

  const updatePosCartQuantity = (itemId: string, delta: number) => {
    setPosCart(posCart.map(c => {
      if (c.item.id === itemId) {
        const newQty = c.quantity + delta;
        if (newQty <= 0) return c; // should remove instead, but we handle remove separately
        if (newQty > c.item.quantity) {
          alert("لا يمكن تجاوز الكمية المتاحة");
          return c;
        }
        return { ...c, quantity: newQty };
      }
      return c;
    }));
  };

  const removeFromPosCart = (itemId: string) => {
    setPosCart(posCart.filter(c => c.item.id !== itemId));
  };

  
  const handlePickContact = async () => {
    localStorage.setItem("ignore_app_lock", "true");
    const clearLockIgnore = setTimeout(() => {
      localStorage.removeItem("ignore_app_lock");
    }, 3000);

    if ((window as any).AndroidContacts && typeof (window as any).AndroidContacts.pickContact === "function") {
      (window as any).onAndroidContactSelected = (name: string, phone: string) => {
        localStorage.removeItem("ignore_app_lock");
        setPosCustomerName(name);
        setPosCustomerPhone(phone);
      };
      (window as any).AndroidContacts.pickContact();
      return;
    }

    try {
      const Contacts = (await import('@capacitor-community/contacts')).Contacts;
      const permission = await Contacts.requestPermissions();
      if (permission.contacts === 'granted') {
        const result = await Contacts.pickContact({ projection: { name: true, phones: true } });
        localStorage.removeItem("ignore_app_lock");
        if (result && result.contact) {
          const contact = result.contact;
          const name = contact.name?.display || "";
          const phone = contact.phones?.[0]?.number || "";
          if (name) setPosCustomerName(name);
          if (phone) setPosCustomerPhone(phone);
        }
      } else {
        localStorage.removeItem("ignore_app_lock");
        alert("يجب منح صلاحية الوصول لجهات الاتصال");
      }
    } catch (err) {
      localStorage.removeItem("ignore_app_lock");
      console.log("Contacts API not available", err);
    }
  };

  const handlePosCheckout = async () => {
    if (!currentUser || posCart.length === 0) return;
    setLoading(true);
    try {
      const invoiceNumber = Math.floor(100000 + Math.random() * 900000).toString();
      const totalAmount = posCart.reduce((sum, c) => sum + (c.item.price * c.quantity), 0);
      
      const invoiceData = {
        userId: currentUser.uid,
        invoiceNumber,
        customerName: (posCustomerName || "").trim(),
        customerPhone: (posCustomerPhone || "").trim(),
        items: posCart.map(c => ({
          itemId: c.item.id,
          itemName: c.item.name,
          price: c.item.price,
          quantity: c.quantity
        })),
        totalAmount,
        createdAt: serverTimestamp()
      };
      
      const invoiceRef = await addDoc(collection(db, "pos_invoices"), invoiceData);

      for (const cartItem of posCart) {
        // Record movement
        await addDoc(collection(db, "inventory_movements"), {
          userId: currentUser.uid,
          itemId: cartItem.item.id,
          itemName: cartItem.item.name,
          type: "out",
          quantity: cartItem.quantity,
          note: `مبيعات سريعة (فاتورة #${invoiceNumber})`,
          createdAt: serverTimestamp()
        });
        // Update item quantity
        await updateDoc(doc(db, "inventory_items", cartItem.item.id), {
          quantity: cartItem.item.quantity - cartItem.quantity
        });
      }
      
      setPosCart([]);
      setPosSearchQuery("");
      setPosCustomerName("");
      setPosCustomerPhone("");
      
      // Show invoice modal
      setShowInvoiceModal({ id: invoiceRef.id, ...invoiceData, createdAt: { toDate: () => new Date() } });
      
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء المعالجة");
    } finally {
      setLoading(false);
    }
  };

  
  const handleDeleteInvoice = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذه الفاتورة؟")) return;
    try {
      await deleteDoc(doc(db, "pos_invoices", id));
      if (showInvoiceModal?.id === id) setShowInvoiceModal(null);
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء الحذف");
    }
  };

  const handleDeleteMovement = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا السجل؟")) return;
    try {
      await deleteDoc(doc(db, "inventory_movements", id));
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء الحذف");
    }
  };

  const handlePrintInvoice = (invoice: any) => {
    let printHTML = `
      <div style="direction: rtl; font-family: sans-serif; padding: 20px; max-width: 400px; margin: 0 auto;">
        <h2 style="text-align: center; margin-bottom: 5px;">فاتورة مبيعات</h2>
        <p style="text-align: center; margin-top: 0; color: #666;">رقم الفاتورة: ${invoice.invoiceNumber}</p>
        <hr style="border: 1px dashed #ccc; margin: 15px 0;">
        ${invoice.customerName ? `<p><strong>العميل:</strong> ${invoice.customerName}</p>` : ''}
        ${invoice.customerPhone ? `<p><strong>رقم الجوال:</strong> ${invoice.customerPhone}</p>` : ''}
        <p><strong>التاريخ:</strong> ${invoice.createdAt?.toDate?.()?.toLocaleDateString('ar-EG') || new Date().toLocaleDateString('ar-EG')}</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <thead>
            <tr style="border-bottom: 1px solid #000;">
              <th style="text-align: right; padding: 5px;">الصنف</th>
              <th style="text-align: center; padding: 5px;">الكمية</th>
              <th style="text-align: left; padding: 5px;">المجموع</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items.map((it: any) => `
              <tr>
                <td style="text-align: right; padding: 5px;">${it.itemName}</td>
                <td style="text-align: center; padding: 5px;">${it.quantity}</td>
                <td style="text-align: left; padding: 5px;">${((it.price || 0) * (it.quantity || 0)).toLocaleString('en-US')} ر.ي</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <hr style="border: 1px dashed #ccc; margin: 15px 0;">
        <h3 style="text-align: center;">الإجمالي: ${(invoice.totalAmount || 0).toLocaleString('en-US')} ريال</h3>
      </div>
    `;
    const printArea = document.getElementById("print-area");
    if (printArea) {
      printArea.innerHTML = printHTML;
      setTimeout(() => {
        if ((window as any).AndroidPrint) {
          (window as any).AndroidPrint.print();
        } else {
          window.print();
        }
        // Clear it after a delay so it doesn't stay in memory
        setTimeout(() => { printArea.innerHTML = ""; }, 2000);
      }, 250);
    }
  };

  const handleSendInvoice = (invoice: any, method: 'whatsapp' | 'sms') => {
    if (!invoice.customerPhone) {
      alert("يرجى إدخال رقم هاتف العميل أولاً");
      return;
    }
    let message = `🧾 *فاتورة مبيعات - #${invoice.invoiceNumber}*\n`;
    message += `العميل: ${invoice.customerName || 'عميل نقدي'}\n\n`;
    invoice.items.forEach((it: any) => {
      message += `▫️ ${it.itemName} (x${it.quantity}) - ${((it.price || 0) * (it.quantity || 0)).toLocaleString('en-US')} ر.ي\n`;
    });
    message += `\n💰 *الإجمالي: ${(invoice.totalAmount || 0).toLocaleString('en-US')} ريال*\n\nشكراً لتعاملكم معنا!`;
    
    let phone = invoice.customerPhone.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '967' + phone.substring(1); // Default to Yemen code if starts with 0
    else if (!phone.startsWith('967')) phone = '967' + phone;

    const encoded = encodeURIComponent(message);
    if (method === 'whatsapp') {
      window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
    } else {
      window.open(`sms:${phone}?body=${encoded}`, "_blank");
    }
  };

  
  const renderInvoices = () => {
    return (
      <div className="space-y-6">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="ابحث برقم الفاتورة، العميل، الهاتف..."
              value={invoicesSearch}
              onChange={(e) => setInvoicesSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3.5 text-sm font-bold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-100">
          {filteredInvoices.length > 0 ? filteredInvoices.map((inv) => (
            <div key={inv.id} className="p-4 hover:bg-slate-50 transition cursor-pointer" onClick={() => setShowInvoiceModal(inv)}>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Receipt size={18} className="text-indigo-500" />
                  <h4 className="font-bold text-slate-800 text-sm">فاتورة #{inv.invoiceNumber}</h4>
                </div>
                <span className="text-xs text-slate-400 font-bold" dir="ltr">
                  {inv.createdAt?.toDate?.()?.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-slate-600 font-bold mb-1">{inv.customerName || 'عميل نقدي'}</p>
                  <p className="text-xs text-slate-400">{inv.items?.length || 0} أصناف مباعة</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-emerald-600">{(inv.totalAmount || 0).toLocaleString('en-US')} ر.ي</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteInvoice(inv.id); }}
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-md transition"
                    title="حذف الفاتورة"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          )) : (
            <div className="p-8 text-center text-slate-400 font-bold text-sm">لا توجد فواتير مطابقة</div>
          )}
        </div>
      </div>
    );
  };

  const renderPOS = () => {
    return (
      <div className="space-y-6">
        {/* Search & Add */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="ابحث بالاسم أو الباركود..."
              value={posSearchQuery}
              onChange={(e) => setPosSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3.5 text-sm font-bold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
            <button 
              onClick={() => { setScannerTarget("search"); setIsScannerOpen(true); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition"
            >
              <Barcode size={20} />
            </button>
          </div>
          
          {posSearchQuery && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden max-h-60 overflow-y-auto">
              {posFilteredItems.length > 0 ? posFilteredItems.map(it => (
                <div key={it.id} onClick={() => addToPosCart(it)} className="flex justify-between items-center p-3 border-b border-slate-200 last:border-0 hover:bg-slate-100 cursor-pointer transition">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{it.name}</h4>
                    <p className="text-xs text-slate-500 mt-1">المتاح: <span className="font-black text-indigo-600">{it.quantity}</span> | السعر: {(it.price || 0).toLocaleString('en-US')} ر.ي</p>
                  </div>
                  <button className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Plus size={16} />
                  </button>
                </div>
              )) : (
                <div className="p-4 text-center text-xs text-slate-500 font-bold">لا يوجد صنف مطابق</div>
              )}
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
            <ClipboardList size={18} className="text-emerald-500" />
            سلة المبيعات
          </h3>
          {posCart.length > 0 ? (
            <div className="space-y-3">
              {posCart.map(c => (
                <div key={c.item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 text-sm truncate">{c.item.name}</h4>
                    <p className="text-xs text-emerald-600 font-black mt-1">{(c.item.price * c.quantity).toLocaleString('en-US')} ر.ي</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <button onClick={() => updatePosCartQuantity(c.item.id, 1)} className="px-2 py-1.5 hover:bg-slate-100 text-slate-600"><Plus size={14} /></button>
                      <span className="px-2 py-1.5 font-bold text-sm text-slate-800 border-x border-slate-200 min-w-[2.5rem] text-center">{c.quantity}</span>
                      <button onClick={() => c.quantity > 1 ? updatePosCartQuantity(c.item.id, -1) : removeFromPosCart(c.item.id)} className="px-2 py-1.5 hover:bg-slate-100 text-slate-600 font-black">-</button>
                    </div>
                    <button onClick={() => removeFromPosCart(c.item.id)} className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              
              <div className="mt-6 pt-4 border-t border-slate-100">
                <div className="mb-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      placeholder="اسم العميل (اختياري)" 
                      value={posCustomerName}
                      onChange={(e) => setPosCustomerName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="tel" 
                      placeholder="رقم الهاتف (اختياري)" 
                      value={posCustomerPhone}
                      onChange={(e) => setPosCustomerPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-emerald-500"
                      dir="ltr"
                    />
                    <button type="button" onClick={handlePickContact} className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition">
                      <Phone size={18} />
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold text-slate-500">الإجمالي:</span>
                  <span className="font-black text-2xl text-slate-800">{totalAmount.toLocaleString('en-US')} <span className="text-sm">ر.ي</span></span>
                </div>
                <button 
                  onClick={handlePosCheckout} 
                  disabled={loading}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-500/20 transition flex justify-center items-center gap-2"
                >
                  {loading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : <Save size={20} />}
                  إتمام البيع وخصم المخزون
                </button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <ClipboardList size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-400">السلة فارغة، قم بالبحث وإضافة أصناف</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 pb-36" dir="rtl">
      <header className="px-5 py-4 bg-white shadow-sm flex items-center justify-between sticky top-0 z-10 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button onClick={onGoBack} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition">
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-800">إدارة المخزون</h1>
            <p className="text-xs font-bold text-slate-400">الأصناف، الكميات، والجرد</p>
          </div>
        </div>
      </header>

      <div className="flex border-b border-slate-200 bg-white overflow-x-auto hide-scrollbar">
        <button onClick={() => setActiveTab("pos")} className={`flex-1 py-3 text-sm font-bold border-b-2 transition whitespace-nowrap px-4 ${activeTab === "pos" ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-500"}`}>نقطة بيع</button>
        <button onClick={() => setActiveTab("items")} className={`flex-1 py-3 text-sm font-bold border-b-2 transition whitespace-nowrap px-4 ${activeTab === "items" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500"}`}>الأصناف</button>
        <button onClick={() => setActiveTab("invoices")} className={`flex-1 py-3 text-sm font-bold border-b-2 transition whitespace-nowrap px-4 ${activeTab === "invoices" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500"}`}>الفواتير</button>
        <button onClick={() => setActiveTab("movements")} className={`flex-1 py-3 text-sm font-bold border-b-2 transition whitespace-nowrap px-4 ${activeTab === "movements" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500"}`}>السجل</button>
        <button onClick={() => setActiveTab("overview")} className={`flex-1 py-3 text-sm font-bold border-b-2 transition whitespace-nowrap px-4 ${activeTab === "overview" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500"}`}>نظرة عامة</button>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="text-center py-10 text-slate-400 font-bold">جاري التحميل...</div>
        ) : (
          <>
            {activeTab === "overview" && renderOverview()}
            {activeTab === "items" && renderItems()}
            {activeTab === "movements" && renderMovements()}
            {activeTab === "pos" && renderPOS()}
            {activeTab === "invoices" && renderInvoices()}
          </>
        )}
      </div>

      {isAddItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-slate-900/50  p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative">
            <button onClick={() => setIsAddItemModalOpen(false)} className="absolute top-4 left-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full">
              <X size={20} />
            </button>
            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
              <Package className="text-indigo-500" />
              {editingItem ? "تعديل صنف" : "صنف جديد"}
            </h2>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">اسم الصنف</label>
                <input type="text" required value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">الفئة / التصنيف</label>
                  <input type="text" value={itemForm.category} onChange={e => setItemForm({...itemForm, category: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">الباركود</label>
                  <div className="flex gap-2">
                    <input type="text" value={itemForm.barcode} onChange={e => setItemForm({...itemForm, barcode: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-indigo-500 font-mono" />
                    <button type="button" onClick={() => { setScannerTarget("form"); setIsScannerOpen(true); }} className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl shrink-0">
                      <ScanLine size={20} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">سعر التكلفة</label>
                  <input type="number" required value={itemForm.cost} onChange={e => setItemForm({...itemForm, cost: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">سعر البيع</label>
                  <input type="number" required value={itemForm.price} onChange={e => setItemForm({...itemForm, price: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">الرصيد الافتتاحي</label>
                  <input type="number" required value={itemForm.quantity} onChange={e => setItemForm({...itemForm, quantity: e.target.value})} disabled={!!editingItem} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-indigo-500 disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">حد النواقص (التنبيه)</label>
                  <input type="number" required value={itemForm.minQuantity} onChange={e => setItemForm({...itemForm, minQuantity: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-indigo-500" />
                </div>
              </div>

              <button type="submit" className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white font-extrabold rounded-xl shadow-md shadow-indigo-500/20 transition flex justify-center items-center gap-2 mt-4">
                <Save size={20} />
                حفظ بيانات الصنف
              </button>
            </form>
          </div>
        </div>
      )}

      {isMovementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-slate-900/50  p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative">
            <button onClick={() => setIsMovementModalOpen(false)} className="absolute top-4 left-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full">
              <X size={20} />
            </button>
            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
              <TrendingUp className="text-emerald-500" />
              حركة مخزون
            </h2>

            <form onSubmit={handleSaveMovement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">الصنف</label>
                <select required value={movementForm.itemId} onChange={e => setMovementForm({...movementForm, itemId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-emerald-500">
                  <option value="">اختر الصنف...</option>
                  {items.map(it => <option key={it.id} value={it.id}>{it.name} - المتاح: {it.quantity}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">نوع الحركة</label>
                  <select required value={movementForm.type} onChange={e => setMovementForm({...movementForm, type: e.target.value as any})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-emerald-500">
                    <option value="in">إدخال (شراء / إضافة)</option>
                    <option value="out">إخراج (بيع / صرف)</option>
                    <option value="return">مرتجع (إضافة للمخزن)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">الكمية</label>
                  <input type="number" required min="1" value={movementForm.quantity} onChange={e => setMovementForm({...movementForm, quantity: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">ملاحظات (اختياري)</label>
                <input type="text" value={movementForm.note} onChange={e => setMovementForm({...movementForm, note: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-emerald-500" />
              </div>

              <button type="submit" className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-xl shadow-md shadow-emerald-500/20 transition flex justify-center items-center gap-2 mt-4">
                <Save size={20} />
                حفظ الحركة
              </button>
            </form>
          </div>
        </div>
      )}

      {isScannerOpen && (
        <BarcodeScannerModal
          onClose={() => setIsScannerOpen(false)}
          onScan={(text) => {
            if (scannerTarget === "form") {
              setItemForm(prev => ({ ...prev, barcode: text }));
            } else {
              setSearchQuery(text);
              setActiveTab("items");
            }
            setIsScannerOpen(false);
          }}
        />
      )}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative text-center max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowInvoiceModal(null)} className="absolute top-4 left-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition">
              <X size={20} />
            </button>
            <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Receipt size={32} />
            </div>
            <h2 className="text-xl font-black text-slate-800 mb-1">تفاصيل الفاتورة</h2>
            <p className="text-sm font-bold text-slate-500 mb-6">رقم الفاتورة: #{showInvoiceModal.invoiceNumber}</p>
            
            <div className="bg-slate-50 rounded-2xl p-4 mb-6 text-right">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
                <span className="text-slate-500 text-sm font-bold">الإجمالي:</span>
                <span className="text-emerald-600 font-black text-lg">{(showInvoiceModal.totalAmount || 0).toLocaleString('en-US')} ر.ي</span>
              </div>
              {showInvoiceModal.customerName && (
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 text-xs font-bold">العميل:</span>
                  <span className="text-slate-800 font-bold text-sm">{showInvoiceModal.customerName}</span>
                </div>
              )}
              {showInvoiceModal.customerPhone && (
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 text-xs font-bold">رقم الجوال:</span>
                  <span className="text-slate-800 font-bold text-sm" dir="ltr">{showInvoiceModal.customerPhone}</span>
                </div>
              )}
              
              <div className="mt-4 pt-2 border-t border-slate-200">
                <h4 className="text-sm font-bold text-slate-700 mb-2">الأصناف:</h4>
                <ul className="space-y-2">
                  {showInvoiceModal.items?.map((it: any, idx: number) => (
                    <li key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{it.itemName}</p>
                        <p className="text-xs text-slate-500">{it.quantity} × {(it.price || 0).toLocaleString('en-US')} ر.ي</p>
                      </div>
                      <span className="text-sm font-black text-slate-700">{(it.quantity * it.price).toLocaleString('en-US')} ر.ي</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <button onClick={() => handlePrintInvoice(showInvoiceModal)} className="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition font-bold text-sm">
                <Printer size={20} className="mb-2" />
                طباعة
              </button>
              <button onClick={() => handleSendInvoice(showInvoiceModal, 'whatsapp')} className="flex flex-col items-center justify-center p-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition font-bold text-sm">
                <Share2 size={20} className="mb-2" />
                واتساب
              </button>
              <button onClick={() => handleSendInvoice(showInvoiceModal, 'sms')} className="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition font-bold text-sm">
                <Phone size={20} className="mb-2" />
                SMS
              </button>
            </div>
            <button onClick={() => setShowInvoiceModal(null)} className="w-full py-3.5 bg-indigo-500 hover:bg-indigo-600 text-white font-extrabold rounded-xl shadow-md shadow-indigo-500/20 transition">
              إغلاق
            </button>
          </div>
        </div>
      )}</div>
  );
}
