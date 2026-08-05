import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

// 1. Change initial state to "pos"
code = code.replace(
  'useState<"overview" | "items" | "movements" | "pos">("overview");',
  'useState<"overview" | "items" | "movements" | "pos" | "invoices">("pos");'
);

// 2. Change the tab order
const oldTabs = `<div className="flex border-b border-slate-200 bg-white">
        <button onClick={() => setActiveTab("overview")} className={\`flex-1 py-3 text-sm font-bold border-b-2 transition \${activeTab === "overview" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500"}\`}>نظرة عامة</button>
        <button onClick={() => setActiveTab("items")} className={\`flex-1 py-3 text-sm font-bold border-b-2 transition \${activeTab === "items" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500"}\`}>الأصناف</button>
        <button onClick={() => setActiveTab("movements")} className={\`flex-1 py-3 text-sm font-bold border-b-2 transition \${activeTab === "movements" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500"}\`}>السجل</button>
        <button onClick={() => setActiveTab("pos")} className={\`flex-1 py-3 text-sm font-bold border-b-2 transition \${activeTab === "pos" ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-500"}\`}>نقطة بيع</button>
      </div>`;

const newTabs = `<div className="flex border-b border-slate-200 bg-white overflow-x-auto hide-scrollbar">
        <button onClick={() => setActiveTab("pos")} className={\`flex-1 py-3 text-sm font-bold border-b-2 transition whitespace-nowrap px-4 \${activeTab === "pos" ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-500"}\`}>نقطة بيع</button>
        <button onClick={() => setActiveTab("items")} className={\`flex-1 py-3 text-sm font-bold border-b-2 transition whitespace-nowrap px-4 \${activeTab === "items" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500"}\`}>الأصناف</button>
        <button onClick={() => setActiveTab("invoices")} className={\`flex-1 py-3 text-sm font-bold border-b-2 transition whitespace-nowrap px-4 \${activeTab === "invoices" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500"}\`}>الفواتير</button>
        <button onClick={() => setActiveTab("movements")} className={\`flex-1 py-3 text-sm font-bold border-b-2 transition whitespace-nowrap px-4 \${activeTab === "movements" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500"}\`}>السجل</button>
        <button onClick={() => setActiveTab("overview")} className={\`flex-1 py-3 text-sm font-bold border-b-2 transition whitespace-nowrap px-4 \${activeTab === "overview" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500"}\`}>نظرة عامة</button>
      </div>`;

code = code.replace(oldTabs, newTabs);

code = code.replace(
  '{activeTab === "pos" && renderPOS()}',
  '{activeTab === "pos" && renderPOS()}\n            {activeTab === "invoices" && renderInvoices()}'
);

fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
console.log("Updated active tabs order.");
