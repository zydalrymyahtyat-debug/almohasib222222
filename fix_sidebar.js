import fs from 'fs';
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

// Replace spring transition with a lighter one
code = code.replace(
  'transition={{ type: "spring", damping: 30, stiffness: 300 }}',
  'transition={{ duration: 0.2, ease: "easeOut" }}'
);
// In case the background overlay has a heavy blur, we can also simplify it.
code = code.replace(
  'className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40"',
  'className="fixed inset-0 bg-slate-900/60 z-40"' // Removed backdrop-blur-sm
);

fs.writeFileSync('src/components/Sidebar.tsx', code);
console.log("Fixed Sidebar performance");
