import https from 'https';
import fs from 'fs';

const url = 'https://ui-avatars.com/api/?name=%D8%A7%D9%84%D8%AF%D9%81%D8%AA%D8%B1&background=0891b2&color=fff&size=512&font-size=0.33&length=2';

https.get(url, (res) => {
  if (res.statusCode === 200) {
    const file = fs.createWriteStream('public/iconapp.png');
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('Downloaded icon successfully!');
    });
  } else {
    console.error('Failed to download: ' + res.statusCode);
  }
}).on('error', (err) => {
  console.error('Error: ', err.message);
});
