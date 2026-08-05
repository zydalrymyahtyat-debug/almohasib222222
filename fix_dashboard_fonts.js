import fs from 'fs';
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

// Title
code = code.replace(
  'className="text-lg font-black tracking-tight text-white"',
  'className="text-2xl font-black tracking-tight text-white"'
);

// Menu Cards
code = code.replace(
  'className="font-extrabold text-[11px] text-slate-800 truncate w-full"',
  'className="font-extrabold text-sm text-slate-800 truncate w-full"'
);
code = code.replace(
  'className="text-[9px] text-slate-400 font-bold mt-1"',
  'className="text-xs text-slate-500 font-bold mt-1"'
);

// Totals Headers
code = code.replace(
  'className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1"',
  'className="text-sm font-bold text-slate-500 mb-1 flex items-center gap-1"'
);
code = code.replace(
  'className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1"', // for the second one (عليك)
  'className="text-sm font-bold text-slate-500 mb-1 flex items-center gap-1"'
);

// Totals Numbers
code = code.replace(
  'className="text-xl font-black text-emerald-600 font-mono"',
  'className="text-3xl font-black text-emerald-600 font-mono"'
);
code = code.replace(
  'className="text-xl font-black text-red-500 font-mono"',
  'className="text-3xl font-black text-red-500 font-mono"'
);

// Currency Label
code = code.replace(
  'className="text-[10px] text-slate-400 font-bold mt-1"',
  'className="text-xs text-slate-400 font-bold mt-1"'
);
code = code.replace(
  'className="text-[10px] text-slate-400 font-bold mt-1"',
  'className="text-xs text-slate-400 font-bold mt-1"'
);

fs.writeFileSync('src/components/Dashboard.tsx', code);
