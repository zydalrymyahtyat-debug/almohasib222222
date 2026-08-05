import fs from 'fs';
let code = fs.readFileSync('src/components/ListView.tsx', 'utf8');

code = code.replace(/text-xs font-bold text-slate-500/g, 'text-sm font-bold text-slate-500');
code = code.replace(/text-\[10px\] text-slate-400/g, 'text-xs text-slate-400');
code = code.replace(/text-\[11px\]/g, 'text-sm');
code = code.replace(/text-sm font-extrabold/g, 'text-base font-extrabold');

fs.writeFileSync('src/components/ListView.tsx', code);
