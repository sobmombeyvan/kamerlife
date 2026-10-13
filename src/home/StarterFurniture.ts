import * as THREE from 'three';
import { Frame } from '../city/Batch';
import { HomeKit } from './homeKit';

/**
 * Movable furniture for the starter house. Local origin sits on the floor top,
 * the usable front of every piece faces local +Z.
 */

const OAK = 0xb08458;
const WALNUT = 0x6e4a32;
const BLACK_METAL = 0x2a2a2c;
const LINEN = 0xf2ede4;

function shade(hex: number, k: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * k));
  const b = Math.min(255, Math.round((hex & 255) * k));
  return (r << 16) | (g << 8) | b;
}

function legs(k: HomeKit, hx: number, hz: number, h: number, r: number, hex: number, key: 'wood' | 'metal' = 'wood'): void {
  for (const [x, z] of [
    [-hx, -hz],
    [hx, -hz],
    [-hx, hz],
    [hx, hz],
  ] as const) {
    k.cyl(key, x, 0, z, r * 0.8, r, h, hex, 8);
  }
}

export function createStarterBed(color: number, accent: number, frameHex = WALNUT): THREE.Group {
  const k = new HomeKit();
  // Platform + slatted base
  k.soft('wood', 0, 0.2, 0.06, 1.78, 0.26, 2.12, 0.03, frameHex);
  legs(k, 0.8, 0.95, 0.08, 0.04, shade(frameHex, 0.8));
  // Upholstered headboard on a wood back
  k.soft('wood', 0, 0.62, -1.02, 1.9, 1.08, 0.08, 0.02, frameHex);
  k.soft('fabric', 0, 0.78, -0.95, 1.76, 0.62, 0.1, 0.04, accent);
  for (const x of [-0.59, 0, 0.59]) k.box('fabric', x, 0.78, -0.895, 0.02, 0.56, 0.01, shade(accent, 0.82));
  // Mattress + fitted sheet
  k.soft('fabric', 0, 0.45, 0.07, 1.66, 0.22, 2.0, 0.06, LINEN);
  // Duvet with turned-down band
  k.soft('fabric', 0, 0.575, 0.36, 1.72, 0.07, 1.42, 0.03, color);
  k.soft('fabric', 0, 0.585, -0.32, 1.7, 0.06, 0.18, 0.025, LINEN);
  k.soft('fabric', 0.86, 0.43, 0.36, 0.04, 0.3, 1.42, 0.015, shade(color, 0.92));
  k.soft('fabric', -0.86, 0.43, 0.36, 0.04, 0.3, 1.42, 0.015, shade(color, 0.92));
  // Throw at the foot
  k.soft('fabric', 0, 0.62, 0.86, 1.74, 0.03, 0.36, 0.012, accent);
  // Pillows
  k.blob('fabric', -0.42, 0.66, -0.7, 0.34, 0.085, 0.2, 0xfbf8f2);
  k.blob('fabric', 0.42, 0.66, -0.7, 0.34, 0.085, 0.2, 0xfbf8f2);
  k.soft('fabric', 0, 0.68, -0.52, 0.42, 0.24, 0.08, 0.04, accent);
  return k.group('furn-bed');
}

export function createStarterSofa(color: number, accent: number): THREE.Group {
  const k = new HomeKit();
  const W = 2.3;
  legs(k, W / 2 - 0.12, 0.33, 0.12, 0.028, 0x3b2a1e);
  k.soft('fabric', 0, 0.27, 0.0, W, 0.3, 0.92, 0.06, shade(color, 0.92));
  // Seat cushions
  for (const x of [-0.72, 0, 0.72]) k.soft('fabric', x, 0.5, 0.07, 0.71, 0.15, 0.74, 0.06, color);
  // Back frame + back cushions
  k.soft('fabric', 0, 0.62, -0.37, W, 0.6, 0.2, 0.07, shade(color, 0.9));
  for (const x of [-0.72, 0, 0.72]) k.soft('fabric', x, 0.78, -0.22, 0.7, 0.42, 0.16, 0.07, shade(color, 1.04));
  // Arms
  for (const x of [-W / 2 + 0.09, W / 2 - 0.09]) k.soft('fabric', x, 0.44, 0.0, 0.2, 0.46, 0.92, 0.07, shade(color, 0.95));
  // Throw pillows
  k.soft('fabric', -0.82, 0.74, -0.08, 0.42, 0.38, 0.12, 0.06, accent);
  k.soft('fabric', 0.82, 0.74, -0.08, 0.42, 0.38, 0.12, 0.06, accent);
  k.soft('fabric', 0.42, 0.7, -0.05, 0.34, 0.3, 0.1, 0.05, LINEN);
  return k.group('furn-sofa');
}

export function createStarterCoffeeTable(color: number, glass = false): THREE.Group {
  const k = new HomeKit();
  if (glass) {
    k.box('glass', 0, 0.42, 0, 1.1, 0.025, 0.6, 0xcfe6ee);
    for (const x of [-0.5, 0.5]) {
      k.box('metal', x, 0.21, 0, 0.03, 0.42, 0.55, BLACK_METAL);
    }
    k.box('metal', 0, 0.06, 0, 1.0, 0.025, 0.08, BLACK_METAL);
    k.box('wood', 0, 0.14, 0, 0.9, 0.025, 0.46, color);
  } else {
    k.soft('wood', 0, 0.41, 0, 1.12, 0.05, 0.62, 0.015, color);
    k.soft('wood', 0, 0.13, 0, 1.0, 0.03, 0.5, 0.01, shade(color, 0.9));
    for (const [x, z] of [
      [-0.5, -0.25],
      [0.5, -0.25],
      [-0.5, 0.25],
      [0.5, 0.25],
    ] as const) {
      k.box('wood', x, 0.2, z, 0.05, 0.4, 0.05, shade(color, 0.85));
    }
  }
  // Books + bowl + vase
  k.box('paint', -0.3, 0.455, 0.05, 0.28, 0.035, 0.2, 0x2f4858);
  k.box('paint', -0.29, 0.488, 0.05, 0.24, 0.03, 0.18, 0xc9a66b);
  k.cyl('ceramic', 0.22, 0.435, -0.05, 0.1, 0.14, 0.07, 0xe9e1d3, 16);
  k.blob('leaf', 0.18, 0.5, -0.06, 0.05, 0.04, 0.05, 0xe0a030, undefined, 6);
  k.blob('leaf', 0.26, 0.5, -0.03, 0.045, 0.04, 0.045, 0x7fae3a, undefined, 6);
  k.cyl('ceramic', 0.38, 0.435, 0.14, 0.045, 0.03, 0.2, 0x3c6e71, 12);
  return k.group('furn-table');
}

/** Media console + flat TV. The screen keeps its own material so it can light up. */
export function createStarterTv(screen: number, glow: number, big = false): THREE.Group {
  const k = new HomeKit();
  const W = 1.8;
  k.soft('wood', 0, 0.3, 0, W, 0.4, 0.44, 0.02, OAK);
  k.box('paint', 0, 0.3, 0.222, W - 0.06, 0.34, 0.006, shade(OAK, 0.92));
  for (const x of [-0.45, 0.45]) k.box('paint', x, 0.3, 0.226, 0.006, 0.34, 0.004, 0x5b4632);
  k.box('chrome', -0.12, 0.3, 0.232, 0.12, 0.012, 0.012, 0xb7b7b7);
  k.box('chrome', 0.12, 0.3, 0.232, 0.12, 0.012, 0.012, 0xb7b7b7);
  legs(k, W / 2 - 0.08, 0.17, 0.1, 0.022, BLACK_METAL, 'metal');
  // TV
  const tw = big ? 1.45 : 1.24;
  const th = big ? 0.83 : 0.72;
  k.box('metal', 0, 0.53, -0.04, 0.32, 0.02, 0.18, BLACK_METAL);
  k.box('metal', 0, 0.58, -0.08, 0.06, 0.1, 0.04, BLACK_METAL);
  k.soft('screen', 0, 0.62 + th / 2, -0.08, tw, th, 0.05, 0.008, screen);
  // Soundbar + decor
  k.soft('metal', 0, 0.535, 0.12, 0.8, 0.07, 0.09, 0.02, 0x1d1d1f);
  k.cyl('ceramic', 0.72, 0.5, 0.02, 0.07, 0.09, 0.2, 0xd8cfc0, 14);
  k.blob('leaf', 0.72, 0.8, 0.02, 0.14, 0.12, 0.14, 0x4f7f3a);
  k.box('paint', -0.72, 0.56, 0.02, 0.18, 0.12, 0.14, 0x8a6a4a);
  const g = k.group('furn-tv');
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(tw - 0.05, th - 0.05),
    new THREE.MeshStandardMaterial({
      color: 0x050608,
      roughness: 0.1,
      metalness: 0.2,
      emissive: glow,
      emissiveIntensity: 0.06,
    }),
  );
  panel.name = 'tv-screen';
  panel.position.set(0, 0.62 + th / 2, -0.08 + 0.026);
  g.add(panel);
  return g;
}

export function createStarterRug(color: number, accent: number): THREE.Group {
  const k = new HomeKit();
  k.soft('fabric', 0, 0.009, 0, 2.5, 0.018, 1.75, 0.008, color);
  k.box('fabric', 0, 0.0185, 0, 2.2, 0.002, 1.45, accent);
  k.box('fabric', 0, 0.0195, 0, 2.06, 0.002, 1.31, color);
  for (const z of [-0.36, 0, 0.36]) k.box('fabric', 0, 0.0205, z, 1.8, 0.002, 0.07, accent);
  return k.group('furn-rug', { shadows: false });
}

export function createStarterPlant(leaf: number, tall = false): THREE.Group {
  const k = new HomeKit();
  k.cyl('ceramic', 0, 0, 0, 0.17, 0.22, 0.42, 0xe8e2d6, 16);
  k.cyl('ceramic', 0, 0.42, 0, 0.225, 0.225, 0.03, 0xd9d1c3, 16);
  k.cyl('wood', 0, 0.4, 0, 0.19, 0.19, 0.03, 0x3b2a1e, 12);
  if (tall) {
    // Fiddle-leaf fig: trunk + stacked leaf clusters
    k.cyl('wood', 0, 0.43, 0, 0.03, 0.022, 1.1, 0x6b4f35, 6);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const y = 0.95 + i * 0.1;
      const r = 0.16 + (i % 3) * 0.04;
      k.blob('leaf', Math.cos(a) * r, y, Math.sin(a) * r, 0.15, 0.06, 0.11, i % 2 ? leaf : shade(leaf, 0.82), undefined, 6);
    }
  } else {
    // Monstera-like fan of leaves
    const f = new Frame(0, 0, 0, 0);
    const B = k.b('leaf');
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + (i % 2) * 0.3;
      const len = 0.42 + (i % 3) * 0.1;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const root: [number, number, number] = [0, 0.48, 0];
      const tip: [number, number, number] = [ca * len, 0.82 + (i % 3) * 0.14, sa * len];
      const w = 0.16;
      const m1: [number, number, number] = [ca * len * 0.55 - sa * w, 0.98 + (i % 2) * 0.08, sa * len * 0.55 + ca * w];
      const m2: [number, number, number] = [ca * len * 0.55 + sa * w, 0.98 + (i % 2) * 0.08, sa * len * 0.55 - ca * w];
      const hex = i % 2 ? leaf : shade(leaf, 0.84);
      B.tri(f, root, m1, tip, hex);
      B.tri(f, root, tip, m2, shade(hex, 0.9));
    }
  }
  return k.group('furn-plant');
}

export function createStarterFloorLamp(shadeHex: number, design = false): THREE.Group {
  const k = new HomeKit();
  k.cyl('metal', 0, 0, 0, 0.16, 0.16, 0.025, BLACK_METAL, 20);
  if (design) {
    // Tripod wood legs + drum shade
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      k.box('wood', Math.cos(a) * 0.1, 0.65, Math.sin(a) * 0.1, 0.03, 1.3, 0.03, OAK);
    }
    k.cyl('fabric', 0, 1.25, 0, 0.26, 0.26, 0.34, shadeHex, 20);
    k.cyl('glow', 0, 1.3, 0, 0.07, 0.07, 0.12, 0xfff1d6, 10);
  } else {
    k.cyl('metal', 0, 0.02, 0, 0.014, 0.014, 1.38, BLACK_METAL, 8);
    k.cyl('fabric', 0, 1.3, 0, 0.23, 0.17, 0.3, shadeHex, 18);
    k.cyl('glow', 0, 1.33, 0, 0.06, 0.06, 0.1, 0xfff1d6, 10);
  }
  return k.group('furn-lamp');
}

/** Framed canvas. Hangs on the wall behind its origin; front faces +Z. */
export function createStarterArt(color: number, yaounde = false): THREE.Group {
  const k = new HomeKit();
  const y = 1.75;
  k.soft('wood', 0, y, 0.03, 1.2, 0.84, 0.04, 0.008, 0x2a1f18);
  k.box('paint', 0, y, 0.052, 1.08, 0.72, 0.006, 0xf3eee5);
  if (yaounde) {
    // Sunset over the seven hills
    k.box('paint', 0, y + 0.18, 0.056, 0.96, 0.24, 0.004, 0xf2a541);
    k.box('paint', 0, y + 0.02, 0.056, 0.96, 0.1, 0.004, color);
    for (let i = 0; i < 5; i++) k.box('paint', -0.38 + i * 0.19, y - 0.1, 0.058, 0.17, 0.12 + (i % 2) * 0.08, 0.004, 0x3d5a40);
    k.box('paint', 0, y - 0.22, 0.057, 0.96, 0.12, 0.004, 0x5b3a29);
  } else {
    k.box('paint', -0.2, y + 0.08, 0.056, 0.44, 0.4, 0.004, color);
    k.box('paint', 0.22, y - 0.1, 0.057, 0.36, 0.34, 0.004, 0x2f4858);
    k.box('paint', 0.18, y + 0.18, 0.058, 0.2, 0.16, 0.004, 0xe8c27a);
  }
  return k.group('furn-art', { shadows: false });
}

function chair(k: HomeKit, f: Frame, wood: number, seat: number): void {
  for (const [x, z] of [
    [-0.2, -0.19],
    [0.2, -0.19],
    [-0.2, 0.19],
    [0.2, 0.19],
  ] as const) {
    k.box('wood', x, 0.22, z, 0.04, 0.44, 0.04, wood, f);
  }
  k.soft('wood', 0, 0.455, 0, 0.46, 0.04, 0.44, 0.012, wood, f);
  k.soft('fabric', 0, 0.49, 0.01, 0.42, 0.04, 0.4, 0.015, seat, f);
  k.box('wood', -0.2, 0.72, -0.2, 0.04, 0.5, 0.04, wood, f);
  k.box('wood', 0.2, 0.72, -0.2, 0.04, 0.5, 0.04, wood, f);
  k.soft('wood', 0, 0.86, -0.2, 0.44, 0.16, 0.03, 0.01, wood, f);
  k.box('wood', 0, 0.66, -0.2, 0.4, 0.04, 0.02, wood, f);
}

/** Dining table for two with chairs at both long sides. */
export function createStarterDining(wood: number, seat: number): THREE.Group {
  const k = new HomeKit();
  k.soft('wood', 0, 0.74, 0, 1.2, 0.045, 0.76, 0.012, wood);
  k.box('wood', 0, 0.68, 0, 1.06, 0.07, 0.62, shade(wood, 0.88));
  for (const [x, z] of [
    [-0.54, -0.32],
    [0.54, -0.32],
    [-0.54, 0.32],
    [0.54, 0.32],
  ] as const) {
    k.box('wood', x, 0.36, z, 0.055, 0.72, 0.055, shade(wood, 0.9));
  }
  chair(k, new Frame(0, 0.6, Math.PI, 0), shade(wood, 0.95), seat);
  chair(k, new Frame(0, -0.6, 0, 0), shade(wood, 0.95), seat);
  // Placemats, plates, fruit bowl
  for (const z of [-0.2, 0.2]) {
    k.box('fabric', 0, 0.765, z, 0.42, 0.004, 0.3, 0xd9c7a6);
    k.cyl('ceramic', 0, 0.767, z, 0.12, 0.12, 0.012, 0xf7f5f0, 18);
  }
  k.cyl('ceramic', 0.38, 0.765, 0, 0.07, 0.11, 0.06, 0x3c6e71, 16);
  k.blob('leaf', 0.36, 0.84, 0.0, 0.05, 0.045, 0.05, 0xe0a030, undefined, 6);
  k.blob('leaf', 0.42, 0.84, 0.03, 0.045, 0.04, 0.045, 0xd04a2a, undefined, 6);
  k.blob('leaf', 0.36, 0.84, 0.05, 0.12, 0.025, 0.035, 0xe8cc45, undefined, 6);
  return k.group('furn-dining');
}
