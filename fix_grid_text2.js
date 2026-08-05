import fs from 'fs';
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(
  'className="font-extrabold text-sm text-slate-800 truncate w-full"',
  'className="font-extrabold text-xs text-slate-800 leading-tight break-words"'
);

code = code.replace(
  'className="text-xs text-slate-500 font-bold mt-1 truncate w-full"',
  'className="text-[10px] text-slate-500 font-bold mt-1 leading-tight break-words"'
);

fs.writeFileSync('src/components/Dashboard.tsx', code);
