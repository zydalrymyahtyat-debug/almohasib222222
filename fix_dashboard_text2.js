import fs from 'fs';
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(/max-w-\[120px\] sm:max-w-\[150px\]/g, '');

fs.writeFileSync('src/components/Dashboard.tsx', code);
