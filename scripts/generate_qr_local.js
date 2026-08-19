const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

function readEnv() {
  const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  const lines = e.split(/\r?\n/);
  const out = {};
  for (const l of lines) {
    const m = l.match(/^\s*([^=\s]+)\s*=\s*(.*)\s*$/);
    if (m) {
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[m[1]] = v;
    }
  }
  return out;
}

(async () => {
  const env = readEnv();
  const base = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const slug = process.argv[2] || 'hediyyeli-carx';
  const wheelEnabled = true;
  const url = `${base.replace(/\/$/, '')}/${wheelEnabled ? 'oyun' : 'ar'}/${slug}`;
  const buf = await QRCode.toBuffer(url, { width: 512, margin: 2 });
  const outPath = path.join(__dirname, `${slug}-qr.png`);
  fs.writeFileSync(outPath, buf);
  console.log('Generated', outPath, '->', url);
})();
