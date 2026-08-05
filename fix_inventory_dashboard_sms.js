import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

const modalButtons = `<button onClick={() => handleSendInvoice(showInvoiceModal, 'whatsapp')} className="flex flex-col items-center justify-center p-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition font-bold text-sm">
                <Share2 size={20} className="mb-2" />
                واتساب
              </button>`;

const newModalButtons = `<button onClick={() => handleSendInvoice(showInvoiceModal, 'whatsapp')} className="flex flex-col items-center justify-center p-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition font-bold text-sm">
                <Share2 size={20} className="mb-2" />
                واتساب
              </button>
              <button onClick={() => handleSendInvoice(showInvoiceModal, 'sms')} className="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition font-bold text-sm">
                <Phone size={20} className="mb-2" />
                رسالة SMS
              </button>`;

code = code.replace(modalButtons, newModalButtons);

const gridCols2 = `<div className="grid grid-cols-2 gap-3 mb-3">`;
const gridCols3 = `<div className="grid grid-cols-3 gap-3 mb-3">`;

code = code.replace(gridCols2, gridCols3);

fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
console.log("Added SMS button.");
