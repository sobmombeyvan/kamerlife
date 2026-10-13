import { Frame, type KitBatch } from './Batch';
import type { TreeSpot } from './CityPlan';
import { hash2, mulberry32 } from './rng';

/** Unit icosahedron (12 verts, 20 faces), jittered per tree for organic canopies. */
const PHI = (1 + Math.sqrt(5)) / 2;
const ICO_V: Array<[number, number, number]> = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
].map(([x, y, z]) => {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l] as [number, number, number];
});
const ICO_F: Array<[number, number, number]> = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

const ID = new Frame();

function blob(B: KitBatch, x: number, y: number, z: number, rx: number, ry: number, rz: number, hex: number, seed: number): void {
  const r = mulberry32(seed);
  const pts = ICO_V.map(([a, b, c]) => {
    const j = 0.82 + r() * 0.36;
    return [x + a * rx * j, y + b * ry * j, z + c * rz * j] as [number, number, number];
  });
  const base = hex;
  for (let i = 0; i < ICO_F.length; i++) {
    const [a, b, c] = ICO_F[i]!;
    const k = 0.86 + ((i * 37) % 11) / 40;
    B.tri(ID, pts[a]!, pts[b]!, pts[c]!, scaleHex(base, k));
  }
}

function scaleHex(hex: number, k: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * k));
  const b = Math.min(255, Math.round((hex & 255) * k));
  return (r << 16) | (g << 8) | b;
}

const LEAF = [0x4c7a34, 0x56843a, 0x3f6b2e, 0x5f8d3f, 0x47723a];
const MANGO = [0x2f5a2a, 0x355f2c, 0x2a5226];
const TRUNK = 0x6b5a48;

/** Full-detail tree: trunk (kit) + foliage (leaf). */
export function buildTree(kit: KitBatch, leaf: KitBatch, t: TreeSpot): void {
  const seed = hash2(Math.round(t.x * 10), Math.round(t.z * 10), 17);
  const r = mulberry32(seed);
  const s = t.s;
  switch (t.kind) {
    case 0: {
      // coconut / royal palm: leaning segmented trunk, drooping fronds
      const h = (7 + r() * 5) * s;
      const lean = (r() - 0.5) * 0.18;
      const yaw = r() * Math.PI * 2;
      const lx = Math.cos(yaw) * lean;
      const lz = Math.sin(yaw) * lean;
      const segs = 4;
      for (let i = 0; i < segs; i++) {
        const y0 = (h / segs) * i;
        const f = new Frame(t.x + lx * y0, t.z + lz * y0, 0, 0);
        kit.cylinder(f, 0, y0, 0, 0.22 * s * (1 - i * 0.08), 0.2 * s * (1 - (i + 1) * 0.08), h / segs + 0.05, i % 2 ? 0x7a6a56 : TRUNK, 6, false);
      }
      const tx = t.x + lx * h;
      const tz = t.z + lz * h;
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r() * 0.3;
        const len = (3.2 + r() * 1.2) * s;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const mid: [number, number, number] = [tx + ca * len * 0.5, h + 0.5 * s, tz + sa * len * 0.5];
        const tip: [number, number, number] = [tx + ca * len, h - (1.4 + r()) * s, tz + sa * len];
        const w = 0.55 * s;
        const px = -sa * w;
        const pz = ca * w;
        const hex = LEAF[(i + (seed & 3)) % LEAF.length]!;
        const root: [number, number, number] = [tx, h, tz];
        leaf.tri(ID, root, [mid[0] + px, mid[1], mid[2] + pz], mid, hex);
        leaf.tri(ID, root, mid, [mid[0] - px, mid[1], mid[2] - pz], scaleHex(hex, 0.9));
        leaf.tri(ID, [mid[0] + px, mid[1], mid[2] + pz], tip, mid, hex);
        leaf.tri(ID, mid, tip, [mid[0] - px, mid[1], mid[2] - pz], scaleHex(hex, 0.9));
      }
      blob(leaf, tx, h - 0.2 * s, tz, 0.45 * s, 0.35 * s, 0.45 * s, 0x6b5a2a, seed + 1);
      return;
    }
    case 1: {
      const h = (3 + r() * 2) * s;
      kit.cylinder(new Frame(t.x, t.z), 0, 0, 0, 0.25 * s, 0.18 * s, h + 0.6, TRUNK, 6, false);
      const c = LEAF[seed % LEAF.length]!;
      const cr = (2.6 + r() * 1.2) * s;
      blob(leaf, t.x, h + cr * 0.6, t.z, cr, cr * 0.75, cr, c, seed);
      blob(leaf, t.x + cr * 0.45, h + cr * 0.4, t.z - cr * 0.3, cr * 0.65, cr * 0.55, cr * 0.65, scaleHex(c, 1.08), seed + 2);
      return;
    }
    case 2: {
      // mango: short trunk, huge dense dark dome — the Yaoundé courtyard tree
      const h = (2 + r()) * s;
      kit.cylinder(new Frame(t.x, t.z), 0, 0, 0, 0.35 * s, 0.26 * s, h + 0.8, TRUNK, 7, false);
      const cr = (3.6 + r() * 1.6) * s;
      const c = MANGO[seed % MANGO.length]!;
      blob(leaf, t.x, h + cr * 0.55, t.z, cr, cr * 0.7, cr, c, seed);
      blob(leaf, t.x - cr * 0.4, h + cr * 0.35, t.z + cr * 0.35, cr * 0.7, cr * 0.5, cr * 0.7, scaleHex(c, 1.1), seed + 3);
      return;
    }
    case 3: {
      const cr = (0.8 + r() * 0.7) * s;
      blob(leaf, t.x, cr * 0.6, t.z, cr * 1.2, cr * 0.75, cr, LEAF[(seed >> 2) % LEAF.length]!, seed);
      return;
    }
    default: {
      // banana / plantain clump
      const h = (2.2 + r() * 0.8) * s;
      kit.cylinder(new Frame(t.x, t.z), 0, 0, 0, 0.16 * s, 0.12 * s, h, 0x6f7f3a, 6, false);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + r();
        const len = (1.8 + r() * 0.6) * s;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const root: [number, number, number] = [t.x, h, t.z];
        const tip: [number, number, number] = [t.x + ca * len, h + (0.2 - r() * 0.8) * s, t.z + sa * len];
        const w = 0.45 * s;
        const m1: [number, number, number] = [t.x + ca * len * 0.5 - sa * w, h + 0.35 * s, t.z + sa * len * 0.5 + ca * w];
        const m2: [number, number, number] = [t.x + ca * len * 0.5 + sa * w, h + 0.35 * s, t.z + sa * len * 0.5 - ca * w];
        leaf.tri(ID, root, m1, tip, 0x6fa040);
        leaf.tri(ID, root, tip, m2, 0x5f9036);
      }
    }
  }
}

/** Distant tree: one canopy blob or palm star, no trunk detail. */
export function buildFarTree(leaf: KitBatch, t: TreeSpot): void {
  const seed = hash2(Math.round(t.x * 10), Math.round(t.z * 10), 17);
  const s = t.s;
  if (t.kind === 0) {
    const h = 9 * s;
    leaf.tri(ID, [t.x - 0.25, 0, t.z], [t.x + 0.25, 0, t.z], [t.x, h, t.z], TRUNK);
    blob(leaf, t.x, h, t.z, 3 * s, 1 * s, 3 * s, LEAF[seed % LEAF.length]!, seed);
    return;
  }
  if (t.kind === 3 || t.kind === 4) return;
  const cr = (t.kind === 2 ? 4.2 : 3) * s;
  const h = (t.kind === 2 ? 2.5 : 3.6) * s;
  blob(leaf, t.x, h + cr * 0.55, t.z, cr, cr * 0.75, cr, t.kind === 2 ? MANGO[0]! : LEAF[seed % LEAF.length]!, seed);
}
