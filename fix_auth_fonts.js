import fs from 'fs';
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(/text-sm font-bold text-slate-500/g, 'text-base font-bold text-slate-500');
code = code.replace(/text-xs text-slate-400/g, 'text-sm text-slate-400');
code = code.replace(/text-sm font-black/g, 'text-base font-black');
code = code.replace(/text-2xl font-black/g, 'text-3xl font-black');

fs.writeFileSync('src/components/AuthScreen.tsx', code);
