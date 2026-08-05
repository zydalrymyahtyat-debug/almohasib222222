import fs from 'fs';
const files = [
  'src/components/InventoryDashboard.tsx',
  'src/components/ReportsDashboard.tsx',
  'src/components/CashBanksDashboard.tsx',
  'src/components/WellProjectView.tsx',
  'src/components/ReportsView.tsx'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/text-\[10px\]/g, 'text-xs');
    code = code.replace(/text-\[9px\]/g, 'text-xs');
    code = code.replace(/text-\[11px\]/g, 'text-sm');
    fs.writeFileSync(file, code);
  }
}
