import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

const cartDivStart = `<div className="mt-6 pt-4 border-t border-slate-100">`;
const newCartDivStart = `<div className="mt-6 pt-4 border-t border-slate-100">
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
                  </div>
                </div>`;

code = code.replace(cartDivStart, newCartDivStart);

fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
console.log("Updated POS Cart UI.");
