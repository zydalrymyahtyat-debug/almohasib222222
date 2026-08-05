import fs from 'fs';
let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

code = code.replace(
`  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !movementForm.itemId || movementForm.quantity <= 0) return;

    const targetItem = items.find(it => it.id === movementForm.itemId);
    if (!targetItem) return;

    let newQty = targetItem.quantity;
    if (movementForm.type === "in" || movementForm.type === "return") {
      newQty += movementForm.quantity;
    } else if (movementForm.type === "out") {
      newQty -= movementForm.quantity;
      if (newQty < 0) {
        alert("الكمية غير كافية في المخزون!");
        return;
      }
    }

    try {
      await addDoc(collection(db, "inventory_movements"), {
        userId: auth.currentUser.uid,
        itemId: targetItem.id,
        itemName: targetItem.name,
        type: movementForm.type,
        quantity: movementForm.quantity,
        note: movementForm.note,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, "inventory_items", targetItem.id), {
        quantity: newQty
      });

      setIsMovementModalOpen(false);
      setMovementForm({ itemId: "", type: "in", quantity: "", note: "" });
    } catch(err) {
      console.error(err);
      alert("حدث خطأ.");
    }
  };`,
`  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedQty = Number(movementForm.quantity) || 0;
    if (!auth.currentUser || !movementForm.itemId || parsedQty <= 0) return;

    const targetItem = items.find(it => it.id === movementForm.itemId);
    if (!targetItem) return;

    let newQty = targetItem.quantity;
    if (movementForm.type === "in" || movementForm.type === "return") {
      newQty += parsedQty;
    } else if (movementForm.type === "out") {
      newQty -= parsedQty;
      if (newQty < 0) {
        alert("الكمية غير كافية في المخزون!");
        return;
      }
    }

    try {
      await addDoc(collection(db, "inventory_movements"), {
        userId: auth.currentUser.uid,
        itemId: targetItem.id,
        itemName: targetItem.name,
        type: movementForm.type,
        quantity: parsedQty,
        note: movementForm.note,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, "inventory_items", targetItem.id), {
        quantity: newQty
      });

      setIsMovementModalOpen(false);
      setMovementForm({ itemId: "", type: "in", quantity: "", note: "" });
    } catch(err) {
      console.error(err);
      alert("حدث خطأ.");
    }
  };`
);

fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
