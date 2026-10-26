// Erzeugt die App-Icons (weißes Kreuz auf grünem Grund) ohne Abhängigkeiten.
// Aufruf: node tools/make-icons.js
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const GREEN = [0x1b, 0x7f, 0x3b];
const WHITE = [0xff, 0xff, 0xff];
const OUT = path.join(__dirname, '..', 'icons');

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// length = Länge der Kreuzbalken, width = Balkenbreite (Anteil der Kantenlänge)
function png(size, length, width) {
  const L = Math.round(size * length);
  const W = Math.round(size * width);
  const a = Math.round((size - L) / 2);
  const b = Math.round((size - W) / 2);
  const raw = Buffer.alloc((size * 3 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // Filter: none
    for (let x = 0; x < size; x++) {
      const vertical = x >= b && x < b + W && y >= a && y < a + L;
      const horizontal = y >= b && y < b + W && x >= a && x < a + L;
      const [r, g, bl] = vertical || horizontal ? WHITE : GREEN;
      raw[o++] = r; raw[o++] = g; raw[o++] = bl;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

fs.mkdirSync(OUT, { recursive: true });
const icons = [
  ['icon-180.png', 180, 0.62, 0.2],
  ['icon-192.png', 192, 0.62, 0.2],
  ['icon-512.png', 512, 0.62, 0.2],
  // maskable: Kreuz bleibt innerhalb der sicheren Zone (Kreis mit 40 % Radius)
  ['icon-maskable-512.png', 512, 0.5, 0.16]
];
for (const [name, size, length, width] of icons) {
  fs.writeFileSync(path.join(OUT, name), png(size, length, width));
  console.log('geschrieben: icons/' + name);
}
