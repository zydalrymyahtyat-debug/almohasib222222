import fs from 'fs';
let code = fs.readFileSync('src/components/StatementView.tsx', 'utf8');

if (!code.includes("Calculator")) {
  code = code.replace(
    'import { Plus, Download, Printer, Search, Share2, FileText, ArrowUpRight, ArrowDownRight, Edit3, Trash2 } from "lucide-react";',
    'import { Plus, Download, Printer, Search, Share2, FileText, ArrowUpRight, ArrowDownRight, Edit3, Trash2, Calculator } from "lucide-react";'
  );
}

code = code.replace(
  '<h3 className="text-xl font-bold text-slate-800 mb-6">{editingTx ? "تعديل العملية" : "إضافة عملية جديدة"}</h3>',
  '<div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-slate-800">{editingTx ? "تعديل العملية" : "إضافة عملية جديدة"}</h3><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-calculator"))} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition" title="آلة حاسبة"><Calculator size={20} /></button></div>'
);

fs.writeFileSync('src/components/StatementView.tsx', code);
console.log("Updated StatementView.tsx");
