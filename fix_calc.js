import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes("import CalculatorModal")) {
  code = code.replace(
    'import ReportsDashboard from "./components/ReportsDashboard";',
    'import ReportsDashboard from "./components/ReportsDashboard";\nimport CalculatorModal from "./components/CalculatorModal";\nimport { Calculator } from "lucide-react";'
  );
}

if (!code.includes("showCalculator")) {
  code = code.replace(
    'const [showOverdueModal, setShowOverdueModal] = useState(false);',
    'const [showOverdueModal, setShowOverdueModal] = useState(false);\n  const [showCalculator, setShowCalculator] = useState(false);'
  );
}

if (code.includes('<Settings size={22} />')) {
  code = code.replace(
    '<button \n            onClick={() => setSidebarOpen(true)}\n            className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer"\n          >\n            <Settings size={22} />\n          </button>',
    '<div className="flex gap-1">\n            <button \n              onClick={() => setShowCalculator(true)}\n              className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer"\n            >\n              <Calculator size={22} />\n            </button>\n            <button \n              onClick={() => setSidebarOpen(true)}\n              className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer"\n            >\n              <Settings size={22} />\n            </button>\n          </div>'
  );
}

if (code.includes('onNavigate={handleNavigate}')) {
  code = code.replace(
    '<Sidebar\n        isOpen={sidebarOpen}',
    '<CalculatorModal isOpen={showCalculator} onClose={() => setShowCalculator(false)} />\n      <Sidebar\n        isOpen={sidebarOpen}'
  );
}

fs.writeFileSync('src/App.tsx', code);
console.log("Updated App.tsx");
