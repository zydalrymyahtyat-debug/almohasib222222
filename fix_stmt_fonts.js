import fs from 'fs';
let code = fs.readFileSync('src/components/StatementView.tsx', 'utf8');

code = code.replace(/text-\[10px\]/g, 'text-xs');
code = code.replace(/text-xs font-bold/g, 'text-sm font-bold');
code = code.replace(/text-sm font-extrabold/g, 'text-base font-extrabold');
code = code.replace(/text-xs text-slate-500/g, 'text-sm text-slate-500');

fs.writeFileSync('src/components/StatementView.tsx', code);
