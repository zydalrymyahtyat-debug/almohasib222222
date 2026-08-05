import fs from 'fs';
let css = fs.readFileSync('src/index.css', 'utf8');

css = css.replace('@import "tailwindcss";\n\n@theme {\n  --font-sans: "Cairo", "Almarai", "Inter", system-ui, -apple-system, sans-serif;\n  --font-mono: "Cairo", "Almarai", "Inter", system-ui, -apple-system, sans-serif;\n}', '@tailwind base;\n@tailwind components;\n@tailwind utilities;');

// also replace without formatting just in case
css = css.replace('@import "tailwindcss";\n@theme {\n  --font-sans: "Cairo", "Almarai", "Inter", system-ui, -apple-system, sans-serif;\n  --font-mono: "Cairo", "Almarai", "Inter", system-ui, -apple-system, sans-serif;\n}', '@tailwind base;\n@tailwind components;\n@tailwind utilities;');

fs.writeFileSync('src/index.css', css);
console.log("Updated index.css");
