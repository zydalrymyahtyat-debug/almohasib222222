import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf8');

// Add import
if (!code.includes('Contacts } from "@capacitor-community/contacts"')) {
  code = code.replace(
    'import { ArrowRight',
    'import { Contacts } from "@capacitor-community/contacts";\nimport { ArrowRight'
  );
}

const contactPickerFn = `  const handlePickContact = async () => {
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

// Inject the function
if (!code.includes('handlePickContact')) {
  code = code.replace('const renderPOS = () => {', contactPickerFn + '\n\n  const renderPOS = () => {');
}

// Add the UI button
const phoneInputCode = `                  <div className="flex items-center gap-2">
                    <input 
                      type="tel" 
                      placeholder="رقم الهاتف (اختياري)" 
                      value={posCustomerPhone}
                      onChange={(e) => setPosCustomerPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-emerald-500"
                      dir="ltr"
                    />
                  </div>`;

const newPhoneInputCode = `                  <div className="flex items-center gap-2">
                    <input 
                      type="tel" 
                      placeholder="رقم الهاتف (اختياري)" 
                      value={posCustomerPhone}
                      onChange={(e) => setPosCustomerPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-emerald-500"
                      dir="ltr"
                    />
                    <button type="button" onClick={handlePickContact} className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition">
                      <Phone size={18} />
                    </button>
                  </div>`;

code = code.replace(phoneInputCode, newPhoneInputCode);

fs.writeFileSync('src/components/InventoryDashboard.tsx', code);
console.log("Added contact picker to Inventory POS.");
