import fs from 'fs';
let xml = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');

xml = xml.replace(
    'android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density"',
    'android:screenOrientation="portrait"\n            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density"'
);

fs.writeFileSync('android/app/src/main/AndroidManifest.xml', xml);
console.log("Updated AndroidManifest.xml");
