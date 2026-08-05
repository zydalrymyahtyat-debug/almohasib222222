import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/text-xs/g, 'text-sm');
code = code.replace(/text-\[10px\]/g, 'text-xs');
code = code.replace(/text-\[9px\]/g, 'text-xs');
code = code.replace(/text-\[8px\]/g, 'text-xs');

fs.writeFileSync('src/App.tsx', code);
