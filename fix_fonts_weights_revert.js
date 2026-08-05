import fs from 'fs';

const files = [
  'src/App.tsx',
  'src/components/WellProjectView.tsx',
  'src/components/Dashboard.tsx'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/font-extrabold/g, 'font-black');
    fs.writeFileSync(file, code);
  }
}
console.log("Reverted font-extrabold to font-black");
