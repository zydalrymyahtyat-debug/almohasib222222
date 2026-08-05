import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

const oldHandlePickContact = `  const handlePickContact = async () => {
    try {
      if ((window as any).AndroidContacts && typeof (window as any).AndroidContacts.pickContact === "function") {
        const handler = (event: any) => {
          const detail = event.detail;
          if (detail && detail.phone) {
            setPosCustomerPhone(detail.phone);
            if (detail.name) setPosCustomerName(detail.name);
          }
          window.removeEventListener("contactPicked", handler);
        };
        window.addEventListener("contactPicked", handler);
        (window as any).AndroidContacts.pickContact();
        return;
      }
      
      let permStatus = await Contacts.checkPermissions();
      if (permStatus.contacts !== 'granted') {
        permStatus = await Contacts.requestPermissions();
      }
      if (permStatus.contacts === 'granted') {
        const result = await Contacts.pickContact({ projection: { name: true, phones: true } });
        if (result.contact) {
          const name = result.contact.name?.display || "";
          const phone = result.contact.phones?.[0]?.number || "";
          if (name) setPosCustomerName(name);
          if (phone) setPosCustomerPhone(phone);
        }
      } else {
        alert("تعذر الوصول لجهات الاتصال. يجب منح الصلاحية.");
      }
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء فتح جهات الاتصال.");
    }
  };`;

const newHandlePickContact = `  const handlePickContact = async () => {
    try {
      if ((window as any).AndroidContacts && typeof (window as any).AndroidContacts.pickContact === "function") {
        (window as any).onAndroidContactSelected = (name: string, phone: string) => {
          if (name === "ERROR") {
            alert("⚠️ حدث خطأ أثناء جلب جهة الاتصال: " + phone);
          } else if (name === "CANCELLED") {
            // User cancelled selection
          } else {
            let cleanedPhone = phone || "";
            if (cleanedPhone) {
              cleanedPhone = cleanedPhone.replace(/[\\s-()]/g, "");
              if (cleanedPhone.startsWith("00")) {
                cleanedPhone = "+" + cleanedPhone.substring(2);
              }
            }
            if (name) setPosCustomerName(name);
            if (cleanedPhone) setPosCustomerPhone(cleanedPhone);
          }
        };
        (window as any).AndroidContacts.pickContact();
        return;
      }
      
      let permStatus = await Contacts.checkPermissions();
      if (permStatus.contacts !== 'granted') {
        permStatus = await Contacts.requestPermissions();
      }
      if (permStatus.contacts === 'granted') {
        const result = await Contacts.pickContact({ projection: { name: true, phones: true } });
        if (result.contact) {
          const name = result.contact.name?.display || "";
          let phone = result.contact.phones?.[0]?.number || "";
          if (phone) {
            phone = phone.replace(/[\\s-()]/g, "");
            if (phone.startsWith("00")) {
              phone = "+" + phone.substring(2);
            }
          }
          if (name) setPosCustomerName(name);
          if (phone) setPosCustomerPhone(phone);
        }
      } else {
        alert("تعذر الوصول لجهات الاتصال. يجب منح الصلاحية.");
      }
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء فتح جهات الاتصال.");
    }
  };`;

code = code.replace(oldHandlePickContact, newHandlePickContact);

fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
console.log("Updated handlePickContact.");
