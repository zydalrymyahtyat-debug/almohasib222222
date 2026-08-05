import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

code = code.replace(
  'customerName: posCustomerName.trim(),',
  'customerName: (posCustomerName || "").trim(),'
);

code = code.replace(
  'customerPhone: posCustomerPhone.trim(),',
  'customerPhone: (posCustomerPhone || "").trim(),'
);

fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
console.log("Fixed trim.");
