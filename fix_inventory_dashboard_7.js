import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

// 1. Remove loadData()
code = code.replace('loadData();', '');

// 2. Add pos_invoices listener
const oldUseEffect = `    const unsubMoves = onSnapshot(movesQ, (snap) => {
      const mvs: InventoryMovement[] = [];
      snap.forEach((doc) => {
        mvs.push({ id: doc.id, ...doc.data() } as InventoryMovement);
      });
      mvs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      if (isMounted) setMovements(mvs);
    }, (error) => {
      console.error("Error fetching inventory movements:", error);
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubItems();
      unsubMoves();
    };`;

const newUseEffect = `    const unsubMoves = onSnapshot(movesQ, (snap) => {
      const mvs: InventoryMovement[] = [];
      snap.forEach((doc) => {
        mvs.push({ id: doc.id, ...doc.data() } as InventoryMovement);
      });
      mvs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      if (isMounted) setMovements(mvs);
    }, (error) => {
      console.error("Error fetching inventory movements:", error);
      if (isMounted) setLoading(false);
    });

    const invoicesQ = query(collection(db, "pos_invoices"), where("userId", "==", auth.currentUser.uid));
    const unsubInvoices = onSnapshot(invoicesQ, (snap) => {
      const invs: any[] = [];
      snap.forEach((doc) => {
        invs.push({ id: doc.id, ...doc.data() });
      });
      invs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      if (isMounted) setInvoices(invs);
    });

    return () => {
      isMounted = false;
      unsubItems();
      unsubMoves();
      unsubInvoices();
    };`;

if (!code.includes('const unsubInvoices')) {
  code = code.replace(oldUseEffect, newUseEffect);
}

fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
console.log("Fixed loadData and added pos_invoices listener.");
