import fs from 'fs';
let css = fs.readFileSync('src/index.css', 'utf8');

css = css.replace('@import "@fontsource/cairo/index.css";', '');
css = css.replace('@import "@fontsource/almarai/index.css";', '');

const gfonts = '@import url("https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Almarai:wght@400;700;800&family=Inter:wght@400;500;600&display=swap");\n';

if (!css.includes('fonts.googleapis.com')) {
  css = gfonts + css;
}

fs.writeFileSync('src/index.css', css);
console.log("Updated fonts in index.css");
