import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

const oldCheckout = `  const handlePosCheckout = async () => {
    if (!auth.currentUser || posCart.length === 0) return;
    setLoading(true);
    try {
      for (const cartItem of posCart) {
        // Record movement
        await addDoc(collection(db, "inventory_movements"), {
          userId: auth.currentUser.uid,
          itemId: cartItem.item.id,
          itemName: cartItem.item.name,
          type: "out",
          quantity: cartItem.quantity,
          note: "مبيعات سريعة (POS)",
          createdAt: serverTimestamp()
        });
        // Update item quantity
        await updateDoc(doc(db, "inventory_items", cartItem.item.id), {
          quantity: cartItem.item.quantity - cartItem.quantity
        });
      }
      setPosCart([]);
      setPosSearchQuery("");
      alert("تمت عملية البيع وخصم المخزون بنجاح");
      loadData();
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء المعالجة");
    } finally {
      setLoading(false);
    }
  };`;

const newCheckout = `  const handlePosCheckout = async () => {
    if (!auth.currentUser || posCart.length === 0) return;
    setLoading(true);
    try {
      const invoiceNumber = Math.floor(100000 + Math.random() * 900000).toString();
      const totalAmount = posCart.reduce((sum, c) => sum + (c.item.price * c.quantity), 0);
      
      const invoiceData = {
        userId: auth.currentUser.uid,
        invoiceNumber,
        customerName: posCustomerName.trim(),
        customerPhone: posCustomerPhone.trim(),
        items: posCart.map(c => ({
          itemId: c.item.id,
          itemName: c.item.name,
          price: c.item.price,
          quantity: c.quantity
        })),
        totalAmount,
        createdAt: serverTimestamp()
      };
      
      const invoiceRef = await addDoc(collection(db, "pos_invoices"), invoiceData);

      for (const cartItem of posCart) {
        // Record movement
        await addDoc(collection(db, "inventory_movements"), {
          userId: auth.currentUser.uid,
          itemId: cartItem.item.id,
          itemName: cartItem.item.name,
          type: "out",
          quantity: cartItem.quantity,
          note: \`مبيعات سريعة (فاتورة #\${invoiceNumber})\`,
          createdAt: serverTimestamp()
        });
        // Update item quantity
        await updateDoc(doc(db, "inventory_items", cartItem.item.id), {
          quantity: cartItem.item.quantity - cartItem.quantity
        });
      }
      setPosCart([]);
      setPosSearchQuery("");
      setPosCustomerName("");
      setPosCustomerPhone("");
      loadData();
      
      // Show invoice modal
      setShowInvoiceModal({ id: invoiceRef.id, ...invoiceData, createdAt: { toDate: () => new Date() } });
      
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء المعالجة");
    } finally {
      setLoading(false);
    }
  };

  const handlePrintInvoice = (invoice: any) => {
    let printHTML = \`
      <div style="direction: rtl; font-family: sans-serif; padding: 20px; max-width: 400px; margin: 0 auto;">
        <h2 style="text-align: center; margin-bottom: 5px;">فاتورة مبيعات</h2>
        <p style="text-align: center; margin-top: 0; color: #666;">رقم الفاتورة: \${invoice.invoiceNumber}</p>
        <hr style="border: 1px dashed #ccc; margin: 15px 0;">
        \${invoice.customerName ? \`<p><strong>العميل:</strong> \${invoice.customerName}</p>\` : ''}
        \${invoice.customerPhone ? \`<p><strong>رقم الجوال:</strong> \${invoice.customerPhone}</p>\` : ''}
        <p><strong>التاريخ:</strong> \${invoice.createdAt?.toDate?.()?.toLocaleDateString('ar-EG') || new Date().toLocaleDateString('ar-EG')}</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <thead>
            <tr style="border-bottom: 1px solid #000;">
              <th style="text-align: right; padding: 5px;">الصنف</th>
              <th style="text-align: center; padding: 5px;">الكمية</th>
              <th style="text-align: left; padding: 5px;">المجموع</th>
            </tr>
          </thead>
          <tbody>
            \${invoice.items.map((it: any) => \`
              <tr>
                <td style="text-align: right; padding: 5px;">\${it.itemName}</td>
                <td style="text-align: center; padding: 5px;">\${it.quantity}</td>
                <td style="text-align: left; padding: 5px;">\${(it.price * it.quantity).toLocaleString('en-US')} ر.ي</td>
              </tr>
            \`).join('')}
          </tbody>
        </table>
        <hr style="border: 1px dashed #ccc; margin: 15px 0;">
        <h3 style="text-align: center;">الإجمالي: \${invoice.totalAmount.toLocaleString('en-US')} ريال</h3>
      </div>
    \`;
    const printWindow = window.open('', '', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleSendInvoice = (invoice: any, method: 'whatsapp' | 'sms') => {
    if (!invoice.customerPhone) {
      alert("يرجى إدخال رقم هاتف العميل أولاً");
      return;
    }
    let message = \`🧾 *فاتورة مبيعات - #\${invoice.invoiceNumber}*\\n\`;
    message += \`العميل: \${invoice.customerName || 'عميل نقدي'}\\n\\n\`;
    invoice.items.forEach((it: any) => {
      message += \`▫️ \${it.itemName} (x\${it.quantity}) - \${(it.price * it.quantity).toLocaleString('en-US')} ر.ي\\n\`;
    });
    message += \`\\n💰 *الإجمالي: \${invoice.totalAmount.toLocaleString('en-US')} ريال*\\n\\nشكراً لتعاملكم معنا!\`;
    
    let phone = invoice.customerPhone.replace(/\\D/g, '');
    if (phone.startsWith('0')) phone = '967' + phone.substring(1); // Default to Yemen code if starts with 0
    else if (!phone.startsWith('967')) phone = '967' + phone;

    const encoded = encodeURIComponent(message);
    if (method === 'whatsapp') {
      window.open(\`https://wa.me/\${phone}?text=\${encoded}\`, "_blank");
    } else {
      window.open(\`sms:\${phone}?body=\${encoded}\`, "_blank");
    }
  };`;

code = code.replace(oldCheckout, newCheckout);

fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
console.log("Updated handlePosCheckout and added invoice handlers.");
