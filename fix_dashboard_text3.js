import fs from 'fs';
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(
  'className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono truncate w-full "',
  'className="text-xl sm:text-2xl font-black text-emerald-600 font-mono"'
);

code = code.replace(
  'className="text-2xl sm:text-3xl font-black text-red-500 font-mono truncate w-full "',
  'className="text-xl sm:text-2xl font-black text-red-500 font-mono"'
);

fs.writeFileSync('src/components/Dashboard.tsx', code);
