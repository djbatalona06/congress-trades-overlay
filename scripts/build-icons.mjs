// Renders the extension icon (three candlesticks on a rounded dark tile) to
// public/icon/{16,32,48,128}.png with no image dependencies.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZES = [16, 32, 48, 128];
const SUPERSAMPLE = 4;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icon');

const BG = [15, 23, 42];
const UP = [34, 197, 94];
const DOWN = [239, 68, 68];
const CORNER = 0.22;
const BODY_HALF = 0.085;
const WICK_HALF = 0.022;

const CANDLES = [
  { x: 0.26, wick: [0.34, 0.8], body: [0.46, 0.7], color: UP },
  { x: 0.5, wick: [0.24, 0.68], body: [0.32, 0.56], color: DOWN },
  { x: 0.74, wick: [0.18, 0.62], body: [0.24, 0.48], color: UP },
];

function insideTile(u, v) {
  const dx = Math.max(CORNER - u, u - (1 - CORNER), 0);
  const dy = Math.max(CORNER - v, v - (1 - CORNER), 0);
  return dx * dx + dy * dy <= CORNER * CORNER;
}

function sample(u, v) {
  if (!insideTile(u, v)) return null;
  for (const c of CANDLES) {
    const dx = Math.abs(u - c.x);
    if (dx <= BODY_HALF && v >= c.body[0] && v <= c.body[1]) return c.color;
    if (dx <= WICK_HALF && v >= c.wick[0] && v <= c.wick[1]) return c.color;
  }
  return BG;
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const n = SUPERSAMPLE * SUPERSAMPLE;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const color = sample(
            (x + (sx + 0.5) / SUPERSAMPLE) / size,
            (y + (sy + 0.5) / SUPERSAMPLE) / size,
          );
          if (!color) continue;
          r += color[0]; g += color[1]; b += color[2]; a += 1;
        }
      }
      const i = (y * size + x) * 4;
      if (a > 0) {
        rgba[i] = Math.round(r / a);
        rgba[i + 1] = Math.round(g / a);
        rgba[i + 2] = Math.round(b / a);
      }
      rgba[i + 3] = Math.round((a / n) * 255);
    }
  }
  return rgba;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = join(OUT_DIR, `${size}.png`);
  writeFileSync(file, encodePng(size, render(size)));
  console.log(`wrote ${file}`);
}
