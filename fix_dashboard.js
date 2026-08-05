import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

// 1. Add missing state variables
if (!code.includes('const [movementsSearch')) {
  code = code.replace(
    'const [invoicesSearch, setInvoicesSearch] = useState("");',
    'const [invoicesSearch, setInvoicesSearch] = useState("");\n  const [movementsSearch, setMovementsSearch] = useState("");'
  );
}

// 2. Add Delete Handlers
const handlersToAdd = `
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
`;

if (!code.includes('const handleDeleteInvoice')) {
  code = code.replace(
    'const handlePrintInvoice = (invoice: any) => {',
    handlersToAdd + '\n  const handlePrintInvoice = (invoice: any) => {'
  );
}

// 3. Update renderInvoices
const oldRenderInvoices = /const renderInvoices = \(\) => \{[\s\S]*?(?=const renderPOS = \(\) => \{)/;
const newRenderInvoices = `const renderInvoices = () => {
    const filteredInvoices = invoices.filter((inv) => {
      const q = invoicesSearch.toLowerCase();
      return inv.invoiceNumber?.includes(q) || inv.customerName?.toLowerCase().includes(q) || inv.customerPhone?.includes(q);
    });

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

  `;

code = code.replace(oldRenderInvoices, newRenderInvoices);

// 4. Update renderMovements
const oldRenderMovements = /const renderMovements = \(\) => \([\s\S]*?(?=const addToPosCart = \(item: InventoryItem\) => \{)/;
const newRenderMovements = `const renderMovements = () => {
    const filteredMovements = movements.filter(m => {
      const q = movementsSearch.toLowerCase();
      return m.itemName?.toLowerCase().includes(q) || (m.note || "").toLowerCase().includes(q);
    });

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
                <div className={\`w-10 h-10 rounded-full flex items-center justify-center \${m.type === 'in' ? 'bg-emerald-100 text-emerald-600' : m.type === 'out' ? 'bg-rose-100 text-rose-500' : 'bg-blue-100 text-blue-500'}\`}>
                  <TrendingUp size={20} className={m.type === 'out' ? 'rotate-180' : ''} />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm">{m.itemName}</h4>
                  <p className="text-xs font-bold text-slate-400">{m.type === 'in' ? 'إدخال' : m.type === 'out' ? 'إخراج' : 'مرتجع'} | {m.createdAt?.toDate?.().toLocaleDateString('ar-YE') || ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={\`text-base font-black font-mono block \${m.type === 'in' || m.type === 'return' ? 'text-emerald-600' : 'text-rose-500'}\`}>
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

  `;

code = code.replace(oldRenderMovements, newRenderMovements);

fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
console.log("Fixed part 1");
