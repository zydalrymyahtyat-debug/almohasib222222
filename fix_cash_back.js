import fs from 'fs';
let code = fs.readFileSync('src/components/CashBanksDashboard.tsx', 'utf8');

const hook = `
  useEffect(() => {
    if (isReceiptModalOpen) {
      (window as any).customBackHandler = () => {
        setIsReceiptModalOpen(false);
      };
    } else {
      delete (window as any).customBackHandler;
    }
    return () => {
      delete (window as any).customBackHandler;
    };
  }, [isReceiptModalOpen]);

`;

code = code.replace(
`  useEffect(() => {
    if (!auth.currentUser) {`,
hook + `  useEffect(() => {
    if (!auth.currentUser) {`
);

// Also fix the form defaults if there are any
code = code.replace(
`  const [form, setForm] = useState({ amount: 0, note: "", source: "cash", destination: "bank1" });`,
`  const [form, setForm] = useState({ amount: "" as string | number, note: "", source: "cash", destination: "bank1" });`
);

code = code.replace(
`  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || form.amount <= 0) return;`,
`  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(form.amount) || 0;
    if (!auth.currentUser || parsedAmount <= 0) return;`
);

code = code.replace(
`        amount: form.amount,`,
`        amount: parsedAmount,`
);

code = code.replace(
`      setForm({ amount: 0, note: "", source: "cash", destination: "bank1" });`,
`      setForm({ amount: "", note: "", source: "cash", destination: "bank1" });`
);

fs.writeFileSync('src/components/CashBanksDashboard.tsx', code);
