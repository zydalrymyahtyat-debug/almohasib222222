import fs from 'fs';
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(
  '<p className="text-xs text-slate-500 font-bold mt-1">{card.sub}</p>',
  '<p className="text-xs text-slate-500 font-bold mt-1 truncate w-full">{card.sub}</p>'
);

fs.writeFileSync('src/components/Dashboard.tsx', code);
