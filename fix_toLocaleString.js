import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

code = code.replace(/\{showInvoiceModal\.totalAmount\.toLocaleString/g, '{(showInvoiceModal.totalAmount || 0).toLocaleString');
code = code.replace(/\$\{invoice\.totalAmount\.toLocaleString/g, '${(invoice.totalAmount || 0).toLocaleString');
code = code.replace(/it\.price\.toLocaleString/g, '(it.price || 0).toLocaleString');
code = code.replace(/\(it\.price \* it\.quantity\)\.toLocaleString/g, '((it.price || 0) * (it.quantity || 0)).toLocaleString');
code = code.replace(/\{it\.price\.toLocaleString/g, '{(it.price || 0).toLocaleString');

fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
console.log("Fixed toLocaleString");
