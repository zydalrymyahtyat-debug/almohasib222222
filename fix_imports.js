import fs from 'fs';

const files = [
  'src/components/StatementView.tsx',
  'src/components/Dashboard.tsx',
  'src/components/ListView.tsx'
];

for (const file of files) {
  let code = fs.readFileSync(file, 'utf8');
  if (!code.includes('import { Calculator } from "lucide-react";') && code.includes('<Calculator')) {
    code = code.replace('from "lucide-react";', 'from "lucide-react";\nimport { Calculator } from "lucide-react";');
    fs.writeFileSync(file, code);
    console.log(`Fixed ${file}`);
  }
}
