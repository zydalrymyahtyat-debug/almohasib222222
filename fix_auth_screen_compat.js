import fs from 'fs';
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

// Remove space-y-4 from the form
code = code.replace('<form onSubmit={handleAuth} className="space-y-4">', '<form onSubmit={handleAuth} className="block">');

// Add mb-4 to the form groups
code = code.replace(/<div className="relative">/g, '<div className="relative mb-4">');

// Remove gap-3 from buttons and add explicit margin
code = code.replace('<div className="flex gap-3 mt-6">', '<div className="flex mt-6">');
code = code.replace('className={`py-4 px-4 bg-gradient-to-r', 'className={`py-4 px-4 ml-3 bg-gradient-to-r');

fs.writeFileSync('src/components/AuthScreen.tsx', code);
console.log("Fixed AuthScreen compat");
