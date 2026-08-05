const fs = require('fs');
let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

code = code.replace(
`  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !itemForm.name) return;

    try {
      if (editingItem) {
        await updateDoc(doc(db, "inventory_items", editingItem.id), {
          ...itemForm
        });
      } else {
        await addDoc(collection(db, "inventory_items"), {
          userId: auth.currentUser.uid,
          ...itemForm,
          createdAt: serverTimestamp()
        });
      }
      setIsAddItemModalOpen(false);
      setEditingItem(null);
      setItemForm({ name: "", category: "", quantity: "", minQuantity: "", cost: "", price: "", barcode: "" });
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الحفظ.");
    }
  };`,
`  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !itemForm.name) return;

    try {
      const payload = {
        name: itemForm.name,
        category: itemForm.category,
        quantity: Number(itemForm.quantity) || 0,
        minQuantity: Number(itemForm.minQuantity) || 0,
        cost: Number(itemForm.cost) || 0,
        price: Number(itemForm.price) || 0,
        barcode: itemForm.barcode
      };

      if (editingItem) {
        await updateDoc(doc(db, "inventory_items", editingItem.id), payload);
      } else {
        await addDoc(collection(db, "inventory_items"), {
          userId: auth.currentUser.uid,
          ...payload,
          createdAt: serverTimestamp()
        });
      }
      setIsAddItemModalOpen(false);
      setEditingItem(null);
      setItemForm({ name: "", category: "", quantity: "", minQuantity: "", cost: "", price: "", barcode: "" });
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الحفظ.");
    }
  };`
);

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
    } catch (err) {
      console.error(err);
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
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حفظ الحركة.");
    }
  };`
);

fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
