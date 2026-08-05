import fs from 'fs';
let code = fs.readFileSync('src/components/StatementView.tsx', 'utf8');

const oldStr = `<div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-slate-800">
                  {transEditId ? "تعديل العملية المالية" : "تسجيل مبلغ مالي"}
                </h3>
                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-calculator"))} className="p-1.5 ml-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition mr-auto" title="آلة حاسبة">
                  <Calculator size={18} />
                </button>
                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-calculator"))} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition" title="آلة حاسبة">
                  <Calculator size={20} />
                </button>
              </div>
                <button
                  onClick={() => setIsTransOpen(false)}
                  className="p-1.5 bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>`;

const newStr = `<div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-slate-800">
                  {transEditId ? "تعديل العملية المالية" : "تسجيل مبلغ مالي"}
                </h3>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-calculator"))} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition" title="آلة حاسبة">
                    <Calculator size={18} />
                  </button>
                  <button type="button" onClick={() => setIsTransOpen(false)} className="p-1.5 bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full cursor-pointer">
                    <X size={18} />
                  </button>
                </div>
              </div>`;

code = code.replace(oldStr, newStr);

fs.writeFileSync('src/components/StatementView.tsx', code);
console.log("Fixed StatementView tags x2");
