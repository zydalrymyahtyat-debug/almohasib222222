import fs from 'fs';
let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

const hook = `
  useEffect(() => {
    if (isAddItemModalOpen || isMovementModalOpen || isScannerOpen) {
      (window as any).customBackHandler = () => {
        setIsAddItemModalOpen(false);
        setIsMovementModalOpen(false);
        setIsScannerOpen(false);
      };
    } else {
      delete (window as any).customBackHandler;
    }
    return () => {
      delete (window as any).customBackHandler;
    };
  }, [isAddItemModalOpen, isMovementModalOpen, isScannerOpen]);

`;

code = code.replace(
`  useEffect(() => {
    if (!auth.currentUser) {`,
hook + `  useEffect(() => {
    if (!auth.currentUser) {`
);

fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
