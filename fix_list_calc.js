import fs from 'fs';
let code = fs.readFileSync('src/components/ListView.tsx', 'utf8');

if (!code.includes("Calculator")) {
  code = code.replace(
    'import { Plus, Search, MapPin, Phone, Building2, Briefcase, FileText, Delete, User, Download, Edit3 } from "lucide-react";',
    'import { Plus, Search, MapPin, Phone, Building2, Briefcase, FileText, Delete, User, Download, Edit3, Calculator } from "lucide-react";'
  );
}

if (!code.includes("open-calculator")) {
  code = code.replace(
    '<h2 className="text-xl font-bold text-slate-800 mb-6">',
    '<div className="flex justify-between items-center mb-6">\n                <h2 className="text-xl font-bold text-slate-800">إضافة جديد</h2>\n                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-calculator"))} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition" title="آلة حاسبة">\n                  <Calculator size={20} />\n                </button>\n              </div>\n              {/* '
  );
  
  code = code.replace(
    '{/* ',
    '' // remove the commented start if it breaks something, let's use exact replace
  );
}

// better replacement for ListView modal title
let modified = fs.readFileSync('src/components/ListView.tsx', 'utf8');
modified = modified.replace(
  '<h2 className="text-xl font-bold text-slate-800 mb-6">إضافة جديد</h2>',
  '<div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-slate-800">إضافة جديد</h2><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-calculator"))} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition" title="آلة حاسبة"><Calculator size={20} /></button></div>'
);

fs.writeFileSync('src/components/ListView.tsx', modified);
console.log("Updated ListView.tsx");
