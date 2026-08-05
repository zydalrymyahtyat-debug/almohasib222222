import fs from 'fs';
import path from 'path';

const root = process.cwd();
const sourcePath = path.join(root, 'iconapp.png');

if (!fs.existsSync(sourcePath)) {
  console.log("No custom iconapp.png found in the root directory yet.");
  process.exit(0);
}

// Target paths to copy the icon to
const densities = ['hdpi', 'mdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
const targetPaths = [
  path.join(root, 'public/iconapp.png')
];

for (const density of densities) {
  const dir = path.join(root, `android/app/src/main/res/mipmap-${density}`);
  targetPaths.push(path.join(dir, 'ic_launcher.png'));
  targetPaths.push(path.join(dir, 'ic_launcher_round.png'));
  targetPaths.push(path.join(dir, 'ic_launcher_foreground.png'));
}

console.log("Custom iconapp.png detected! Syncing across all asset directories...");

let successCount = 0;
const buffer = fs.readFileSync(sourcePath);

for (const target of targetPaths) {
  try {
    const dir = path.dirname(target);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(target, buffer);
    console.log(`Synced successfully: ${target}`);
    successCount++;
  } catch (err) {
    console.error(`Error writing to ${target}:`, err);
  }
}

console.log(`Sync completed! Successfully updated ${successCount} launcher and web icon assets.`);
