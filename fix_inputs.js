import fs from 'fs';
let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

code = code.replace(/cost: Number\(e\.target\.value\)/g, 'cost: e.target.value');
code = code.replace(/price: Number\(e\.target\.value\)/g, 'price: e.target.value');
code = code.replace(/quantity: Number\(e\.target\.value\)/g, 'quantity: e.target.value');
code = code.replace(/minQuantity: Number\(e\.target\.value\)/g, 'minQuantity: e.target.value');

fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
