import fs from 'fs';

const files = [
  'src/App.tsx',
  'src/components/WellProjectView.tsx',
  'src/components/Dashboard.tsx'
];

for (const file of files) {
  let code = fs.readFileSync(file, 'utf8');
  // Tone down some font-black to font-extrabold
  code = code.replace(/font-black/g, 'font-extrabold');
  fs.writeFileSync(file, code);
}
console.log("Toned down font-black to font-extrabold");
