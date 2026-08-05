import fs from 'fs';
let code = fs.readFileSync('src/components/WellProjectView.tsx', 'utf8');

code = code.replace(
  '{isWatering ? "+" : "-"}{t.amount.toLocaleString(\'en-US\')} ريال',
  '<span dir="ltr">{isWatering ? "+" : "-"}{t.amount.toLocaleString(\'en-US\')}</span> <span>ريال</span>'
);

fs.writeFileSync('src/components/WellProjectView.tsx', code);
console.log("Fixed amount render");
