import fs from 'fs';

const files = ['src/App.tsx', 'src/components/AuthScreen.tsx'];

for (const file of files) {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(/left-1\/2 -translate-x-1\/2/g, 'left-0 right-0 mx-auto');
  fs.writeFileSync(file, code);
  console.log(`Fixed centers in ${file}`);
}
