import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  '<h1 className="text-base font-black text-slate-800 truncate max-w-[60%]">{viewTitle}</h1>',
  '<h1 className="text-base font-extrabold text-slate-800 truncate max-w-[70%]">{viewTitle}</h1>'
);

fs.writeFileSync('src/App.tsx', code);
console.log("Fixed App title");
