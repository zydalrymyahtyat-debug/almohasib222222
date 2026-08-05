import fs from 'fs';
let code = fs.readFileSync('src/components/StatementView.tsx', 'utf8');

code = code.replace(
  '{transEditId ? "تعديل العملية المالية" : "تسجيل مبلغ مالي"}\n                </h3>\n                <button',
  '{transEditId ? "تعديل العملية المالية" : "تسجيل مبلغ مالي"}\n                </h3>\n                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-calculator"))} className="p-1.5 ml-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition mr-auto" title="آلة حاسبة">\n                  <Calculator size={18} />\n                </button>\n                <button'
);

fs.writeFileSync('src/components/StatementView.tsx', code);
console.log("Updated StatementView.tsx properly x2");
