import { FacadeBatch, Frame, KitBatch } from './Batch';
import { T, tileRect, type TileId } from './facadeAtlas';
import { SignBatch, signSlot, type SignStyle } from './kitMaterials';
import { hash2 } from './rng';
import { FOOD_SIGNS, SHOP_SIGNS } from './names';

const NAMES_POOL = [...SHOP_SIGNS, ...FOOD_SIGNS];

export const STOREY = 3.1;

export type Arch =
  | 'apartment'
  | 'shoprow'
  | 'house'
  | 'villa'
  | 'planks'
  | 'office'
  | 'hotel'
  | 'warehouse'
  | 'garage'
  | 'school'
  | 'church'
  | 'clinic'
  | 'unfinished'
  | 'market'
  | 'bank'
  | 'supermarket'
  | 'restaurant'
  | 'fuel'
  | 'civic';

export type Compound = {
  /** Local-frame rectangle (centre x/z, half sizes) around the building. */
  cx: number;
  cz: number;
  hw: number;
  hd: number;
  wall: number;
  gate: number;
  gateW: number;
  height: number;
};

export type BuildingPlan = {
  id: number;
  arch: Arch;
  x: number;
  z: number;
  yaw: number;
  w: number;
  d: number;
  floors: number;
  seed: number;
  paint: number;
  trim: number;
  roof: number;
  name?: string;
  signStyle?: SignStyle;
  shopGround: boolean;
  /** Paved apron in front of the facade (towards the street), metres. */
  apron: number;
  compound?: Compound;
  unfinishedTop?: boolean;
  /** Older, weathered or abandoned look. */
  old?: boolean;
};

export type Batches = {
  facade: FacadeBatch;
  kit: KitBatch;
  metal: KitBatch;
  tin: KitBatch;
  glow: KitBatch;
  ground: KitBatch;
  sign: SignBatch;
};

export function newBatches(): Batches {
  return {
    facade: new FacadeBatch(),
    kit: new KitBatch(),
    metal: new KitBatch(),
    tin: new KitBatch(),
    glow: new KitBatch(),
    ground: new KitBatch(),
    sign: new SignBatch(),
  };
}

export function heightOf(p: BuildingPlan): number {
  if (p.arch === 'warehouse' || p.arch === 'supermarket') return Math.max(6, p.floors * 3.6);
  if (p.arch === 'church') return 8.5;
  if (p.arch === 'market' || p.arch === 'garage' || p.arch === 'fuel') return 4.2;
  return p.floors * STOREY;
}

/** Deterministic per-plan decision k in [0, 1). */
function v(p: BuildingPlan, k: number): number {
  return (hash2(p.seed, k, 7) % 100000) / 100000;
}

function shade(hex: number, f: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((hex >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((hex >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((hex & 255) * f)));
  return (r << 16) | (g << 8) | b;
}

type Side = 0 | 1 | 2 | 3;
const SIDE_YAW = [0, Math.PI / 2, Math.PI, -Math.PI / 2] as const;

type FacadeSpec = {
  ground?: TileId[];
  upper: TileId[];
  side: TileId[];
  back: TileId[];
  /** Side walls touching neighbours get blank tiles. */
  sideGround?: TileId[];
};

/** One band of storeys on one side, grouped into runs of identical tiles. */
function band(
  B: Batches,
  f: Frame,
  p: BuildingPlan,
  side: Side,
  hw: number,
  hd: number,
  y0: number,
  floors: number,
  floorOffset: number,
  pattern: TileId[],
  storey = STOREY,
): void {
  if (floors <= 0 || !pattern.length) return;
  const width = side % 2 === 0 ? hw * 2 : hd * 2;
  const bays = Math.max(1, Math.round(width / 3.2));
  const bayW = width / bays;
  const yaw = SIDE_YAW[side];
  const start: [number, number] =
    side === 0 ? [-hw, hd] : side === 1 ? [hw, hd] : side === 2 ? [hw, -hd] : [-hw, -hd];
  const run: [number, number] = [Math.cos(yaw), -Math.sin(yaw)];
  const paint = p.old ? shade(p.paint, 0.82) : p.paint;
  let k = 0;
  while (k < bays) {
    const tile = pattern[k % pattern.length]!;
    let m = 1;
    while (k + m < bays && pattern[(k + m) % pattern.length] === tile) m++;
    const lx = start[0] + run[0] * bayW * k;
    const lz = start[1] + run[1] * bayW * k;
    B.facade.wall(f, yaw, lx, y0, lz, bayW * m, floors * storey, m, floors, tileRect(tile), paint, (p.seed % 997) + side * 0.17, floorOffset);
    k += m;
  }
}

function facades(B: Batches, f: Frame, p: BuildingPlan, hw: number, hd: number, floors: number, spec: FacadeSpec, storey = STOREY): void {
  const g = spec.ground ? 1 : 0;
  if (spec.ground) band(B, f, p, 0, hw, hd, 0, 1, 0, spec.ground, storey);
  band(B, f, p, 0, hw, hd, g * storey, floors - g, g, spec.upper, storey);
  const sg = spec.sideGround;
  for (const s of [1, 3] as const) {
    if (sg) {
      band(B, f, p, s, hw, hd, 0, 1, 0, sg, storey);
      band(B, f, p, s, hw, hd, storey, floors - 1, 1, spec.side, storey);
    } else band(B, f, p, s, hw, hd, 0, floors, 0, spec.side, storey);
  }
  band(B, f, p, 2, hw, hd, 0, floors, 0, spec.back, storey);
}

// ---------------------------------------------------------------------------
// Roofs

function flatRoof(B: Batches, f: Frame, p: BuildingPlan, hw: number, hd: number, h: number, base: boolean): void {
  const slab = p.old ? 0x5a5a56 : 0x7d7b76;
  if (base) {
    B.kit.box(f, 0, h + 0.05, 0, hw * 2 + 0.3, 0.1, hd * 2 + 0.3, slab);
    const par = shade(p.paint, 0.9);
    B.kit.box(f, 0, h + 0.45, hd + 0.05, hw * 2 + 0.3, 0.8, 0.2, par);
    B.kit.box(f, 0, h + 0.45, -hd - 0.05, hw * 2 + 0.3, 0.8, 0.2, par);
    B.kit.box(f, hw + 0.05, h + 0.45, 0, 0.2, 0.8, hd * 2, par);
    B.kit.box(f, -hw - 0.05, h + 0.45, 0, 0.2, 0.8, hd * 2, par);
  }
}

function roofProps(B: Batches, f: Frame, p: BuildingPlan, hw: number, hd: number, h: number): void {
  const tanks = 1 + Math.floor(v(p, 31) * 3);
  for (let i = 0; i < tanks; i++) {
    const tx = -hw + 1.2 + (i * 1.6) % Math.max(1, hw * 2 - 2.4);
    const tz = -hd + 1.4;
    // steel stand + black polyethylene tank (very common on Yaoundé roofs)
    for (const [ox, oz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]] as const) {
      B.metal.box(f, tx + ox, h + 0.6, tz + oz, 0.07, 1.2, 0.07, 0x55595c);
    }
    B.metal.box(f, tx, h + 1.22, tz, 1.1, 0.06, 1.1, 0x55595c);
    B.kit.cylinder(f, tx, h + 1.25, tz, 0.55, 0.5, 1.15, v(p, 32 + i) < 0.7 ? 0x1c1e20 : 0x2f5d8a, 10);
  }
  if (v(p, 40) < 0.55) {
    // satellite dish
    const dx = hw - 1;
    B.metal.box(f, dx, h + 0.5, hd - 1, 0.06, 1.0, 0.06, 0x8a8f92);
    B.metal.cylinder(f, dx, h + 0.95, hd - 0.9, 0.05, 0.42, 0.22, 0xd8d8d4, 10, false);
  }
  if (v(p, 41) < 0.5 && hw > 3 && hd > 3) {
    // stair access head-house
    B.kit.box(f, hw - 1.6, h + 1.2, -hd + 1.6, 2.6, 2.4, 2.6, shade(p.paint, 0.92));
    B.kit.box(f, hw - 1.6, h + 2.45, -hd + 1.6, 2.9, 0.12, 2.9, 0x6e6c68);
  }
  if (p.unfinishedTop) rebarGrid(B, f, hw, hd, h);
}

function rebarGrid(B: Batches, f: Frame, hw: number, hd: number, h: number): void {
  const nx = Math.max(2, Math.round((hw * 2) / 3.6));
  const nz = Math.max(2, Math.round((hd * 2) / 3.6));
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      if (i > 0 && i < nx - 1 && j > 0 && j < nz - 1) continue;
      const x = -hw + 0.3 + (i * (hw * 2 - 0.6)) / (nx - 1);
      const z = -hd + 0.3 + (j * (hd * 2 - 0.6)) / (nz - 1);
      B.kit.box(f, x, h + 0.25, z, 0.32, 0.5, 0.32, 0x8e8c86);
      for (const [ox, oz] of [[-0.09, -0.09], [0.09, -0.09], [-0.09, 0.09], [0.09, 0.09]] as const) {
        B.metal.box(f, x + ox, h + 1.05, z + oz, 0.025, 1.1, 0.025, 0x6b3c22);
      }
    }
  }
}

/** Corrugated gable roof, ridge along local X. */
function gableRoof(B: Batches, f: Frame, p: BuildingPlan, hw: number, hd: number, h: number, pitch = 0.42, over = 0.6): void {
  const rise = hd * pitch;
  const x0 = -hw - over;
  const x1 = hw + over;
  const zf = hd + over;
  const yb = h - over * pitch;
  B.tin.slab(f, [[x0, yb, zf], [x1, yb, zf], [x1, h + rise, 0], [x0, h + rise, 0]], p.roof, x1 - x0, Math.hypot(zf, rise));
  B.tin.slab(f, [[x1, yb, -zf], [x0, yb, -zf], [x0, h + rise, 0], [x1, h + rise, 0]], shade(p.roof, 0.95), x1 - x0, Math.hypot(zf, rise));
  const gc = p.old ? shade(p.paint, 0.8) : p.paint;
  B.kit.tri(f, [hw, h, hd], [hw, h, -hd], [hw, h + rise, 0], gc);
  B.kit.tri(f, [-hw, h, -hd], [-hw, h, hd], [-hw, h + rise, 0], gc);
  B.metal.box(f, 0, h + rise + 0.03, 0, x1 - x0, 0.08, 0.3, shade(p.roof, 0.8));
}

/** Corrugated hip roof (four slopes). */
function hipRoof(B: Batches, f: Frame, p: BuildingPlan, hw: number, hd: number, h: number, pitch = 0.45, over = 0.6): void {
  const ox = hw + over;
  const oz = hd + over;
  const rise = Math.min(ox, oz) * pitch;
  const ridge = Math.max(0, ox - oz);
  const top = h + rise;
  const yb = h - over * pitch * 0.5;
  const c = p.roof;
  B.tin.slab(f, [[-ox, yb, oz], [ox, yb, oz], [ridge, top, 0], [-ridge, top, 0]], c, ox * 2, oz);
  B.tin.slab(f, [[ox, yb, -oz], [-ox, yb, -oz], [-ridge, top, 0], [ridge, top, 0]], shade(c, 0.94), ox * 2, oz);
  B.tin.tri(f, [ox, yb, oz], [ox, yb, -oz], [ridge, top, 0], shade(c, 0.9));
  B.tin.tri(f, [-ox, yb, -oz], [-ox, yb, oz], [-ridge, top, 0], shade(c, 0.97));
  if (ridge > 0.05) B.metal.box(f, 0, top + 0.03, 0, ridge * 2, 0.08, 0.25, shade(c, 0.8));
}

/** Mono-pitch shed roof sloping to the back. */
function shedRoof(B: Batches, f: Frame, color: number, hw: number, hd: number, h: number, over = 0.5, rise = 0.6): void {
  B.tin.slab(f, [[-hw - over, h + rise, hd + over], [hw + over, h + rise, hd + over], [hw + over, h, -hd - over], [-hw - over, h, -hd - over]], color, hw * 2, hd * 2);
}

// ---------------------------------------------------------------------------
// Details

function balcony(B: Batches, f: Frame, x: number, y: number, z: number, w: number, color: number, metal: boolean): void {
  B.kit.box(f, x, y, z + 0.55, w, 0.16, 1.1, 0x8f8c86);
  if (metal) {
    B.metal.box(f, x, y + 0.95, z + 1.08, w, 0.05, 0.05, 0x2d3133);
    const n = Math.max(3, Math.round(w / 0.4));
    for (let i = 0; i <= n; i++) B.metal.box(f, x - w / 2 + (i * w) / n, y + 0.5, z + 1.08, 0.025, 0.9, 0.025, 0x2d3133);
    B.metal.box(f, x - w / 2, y + 0.5, z + 0.55, 0.04, 0.9, 1.1, 0x2d3133);
    B.metal.box(f, x + w / 2, y + 0.5, z + 0.55, 0.04, 0.9, 1.1, 0x2d3133);
  } else {
    B.kit.box(f, x, y + 0.5, z + 1.05, w, 0.85, 0.12, color);
  }
}

function awning(B: Batches, f: Frame, x: number, y: number, z: number, w: number, depth: number, color: number): void {
  B.tin.slab(f, [[x - w / 2, y - 0.35, z + depth], [x + w / 2, y - 0.35, z + depth], [x + w / 2, y, z], [x - w / 2, y, z]], color, w, depth);
  B.metal.box(f, x - w / 2 + 0.1, (y - 0.35) / 2, z + depth - 0.1, 0.06, y - 0.35, 0.06, 0x3a3d40);
  B.metal.box(f, x + w / 2 - 0.1, (y - 0.35) / 2, z + depth - 0.1, 0.06, y - 0.35, 0.06, 0x3a3d40);
}

function signBoard(B: Batches, f: Frame, x: number, y: number, z: number, w: number, h: number, text: string, style: SignStyle): void {
  B.kit.box(f, x, y, z + 0.08, w + 0.2, h + 0.16, 0.14, 0x25282a);
  const a = [0, 0, 0];
  const b = [0, 0, 0];
  const c = [0, 0, 0];
  const d = [0, 0, 0];
  const n = [0, 0, 0];
  f.apply(x - w / 2, y - h / 2, z + 0.16, a);
  f.apply(x + w / 2, y - h / 2, z + 0.16, b);
  f.apply(x + w / 2, y + h / 2, z + 0.16, c);
  f.apply(x - w / 2, y + h / 2, z + 0.16, d);
  f.dir(0, 1, n);
  B.sign.quad(a, b, c, d, n, signSlot(text, style));
}

const SIGN_STYLES: SignStyle[] = [
  { bg: '#0f2a22', fg: '#ffc857' },
  { bg: '#b71c1c', fg: '#ffffff' },
  { bg: '#0d47a1', fg: '#ffffff' },
  { bg: '#f9a825', fg: '#1a1a1a' },
  { bg: '#1b5e20', fg: '#ffffff' },
  { bg: '#ffffff', fg: '#c62828' },
  { bg: '#4a148c', fg: '#ffe082' },
  { bg: '#263238', fg: '#80deea' },
];

export function signStyleFor(seed: number | string): SignStyle {
  let s = 0;
  if (typeof seed === 'number') s = seed;
  else for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  return SIGN_STYLES[s % SIGN_STYLES.length]!;
}

/** Wall segments (local rects) of a compound; the gate gap is on the front (+Z) side. */
export function compoundSegments(c: Compound): Array<{ x: number; z: number; hw: number; hd: number }> {
  const t = 0.11;
  const segs: Array<{ x: number; z: number; hw: number; hd: number }> = [];
  segs.push({ x: c.cx, z: c.cz - c.hd, hw: c.hw, hd: t });
  segs.push({ x: c.cx - c.hw, z: c.cz, hw: t, hd: c.hd });
  segs.push({ x: c.cx + c.hw, z: c.cz, hw: t, hd: c.hd });
  const g0 = c.gate - c.gateW / 2;
  const g1 = c.gate + c.gateW / 2;
  const left = g0 - (c.cx - c.hw);
  const right = c.cx + c.hw - g1;
  if (left > 0.2) segs.push({ x: c.cx - c.hw + left / 2, z: c.cz + c.hd, hw: left / 2, hd: t });
  if (right > 0.2) segs.push({ x: g1 + right / 2, z: c.cz + c.hd, hw: right / 2, hd: t });
  return segs;
}

/** Wall bodies only: part of the base layer so compounds still read as compounds far away. */
export function compoundWallBase(B: Batches, p: BuildingPlan): void {
  const c = p.compound;
  if (!c) return;
  const f = new Frame(p.x, p.z, p.yaw);
  const wallC = p.old ? shade(c.wall, 0.8) : c.wall;
  for (const s of compoundSegments(c)) B.kit.box(f, s.x, c.height / 2, s.z, s.hw * 2, c.height, s.hd * 2, wallC);
}

/** Detail: wall caps, gate pillars, gate leaves, gate lamp. */
function compoundWall(B: Batches, f: Frame, p: BuildingPlan, c: Compound): void {
  const wallC = p.old ? shade(c.wall, 0.8) : c.wall;
  for (const s of compoundSegments(c)) {
    B.kit.box(f, s.x, c.height + 0.05, s.z, s.hw * 2 + 0.08, 0.1, s.hd * 2 + 0.08, shade(wallC, 0.82));
  }
  // gate pillars + steel gate leaves (one half open)
  const gz = c.cz + c.hd;
  const gate = 0x1d4d3a + (p.seed % 3) * 0x101010;
  const gx0 = c.gate - c.gateW / 2;
  const gx1 = c.gate + c.gateW / 2;
  B.kit.box(f, gx0 - 0.2, c.height / 2 + 0.15, gz, 0.4, c.height + 0.3, 0.4, shade(wallC, 0.9));
  B.kit.box(f, gx1 + 0.2, c.height / 2 + 0.15, gz, 0.4, c.height + 0.3, 0.4, shade(wallC, 0.9));
  const leaf = c.gateW / 2;
  B.metal.box(f, gx0 + leaf / 2, c.height * 0.48, gz, leaf, c.height * 0.9, 0.06, [0x1d4d3a, 0x6b1f1f, 0x1f3f6b, 0x2b2b2b][p.seed % 4]!);
  const open = new Frame();
  const hinge = [0, 0, 0];
  f.apply(gx1, 0, gz, hinge);
  open.x = hinge[0]!;
  open.z = hinge[2]!;
  open.yaw = f.yaw - 1.2;
  B.metal.box(open, -leaf / 2, c.height * 0.48, 0, leaf, c.height * 0.9, 0.06, gate);
  // lamp over the gate
  B.glow.box(f, c.gate, c.height + 0.35, gz + 0.1, 0.25, 0.18, 0.18, 0xffd9a0);
}

function apron(B: Batches, f: Frame, hw: number, hd: number, depth: number, color: number): void {
  if (depth < 0.4) return;
  B.ground.box(f, 0, 0.035, hd + depth / 2, hw * 2 + 0.6, 0.07, depth, color);
}

function steps(B: Batches, f: Frame, x: number, z: number, w: number, n: number, color: number): void {
  for (let i = 0; i < n; i++) B.kit.box(f, x, 0.09 + i * 0.17, z + (n - i) * 0.3 - 0.15, w, 0.18 + i * 0.17 * 0, 0.3, color);
}

function columns(B: Batches, f: Frame, hw: number, z: number, h: number, n: number, color: number, size = 0.32): void {
  for (let i = 0; i < n; i++) {
    const x = -hw + 0.3 + (i * (hw * 2 - 0.6)) / Math.max(1, n - 1);
    B.kit.box(f, x, h / 2, z, size, h, size, color);
  }
}

function floorBands(B: Batches, f: Frame, p: BuildingPlan, hw: number, hd: number, floors: number): void {
  const c = shade(p.paint, 0.8);
  for (let i = 1; i < floors; i++) B.kit.box(f, 0, i * STOREY - 0.05, hd + 0.06, hw * 2 + 0.12, 0.22, 0.14, c);
}

function acUnits(B: Batches, f: Frame, p: BuildingPlan, hw: number, hd: number, floors: number): void {
  const n = Math.floor(v(p, 50) * 4);
  for (let i = 0; i < n; i++) {
    const fl = 1 + Math.floor(v(p, 51 + i) * Math.max(1, floors - 1));
    const x = -hw + 1 + v(p, 60 + i) * (hw * 2 - 2);
    B.kit.box(f, x, fl * STOREY + 0.9, hd + 0.2, 0.8, 0.55, 0.32, 0xe4e4e0);
  }
}

function signName(p: BuildingPlan, fallback: string): string {
  return p.name ?? fallback;
}

// ---------------------------------------------------------------------------
// Archetypes. `base` = facades + roof shell (far LOD), otherwise = detail layer.

export function buildPlan(B: Batches, p: BuildingPlan, base: boolean): void {
  const f = new Frame(p.x, p.z, p.yaw);
  const hw = p.w / 2;
  const hd = p.d / 2;
  const h = heightOf(p);
  const style = p.signStyle ?? signStyleFor(p.name ?? p.seed);
  switch (p.arch) {
    case 'apartment': {
      const balc = v(p, 1) < 0.6;
      const pat: TileId[] = balc
        ? [T.RES_WINDOW, T.BALCONY_DOOR]
        : v(p, 2) < 0.5
          ? [T.RES_SHUTTER]
          : [T.RES_WINDOW, T.HOTEL_AC];
      const ground: TileId[] = p.shopGround ? [T.SHOP_SHUTTER, T.SHOP_GLASS, T.SHOP_SHUTTER, T.ENTRANCE] : [T.RES_WINDOW, T.ENTRANCE];
      if (base) {
        facades(B, f, p, hw, hd, p.floors, {
          ground,
          upper: pat,
          side: v(p, 3) < 0.5 ? [T.SMALL_WINDOW, T.RES_WINDOW] : [T.BLANK, T.SMALL_WINDOW],
          back: [T.RES_WINDOW, T.SMALL_WINDOW],
        });
        flatRoof(B, f, p, hw, hd, h, true);
        return;
      }
      floorBands(B, f, p, hw, hd, p.floors);
      if (balc) {
        const bays = Math.max(1, Math.round((hw * 2) / 3.2));
        const bw = (hw * 2) / bays;
        for (let k = 1; k < bays; k += 2) {
          for (let fl = 1; fl < p.floors; fl++) balcony(B, f, -hw + bw * (k + 0.5), fl * STOREY + 0.08, hd, bw * 0.92, p.paint, v(p, 4) < 0.6);
        }
      }
      acUnits(B, f, p, hw, hd, p.floors);
      roofProps(B, f, p, hw, hd, h);
      if (p.shopGround) {
        signBoard(B, f, 0, STOREY - 0.45, hd, Math.min(hw * 1.6, 9), 0.75, signName(p, 'Boutique'), style);
        if (v(p, 5) < 0.6) awning(B, f, 0, 2.55, hd + 0.05, hw * 1.8, 1.6, [0x9c3326, 0x2f6b4a, 0x2e5b8a, 0xb8860b][p.seed % 4]!);
      }
      apron(B, f, hw, hd, p.apron, p.shopGround ? 0xa7a49c : 0x8b8478);
      if (!p.shopGround) steps(B, f, 0, hd, 2.2, 2, 0x9a978f);
      if (p.compound) compoundWall(B, f, p, p.compound);
      return;
    }
    case 'shoprow': {
      const units = Math.max(1, Math.round(p.w / 5));
      const uw = p.w / units;
      if (base) {
        facades(B, f, p, hw, hd, p.floors, {
          ground: [T.SHOP_SHUTTER, T.SHOP_GLASS],
          upper: [T.RES_WINDOW, T.RES_SHUTTER],
          side: [T.BLANK],
          back: [T.SMALL_WINDOW, T.BLANK],
        });
        if (p.floors >= 2 || v(p, 6) < 0.5) flatRoof(B, f, p, hw, hd, h, true);
        else shedRoof(B, f, p.roof, hw, hd, h);
        return;
      }
      for (let i = 0; i < units; i++) {
        const x = -hw + uw * (i + 0.5);
        const name = i === 0 ? signName(p, 'Boutique') : NAMES_POOL[(p.seed + i * 7) % NAMES_POOL.length]!;
        signBoard(B, f, x, STOREY - 0.45, hd, uw * 0.88, 0.7, name, signStyleFor(name));
        if (v(p, 70 + i) < 0.7) awning(B, f, x, 2.5, hd + 0.05, uw * 0.96, 1.5 + v(p, 80 + i) * 0.6, [0x9c3326, 0x2f6b4a, 0x2e5b8a, 0xb8860b, 0x9aa3a8][(p.seed + i) % 5]!);
      }
      if (p.floors >= 2) floorBands(B, f, p, hw, hd, p.floors);
      if (p.floors >= 2 || v(p, 6) < 0.5) roofProps(B, f, p, hw, hd, h);
      apron(B, f, hw, hd, p.apron, 0xa39f96);
      return;
    }
    case 'house': {
      if (base) {
        facades(B, f, p, hw, hd, p.floors, {
          upper: v(p, 7) < 0.5 ? [T.RES_SHUTTER, T.RES_WINDOW] : [T.RES_WINDOW],
          side: [T.RES_WINDOW, T.SMALL_WINDOW],
          back: [T.SMALL_WINDOW, T.RES_SHUTTER],
        });
        if (v(p, 8) < 0.6) hipRoof(B, f, p, hw, hd, h);
        else gableRoof(B, f, p, hw, hd, h);
        return;
      }
      // veranda: slab, columns, steps
      B.kit.box(f, 0, 0.12, hd + 1.1, hw * 1.6, 0.24, 2.2, 0x9d978d);
      columns(B, f, hw * 0.78, hd + 2.0, h - 0.3, 3 + (p.seed % 2), shade(p.paint, 0.95), 0.26);
      B.tin.slab(f, [[-hw * 0.82, h - 0.4, hd + 2.3], [hw * 0.82, h - 0.4, hd + 2.3], [hw * 0.82, h - 0.05, hd], [-hw * 0.82, h - 0.05, hd]], p.roof, hw * 1.6, 2.3);
      steps(B, f, 0, hd + 2.2, 1.8, 2, 0x9d978d);
      if (p.compound) compoundWall(B, f, p, p.compound);
      if (v(p, 9) < 0.5) {
        // clothes line + plastic chairs in the yard
        const cz = p.compound ? p.compound.cz - p.compound.hd + 1.4 : -hd - 1.4;
        B.metal.box(f, -hw + 0.5, 0.9, cz, 0.05, 1.8, 0.05, 0x666666);
        B.metal.box(f, hw - 0.5, 0.9, cz, 0.05, 1.8, 0.05, 0x666666);
        B.metal.box(f, 0, 1.75, cz, hw * 2 - 1, 0.02, 0.02, 0x666666);
        for (let i = 0; i < 4; i++) B.kit.box(f, -hw + 1.4 + i * 1.3, 1.45, cz, 0.7, 0.6, 0.02, [0xc0392b, 0xf1c40f, 0x2980b9, 0xecf0f1][i]!);
      }
      return;
    }
    case 'villa': {
      if (base) {
        facades(B, f, p, hw, hd, p.floors, {
          upper: [T.RES_WINDOW, T.BALCONY_DOOR, T.RES_WINDOW],
          side: [T.RES_WINDOW],
          back: [T.RES_WINDOW, T.SMALL_WINDOW],
        });
        if (v(p, 10) < 0.65) hipRoof(B, f, p, hw, hd, h, 0.5, 0.8);
        else flatRoof(B, f, p, hw, hd, h, true);
        return;
      }
      floorBands(B, f, p, hw, hd, p.floors);
      if (p.floors > 1) balcony(B, f, 0, STOREY + 0.08, hd, hw * 0.9, p.paint, false);
      columns(B, f, hw * 0.4, hd + 1.0, STOREY, 2, 0xf2efe8, 0.34);
      B.kit.box(f, 0, STOREY + 0.02, hd + 0.6, hw * 0.9, 0.18, 1.6, 0xd9d4ca);
      if (p.compound) {
        compoundWall(B, f, p, p.compound);
        // guard booth beside the gate
        const c = p.compound;
        B.kit.box(f, c.gate + c.gateW / 2 + 1.4, 1.2, c.cz + c.hd - 1.2, 1.6, 2.4, 1.6, 0xe9e4d8);
        B.tin.slab(f, [[c.gate + c.gateW / 2 + 0.4, 2.55, c.cz + c.hd - 0.2], [c.gate + c.gateW / 2 + 2.4, 2.55, c.cz + c.hd - 0.2], [c.gate + c.gateW / 2 + 2.4, 2.45, c.cz + c.hd - 2.2], [c.gate + c.gateW / 2 + 0.4, 2.45, c.cz + c.hd - 2.2]], p.roof, 2, 2);
        B.ground.box(f, c.gate, 0.03, (c.cz + c.hd + hd) / 2, c.gateW, 0.06, Math.max(0.5, c.cz + c.hd - hd), 0x8c8c86);
      }
      if (h < 7) roofProps(B, f, { ...p, unfinishedTop: false }, hw * 0.5, hd * 0.5, h);
      return;
    }
    case 'planks': {
      if (base) {
        facades(B, f, p, hw, hd, 1, { upper: [T.PLANKS], side: [T.PLANKS], back: [T.PLANKS] }, 2.7);
        shedRoof(B, f, p.roof, hw, hd, 2.7, 0.4, 0.5);
        return;
      }
      // stones holding down the sheets
      for (let i = 0; i < 3; i++) B.kit.box(f, -hw + 0.8 + i * hw * 0.8, 3.15 - i * 0.05, 0.2 * i, 0.3, 0.22, 0.3, 0x6c6a64);
      B.kit.box(f, 0, 0.1, hd + 0.5, hw * 1.2, 0.2, 1, 0x6e5a44);
      return;
    }
    case 'office':
    case 'bank': {
      const glass = p.arch === 'office' && v(p, 11) < 0.6;
      if (base) {
        facades(B, f, p, hw, hd, p.floors, {
          ground: [T.SHOP_GLASS, T.ENTRANCE, T.SHOP_GLASS],
          upper: glass ? [T.OFFICE_GLASS] : [T.OFFICE_RIBBON],
          side: glass ? [T.OFFICE_GLASS] : [T.OFFICE_RIBBON],
          back: glass ? [T.OFFICE_GLASS] : [T.OFFICE_RIBBON, T.BLANK],
        });
        flatRoof(B, f, p, hw, hd, h, true);
        return;
      }
      // entrance canopy + pylons
      B.kit.box(f, 0, 3.4, hd + 1.6, Math.min(hw * 1.2, 8), 0.3, 3.2, 0x3d4246);
      B.metal.box(f, -Math.min(hw * 0.55, 3.6), 1.7, hd + 3, 0.16, 3.4, 0.16, 0x9aa0a4);
      B.metal.box(f, Math.min(hw * 0.55, 3.6), 1.7, hd + 3, 0.16, 3.4, 0.16, 0x9aa0a4);
      B.glow.box(f, 0, 3.24, hd + 1.6, Math.min(hw * 1.1, 7.4), 0.04, 2.8, 0xfff0d0);
      // rooftop plant + mast
      B.metal.box(f, -hw * 0.3, h + 0.9, 0, hw * 0.6, 1.6, hd * 0.6, 0x9ea4a6);
      B.metal.box(f, hw * 0.4, h + 3, -hd * 0.4, 0.12, 6, 0.12, 0xb0b5b8);
      B.glow.box(f, hw * 0.4, h + 6.05, -hd * 0.4, 0.25, 0.25, 0.25, 0xff3b30);
      signBoard(B, f, 0, h - 0.9, hd + 0.02, Math.min(hw * 1.5, 12), 1.1, signName(p, 'Centre d’Affaires'), style);
      if (p.arch === 'bank') {
        B.kit.box(f, hw - 1.2, 1.1, hd + 0.2, 0.9, 1.8, 0.4, 0x303438);
        B.glow.box(f, hw - 1.2, 1.35, hd + 0.42, 0.5, 0.35, 0.02, 0x7fd0ff);
      }
      apron(B, f, hw, hd, p.apron, 0xb3aea4);
      steps(B, f, 0, hd, 4, 3, 0xbab5aa);
      return;
    }
    case 'hotel': {
      if (base) {
        facades(B, f, p, hw, hd, p.floors, {
          ground: [T.SHOP_GLASS, T.ENTRANCE, T.SHOP_GLASS],
          upper: [T.HOTEL_AC, T.BALCONY_DOOR],
          side: [T.HOTEL_AC, T.BLANK],
          back: [T.HOTEL_AC],
        });
        flatRoof(B, f, p, hw, hd, h, true);
        return;
      }
      floorBands(B, f, p, hw, hd, p.floors);
      const bays = Math.max(1, Math.round((hw * 2) / 3.2));
      const bw = (hw * 2) / bays;
      for (let k = 1; k < bays; k += 2) for (let fl = 1; fl < p.floors; fl++) balcony(B, f, -hw + bw * (k + 0.5), fl * STOREY + 0.08, hd, bw * 0.9, p.paint, true);
      B.kit.box(f, 0, 3.5, hd + 2.2, 7, 0.35, 4.4, 0x2f3437);
      B.glow.box(f, 0, 3.3, hd + 2.2, 6.6, 0.05, 4, 0xffe0b0);
      for (const x of [-3.2, 3.2]) B.kit.box(f, x, 1.7, hd + 4.1, 0.3, 3.4, 0.3, 0xe8e2d6);
      // flagpoles
      for (let i = 0; i < 3; i++) {
        B.metal.box(f, -hw + 1 + i * 1.2, 4, hd + 5, 0.08, 8, 0.08, 0xc8ccce);
        B.kit.box(f, -hw + 1.55 + i * 1.2, 7.4, hd + 5, 1.0, 0.65, 0.02, [0x007a3d, 0xce1126, 0xfcd116][i]!);
      }
      signBoard(B, f, 0, h + 1.2, hd - 0.4, Math.min(hw * 1.6, 12), 1.4, signName(p, 'Hôtel'), { bg: '#1a1a1a', fg: '#ffd27a' });
      roofProps(B, f, p, hw, hd, h);
      apron(B, f, hw, hd, p.apron, 0xb7b2a8);
      return;
    }
    case 'warehouse': {
      const ch = h;
      if (base) {
        facades(B, f, p, hw, hd, 1, { upper: [T.CORRUGATED, T.GARAGE, T.CORRUGATED], side: [T.CORRUGATED], back: [T.CORRUGATED] }, ch);
        gableRoof(B, f, p, hw, hd, ch, 0.18, 0.4);
        return;
      }
      if (p.compound) compoundWall(B, f, p, p.compound);
      const yard = p.compound ? p.compound.cz + p.compound.hd - 3 : hd + 3;
      for (let i = 0; i < 2; i++) {
        if (v(p, 90 + i) < 0.5) continue;
        const cx = -hw + 3 + i * 7;
        B.metal.box(f, cx, 1.3, yard, 6, 2.6, 2.4, [0x8b2f23, 0x2f5f8b, 0x2f7b4b, 0xb9862f][(p.seed + i) % 4]!);
      }
      signBoard(B, f, 0, ch - 0.8, hd, Math.min(hw * 1.2, 10), 0.9, signName(p, 'Entrepôt'), style);
      apron(B, f, hw, hd, Math.min(p.apron, 6), 0x7d7a73);
      return;
    }
    case 'garage': {
      if (base) {
        // back wall only, open shed
        band(B, f, p, 2, hw, hd, 0, 1, 0, [T.BLOCKWORK], h);
        band(B, f, p, 1, hw, hd, 0, 1, 0, [T.BLANK], h);
        band(B, f, p, 3, hw, hd, 0, 1, 0, [T.BLANK], h);
        shedRoof(B, f, p.roof, hw, hd, h, 0.6, 0.5);
        return;
      }
      columns(B, f, hw, hd, h, 3, 0x6d6a64, 0.2);
      for (let i = 0; i < 3; i++) B.kit.cylinder(f, hw - 0.8, 0.12 + i * 0.24, hd + 0.6, 0.38, 0.38, 0.22, 0x161616, 10);
      for (let i = 0; i < 3; i++) B.kit.cylinder(f, hw - 1.7, 0.12 + i * 0.24, hd + 0.9, 0.36, 0.36, 0.22, 0x161616, 10);
      B.kit.cylinder(f, -hw + 0.8, 0, hd - 0.6, 0.3, 0.3, 0.9, 0x2b4f7c, 10);
      // car shell on blocks
      B.metal.box(f, -0.6, 0.85, -0.3, 1.8, 0.7, 4.0, [0xb0b4b6, 0x7a1f1f, 0x23436b][p.seed % 3]!);
      B.metal.box(f, -0.6, 1.4, -0.6, 1.6, 0.5, 2.1, 0x2b3134);
      signBoard(B, f, 0, h + 0.6, hd + 0.4, Math.min(hw * 1.6, 8), 0.8, signName(p, 'Garage'), style);
      B.ground.box(f, 0, 0.03, 0, p.w, 0.06, p.d, 0x4a4844);
      apron(B, f, hw, hd, p.apron, 0x5a5650);
      return;
    }
    case 'school': {
      if (base) {
        facades(B, f, p, hw, hd, p.floors, { upper: [T.RES_WINDOW], side: [T.BLANK], back: [T.RES_WINDOW] });
        hipRoof(B, f, p, hw + 1.8 * 0, hd + 1.4, h, 0.32, 0.4);
        return;
      }
      // front gallery: columns, corridor slab, railing
      for (let fl = 0; fl < p.floors; fl++) {
        const y = fl * STOREY;
        if (fl > 0) {
          B.kit.box(f, 0, y + 0.06, hd + 1.0, p.w, 0.16, 2.0, 0xa6a196);
          B.kit.box(f, 0, y + 0.55, hd + 1.95, p.w, 0.9, 0.12, p.paint);
        }
      }
      columns(B, f, hw, hd + 1.9, h, Math.max(3, Math.round(p.w / 3.4)), shade(p.paint, 0.9), 0.3);
      if (p.compound) compoundWall(B, f, p, p.compound);
      // flag of Cameroon on a pole in the yard
      const fz = hd + 5;
      B.metal.box(f, hw - 2, 3.5, fz, 0.08, 7, 0.08, 0xd0d4d6);
      B.kit.box(f, hw - 2 + 0.35, 6.4, fz, 0.6, 1.2, 0.03, 0x007a3d);
      B.kit.box(f, hw - 2 + 0.95, 6.4, fz, 0.6, 1.2, 0.03, 0xce1126);
      B.kit.box(f, hw - 2 + 1.55, 6.4, fz, 0.6, 1.2, 0.03, 0xfcd116);
      B.kit.box(f, hw - 2 + 0.95, 6.4, fz + 0.02, 0.18, 0.18, 0.03, 0xfcd116);
      signBoard(B, f, 0, h + 0.2, hd + 2.0, Math.min(p.w * 0.6, 12), 0.9, signName(p, 'École'), { bg: '#ffffff', fg: '#0d47a1' });
      B.ground.box(f, 0, 0.03, hd + 6, p.w, 0.06, 8, 0x9a7b5c);
      return;
    }
    case 'church': {
      if (base) {
        facades(B, f, p, hw, hd, 1, { upper: [T.ENTRANCE], side: [T.ARCH], back: [T.BLANK] }, h);
        gableRoof(B, f, p, hw, hd, h, 0.7, 0.5);
        // bell tower
        B.kit.box(f, 0, (h + 6) / 2, hd + 1.5, 3.4, h + 6, 3.4, p.paint);
        hipRoof(B, f, { ...p, roof: 0x7a2a1f }, 1.7, 1.7, h + 6, 1.4, 0.2);
        return;
      }
      B.kit.box(f, 0, h + 9.2, hd + 1.5, 0.18, 1.8, 0.18, 0xf0f0f0);
      B.kit.box(f, 0, h + 9.5, hd + 1.5, 1.0, 0.18, 0.18, 0xf0f0f0);
      B.glow.box(f, 0, h + 3.2, hd + 3.25, 1.2, 1.2, 0.05, 0xffe9b0);
      signBoard(B, f, 0, 3.2, hd + 3.25, 5, 0.6, signName(p, 'Paroisse'), { bg: '#f5f5f0', fg: '#5d4037' });
      if (p.compound) compoundWall(B, f, p, p.compound);
      apron(B, f, hw, hd + 3.2, p.apron, 0xb0a99c);
      return;
    }
    case 'clinic': {
      if (base) {
        facades(B, f, p, hw, hd, p.floors, {
          ground: [T.SHOP_GLASS, T.ENTRANCE, T.SHOP_GLASS],
          upper: [T.RES_WINDOW, T.SMALL_WINDOW],
          side: [T.SMALL_WINDOW],
          back: [T.SMALL_WINDOW],
        });
        flatRoof(B, f, p, hw, hd, h, true);
        return;
      }
      // green pharmacy cross, backlit at night
      const cx = hw - 1.2;
      B.metal.box(f, cx, STOREY + 0.6, hd + 0.6, 0.06, 0.06, 1.2, 0x555555);
      B.glow.box(f, cx, STOREY + 0.6, hd + 1.2, 0.3, 1.1, 0.16, 0x10c050);
      B.glow.box(f, cx, STOREY + 0.6, hd + 1.2, 1.1, 0.3, 0.16, 0x10c050);
      signBoard(B, f, -0.8, STOREY - 0.45, hd, Math.min(hw * 1.4, 8), 0.7, signName(p, 'Pharmacie'), { bg: '#ffffff', fg: '#1b7f3a' });
      floorBands(B, f, p, hw, hd, p.floors);
      roofProps(B, f, p, hw, hd, h);
      apron(B, f, hw, hd, p.apron, 0xb8b3a9);
      return;
    }
    case 'unfinished': {
      const built = Math.max(1, Math.floor(p.floors * (0.4 + v(p, 12) * 0.5)));
      if (base) {
        // lower storeys walled in breeze blocks, upper storeys bare frame
        facades(B, f, p, hw, hd, built, { upper: [T.BLOCKWORK], side: [T.BLOCKWORK], back: [T.BLOCKWORK] });
        for (let fl = 1; fl <= p.floors; fl++) B.kit.box(f, 0, fl * STOREY - 0.1, 0, p.w + 0.3, 0.2, p.d + 0.3, 0x8f8d87);
        const nx = Math.max(2, Math.round(p.w / 3.6));
        const nz = Math.max(2, Math.round(p.d / 3.6));
        for (let i = 0; i < nx; i++) {
          for (let j = 0; j < nz; j++) {
            const x = -hw + 0.2 + (i * (p.w - 0.4)) / (nx - 1);
            const z = -hd + 0.2 + (j * (p.d - 0.4)) / (nz - 1);
            B.kit.box(f, x, (p.floors * STOREY) / 2, z, 0.3, p.floors * STOREY, 0.3, 0x96948e);
          }
        }
        return;
      }
      rebarGrid(B, f, hw, hd, p.floors * STOREY);
      // scaffolding poles + planks, sand, blocks, mixer
      for (let i = 0; i < 4; i++) B.kit.box(f, -hw + 0.6 + i * (p.w - 1.2) / 3, (built * STOREY) / 2 + 0.5, hd + 0.9, 0.09, built * STOREY + 1, 0.09, 0x8a6a44);
      for (let fl = 1; fl <= built; fl++) B.kit.box(f, 0, fl * STOREY - 0.6, hd + 0.9, p.w, 0.05, 0.5, 0x9a7a52);
      B.kit.cylinder(f, hw + 1.5, 0, hd + 2.4, 1.6, 0.1, 1.1, 0xc9a66b, 10, false);
      for (let i = 0; i < 3; i++) B.kit.box(f, -hw + 1 + i * 0.5, 0.2 + (i % 2) * 0.4, hd + 2.6, 1.2, 0.4, 0.8, 0x9b9993);
      B.metal.cylinder(f, -hw - 1.3, 0.5, hd + 2.2, 0.55, 0.45, 0.9, 0xd4a017, 10);
      B.ground.box(f, 0, 0.03, hd + 1.8, p.w + 4, 0.06, 4.5, 0x8a7356);
      return;
    }
    case 'market': {
      // sheds: posts + shed roofs over stall tables, no solid facades
      const rows = Math.max(1, Math.round(p.d / 5));
      const cols = Math.max(1, Math.round(p.w / 4));
      const rw = p.d / rows;
      const cw = p.w / cols;
      if (base) {
        for (let r = 0; r < rows; r++) {
          const z = -hd + rw * (r + 0.5);
          const g = new Frame(p.x, p.z, p.yaw);
          shedRoofAt(B, g, p.roof, 0, z, hw, rw * 0.42, 2.9);
        }
        return;
      }
      for (let r = 0; r < rows; r++) {
        const z = -hd + rw * (r + 0.5);
        for (let c = 0; c <= cols; c++) B.metal.box(f, -hw + c * cw, 1.45, z + rw * 0.4, 0.08, 2.9, 0.08, 0x5a4a3a);
        for (let c = 0; c < cols; c++) {
          const x = -hw + cw * (c + 0.5);
          B.kit.box(f, x, 0.45, z, cw * 0.85, 0.9, rw * 0.45, 0x7b5a3c);
          for (let k = 0; k < 3; k++) B.kit.box(f, x - cw * 0.25 + k * cw * 0.25, 1.0, z, cw * 0.18, 0.2, rw * 0.3, [0xd35400, 0xf1c40f, 0x27ae60, 0xc0392b, 0x8e44ad][(c + k + r) % 5]!);
        }
      }
      B.ground.box(f, 0, 0.03, 0, p.w + 2, 0.06, p.d + 2, 0x7d6a55);
      if (p.name) signBoard(B, f, 0, 3.6, hd + 0.6, Math.min(p.w * 0.6, 10), 0.8, p.name, style);
      return;
    }
    case 'supermarket': {
      if (base) {
        facades(B, f, p, hw, hd, 1, { upper: [T.SHOP_GLASS, T.ENTRANCE, T.SHOP_GLASS, T.SHOP_GLASS], side: [T.BLANK], back: [T.BLANK, T.GARAGE] }, h);
        flatRoof(B, f, p, hw, hd, h, true);
        return;
      }
      signBoard(B, f, 0, h - 1.0, hd, Math.min(p.w * 0.7, 18), 1.6, signName(p, 'Supermarché'), style);
      B.kit.box(f, 0, 3.6, hd + 1.4, p.w * 0.5, 0.3, 2.8, 0x2c3135);
      B.glow.box(f, 0, 3.42, hd + 1.4, p.w * 0.48, 0.04, 2.6, 0xfff2d6);
      roofProps(B, f, { ...p, unfinishedTop: false }, hw, hd, h);
      // parking lot with bay lines
      const depth = Math.max(4, p.apron);
      B.ground.box(f, 0, 0.03, hd + depth / 2, p.w + 2, 0.06, depth, 0x45484b);
      const bays = Math.floor(p.w / 2.6);
      for (let i = 0; i <= bays; i++) B.ground.box(f, -hw + i * 2.6, 0.065, hd + depth - 3, 0.12, 0.02, 5, 0xe8e8e2);
      return;
    }
    case 'restaurant': {
      if (base) {
        facades(B, f, p, hw, hd, p.floors, { ground: [T.SHOP_GLASS, T.ENTRANCE], upper: [T.RES_SHUTTER], side: [T.BLANK, T.SMALL_WINDOW], back: [T.SMALL_WINDOW] });
        if (p.floors > 1) flatRoof(B, f, p, hw, hd, h, true);
        else shedRoof(B, f, p.roof, hw, hd, h);
        return;
      }
      signBoard(B, f, 0, STOREY - 0.45, hd, Math.min(hw * 1.6, 9), 0.8, signName(p, 'Restaurant'), style);
      // terrace: tin roof on posts, plastic tables + chairs, string lights
      const td = Math.min(4, p.apron - 0.5);
      if (td > 1.5) {
        awning(B, f, 0, 2.7, hd + 0.05, p.w, td, p.roof);
        const n = Math.max(1, Math.floor(p.w / 2.6));
        for (let i = 0; i < n; i++) {
          const x = -hw + 1.3 + i * 2.6;
          B.kit.box(f, x, 0.72, hd + td * 0.55, 0.9, 0.05, 0.9, 0xf2f2f2);
          B.kit.box(f, x, 0.36, hd + td * 0.55, 0.06, 0.72, 0.06, 0xf2f2f2);
          for (const dx of [-0.6, 0.6]) B.kit.box(f, x + dx, 0.45, hd + td * 0.55, 0.42, 0.9, 0.42, [0xd32f2f, 0x1976d2, 0xf2f2f2][(p.seed + i) % 3]!);
        }
        for (let i = 0; i < Math.round(p.w / 0.8); i++) B.glow.box(f, -hw + 0.4 + i * 0.8, 2.25, hd + td - 0.15, 0.08, 0.08, 0.08, [0xffd166, 0xef476f, 0x06d6a0][i % 3]!);
      }
      apron(B, f, hw, hd, p.apron, 0x9e9a91);
      return;
    }
    case 'fuel': {
      if (base) {
        facades(B, f, { ...p }, hw * 0.45, hd * 0.4, 1, { upper: [T.SHOP_GLASS, T.ENTRANCE], side: [T.BLANK], back: [T.BLANK] });
        flatRoof(B, f, p, hw * 0.45, hd * 0.4, STOREY, true);
        return;
      }
      // canopy forward of the kiosk
      const cz = hd * 0.4 + 5;
      B.kit.box(f, 0, 5.2, cz, p.w * 0.9, 0.6, 8, 0xf2f2f0);
      B.kit.box(f, 0, 5.2, cz + 4.02, p.w * 0.9, 0.6, 0.06, 0xc62828);
      B.glow.box(f, 0, 4.88, cz, p.w * 0.85, 0.04, 7.4, 0xfff6e0);
      for (const x of [-p.w * 0.3, p.w * 0.3]) for (const z of [cz - 2.5, cz + 2.5]) B.kit.box(f, x, 2.45, z, 0.4, 4.9, 0.4, 0xd8d8d4);
      for (const x of [-p.w * 0.18, p.w * 0.18]) {
        B.kit.box(f, x, 0.15, cz, 1.4, 0.3, 4.4, 0xb7b2a8);
        for (const z of [cz - 1.2, cz + 1.2]) {
          B.kit.box(f, x, 1.05, z, 0.7, 1.5, 0.45, 0xe8e8e4);
          B.glow.box(f, x, 1.45, z + 0.24, 0.4, 0.22, 0.02, 0x9be7ff);
        }
      }
      // price pylon
      B.kit.box(f, hw - 0.8, 3.2, hd + 0.4, 1.4, 6.4, 0.35, 0xc62828);
      signBoard(B, f, hw - 0.8, 5.6, hd + 0.4, 1.2, 0.6, signName(p, 'Kamer Petrol'), { bg: '#c62828', fg: '#ffffff' });
      B.ground.box(f, 0, 0.03, cz, p.w + 2, 0.06, 12, 0x5d6063);
      return;
    }
    case 'civic': {
      if (base) {
        facades(B, f, p, hw, hd, p.floors, { ground: [T.RES_WINDOW, T.ENTRANCE, T.RES_WINDOW], upper: [T.RES_WINDOW], side: [T.RES_WINDOW], back: [T.SMALL_WINDOW] });
        hipRoof(B, f, p, hw, hd, h, 0.3, 0.6);
        return;
      }
      columns(B, f, hw * 0.5, hd + 1.4, STOREY, 4, 0xf4f1ea, 0.4);
      B.kit.box(f, 0, STOREY + 0.1, hd + 0.8, hw, 0.25, 2, 0xe0dbd0);
      steps(B, f, 0, hd + 1.6, hw, 3, 0xc8c2b6);
      const fz = hd + 4;
      B.metal.box(f, 0, 4, fz, 0.08, 8, 0.08, 0xd0d4d6);
      B.kit.box(f, 0.35, 7.4, fz, 0.6, 1.2, 0.03, 0x007a3d);
      B.kit.box(f, 0.95, 7.4, fz, 0.6, 1.2, 0.03, 0xce1126);
      B.kit.box(f, 1.55, 7.4, fz, 0.6, 1.2, 0.03, 0xfcd116);
      signBoard(B, f, 0, h - 0.6, hd + 0.02, Math.min(hw * 1.5, 12), 0.9, signName(p, 'Mairie'), { bg: '#0d3b66', fg: '#ffffff' });
      if (p.compound) compoundWall(B, f, p, p.compound);
      apron(B, f, hw, hd, p.apron, 0xb6b0a4);
      return;
    }
  }
}

function shedRoofAt(B: Batches, f: Frame, color: number, x: number, z: number, hw: number, hd: number, h: number): void {
  B.tin.slab(f, [[x - hw - 0.3, h + 0.4, z + hd + 0.3], [x + hw + 0.3, h + 0.4, z + hd + 0.3], [x + hw + 0.3, h, z - hd - 0.3], [x - hw - 0.3, h, z - hd - 0.3]], color, hw * 2, hd * 2);
}
