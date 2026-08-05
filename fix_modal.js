import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

const oldModal = /{showInvoiceModal && \([\s\S]*?(?=<\/div>\n  \);\n\})/;
const newModal = `{showInvoiceModal && (
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
                <span className="text-emerald-600 font-black text-lg">{showInvoiceModal.totalAmount.toLocaleString('en-US')} ر.ي</span>
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
                        <p className="text-xs text-slate-500">{it.quantity} × {it.price.toLocaleString('en-US')} ر.ي</p>
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
      )}`;

code = code.replace(oldModal, newModal);
fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
console.log("Fixed part 2");
