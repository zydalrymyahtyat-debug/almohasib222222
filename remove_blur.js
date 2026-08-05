import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('src', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let code = fs.readFileSync(filePath, 'utf8');
    let original = code;
    code = code.replace(/backdrop-blur-md/g, '');
    code = code.replace(/backdrop-blur-sm/g, '');
    code = code.replace(/backdrop-blur-lg/g, '');
    code = code.replace(/backdrop-blur/g, '');
    // Also change translucent backgrounds to solid for better contrast without blur
    code = code.replace(/bg-white\/95/g, 'bg-white');
    code = code.replace(/bg-white\/90/g, 'bg-white');
    code = code.replace(/bg-slate-900\/95/g, 'bg-slate-900');
    code = code.replace(/bg-slate-900\/90/g, 'bg-slate-900');
    code = code.replace(/bg-slate-900\/80/g, 'bg-slate-900/90'); // keep modals slightly transparent but mostly dark
    
    if (code !== original) {
      fs.writeFileSync(filePath, code);
      console.log('Removed blur from ' + filePath);
    }
  }
});
