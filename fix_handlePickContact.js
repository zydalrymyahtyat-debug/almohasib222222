import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

const handlersToAdd = `
  const handlePickContact = async () => {
    localStorage.setItem("ignore_app_lock", "true");
    const clearLockIgnore = setTimeout(() => {
      localStorage.removeItem("ignore_app_lock");
    }, 3000);

    if ((window as any).AndroidContacts && typeof (window as any).AndroidContacts.pickContact === "function") {
      (window as any).onAndroidContactSelected = (name: string, phone: string) => {
        localStorage.removeItem("ignore_app_lock");
        setPosCustomerName(name);
        setPosCustomerPhone(phone);
      };
      (window as any).AndroidContacts.pickContact();
      return;
    }

    try {
      const Contacts = (await import('@capacitor-community/contacts')).Contacts;
      const permission = await Contacts.requestPermissions();
      if (permission.contacts === 'granted') {
        const result = await Contacts.pickContact();
        localStorage.removeItem("ignore_app_lock");
        if (result && result.contact) {
          const contact = result.contact;
          const name = contact.name?.display || "";
          const phone = contact.phones?.[0]?.number || "";
          if (name) setPosCustomerName(name);
          if (phone) setPosCustomerPhone(phone);
        }
      } else {
        localStorage.removeItem("ignore_app_lock");
        alert("يجب منح صلاحية الوصول لجهات الاتصال");
      }
    } catch (err) {
      localStorage.removeItem("ignore_app_lock");
      console.log("Contacts API not available", err);
    }
  };
`;

if (!code.includes('const handlePickContact')) {
  code = code.replace(
    'const handlePosCheckout = async () => {',
    handlersToAdd + '\n  const handlePosCheckout = async () => {'
  );
  fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
  console.log("Added handlePickContact");
} else {
  console.log("Already exists");
}
