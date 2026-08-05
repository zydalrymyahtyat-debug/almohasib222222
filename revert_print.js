import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

const currentPrint = `    const printArea = document.getElementById("print-area");
    if (printArea) {
      printArea.innerHTML = printHTML;
      setTimeout(() => {
        if ((window as any).AndroidPrint) {
          (window as any).AndroidPrint.print();
        } else {
          window.print();
        }
      }, 250);
    }`;

const oldPrint = `    const printWindow = window.open('', '', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
      printWindow.print();
    }`;

code = code.replace(currentPrint, oldPrint);
fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
console.log("Reverted printing logic.");
