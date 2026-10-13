import * as THREE from 'three';
import { Frame } from '../city/Batch';
import { HOME_FLOOR_TOP, HOME_INNER, HOME_ROOMS, HOME_WALLS, inRect, type WallRun } from './homeLayout';
import { HomeKit } from './homeKit';
import { openingFrame } from './buildHomeInterior';

const FT = HOME_FLOOR_TOP;
const COUNTER_TOP = 0.9;

function shade(hex: number, k: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * k));
  const b = Math.min(255, Math.round((hex & 255) * k));
  return (r << 16) | (g << 8) | b;
}

/**
 * Kitchen along the back wall: fridge, base + wall cabinets, stone top, sink under the window,
 * four-burner hob with oven and hood, small appliances and food.
 */
export function buildKitchen(cabinet: number, cx: number, cz: number): THREE.Group {
  const k = new HomeKit();
  const f = new Frame(cx, cz + HOME_INNER.z0, 0, FT);
  const x0 = 1.35;
  const x1 = HOME_INNER.x1;
  const depth = 0.62;
  const zc = depth / 2;
  const handle = 0xc8c8c8;
  // Plinth + carcass
  k.box('paint', (x0 + x1) / 2, 0.05, zc - 0.04, x1 - x0, 0.1, depth - 0.08, 0x3a3836, f);
  k.box('paint', (x0 + x1) / 2, 0.48, zc, x1 - x0, 0.76, depth, shade(cabinet, 0.94), f);
  // Fronts (sink 4.0, hob 6.3)
  const fronts: Array<[number, number, 'door' | 'drawers' | 'oven']> = [
    [1.35, 1.95, 'drawers'],
    [1.95, 2.55, 'door'],
    [2.55, 3.15, 'door'],
    [3.15, 3.7, 'door'],
    [3.7, 4.3, 'door'],
    [4.3, 4.85, 'door'],
    [4.85, 5.45, 'drawers'],
    [5.45, 6.0, 'door'],
    [6.0, 6.6, 'oven'],
    [6.6, 7.2, 'drawers'],
    [7.2, x1, 'door'],
  ];
  for (const [a, b, kind] of fronts) {
    const w = b - a - 0.012;
    const mx = (a + b) / 2;
    if (kind === 'oven') {
      k.soft('screen', mx, 0.43, depth + 0.006, w, 0.6, 0.02, 0.005, 0x15171a, f);
      k.box('chrome', mx, 0.69, depth + 0.03, w - 0.1, 0.02, 0.02, handle, f);
      k.box('paint', mx, 0.8, depth + 0.004, w, 0.12, 0.012, 0x2b2b2b, f);
      continue;
    }
    if (kind === 'drawers') {
      for (const [y, h] of [
        [0.24, 0.26],
        [0.52, 0.26],
        [0.76, 0.18],
      ] as const) {
        k.soft('paint', mx, y, depth + 0.006, w, h - 0.012, 0.018, 0.004, cabinet, f);
        k.box('chrome', mx, y + h / 2 - 0.05, depth + 0.024, 0.22, 0.014, 0.014, handle, f);
      }
      continue;
    }
    k.soft('paint', mx, 0.48, depth + 0.006, w, 0.74, 0.018, 0.004, cabinet, f);
    k.box('chrome', mx + w / 2 - 0.05, 0.7, depth + 0.024, 0.014, 0.16, 0.014, handle, f);
  }
  // Stone worktop
  k.soft('stone', (x0 + x1) / 2, COUNTER_TOP - 0.02, zc + 0.01, x1 - x0, 0.04, depth + 0.03, 0.006, 0xd8d2c8, f);
  // Backsplash tiles (window above the sink starts at 1.15)
  k.box('tile', (x0 + 3.3) / 2, 1.2, 0.006, 3.3 - x0, 0.6, 0.012, 0xe9ece8, f);
  k.box('tile', 4.0, 1.025, 0.006, 1.4, 0.25, 0.012, 0xe9ece8, f);
  k.box('tile', (4.7 + x1) / 2, 1.2, 0.006, x1 - 4.7, 0.6, 0.012, 0xe9ece8, f);
  // Sink + mixer
  k.soft('chrome', 4.0, COUNTER_TOP + 0.003, zc + 0.02, 0.78, 0.01, 0.46, 0.004, 0xb5babd, f);
  k.box('metal', 3.82, COUNTER_TOP + 0.006, zc + 0.04, 0.36, 0.006, 0.36, 0x6c7176, f);
  k.box('metal', 4.2, COUNTER_TOP + 0.006, zc + 0.04, 0.3, 0.006, 0.36, 0x6c7176, f);
  k.cyl('chrome', 4.0, COUNTER_TOP, 0.08, 0.025, 0.02, 0.32, 0xd0d4d6, 10, f);
  k.box('chrome', 4.0, COUNTER_TOP + 0.31, 0.16, 0.025, 0.025, 0.18, 0xd0d4d6, f);
  // Dish rack
  k.box('chrome', 4.75, COUNTER_TOP + 0.01, zc, 0.38, 0.02, 0.3, 0xbfc3c6, f);
  for (let i = 0; i < 5; i++) k.cyl('ceramic', 4.62 + i * 0.065, COUNTER_TOP + 0.02, zc - 0.02, 0.012, 0.012, 0.2, 0xf4f2ee, 6, f);
  // Hob + pots
  k.soft('screen', 6.3, COUNTER_TOP + 0.006, zc, 0.6, 0.012, 0.52, 0.004, 0x111214, f);
  for (const [dx, dz, r] of [
    [-0.15, -0.12, 0.08],
    [0.15, -0.12, 0.065],
    [-0.15, 0.12, 0.065],
    [0.15, 0.12, 0.09],
  ] as const) {
    k.cyl('metal', 6.3 + dx, COUNTER_TOP + 0.012, zc + dz, r, r, 0.006, 0x3a3a3a, 16, f);
  }
  k.cyl('chrome', 6.15, COUNTER_TOP + 0.02, zc - 0.12, 0.13, 0.12, 0.16, 0xaeb3b6, 18, f);
  k.box('metal', 6.15, COUNTER_TOP + 0.17, zc - 0.12 + 0.17, 0.03, 0.02, 0.14, 0x222222, f);
  k.cyl('paint', 6.45, COUNTER_TOP + 0.02, zc + 0.12, 0.11, 0.1, 0.09, 0xb3402a, 16, f);
  // Hood + chimney
  k.soft('chrome', 6.3, 1.98, 0.27, 0.62, 0.12, 0.5, 0.02, 0xc4c8cb, f);
  k.box('chrome', 6.3, 2.12, 0.18, 0.3, 0.16, 0.26, 0xc4c8cb, f);
  k.box('chrome', 6.3, 2.62, 0.13, 0.26, 0.84, 0.22, 0xc4c8cb, f);
  // Wall cabinets with LED strip
  for (const [a, b] of [
    [x0, 3.2],
    [4.8, 5.95],
    [6.65, x1],
  ] as const) {
    k.box('paint', (a + b) / 2, 1.85, 0.18, b - a, 0.7, 0.34, shade(cabinet, 0.94), f);
    const n = Math.max(1, Math.round((b - a) / 0.6));
    const dw = (b - a) / n;
    for (let i = 0; i < n; i++) {
      const mx = a + dw * (i + 0.5);
      k.soft('paint', mx, 1.85, 0.358, dw - 0.012, 0.68, 0.018, 0.004, cabinet, f);
      k.box('chrome', mx + (i % 2 ? -1 : 1) * (dw / 2 - 0.05), 1.58, 0.375, 0.014, 0.12, 0.014, handle, f);
    }
    k.box('glow', (a + b) / 2, 1.495, 0.3, b - a - 0.1, 0.008, 0.02, 0xffe2b8, f);
  }
  // Counter appliances + food
  k.soft('paint', 2.2, COUNTER_TOP + 0.15, zc - 0.05, 0.5, 0.3, 0.38, 0.02, 0x2b2b2d, f);
  k.box('screen', 2.12, COUNTER_TOP + 0.15, zc + 0.142, 0.3, 0.2, 0.006, 0x101215, f);
  k.box('paint', 2.4, COUNTER_TOP + 0.15, zc + 0.142, 0.08, 0.2, 0.006, 0x8f9499, f);
  k.cyl('chrome', 2.85, COUNTER_TOP, zc - 0.1, 0.08, 0.07, 0.22, 0xd0d4d6, 14, f);
  k.soft('wood', 5.25, COUNTER_TOP + 0.012, zc + 0.05, 0.42, 0.024, 0.28, 0.008, 0xc49a6c, f);
  k.cyl('ceramic', 5.62, COUNTER_TOP, 0.1, 0.06, 0.06, 0.16, 0xe8e2d6, 12, f);
  for (const [dx, h] of [
    [-0.02, 0.12],
    [0.02, 0.14],
  ] as const) {
    k.cyl('wood', 5.62 + dx, COUNTER_TOP + 0.16, 0.1, 0.008, 0.008, h, 0x8a6a4a, 5, f);
  }
  // Plantain bunch + fruit bowl
  for (let i = 0; i < 4; i++) {
    k.blob('leaf', 7.4 + i * 0.04, COUNTER_TOP + 0.05, zc - 0.05 + i * 0.03, 0.14, 0.03, 0.035, i % 2 ? 0x8aa63a : 0xb5b23a, f);
  }
  k.cyl('ceramic', 3.0, COUNTER_TOP, zc + 0.05, 0.08, 0.13, 0.07, 0xe9e1d3, 16, f);
  k.blob('leaf', 2.97, COUNTER_TOP + 0.09, zc + 0.04, 0.05, 0.045, 0.05, 0xe07a2a, f);
  k.blob('leaf', 3.04, COUNTER_TOP + 0.09, zc + 0.07, 0.045, 0.04, 0.045, 0x7fae3a, f);
  // Spice shelf under the window side cabinet
  k.box('wood', 4.0, 2.35, 0.08, 1.2, 0.03, 0.16, 0xa57a50, f);
  // Fridge
  const fr = new Frame(cx + 0.95, cz + HOME_INNER.z0 + 0.35, 0, FT);
  k.soft('paint', 0, 0.925, 0, 0.74, 1.85, 0.68, 0.03, 0xd9dcde, fr);
  k.box('metal', 0, 1.25, 0.342, 0.72, 0.008, 0.008, 0x8a8f93, fr);
  k.box('chrome', 0.3, 1.0, 0.36, 0.02, 0.36, 0.03, 0xbfc3c6, fr);
  k.box('chrome', 0.3, 1.5, 0.36, 0.02, 0.2, 0.03, 0xbfc3c6, fr);
  k.box('paint', -0.1, 1.55, 0.343, 0.12, 0.08, 0.004, 0xe0a030, fr);
  return k.group('home-kitchen');
}

/** Wall-tile runs on the bathroom side of a wall, cut around doors (and below windows). */
function tileWall(k: HomeKit, run: WallRun, side: 1 | -1, a: number, b: number, top: number, hex: number, cx: number, cz: number): void {
  const cuts = run.openings.filter((o) => o.at + o.w / 2 > a && o.at - o.w / 2 < b).sort((p, q) => p.at - q.at);
  let cur = a;
  const put = (s: number, e: number, h: number) => {
    if (e - s < 0.02 || h <= 0.02) return;
    const f = openingFrame(run, (s + e) / 2, side, cx, cz);
    k.box('tile', 0, h / 2, run.t / 2 + 0.005, e - s, h, 0.01, hex, f);
  };
  for (const o of cuts) {
    const oa = Math.max(a, o.at - o.w / 2);
    const ob = Math.min(b, o.at + o.w / 2);
    put(cur, oa, top);
    if (o.sill > 0) put(oa, ob, Math.min(top, o.sill));
    cur = ob;
  }
  put(cur, b, top);
}

/** Bathroom: tiles, walk-in shower, toilet, vanity with mirror, tall cabinet, towels. */
export function buildBathroom(tile: number, cx: number, cz: number): THREE.Group {
  const k = new HomeKit();
  const R = HOME_ROOMS.bath;
  const top = 2.05;
  // Floor tiles
  k.box('tile', cx + (R.x0 + R.x1) / 2, FT + 0.004, cz + (R.z0 + R.z1) / 2, R.x1 - R.x0, 0.008, R.z1 - R.z0, shade(tile, 0.86));
  for (const run of HOME_WALLS) {
    for (const side of [1, -1] as const) {
      if (run.outward && side === run.outward) continue;
      const lo = run.axis === 'x' ? R.x0 : R.z0;
      const hi = run.axis === 'x' ? R.x1 : R.z1;
      const a = Math.max(run.from, lo);
      const b = Math.min(run.to, hi);
      if (b - a < 0.1) continue;
      const p = run.fixed + side * (run.t / 2 + 0.2);
      const mid = (a + b) / 2;
      const [px, pz] = run.axis === 'x' ? [mid, p] : [p, mid];
      if (!inRect(R, px, pz)) continue;
      tileWall(k, run, side, a, b, top, tile, cx, cz);
    }
  }
  // Walk-in shower: tray, glass screen, rain head, mixer, niche
  const sx = cx - 7.31;
  const sz = cz + 2.98;
  k.soft('ceramic', sx, FT + 0.025, sz, 1.1, 0.05, 1.1, 0.01, 0xf3f3f1);
  k.box('chrome', sx, FT + 0.052, sz, 0.12, 0.004, 0.12, 0x9a9fa3);
  k.box('glass', cx - 6.76, FT + 1.0, cz + 3.24, 0.01, 1.96, 0.58, 0xd8e8ec);
  k.box('chrome', cx - 6.76, FT + 1.0, cz + 2.94, 0.025, 1.96, 0.02, 0xc9cdd0);
  k.box('chrome', cx - 6.76, FT + 1.99, cz + 3.24, 0.025, 0.02, 0.58, 0xc9cdd0);
  k.cyl('chrome', cx - 7.82, FT + 1.0, sz, 0.012, 0.012, 1.15, 0xd0d4d6, 8);
  k.box('chrome', cx - 7.7, FT + 2.15, sz, 0.26, 0.02, 0.02, 0xd0d4d6);
  k.cyl('chrome', cx - 7.56, FT + 2.11, sz, 0.12, 0.12, 0.02, 0xd0d4d6, 18);
  k.box('chrome', cx - 7.82, FT + 1.05, sz, 0.03, 0.14, 0.08, 0xd0d4d6);
  k.box('paint', cx - 7.84, FT + 1.35, sz + 0.38, 0.02, 0.28, 0.32, shade(tile, 0.75));
  k.cyl('paint', cx - 7.8, FT + 1.24, sz + 0.32, 0.03, 0.03, 0.14, 0xe07a8a, 8);
  k.cyl('paint', cx - 7.8, FT + 1.24, sz + 0.42, 0.03, 0.03, 0.17, 0x3c6e71, 8);
  // Bath mat
  k.soft('fabric', cx - 7.3, FT + 0.012, cz + 2.1, 0.62, 0.016, 0.42, 0.006, 0xd9c7a6);
  // Toilet facing -z, tank against the hall wall
  const t = new Frame(cx - 5.6, cz + 3.53 - 0.34, Math.PI, FT);
  k.cyl('ceramic', 0, 0, 0.04, 0.13, 0.17, 0.36, 0xf7f7f5, 16, t);
  k.soft('ceramic', 0, 0.36, 0.0, 0.38, 0.06, 0.5, 0.025, 0xf7f7f5, t);
  k.soft('ceramic', 0, 0.39, -0.02, 0.36, 0.02, 0.46, 0.01, 0xfbfbfa, t);
  k.soft('ceramic', 0, 0.62, -0.26, 0.42, 0.42, 0.16, 0.03, 0xf7f7f5, t);
  k.box('chrome', 0.08, 0.84, -0.26, 0.06, 0.012, 0.04, 0xc9cdd0, t);
  // Toilet roll + brush
  k.cyl('chrome', cx - 5.15, FT + 0.65, cz + 3.5, 0.008, 0.008, 0.04, 0xc9cdd0, 6);
  k.cyl('paint', cx - 5.15, FT + 0.6, cz + 3.46, 0.055, 0.055, 0.1, 0xffffff, 12);
  k.cyl('paint', cx - 5.95, FT, cz + 3.4, 0.05, 0.06, 0.32, 0x9aa0a4, 10);
  // Vanity + basin + mirror + light bar (facing -x)
  const v = new Frame(cx - 4.6 - 0.07 - 0.25, cz + 1.5, -Math.PI / 2, FT);
  k.soft('wood', 0, 0.45, 0, 0.8, 0.7, 0.48, 0.012, 0xa57a50, v);
  k.box('paint', -0.2, 0.43, 0.242, 0.38, 0.6, 0.006, 0x9a6f47, v);
  k.box('paint', 0.2, 0.43, 0.242, 0.38, 0.6, 0.006, 0x9a6f47, v);
  k.soft('ceramic', 0, 0.82, 0.01, 0.82, 0.04, 0.5, 0.01, 0xf7f7f5, v);
  k.cyl('ceramic', 0, 0.84, 0.04, 0.18, 0.16, 0.1, 0xf7f7f5, 20, v);
  k.cyl('chrome', 0, 0.84, 0.04, 0.15, 0.15, 0.104, 0xe6e8e9, 18, v);
  k.cyl('chrome', 0, 0.84, -0.17, 0.018, 0.018, 0.24, 0xd0d4d6, 8, v);
  k.box('chrome', 0, 1.07, -0.1, 0.022, 0.022, 0.14, 0xd0d4d6, v);
  k.soft('chrome', 0, 1.55, -0.225, 0.7, 0.8, 0.02, 0.01, 0xdfe7ea, v);
  k.box('glow', 0, 2.02, -0.2, 0.56, 0.035, 0.05, 0xfff3e2, v);
  k.cyl('ceramic', 0.3, 0.84, -0.12, 0.03, 0.03, 0.13, 0x3c6e71, 8, v);
  // Tall cabinet with plant (facing +x)
  const c = new Frame(cx - 7.86 + 0.21, cz + 0.75, Math.PI / 2, FT);
  k.soft('paint', 0, 0.85, 0, 0.6, 1.7, 0.42, 0.012, 0xf2efe9, c);
  k.box('paint', 0, 0.85, 0.212, 0.004, 1.6, 0.004, 0xd7d2c8, c);
  k.box('chrome', -0.05, 0.9, 0.225, 0.014, 0.14, 0.014, 0xc9cdd0, c);
  k.box('chrome', 0.05, 0.9, 0.225, 0.014, 0.14, 0.014, 0xc9cdd0, c);
  k.cyl('ceramic', 0.1, 1.7, 0, 0.07, 0.06, 0.12, 0xe9e1d3, 12, c);
  k.blob('leaf', 0.1, 1.9, 0, 0.12, 0.1, 0.12, 0x4f7f3a, c);
  // Towel rail + towels on the hall wall
  const r = new Frame(cx - 6.35, cz + 3.53, Math.PI, FT);
  k.rod('chrome', -0.3, 0.3, 1.25, 0.05, 0.012, 0xc9cdd0, r);
  k.soft('fabric', -0.12, 0.98, 0.065, 0.32, 0.56, 0.03, 0.01, 0xf2ede4, r);
  k.soft('fabric', 0.17, 1.0, 0.065, 0.24, 0.5, 0.03, 0.01, shade(tile, 0.7), r);
  return k.group('home-bathroom');
}

/** Rods and pleated panels on living, dining, bedroom and hall windows. */
export function buildCurtains(color: number, cx: number, cz: number): THREE.Group {
  const k = new HomeKit();
  for (const run of HOME_WALLS) {
    if (!run.outward) continue;
    const inner = (-run.outward) as 1 | -1;
    for (const op of run.openings) {
      if (op.kind !== 'window') continue;
      const [px, pz] = run.axis === 'x' ? [op.at, run.fixed + inner * 0.5] : [run.fixed + inner * 0.5, op.at];
      if (inRect(HOME_ROOMS.bath, px, pz)) continue;
      // Kitchen window above the sink keeps a short roller blind
      const kitchen = run.id === 'back' && op.at > 2;
      const f = openingFrame(run, op.at, inner, cx, cz);
      const z = run.t / 2 + 0.09;
      if (kitchen) {
        k.box('fabric', 0, op.head - 0.12, run.t / 2 + 0.04, op.w - 0.04, 0.22, 0.02, 0xefe8dc, f);
        k.box('paint', 0, op.head + 0.01, run.t / 2 + 0.05, op.w + 0.04, 0.05, 0.05, 0xd8d2c8, f);
        continue;
      }
      const rodY = op.head + 0.2;
      const bottom = op.sill >= 0.95 ? op.sill - 0.12 : 0.04;
      const h = rodY - 0.04 - bottom;
      k.rod('chrome', -op.w / 2 - 0.4, op.w / 2 + 0.4, rodY, z, 0.013, 0x9a8f80, f);
      k.cyl('chrome', -op.w / 2 - 0.42, rodY - 0.02, z, 0.02, 0.02, 0.04, 0x9a8f80, 8, f);
      k.cyl('chrome', op.w / 2 + 0.42, rodY - 0.02, z, 0.02, 0.02, 0.04, 0x9a8f80, 8, f);
      for (const dir of [-1, 1]) {
        const base = dir * (op.w / 2 + 0.06);
        for (let i = 0; i < 4; i++) {
          const x = base + dir * (i * 0.1 - 0.12);
          const off = i % 2 ? 0.025 : 0;
          k.soft('fabric', x, bottom + h / 2, z + off, 0.11, h, 0.035, 0.015, i % 2 ? shade(color, 0.93) : color, f);
        }
        k.box('fabric', base + dir * 0.03, bottom + h * 0.45, z + 0.04, 0.34, 0.04, 0.02, shade(color, 0.85), f);
      }
    }
  }
  return k.group('home-curtains', { shadows: false });
}
