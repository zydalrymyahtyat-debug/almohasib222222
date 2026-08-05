import fs from 'fs';
let code = fs.readFileSync('src/components/CashBanksDashboard.tsx', 'utf8');

code = code.replace(/amount: Number\(e\.target\.value\)/g, 'amount: e.target.value');

fs.writeFileSync('src/components/CashBanksDashboard.tsx', code);
