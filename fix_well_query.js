import fs from 'fs';
let code = fs.readFileSync('src/components/WellProjectView.tsx', 'utf8');

code = code.replace(
  'const q = query(\n      collection(db, "transactions"),\n      where("personId", "==", selectedFarmer.id)\n    );',
  'const q = query(\n      collection(db, "transactions"),\n      where("userId", "==", auth.currentUser?.uid || ""),\n      where("personId", "==", selectedFarmer.id)\n    );'
);

fs.writeFileSync('src/components/WellProjectView.tsx', code);
console.log("Fixed query");
