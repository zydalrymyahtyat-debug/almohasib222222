import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');
code = code.replace(/await Contacts.pickContact\(\)/g, 'await Contacts.pickContact({ projection: { name: true, phones: true } })');
fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
