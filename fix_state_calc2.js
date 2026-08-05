import fs from 'fs';
let code = fs.readFileSync('src/components/StatementView.tsx', 'utf8');

if (!code.includes("open-calculator")) {
  code = code.replace(
    '<h3 className="text-xl font-black text-slate-800 mb-6">',
    '<div className="flex justify-between items-center mb-6">\n                <h3 className="text-xl font-black text-slate-800">'
  );
  
  code = code.replace(
    '{transEditId ? "تعديل العملية المالية" : "تسجيل مبلغ مالي"}\n                </h3>',
    '{transEditId ? "تعديل العملية المالية" : "تسجيل مبلغ مالي"}\n                </h3>\n                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-calculator"))} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition" title="آلة حاسبة">\n                  <Calculator size={20} />\n                </button>\n              </div>'
  );
}

fs.writeFileSync('src/components/StatementView.tsx', code);
console.log("Updated StatementView.tsx properly");
