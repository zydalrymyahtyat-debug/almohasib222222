import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/bottom-24/g, 'bottom-32');

fs.writeFileSync('src/App.tsx', code);
