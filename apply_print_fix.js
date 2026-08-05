import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

const oldPrint = `    const printWindow = window.open('', '', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
      printWindow.print();
    }`;

const newPrint = `    const printArea = document.getElementById("print-area");
    if (printArea) {
      printArea.innerHTML = printHTML;
      setTimeout(() => {
        if ((window as any).AndroidPrint) {
          (window as any).AndroidPrint.print();
        } else {
          window.print();
        }
        // Clear it after a delay so it doesn't stay in memory
        setTimeout(() => { printArea.innerHTML = ""; }, 2000);
      }, 250);
    }`;

code = code.replace(oldPrint, newPrint);
fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
console.log("Applied print fix again.");
