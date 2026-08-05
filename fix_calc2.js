import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes("open-calculator")) {
  code = code.replace(
    'window.addEventListener("open-overdue-modal" as any, handleOpenOverdueModal);',
    'window.addEventListener("open-overdue-modal" as any, handleOpenOverdueModal);\n    window.addEventListener("open-calculator" as any, () => setShowCalculator(true));'
  );
  
  code = code.replace(
    'window.removeEventListener("open-overdue-modal" as any, handleOpenOverdueModal);',
    'window.removeEventListener("open-overdue-modal" as any, handleOpenOverdueModal);\n      window.removeEventListener("open-calculator" as any, () => setShowCalculator(true));'
  );
}

fs.writeFileSync('src/App.tsx', code);
console.log("Updated App.tsx again");

let dashCode = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');
if (!dashCode.includes("Calculator")) {
  dashCode = dashCode.replace(
    'import { Menu, Search, TrendingUp, TrendingDown, Clock, Download, Share2, Printer, Plus, AlertTriangle, ShieldCheck, CheckCircle2, ChevronLeft, Building2, UserCircle, Bell, Receipt, Database } from "lucide-react";',
    'import { Menu, Search, TrendingUp, TrendingDown, Clock, Download, Share2, Printer, Plus, AlertTriangle, ShieldCheck, CheckCircle2, ChevronLeft, Building2, UserCircle, Bell, Receipt, Database, Calculator } from "lucide-react";'
  );
}
if (!dashCode.includes("open-calculator")) {
  dashCode = dashCode.replace(
    '<button \n              onClick={() => {',
    '<button \n              onClick={() => window.dispatchEvent(new CustomEvent("open-calculator"))}\n              className="p-2 bg-slate-800/80 hover:bg-slate-800 text-slate-100 rounded-full transition cursor-pointer border border-slate-700/50"\n              title="آلة حاسبة"\n            >\n              <Calculator size={20} />\n            </button>\n            <button \n              onClick={() => {'
  );
}
fs.writeFileSync('src/components/Dashboard.tsx', dashCode);
console.log("Updated Dashboard.tsx");
