import fs from 'fs';
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

fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
