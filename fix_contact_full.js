import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

// Ensure Capacitor is imported
if (!code.includes('Capacitor }')) {
  code = code.replace(
    'import { Contacts } from "@capacitor-community/contacts";',
    'import { Contacts } from "@capacitor-community/contacts";\nimport { Capacitor } from "@capacitor/core";'
  );
}

const oldHandlePickContactRegex = /const handlePickContact = async \(\) => \{[\s\S]*?(?=const renderPOS = \(\) => \{)/;

const newHandlePickContact = `const handlePickContact = async () => {
    localStorage.setItem("ignore_app_lock", "true");
    const clearLockIgnore = setTimeout(() => {
      localStorage.removeItem("ignore_app_lock");
    }, 3000);

    if ((window as any).AndroidContacts && typeof (window as any).AndroidContacts.pickContact === "function") {
      (window as any).onAndroidContactSelected = (name: string, phone: string) => {
        localStorage.removeItem("ignore_app_lock");
        clearTimeout(clearLockIgnore);
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
      try {
        (window as any).AndroidContacts.pickContact();
      } catch (err: any) {
        console.error("AndroidContacts interface call failed:", err);
        localStorage.removeItem("ignore_app_lock");
        clearTimeout(clearLockIgnore);
      }
      return;
    }

    if (Capacitor.isNativePlatform()) {
      try {
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
      } catch (nativeErr: any) {
        console.error("Native Contact Picker Error:", nativeErr);
        alert("⚠️ تعذر فتح جهات الاتصال: " + (nativeErr.message || JSON.stringify(nativeErr)));
      } finally {
        localStorage.removeItem("ignore_app_lock");
        clearTimeout(clearLockIgnore);
      }
      return;
    }

    localStorage.removeItem("ignore_app_lock");
    clearTimeout(clearLockIgnore);

    if ("contacts" in navigator && (navigator as any).contacts?.select) {
      try {
        const options = { multiple: false };
        const selected = await (navigator as any).contacts.select(["name", "tel"], options);
        if (selected && selected.length > 0) {
          const contact = selected[0];
          const name = contact.name ? contact.name[0] : "";
          let phone = contact.tel ? contact.tel[0] : "";
          if (phone) {
            phone = phone.replace(/[\\s-()]/g, "");
            if (phone.startsWith("00")) {
              phone = "+" + phone.substring(2);
            }
          }
          if (name) setPosCustomerName(name);
          if (phone) setPosCustomerPhone(phone);
        }
      } catch (ex) {
        console.error("Web Contacts API Error:", ex);
      }
    } else {
      alert("⚠️ ميزة اختيار جهات الاتصال غير مدعومة في هذا المتصفح.");
    }
  };

  `;

code = code.replace(oldHandlePickContactRegex, newHandlePickContact);

fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
console.log("Updated handlePickContact fully.");
