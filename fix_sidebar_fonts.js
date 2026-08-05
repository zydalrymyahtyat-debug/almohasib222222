import fs from 'fs';
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

// Title Name
code = code.replace(
  'className="text-lg font-black text-slate-100"',
  'className="text-xl font-black text-slate-100"'
);

// Email
code = code.replace(
  'className="text-[10px] text-slate-400 font-bold"',
  'className="text-xs text-slate-400 font-bold"'
);

// Menu items text
code = code.replace(
  /text-xs font-bold text-slate-300/g,
  'text-sm font-bold text-slate-300'
);

// Small notes
code = code.replace(
  /text-\[9px\] text-slate-500/g,
  'text-xs text-slate-500'
);
code = code.replace(
  /text-\[10px\]/g,
  'text-xs'
);

// Section Titles
code = code.replace(
  /text-\[11px\] font-black text-slate-500/g,
  'text-sm font-black text-slate-500'
);

fs.writeFileSync('src/components/Sidebar.tsx', code);
