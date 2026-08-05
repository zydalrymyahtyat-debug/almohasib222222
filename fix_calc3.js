import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'window.addEventListener("open-calculator" as any, () => setShowCalculator(true));',
  'const handleOpenCalculator = () => setShowCalculator(true);\n    window.addEventListener("open-calculator" as any, handleOpenCalculator);'
);

code = code.replace(
  'window.removeEventListener("open-calculator" as any, () => setShowCalculator(true));',
  'window.removeEventListener("open-calculator" as any, handleOpenCalculator);'
);

fs.writeFileSync('src/App.tsx', code);
console.log("Updated App.tsx again x2");
