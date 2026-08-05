import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

code = code.replace(/b\.cost \* b\.quantity/g, '(b.cost || 0) * (b.quantity || 0)');

fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
console.log("Fixed cost");
