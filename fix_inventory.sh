sed -i 's/const \[itemForm, setItemForm\] = useState({ name: "", category: "", quantity: 0, minQuantity: 0, cost: 0, price: 0, barcode: "" });/const [itemForm, setItemForm] = useState({ name: "", category: "", quantity: "" as string | number, minQuantity: "" as string | number, cost: "" as string | number, price: "" as string | number, barcode: "" });/g' src/components/InventoryDashboard.tsx

sed -i 's/setItemForm({ name: "", category: "", quantity: 0, minQuantity: 0, cost: 0, price: 0, barcode: "" });/setItemForm({ name: "", category: "", quantity: "", minQuantity: "", cost: "", price: "", barcode: "" });/g' src/components/InventoryDashboard.tsx

sed -i 's/const \[movementForm, setMovementForm\] = useState({ itemId: "", type: "in", quantity: 0, note: "" });/const [movementForm, setMovementForm] = useState({ itemId: "", type: "in", quantity: "" as string | number, note: "" });/g' src/components/InventoryDashboard.tsx

sed -i 's/setMovementForm({ itemId: "", type: "in", quantity: 0, note: "" });/setMovementForm({ itemId: "", type: "in", quantity: "", note: "" });/g' src/components/InventoryDashboard.tsx
