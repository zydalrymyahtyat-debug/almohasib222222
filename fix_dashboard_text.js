import fs from 'fs';
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

// Change text-3xl to text-2xl truncate to prevent overflow
code = code.replace(/text-3xl font-black text-emerald-600 font-mono/g, 'text-2xl sm:text-3xl font-black text-emerald-600 font-mono truncate w-full max-w-[120px] sm:max-w-[150px]');
code = code.replace(/text-3xl font-black text-red-500 font-mono/g, 'text-2xl sm:text-3xl font-black text-red-500 font-mono truncate w-full max-w-[120px] sm:max-w-[150px]');

fs.writeFileSync('src/components/Dashboard.tsx', code);
