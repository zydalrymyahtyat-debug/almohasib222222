import fs from 'fs';
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(
  'className="p-3 bg-white text-slate-800 shadow-md border border-slate-100 flex flex-col items-center text-center cursor-pointer select-none relative overflow-hidden group hover:shadow-lg transition rounded-2xl"',
  'className="p-3 bg-white text-slate-800 shadow-md border border-slate-100 flex flex-col items-center justify-start text-center cursor-pointer select-none relative overflow-hidden group hover:shadow-lg transition rounded-2xl h-full"'
);

fs.writeFileSync('src/components/Dashboard.tsx', code);
