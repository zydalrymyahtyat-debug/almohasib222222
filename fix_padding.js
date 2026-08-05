import fs from 'fs';

// 1. Dashboard.tsx
let dashboard = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');
dashboard = dashboard.replace('pb-24', 'pb-36');
fs.writeFileSync('src/components/Dashboard.tsx', dashboard);

// 2. The ones with pb-28
const filesWithPb28 = ['src/components/ListView.tsx', 'src/components/ReportsView.tsx', 'src/components/StatementView.tsx', 'src/components/WellProjectView.tsx'];
for (const file of filesWithPb28) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/pb-28/g, 'pb-36');
  fs.writeFileSync(file, content);
}

// 3. The ones with no pb-
const filesWithNoPb = ['src/components/CashBanksDashboard.tsx', 'src/components/InventoryDashboard.tsx', 'src/components/ReportsDashboard.tsx'];
for (const file of filesWithNoPb) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace('className="flex flex-col min-h-screen bg-slate-50 text-slate-800"', 'className="flex flex-col min-h-screen bg-slate-50 text-slate-800 pb-36"');
  fs.writeFileSync(file, content);
}
