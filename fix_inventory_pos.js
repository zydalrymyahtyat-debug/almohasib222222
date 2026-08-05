import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

// 1. Add 'pos' to activeTab state type
code = code.replace(
  'const [activeTab, setActiveTab] = useState<"overview" | "items" | "movements">("overview");',
  'const [activeTab, setActiveTab] = useState<"overview" | "items" | "movements" | "pos">("overview");\n  const [posSearchQuery, setPosSearchQuery] = useState("");\n  const [posCart, setPosCart] = useState<{item: InventoryItem, quantity: number}[]>([]);'
);

// 2. Insert POS tab button
const tabsBlock = `<div className="flex border-b border-slate-200 bg-white">
        <button onClick={() => setActiveTab("overview")} className={\`flex-1 py-3 text-sm font-bold border-b-2 transition \${activeTab === "overview" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500"}\`}>نظرة عامة</button>
        <button onClick={() => setActiveTab("items")} className={\`flex-1 py-3 text-sm font-bold border-b-2 transition \${activeTab === "items" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500"}\`}>الأصناف</button>
        <button onClick={() => setActiveTab("movements")} className={\`flex-1 py-3 text-sm font-bold border-b-2 transition \${activeTab === "movements" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500"}\`}>السجل</button>
        <button onClick={() => setActiveTab("pos")} className={\`flex-1 py-3 text-sm font-bold border-b-2 transition \${activeTab === "pos" ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-500"}\`}>نقطة بيع</button>
      </div>`;
code = code.replace(/<div className="flex border-b border-slate-200 bg-white">[\s\S]*?<\/div>/, tabsBlock);

// 3. Insert {activeTab === "pos" && renderPOS()}
code = code.replace(
  '{activeTab === "movements" && renderMovements()}',
  '{activeTab === "movements" && renderMovements()}\n            {activeTab === "pos" && renderPOS()}'
);

fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
console.log("POS state and UI tabs updated.");
