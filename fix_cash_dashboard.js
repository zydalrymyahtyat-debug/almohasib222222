import fs from 'fs';
let code = fs.readFileSync('src/components/CashBanksDashboard.tsx', 'utf8');

code = code.replace(
  'const handleSaveReceipt = async (e: React.FormEvent) => {\n    e.preventDefault();\n    if (!auth.currentUser || form.amount <= 0) return;',
  'const handleSaveReceipt = async (e: React.FormEvent) => {\n    e.preventDefault();\n    const parsedAmount = Number(form.amount) || 0;\n    if (!auth.currentUser || parsedAmount <= 0) return;'
);

code = code.replace(
  'if (receiptType === "out" && form.amount > balance)',
  'if (receiptType === "out" && parsedAmount > balance)'
);

fs.writeFileSync('src/components/CashBanksDashboard.tsx', code);
console.log("Fixed parsedAmount issue");
