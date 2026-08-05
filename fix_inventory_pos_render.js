import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

const posMethods = `
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

  const handlePosCheckout = async () => {
    if (!auth.currentUser || posCart.length === 0) return;
    setLoading(true);
    try {
      for (const cartItem of posCart) {
        // Record movement
        await addDoc(collection(db, "inventory_movements"), {
          userId: auth.currentUser.uid,
          itemId: cartItem.item.id,
          itemName: cartItem.item.name,
          type: "out",
          quantity: cartItem.quantity,
          note: "مبيعات سريعة (POS)",
          createdAt: serverTimestamp()
        });
        // Update item quantity
        await updateDoc(doc(db, "inventory_items", cartItem.item.id), {
          quantity: cartItem.item.quantity - cartItem.quantity
        });
      }
      setPosCart([]);
      alert("تمت عملية البيع بنجاح وخصم الكميات من المخزون!");
    } catch (error) {
      console.error("Error during checkout:", error);
      alert("حدث خطأ أثناء إتمام العملية");
    } finally {
      setLoading(false);
    }
  };

  const renderPOS = () => {
    const posFilteredItems = posSearchQuery ? items.filter(it => 
      it.name.includes(posSearchQuery) || 
      it.barcode.includes(posSearchQuery)
    ) : [];

    const totalAmount = posCart.reduce((sum, c) => sum + (c.item.price * c.quantity), 0);

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
                    <p className="text-xs text-slate-500 mt-1">المتاح: <span className="font-black text-indigo-600">{it.quantity}</span> | السعر: {it.price.toLocaleString('en-US')} ر.ي</p>
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
`;

code = code.replace(
  '  return (\n    <div className="flex flex-col min-h-screen',
  posMethods + '\n  return (\n    <div className="flex flex-col min-h-screen'
);

// We should also make sure scanner properly populates posSearchQuery if we are in POS
// Let's modify handleBarcodeDetect
code = code.replace(
  'const handleBarcodeDetect = (code: string) => {',
  'const handleBarcodeDetect = (code: string) => {\n    if (activeTab === "pos") {\n      setPosSearchQuery(code);\n      setIsScannerOpen(false);\n      return;\n    }'
);

fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
console.log("POS logic added.");
