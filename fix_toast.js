import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'className="fixed top-6 left-1/2 -translate-x-1/2 w-[92%] max-w-sm bg-slate-900/95 backdrop-blur-md text-white px-5 py-4 rounded-[1.8rem] shadow-2xl border border-slate-700/50 flex items-start gap-3 z-50 cursor-pointer"',
  'className="fixed top-6 left-0 right-0 mx-auto w-[92%] max-w-sm bg-slate-900/95 backdrop-blur-md text-white px-5 py-4 rounded-[1.8rem] shadow-2xl border border-slate-700/50 flex items-start gap-3 z-50 cursor-pointer"'
);

fs.writeFileSync('src/App.tsx', code);
console.log("Fixed toast");
