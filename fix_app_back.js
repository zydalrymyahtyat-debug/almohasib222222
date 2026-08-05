import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes("import { Capacitor }")) {
  code = code.replace('import { App as CapApp } from "@capacitor/app";', 'import { App as CapApp } from "@capacitor/app";\nimport { Capacitor } from "@capacitor/core";');
}

code = code.replace(
`    let isNative = false;
    try {
      // Very basic check if Capacitor is running native
      isNative = !!(window as any).Capacitor?.isNativePlatform?.();
    } catch (e) {}`,
`    const isNative = Capacitor.isNativePlatform();`
);

fs.writeFileSync('src/App.tsx', code);
