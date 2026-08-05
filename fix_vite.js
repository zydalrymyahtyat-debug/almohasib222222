import fs from 'fs';
let code = fs.readFileSync('vite.config.ts', 'utf8');

code = code.replace("import tailwindcss from '@tailwindcss/vite';\n", '');
code = code.replace("tailwindcss(),\n", '');
code = code.replace("      tailwindcss(),\n", '');

fs.writeFileSync('vite.config.ts', code);
console.log("Updated vite.config.ts");
