import fs from 'fs';
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

const targetStr = '{/* Info text about iframe and browser behavior */}\n                    <p className="text-[9px] text-amber-600 font-medium leading-relaxed bg-amber-50 p-2 rounded-xl border border-amber-100/30">\n                      💡 ملاحظة: للتنبيه بشريط حالة الجوال الحقيقي، افتح البرنامج بنافذة جديدة (New Tab) ووافق على طلب الإذن. في بيئة المعاينة الحالية ستظهر الإشعارات كتنبيهات داخلية مميزة.\n                    </p>';

if (code.includes(targetStr)) {
  code = code.replace(targetStr, '');
  fs.writeFileSync('src/components/Sidebar.tsx', code);
  console.log("Replaced note in Sidebar");
} else {
  console.log("Could not find note in Sidebar");
}
