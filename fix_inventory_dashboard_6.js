import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

const renderInvoicesCode = `
  const renderInvoices = () => {
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
                  <p className="text-xs text-slate-400">{inv.items.length} أصناف مباعة</p>
                </div>
                <span className="font-black text-emerald-600">{(inv.totalAmount || 0).toLocaleString('en-US')} ر.ي</span>
              </div>
            </div>
          )) : (
            <div className="py-12 text-center">
              <Receipt size={48} className="mx-auto text-slate-200 mb-3" />
              <p className="text-sm font-bold text-slate-400">لا توجد فواتير مطابقة للبحث</p>
            </div>
          )}
        </div>
      </div>
    );
  };
`;

code = code.replace(
  'const renderPOS = () => {',
  renderInvoicesCode + '\n  const renderPOS = () => {'
);

fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
console.log("Added renderInvoices.");
