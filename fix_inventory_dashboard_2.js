import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

// Imports
if (!code.includes('Printer')) {
  code = code.replace(
    'import { ArrowRight',
    'import { ArrowRight, Printer, Share2, Receipt, Phone'
  );
}

// State
code = code.replace(
  'const [posCart, setPosCart] = useState<{item: InventoryItem, quantity: number}[]>([]);',
  `const [posCart, setPosCart] = useState<{item: InventoryItem, quantity: number}[]>([]);
  const [posCustomerName, setPosCustomerName] = useState("");
  const [posCustomerPhone, setPosCustomerPhone] = useState("");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesSearch, setInvoicesSearch] = useState("");
  const [showInvoiceModal, setShowInvoiceModal] = useState<any>(null);`
);

// Loading data
const loadingCode = `const loadedMovements = snap2.docs.map(d => ({ id: d.id, ...d.data() } as InventoryMovement));
      setMovements(loadedMovements);`;

const newLoadingCode = `const loadedMovements = snap2.docs.map(d => ({ id: d.id, ...d.data() } as InventoryMovement));
      setMovements(loadedMovements);
      
      // Load invoices
      const invSnap = await getDocs(query(collection(db, "pos_invoices"), where("userId", "==", auth.currentUser.uid), orderBy("createdAt", "desc")));
      setInvoices(invSnap.docs.map(d => ({ id: d.id, ...d.data() })));`;

code = code.replace(loadingCode, newLoadingCode);

fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
console.log("Updated state and imports.");
