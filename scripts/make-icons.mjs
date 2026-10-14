/**
 * Rasterizes the in-game Kamerlife mark: gold tile, dark “K”.
 * The HUD uses the same colors (#d4a84b → #8a5a22 on #14110c).
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/icons');

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mix(c0, c1, t) {
  return [
    Math.round(lerp(c0[0], c1[0], t)),
    Math.round(lerp(c0[1], c1[1], t)),
    Math.round(lerp(c0[2], c1[2], t)),
    255,
  ];
}

function distPointSeg(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby || 1;
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (ax + abx * t);
  const dy = py - (ay + aby * t);
  return Math.hypot(dx, dy);
}

function roundedDist(px, py, x, y, w, h, r) {
  const cx = Math.max(x + r, Math.min(px, x + w - r));
  const cy = Math.max(y + r, Math.min(py, y + h - r));
  const dx = px - cx;
  const dy = py - cy;
  const outside = px < x + r || px > x + w - r || py < y + r || py > y + h - r;
  if (!outside && px >= x && px <= x + w && py >= y && py <= y + h) {
    const inset = Math.min(px - x, x + w - px, py - y, y + h - py);
    return -inset;
  }
  return Math.hypot(dx, dy);
}

function drawIcon(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const bg = [11, 18, 24];
  const goldA = [212, 168, 75];
  const goldB = [138, 90, 34];
  const ink = [20, 17, 12];
  const pad = maskable ? size * 0.02 : size * 0.08;
  const tile = size - pad * 2;
  const radius = tile * (maskable ? 0.2 : 0.22);
  const stroke = tile * 0.11;
  const k = {
    x0: pad + tile * 0.3,
    x1: pad + tile * 0.44,
    y0: pad + tile * 0.22,
    y1: pad + tile * 0.78,
    joinX: pad + tile * 0.4,
    joinY: pad + tile * 0.5,
    tipX: pad + tile * 0.74,
    tipY0: pad + tile * 0.24,
    tipY1: pad + tile * 0.76,
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const tileEdge = roundedDist(x + 0.5, y + 0.5, pad, pad, tile, tile, radius);
      const tileCover = Math.max(0, Math.min(1, 0.5 - tileEdge));
      const base = maskable ? mix(goldA, goldB, (x + y) / (size * 2)) : [...bg, 255];
      let r = base[0];
      let g = base[1];
      let b = base[2];
      if (!maskable && tileCover > 0) {
        const gold = mix(goldA, goldB, (x + y) / (size * 2));
        r = lerp(r, gold[0], tileCover);
        g = lerp(g, gold[1], tileCover);
        b = lerp(b, gold[2], tileCover);
      }
      const dBar = distPointSeg(x, y, k.x0, k.y0, k.x0, k.y1);
      const dUp = distPointSeg(x, y, k.joinX, k.joinY, k.tipX, k.tipY0);
      const dDn = distPointSeg(x, y, k.joinX, k.joinY, k.tipX, k.tipY1);
      const d = Math.min(dBar, dUp, dDn);
      const cover = Math.max(0, Math.min(1, (stroke * 0.5 + 0.75 - d) / 1.5));
      const mark = maskable ? 1 : tileCover;
      const inkCover = cover * mark;
      r = lerp(r, ink[0], inkCover);
      g = lerp(g, ink[1], inkCover);
      b = lerp(b, ink[2], inkCover);
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

mkdirSync(outDir, { recursive: true });
const files = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable.png', 512, true],
  ['apple-touch-icon.png', 180, false],
];
for (const [name, size, maskable] of files) {
  const png = encodePng(size, drawIcon(size, maskable));
  writeFileSync(resolve(outDir, name), png);
  console.log(`${name} ${png.length} bytes`);
}
