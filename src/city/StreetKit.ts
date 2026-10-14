import { Frame, KitBatch } from './Batch';
import type { Batches } from './BuildingKit';
import type { CityPlan, Zone } from './CityPlan';
import { CHUNK } from './CityPlan';
import { gridAxes, isAvenueAxis, isHighwayAxisX, isHighwayAxisZ } from '../roads/CityRoadPlan';
import { hasSignal, roadOpen } from './signals';
import { hash2, mulberry32, pick, range } from './rng';
import { isFree } from './Occupancy';
import { AD_SIGNS } from './names';
import { signSlot } from './kitMaterials';
import type { CollisionSystem } from '../world/CollisionSystem';

export type ChunkBatches = Batches & {
  leaf: KitBatch;
  asphalt: KitBatch;
  walk: KitBatch;
  grass: KitBatch;
  pool: KitBatch;
  signal: KitBatch;
};

/** Visible asphalt half-width (RoadBuilder widths: highway 28, avenue 16, street 11). */
export function asphaltHalf(axis: number, highway: boolean): number {
  if (highway) return 14;
  return isAvenueAxis(axis) ? 8 : 5.5;
}

const SIDEWALK = 3.1;
const CURB = 0.2;
const WALK_Y = 0.13;
const ROAD_Y = 0.05;
const PAINT_Y = 0.058;
const WHITE = 0xe9e7e0;
const YELLOW = 0xe2b33a;

type RoadInfo = { axis: 'x' | 'z'; c: number; hw: number; highway: boolean; avenue: boolean };

function roadInfo(axis: 'x' | 'z', c: number): RoadInfo {
  const highway = axis === 'z' ? isHighwayAxisX(c) : isHighwayAxisZ(c);
  return { axis, c, hw: asphaltHalf(c, highway), highway, avenue: !highway && isAvenueAxis(c) };
}

/** Frame where local x = across the road, local z = along it. */
function roadFrame(r: RoadInfo): Frame {
  return r.axis === 'z' ? new Frame(r.c, 0, 0) : new Frame(0, r.c, Math.PI / 2);
}

/** Local along-coordinate → world for an x-road frame (yaw π/2 maps local z to world x, local x to −z). */
function toWorld(f: Frame, u: number, v: number, out: number[]): void {
  f.apply(u, 0, v, out);
}

const AXES = new Set<number>();
function axisSet(): Set<number> {
  if (!AXES.size) for (const a of gridAxes()) AXES.add(a);
  return AXES;
}

const ID = new Frame();

export type StreetCtx = {
  B: ChunkBatches;
  plan: CityPlan;
  collisions: CollisionSystem | null;
  /** Trunk blockers: their own layer, rebuilt with the trees whenever vegetation density changes. */
  treeBox?: (x: number, z: number, r: number) => void;
  vegetation: number;
  base: boolean;
};

/** Everything on and beside the roads owned by chunk (cx, cz). */
export function buildStreets(ctx: StreetCtx, cx: number, cz: number): void {
  const axes = axisSet();
  const x0 = cx * CHUNK;
  const z0 = cz * CHUNK;
  const owned = [0, 72].map((d) => d);
  for (const dx of owned) {
    const gx = x0 + dx;
    if (!axes.has(gx)) continue;
    for (const dz of owned) {
      const gz = z0 + dz;
      if (!axes.has(gz)) continue;
      // segment along z from gz to gz+72 on road x = gx
      if (axes.has(gz + 72)) segment(ctx, roadInfo('z', gx), gz, gz + 72);
      if (axes.has(gx + 72)) segment(ctx, roadInfo('x', gz), gx, gx + 72);
      junction(ctx, gx, gz);
    }
  }
}

function crossHalf(r: RoadInfo, along: number): number {
  // half-width of the road crossing r at `along`, or 0 when no road crosses there
  if (!axisSet().has(along)) return 0;
  const cross = roadInfo(r.axis === 'z' ? 'x' : 'z', along);
  if (!roadOpen(cross.axis, cross.c, r.c)) return 0;
  return cross.hw;
}

/** Open sub-spans of [a, b] on road r after landmark gaps. */
function spans(r: RoadInfo, a: number, b: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let cur = a;
  const step = 1;
  let open = roadOpen(r.axis, r.c, cur);
  let start = open ? cur : NaN;
  for (cur = a + step; cur <= b; cur += step) {
    const o = roadOpen(r.axis, r.c, cur);
    if (o && !open) start = cur;
    if (!o && open) out.push([start, cur - step]);
    open = o;
  }
  if (open) out.push([start, b]);
  return out.filter(([s, e]) => e - s > 4);
}

function segment(ctx: StreetCtx, r: RoadInfo, a: number, b: number): void {
  const { B } = ctx;
  const f = roadFrame(r);
  const sign = r.axis === 'z' ? 1 : 1;
  void sign;
  const hcA = crossHalf(r, a);
  const hcB = crossHalf(r, b);
  const seed = hash2(r.axis === 'z' ? r.c : r.c + 7919, a, 61);
  const rnd = mulberry32(seed);
  const midX = r.axis === 'z' ? r.c : (a + b) / 2;
  const midZ = r.axis === 'z' ? (a + b) / 2 : r.c;
  const zone = ctx.plan.zoneAt(midX + (r.axis === 'z' ? 20 : 0), midZ + (r.axis === 'x' ? 20 : 0));
  const residential = zone === 'family' || zone === 'periurban' || zone === 'premium' || zone === 'student' || zone === 'fringe';
  const busy = zone === 'core' || zone === 'market' || zone === 'dense' || zone === 'student';

  for (const [s0, s1] of ctx.base ? spans(r, a, b) : []) {
    const v0 = s0 === a ? a + hcA : s0;
    const v1 = s1 === b ? b - hcB : s1;
    if (v1 - v0 < 2) continue;
    // ---- base: asphalt, sidewalks, curbs, markings
    B.asphalt.flat(f, -r.hw, r.hw, v0, v1, ROAD_Y, r.highway ? 0x6a6d70 : zone === 'fringe' ? 0x8a8276 : 0x75787a);
    const wA = s0 === a ? a + hcA + CURB : s0;
    const wB = s1 === b ? b - hcB - CURB : s1;
    // x-roads' sidewalks stop at the z-roads' sidewalk outer edge so corners don't overlap
    const xTrimA = r.axis === 'x' && s0 === a && hcA > 0 ? SIDEWALK + CURB : 0;
    const xTrimB = r.axis === 'x' && s1 === b && hcB > 0 ? SIDEWALK + CURB : 0;
    for (const side of [-1, 1] as const) {
      const u0 = side * (r.hw + CURB);
      const u1 = side * (r.hw + CURB + SIDEWALK);
      walkBox(B.walk, f, Math.min(u0, u1), Math.max(u0, u1), wA + xTrimA, wB - xTrimB, zone === 'core' || r.highway ? 0xa9a397 : 0x9c9284);
      const cu = side * (r.hw + CURB / 2);
      const ca = s0 === a ? a + hcA : s0;
      const cb = s1 === b ? b - hcB : s1;
      curbRun(B, f, cu, ca, cb, hasSignal(r.axis === 'z' ? r.c : a, r.axis === 'z' ? a : r.c), hasSignal(r.axis === 'z' ? r.c : b, r.axis === 'z' ? b : r.c));
    }
    markings(B.ground, f, r, v0, v1, rnd);
    surfaceWear(B, f, r, v0, v1, rnd, zone);
  }
  if (ctx.base) {
    lampsForSegment(ctx, f, r, a + hcA, b - hcB, seed, true);
    if (r.highway) median(ctx, f, r, a + hcA, b - hcB, true);
    return;
  }
  // ---- detail layer: street furniture
  lampsForSegment(ctx, f, r, a + hcA, b - hcB, seed, false);
  if (r.highway) median(ctx, f, r, a + hcA, b - hcB, false);
  const lampSide = (seed & 1) === 0 ? 1 : -1;
  if (!r.highway && zone !== 'fringe') utilityLine(ctx, f, r, a + hcA + 6, b - hcB - 6, r.avenue ? -1 : -lampSide, seed);
  if (!r.highway && zone !== 'core' && zone !== 'premium') {
    for (const side of [-1, 1] as const) drain(ctx.B, f, r, side, a + hcA + SIDEWALK + 1, b - hcB - SIDEWALK - 1);
  }
  if ((r.avenue || r.highway) && rnd() < 0.55) busStop(ctx, f, r, (a + b) / 2 + range(rnd, -12, 12), rnd() < 0.5 ? 1 : -1, seed);
  if (busy && !r.highway) vendors(ctx, f, r, a + hcA + 8, b - hcB - 8, rnd, zone);
  if (residential || zone === 'institutional') streetTrees(ctx, f, r, a + hcA + 9, b - hcB - 9, rnd, zone);
  if (r.highway && rnd() < 0.7) billboard(ctx, f, r, (a + b) / 2 + range(rnd, -15, 15), rnd() < 0.5 ? 1 : -1, seed);
  if (!r.highway && residential && rnd() < 0.18) speedBump(ctx.B, f, r, (a + b) / 2);
}

function walkBox(B: KitBatch, f: Frame, u0: number, u1: number, v0: number, v1: number, hex: number): void {
  if (v1 - v0 < 0.3) return;
  B.flat(f, u0, u1, v0, v1, WALK_Y, hex);
  // outer face (towards the block) so the raised strip reads from the shoulder side
  const p = [0, 0, 0];
  const q = [0, 0, 0];
  const r = [0, 0, 0];
  const s = [0, 0, 0];
  const outer = Math.abs(u0) > Math.abs(u1) ? u0 : u1;
  const sgn = Math.sign(outer);
  if (sgn > 0) {
    f.apply(outer, 0, v1, p); f.apply(outer, 0, v0, q); f.apply(outer, WALK_Y, v0, r); f.apply(outer, WALK_Y, v1, s);
  } else {
    f.apply(outer, 0, v0, p); f.apply(outer, 0, v1, q); f.apply(outer, WALK_Y, v1, r); f.apply(outer, WALK_Y, v0, s);
  }
  B.quadWorld(p, q, r, s, 0x9c958a, v1 - v0, WALK_Y);
}

function curbRun(B: ChunkBatches, f: Frame, u: number, v0: number, v1: number, paintA: boolean, paintB: boolean): void {
  if (v1 - v0 < 0.3) return;
  const painted = 6;
  let v = v0;
  if (paintA) {
    for (let i = 0; i < painted && v < v1; i++, v += 1) B.kit.box(f, u, 0.075, v + 0.5, CURB, 0.15, 1, i % 2 ? 0x1c1c1c : 0xe8c33a);
  }
  const end = paintB ? Math.max(v, v1 - painted) : v1;
  if (end > v) B.kit.box(f, u, 0.075, (v + end) / 2, CURB, 0.15, end - v, 0xb8b0a2);
  if (paintB) {
    let w = end;
    for (let i = 0; w < v1 - 0.01; i++, w += 1) B.kit.box(f, u, 0.075, w + Math.min(1, v1 - w) / 2, CURB, 0.15, Math.min(1, v1 - w), i % 2 ? 0x1c1c1c : 0xe8c33a);
  }
}

function dashed(P: KitBatch, f: Frame, u: number, v0: number, v1: number, dash: number, gap: number, w: number, hex: number): void {
  for (let v = v0 + gap / 2; v + dash <= v1; v += dash + gap) P.flat(f, u - w / 2, u + w / 2, v, v + dash, PAINT_Y, hex);
}

function markings(P: KitBatch, f: Frame, r: RoadInfo, v0: number, v1: number, rnd: () => number): void {
  const edge = r.hw - 0.45;
  for (const s of [-1, 1]) P.flat(f, s * edge - 0.08, s * edge + 0.08, v0 + 1, v1 - 1, PAINT_Y, WHITE);
  if (r.highway) {
    dashed(P, f, -7.5, v0, v1, 4, 6, 0.15, WHITE);
    dashed(P, f, 7.5, v0, v1, 4, 6, 0.15, WHITE);
  } else if (r.avenue) {
    for (const s of [-1, 1]) P.flat(f, s * 0.18 - 0.07, s * 0.18 + 0.07, v0 + 1, v1 - 1, PAINT_Y, YELLOW);
  } else if (rnd() < 0.8) {
    dashed(P, f, 0, v0, v1, 3, 4, 0.12, WHITE);
  }
}

function surfaceWear(B: ChunkBatches, f: Frame, r: RoadInfo, v0: number, v1: number, rnd: () => number, zone: Zone): void {
  const worn = zone === 'periurban' || zone === 'fringe' || zone === 'market' || zone === 'dense' ? 1 : 0.4;
  const patches = Math.floor(rnd() * 3 * worn + (r.highway ? 0 : 0.6));
  for (let i = 0; i < patches; i++) {
    const u = range(rnd, -r.hw + 1.5, r.hw - 1.5);
    const v = range(rnd, v0 + 4, v1 - 4);
    const w = range(rnd, 1.2, 3.5);
    const d = range(rnd, 1, 4);
    B.ground.flat(f, u - w / 2, u + w / 2, v - d / 2, v + d / 2, PAINT_Y - 0.004, rnd() < 0.5 ? 0x3a3c3e : 0x5c5e60);
  }
  if (worn > 0.5 && rnd() < 0.6) {
    const p = [0, 0, 0];
    toWorld(f, range(rnd, -r.hw + 1, r.hw - 1), range(rnd, v0 + 3, v1 - 3), p);
    B.ground.disc(p[0]!, PAINT_Y - 0.002, p[2]!, range(rnd, 0.35, 0.8), 0x2a2622, 9);
  }
  const m = [0, 0, 0];
  toWorld(f, r.hw * 0.4 * (rnd() < 0.5 ? -1 : 1), range(rnd, v0 + 6, v1 - 6), m);
  B.ground.disc(m[0]!, PAINT_Y, m[2]!, 0.42, 0x3b3d40, 12);
}

// ---------------------------------------------------------------------------

function junction(ctx: StreetCtx, gx: number, gz: number): void {
  if (!roadOpen('z', gx, gz) || !roadOpen('x', gz, gx)) return;
  const ns = roadInfo('z', gx);
  const ew = roadInfo('x', gz);
  const { B } = ctx;
  const sig = hasSignal(gx, gz);
  if (ctx.base) {
    B.asphalt.flat(ID, gx - ns.hw, gx + ns.hw, gz - ew.hw, gz + ew.hw, ROAD_Y, ns.highway || ew.highway ? 0x6a6d70 : 0x75787a);
    if (sig || ns.highway || ew.highway || ns.avenue || ew.avenue) {
      const reach = 9;
      if (roadOpen('z', gx, gz + ew.hw + reach)) zebra(B.ground, roadFrame(ns), ns, gz + ew.hw + 0.6, 1);
      if (roadOpen('z', gx, gz - ew.hw - reach)) zebra(B.ground, roadFrame(ns), ns, gz - ew.hw - 0.6, -1);
      if (roadOpen('x', gz, gx + ns.hw + reach)) zebra(B.ground, roadFrame(ew), ew, gx + ns.hw + 0.6, 1);
      if (roadOpen('x', gz, gx - ns.hw - reach)) zebra(B.ground, roadFrame(ew), ew, gx - ns.hw - 0.6, -1);
    }
    return;
  }
  // signals or stop signs at the corners
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      const px = gx + sx * (ns.hw + CURB + 0.6);
      const pz = gz + sz * (ew.hw + CURB + 0.6);
      if (sig) signalPole(ctx, px, pz, sx, sz, ns.highway || ew.highway || ns.avenue || ew.avenue);
    }
  }
  if (!sig && !ns.highway && !ew.highway) {
    // minor junction: stop signs for the N–S street
    for (const sz of [-1, 1] as const) {
      const px = gx + sz * (ns.hw + CURB + 0.5);
      const pz = gz + sz * (ew.hw + SIDEWALK + 0.2);
      stopSign(ctx, px, pz, sz > 0 ? 0 : Math.PI);
    }
  }
}

function zebra(P: KitBatch, f: Frame, r: RoadInfo, vStart: number, dir: 1 | -1): void {
  const depth = 3.2;
  const v0 = dir > 0 ? vStart : vStart - depth;
  const n = Math.floor((r.hw * 2 - 1) / 1.0);
  for (let i = 0; i < n; i++) {
    const u = -r.hw + 0.8 + i * 1.0;
    P.flat(f, u, u + 0.5, v0, v0 + depth, PAINT_Y, WHITE);
  }
  const stop = dir > 0 ? vStart + depth + 0.8 : vStart - depth - 0.8;
  P.flat(f, -r.hw + 0.4, r.hw - 0.4, stop - 0.2, stop + 0.2, PAINT_Y, WHITE);
}

function signalPole(ctx: StreetCtx, x: number, z: number, sx: number, sz: number, major: boolean): void {
  const { B } = ctx;
  const f = new Frame(x, z, 0);
  B.metal.cylinder(f, 0, 0, 0, 0.09, 0.08, major ? 5.4 : 4.2, 0x3a3f42, 7);
  // head facing traffic along z (approaching from the sz side) and along x
  const y = major ? 4.6 : 3.4;
  head(B, x, y, z + sz * 0.22, sz > 0 ? 0 : Math.PI, 0);
  head(B, x + sx * 0.22, y, z, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 1);
  if (major) {
    // overhead arm with a second head above the lanes for the z approach
    B.metal.box(f, -sx * 3.2, 5.3, 0, 6.4, 0.12, 0.12, 0x3a3f42);
    head(B, x - sx * 5.6, 4.8, z + sz * 0.22, sz > 0 ? 0 : Math.PI, 0);
  }
  ctx.collisions?.addBox(x, 2, z, 0.2, 2, 0.2);
}

const LENS_RED = 0x000000;
const LENS_AMBER = 0xb00000;
const LENS_GREEN = 0xff0000;

function head(B: ChunkBatches, x: number, y: number, z: number, yaw: number, axis: 0 | 1): void {
  const f = new Frame(x, z, yaw, 0);
  B.metal.box(f, 0, y, 0, 0.36, 1.0, 0.24, 0x1d2022);
  B.metal.box(f, 0, y, -0.02, 0.5, 1.15, 0.04, 0x111214);
  const g = axis ? 0x00ff00 : 0;
  const lenses = [LENS_RED, LENS_AMBER, LENS_GREEN];
  for (let i = 0; i < 3; i++) {
    B.signal.box(f, 0, y + 0.3 - i * 0.3, 0.13, 0.2, 0.2, 0.03, lenses[i]! | g);
    B.metal.box(f, 0, y + 0.42 - i * 0.3, 0.2, 0.26, 0.03, 0.12, 0x1d2022);
  }
}

function stopSign(ctx: StreetCtx, x: number, z: number, yaw: number): void {
  const { B } = ctx;
  const f = new Frame(x, z, yaw);
  B.metal.cylinder(f, 0, 0, 0, 0.04, 0.04, 2.3, 0x9a9fa2, 6);
  B.kit.box(f, 0, 2.4, 0.03, 0.72, 0.72, 0.03, 0xc62828);
  quadSign(B, f, 0, 2.4, 0.05, 0.6, 0.24, 'STOP', { bg: '#c62828', fg: '#ffffff' });
  ctx.collisions?.addBox(x, 1, z, 0.08, 1, 0.08);
}

function quadSign(B: ChunkBatches, f: Frame, x: number, y: number, z: number, w: number, h: number, text: string, style: { bg: string; fg: string }): void {
  const a = [0, 0, 0];
  const b = [0, 0, 0];
  const c = [0, 0, 0];
  const d = [0, 0, 0];
  const n = [0, 0, 0];
  f.apply(x - w / 2, y - h / 2, z, a);
  f.apply(x + w / 2, y - h / 2, z, b);
  f.apply(x + w / 2, y + h / 2, z, c);
  f.apply(x - w / 2, y + h / 2, z, d);
  f.dir(0, 1, n);
  B.sign.quad(a, b, c, d, n, signSlot(text, style));
}

// ---------------------------------------------------------------------------

function lampsForSegment(ctx: StreetCtx, f: Frame, r: RoadInfo, v0: number, v1: number, seed: number, base: boolean): void {
  const both = r.highway || r.avenue;
  const spacing = both ? 30 : 34;
  const len = v1 - v0 - 8;
  if (len < 6) return;
  const n = Math.max(1, Math.round(len / spacing));
  const step = len / n;
  const side0 = (seed & 1) === 0 ? 1 : -1;
  const led = r.highway || r.avenue;
  const height = r.highway ? 10 : r.avenue ? 9 : 7.2;
  for (let i = 0; i <= n; i++) {
    const v = v0 + 4 + step * i;
    const sides = both ? [-1, 1] : [i % 2 === 0 ? side0 : -side0];
    for (const s of sides) {
      const u = s * (r.hw + CURB + SIDEWALK - 0.35);
      const p = [0, 0, 0];
      toWorld(f, u, v, p);
      if (!isFree(p[0]!, p[2]!, 0.4, 0.4, 0.5)) continue;
      const armLen = r.highway ? 2.6 : 1.8;
      const headU = u - s * armLen;
      const h = [0, 0, 0];
      toWorld(f, headU, v, h);
      if (base) {
        // lamp heads glow from far; pools only near (base layer covers both ranges)
        ctx.B.glow.box(f, headU, height - 0.12, v, 0.7, 0.12, 0.32, led ? 0xe8f0ff : 0xffcf8a);
        poolQuad(ctx.B.pool, h[0]!, h[2]!, r.highway ? 9 : 7.5, led ? 0x9fb4d8 : 0xd08a3a);
        continue;
      }
      ctx.B.metal.cylinder(new Frame(p[0]!, p[2]!), 0, 0, 0, 0.11, 0.07, height, 0x6d7275, 7);
      ctx.B.metal.box(f, u - (s * armLen) / 2, height + 0.05, v, armLen, 0.08, 0.08, 0x6d7275);
      ctx.B.metal.box(f, headU, height, v, 0.8, 0.16, 0.38, 0x50555a);
      ctx.collisions?.addBox(p[0]!, 2, p[2]!, 0.16, 2, 0.16);
    }
  }
}

function poolQuad(B: KitBatch, x: number, z: number, r: number, hex: number): void {
  const y = 0.075;
  B.quadWorld([x - r, y, z - r], [x - r, y, z + r], [x + r, y, z + r], [x + r, y, z - r], hex, 1, 1);
}

function median(ctx: StreetCtx, f: Frame, r: RoadInfo, v0: number, v1: number, base: boolean): void {
  const a = v0 + 7;
  const b = v1 - 7;
  if (b - a < 6) return;
  if (base) {
    ctx.B.kit.box(f, 0, 0.12, (a + b) / 2, 2.6, 0.24, b - a, 0xb9b1a3);
    ctx.B.grass.flat(f, -1.1, 1.1, a + 0.3, b - 0.3, 0.245, 0x7aa05a);
    return;
  }
  const mid = [0, 0, 0];
  toWorld(f, 0, (a + b) / 2, mid);
  const halfAlong = (b - a) / 2;
  if (r.axis === 'z') ctx.collisions?.addBox(mid[0]!, 0.4, mid[2]!, 1.3, 0.4, halfAlong);
  else ctx.collisions?.addBox(mid[0]!, 0.4, mid[2]!, halfAlong, 0.4, 1.3);
  if (ctx.vegetation <= 0.05) return;
  for (let v = a + 6; v < b - 4; v += 18 / Math.max(0.35, ctx.vegetation)) {
    const p = [0, 0, 0];
    toWorld(f, 0, v, p);
    treeHook?.({ x: p[0]!, z: p[2]!, kind: 0, s: 0.95 });
  }
}

/** Set by CityChunks so street trees go through the same vegetation builder as block trees. */
export let treeHook: ((t: { x: number; z: number; kind: 0 | 1 | 2 | 3 | 4; s: number }) => void) | null = null;
export function setTreeHook(fn: typeof treeHook): void {
  treeHook = fn;
}

function utilityLine(ctx: StreetCtx, f: Frame, r: RoadInfo, v0: number, v1: number, side: number, seed: number): void {
  if (v1 - v0 < 20) return;
  const u = side * (r.hw + CURB + SIDEWALK + 1.1);
  const n = Math.max(1, Math.round((v1 - v0) / 34));
  const step = (v1 - v0) / n;
  const tops: number[][] = [];
  const rnd = mulberry32(seed ^ 0x5bd1e995);
  for (let i = 0; i <= n; i++) {
    const v = v0 + step * i;
    const p = [0, 0, 0];
    toWorld(f, u, v, p);
    if (!isFree(p[0]!, p[2]!, 0.5, 0.5, 0.5)) continue;
    const wood = rnd() < 0.45;
    ctx.B.kit.cylinder(new Frame(p[0]!, p[2]!), 0, 0, 0, wood ? 0.13 : 0.16, wood ? 0.1 : 0.11, 8.6, wood ? 0x5b4a3a : 0x9a968e, 6);
    ctx.B.kit.box(f, u, 8.1, v, 1.8, 0.12, 0.12, wood ? 0x4d3f31 : 0x8a867e);
    for (const k of [-0.75, 0, 0.75]) ctx.B.kit.box(f, u + k, 8.22, v, 0.08, 0.14, 0.08, 0xe0ddd5);
    if (rnd() < 0.18) {
      ctx.B.metal.box(f, u - side * 0.35, 6.3, v, 0.6, 1.1, 0.6, 0x7b8085);
      ctx.B.metal.cylinder(new Frame(p[0]!, p[2]!), 0, 6.9, 0, 0.08, 0.08, 0.4, 0x3a3a3a, 5);
    }
    ctx.collisions?.addBox(p[0]!, 2, p[2]!, 0.18, 2, 0.18);
    tops.push([u, v]);
  }
  for (let i = 0; i + 1 < tops.length; i++) {
    const [ua, va] = tops[i]!;
    const [, vb] = tops[i + 1]!;
    for (const k of [-0.75, 0, 0.75]) cable(ctx.B.metal, f, ua! + k, va!, vb!, 8.25, 0.55 + Math.abs(k) * 0.2);
  }
}

function cable(B: KitBatch, f: Frame, u: number, va: number, vb: number, y: number, sag: number): void {
  const segs = 5;
  let prev = [0, 0, 0];
  toWorld(f, u, va, prev);
  prev[1] = y;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const p = [0, 0, 0];
    toWorld(f, u, va + (vb - va) * t, p);
    p[1] = y - sag * 4 * t * (1 - t);
    B.ribbon(prev, p, 0.055, 0x1a1a1a);
    prev = p;
  }
}

function drain(B: ChunkBatches, f: Frame, r: RoadInfo, side: number, v0: number, v1: number): void {
  if (v1 - v0 < 4) return;
  const uIn = side * (r.hw + CURB + SIDEWALK);
  const uOut = side * (r.hw + CURB + SIDEWALK + 0.75);
  const lo = Math.min(uIn, uOut);
  const hi = Math.max(uIn, uOut);
  B.ground.flat(f, lo, hi, v0, v1, 0.028, 0x2f2b27);
  B.kit.box(f, side > 0 ? hi - 0.06 : lo + 0.06, 0.1, (v0 + v1) / 2, 0.12, 0.2, v1 - v0, 0xa59d90);
  // slab covers every few metres where people cross
  for (let v = v0 + 5; v < v1 - 2; v += 11) B.kit.box(f, (lo + hi) / 2, 0.12, v, hi - lo + 0.1, 0.06, 1.2, 0x9d968a);
}

function busStop(ctx: StreetCtx, f: Frame, r: RoadInfo, v: number, side: number, seed: number): void {
  const u = side * (r.hw + CURB + SIDEWALK + 0.6);
  const p = [0, 0, 0];
  toWorld(f, u, v, p);
  if (!isFree(p[0]!, p[2]!, 3.2, 3.2, 0)) return;
  const yaw = (r.axis === 'z' ? 0 : Math.PI / 2) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
  const s = new Frame(p[0]!, p[2]!, yaw);
  const { B } = ctx;
  for (const x of [-2.2, 2.2]) B.metal.box(s, x, 1.25, -0.6, 0.1, 2.5, 0.1, 0x3d4a52);
  B.tin.slab(s, [[-2.6, 2.6, 1.0], [2.6, 2.6, 1.0], [2.6, 2.75, -0.9], [-2.6, 2.75, -0.9]], 0x2e5b8a, 5.2, 1.9);
  B.glow.box(s, 1.4, 1.4, -0.62, 1.6, 1.8, 0.05, 0xf4f0e0);
  B.kit.box(s, -0.6, 0.45, -0.35, 2.6, 0.08, 0.45, 0x8a6a44);
  for (const x of [-1.7, 0.5]) B.metal.box(s, x, 0.22, -0.35, 0.06, 0.44, 0.4, 0x3d4a52);
  B.metal.box(s, -3.2, 1.4, 0.2, 0.06, 2.8, 0.06, 0x8a9094);
  quadSign(B, s, -3.2, 2.7, 0.24, 0.9, 0.3, 'ARRÊT BUS', { bg: '#0d47a1', fg: '#ffffff' });
  ctx.collisions?.addBox(p[0]!, 1.2, p[2]!, 1.0, 1.2, 1.0);
  void seed;
}

const UMBRELLA = [0xd32f2f, 0xf9a825, 0x1565c0, 0x2e7d32, 0xffffff, 0xef6c00];

function vendors(ctx: StreetCtx, f: Frame, r: RoadInfo, v0: number, v1: number, rnd: () => number, zone: Zone): void {
  const n = zone === 'market' ? 4 : zone === 'core' ? 1 : 2;
  const { B } = ctx;
  for (let i = 0; i < n; i++) {
    if (v1 - v0 < 6) return;
    const side = rnd() < 0.5 ? -1 : 1;
    const u = side * (r.hw + CURB + SIDEWALK + 1.9);
    const v = range(rnd, v0, v1);
    const p = [0, 0, 0];
    toWorld(f, u, v, p);
    if (!isFree(p[0]!, p[2]!, 1.4, 1.4, 0)) continue;
    const s = new Frame(p[0]!, p[2]!, rnd() * Math.PI);
    const kind = rnd();
    if (kind < 0.45) {
      // umbrella stall: table, crates, produce
      B.metal.cylinder(s, 0, 0, 0, 0.03, 0.03, 2.3, 0x777777, 5);
      B.tin.slab(s, [[-1.2, 2.1, 1.2], [1.2, 2.1, 1.2], [0, 2.5, 0], [0, 2.5, 0]], pick(rnd, UMBRELLA), 1, 1);
      B.tin.slab(s, [[1.2, 2.1, -1.2], [-1.2, 2.1, -1.2], [0, 2.5, 0], [0, 2.5, 0]], pick(rnd, UMBRELLA), 1, 1);
      B.tin.slab(s, [[1.2, 2.1, 1.2], [1.2, 2.1, -1.2], [0, 2.5, 0], [0, 2.5, 0]], pick(rnd, UMBRELLA), 1, 1);
      B.tin.slab(s, [[-1.2, 2.1, -1.2], [-1.2, 2.1, 1.2], [0, 2.5, 0], [0, 2.5, 0]], pick(rnd, UMBRELLA), 1, 1);
      B.kit.box(s, 0, 0.42, 0.4, 1.4, 0.84, 0.7, 0x7b5a3c);
      for (let k = 0; k < 4; k++) B.kit.box(s, -0.5 + k * 0.33, 0.92, 0.4, 0.26, 0.16, 0.5, [0xd35400, 0xf1c40f, 0x27ae60, 0xc0392b][k]!);
      B.kit.box(s, 0.9, 0.2, -0.5, 0.45, 0.4, 0.35, 0x1565c0);
    } else if (kind < 0.75) {
      // call-box / mobile money kiosk
      B.kit.box(s, 0, 1.1, 0, 1.4, 2.2, 1.1, pick(rnd, [0xf2c230, 0xe65100, 0x1565c0, 0x2e7d32]));
      B.tin.slab(s, [[-0.95, 2.35, 0.85], [0.95, 2.35, 0.85], [0.95, 2.5, -0.75], [-0.95, 2.5, -0.75]], 0x9aa3a8, 1.9, 1.6);
      B.kit.box(s, 0, 1.0, 0.56, 1.1, 0.5, 0.04, 0x1d2022);
      B.glow.box(s, 0, 1.9, 0.57, 1.0, 0.25, 0.02, 0xfff3c0);
    } else {
      // grill: oil drum barbecue + bench (soya / poisson braisé)
      B.metal.cylinder(s, 0, 0, 0, 0.32, 0.32, 0.85, 0x3a3a3a, 9);
      B.glow.box(s, 0, 0.88, 0, 0.5, 0.04, 0.5, 0xff7a2a);
      B.kit.box(s, 1.1, 0.25, 0, 0.35, 0.5, 1.4, 0x6b4f35);
      B.kit.box(s, -0.9, 0.5, 0.3, 0.7, 0.04, 0.7, 0xf2f2f2);
    }
    ctx.collisions?.addBox(p[0]!, 0.6, p[2]!, 0.8, 0.6, 0.8);
  }
}

function streetTrees(ctx: StreetCtx, f: Frame, r: RoadInfo, v0: number, v1: number, rnd: () => number, zone: Zone): void {
  if (!treeHook || ctx.vegetation <= 0.05) return;
  const base = zone === 'premium' || zone === 'institutional' ? 14 : zone === 'family' || zone === 'periurban' || zone === 'student' ? 17 : 22;
  const spacing = base / Math.max(0.35, ctx.vegetation);
  for (const side of [-1, 1] as const) {
    const u = side * (r.hw + CURB + SIDEWALK + 2.6);
    for (let v = v0 + rnd() * 6; v < v1; v += spacing * (0.8 + rnd() * 0.4)) {
      const p = [0, 0, 0];
      toWorld(f, u, v, p);
      if (!isFree(p[0]!, p[2]!, 1.2, 1.2, 0)) continue;
      const kind = zone === 'premium' ? (rnd() < 0.5 ? 0 : 1) : pick(rnd, [0, 1, 2, 1] as const);
      treeHook({ x: p[0]!, z: p[2]!, kind, s: range(rnd, 0.75, 1.1) });
      ctx.treeBox?.(p[0]!, p[2]!, 0.3);
    }
  }
}

function billboard(ctx: StreetCtx, f: Frame, r: RoadInfo, v: number, side: number, seed: number): void {
  const u = side * (r.hw + CURB + SIDEWALK + 1.6);
  const p = [0, 0, 0];
  toWorld(f, u, v, p);
  const yaw = (r.axis === 'z' ? 0 : Math.PI / 2) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
  const s = new Frame(p[0]!, p[2]!, yaw);
  const { B } = ctx;
  const w = 9;
  const h = 3.4;
  const y = 9.5;
  B.metal.cylinder(s, 0, 0, 0, 0.32, 0.28, y, 0x5a6064, 8);
  B.metal.box(s, 0, y + h / 2, -0.15, w + 0.3, h + 0.3, 0.25, 0x2b2f33);
  const ad = AD_SIGNS[seed % AD_SIGNS.length]!;
  const palette = [0x0d47a1, 0xb71c1c, 0x1b5e20, 0xf9a825, 0x4a148c, 0x006064];
  B.kit.box(s, 0, y + h / 2, 0.0, w, h, 0.05, palette[seed % palette.length]!);
  B.kit.box(s, -w * 0.28, y + h * 0.42, 0.04, w * 0.36, h * 0.6, 0.02, 0xf2efe6);
  quadSign(B, s, w * 0.12, y + h * 0.62, 0.06, w * 0.7, h * 0.36, ad, { bg: '#10251f', fg: '#ffc857' });
  for (const x of [-w * 0.33, 0, w * 0.33]) {
    B.metal.box(s, x, y - 0.1, 0.55, 0.06, 0.06, 1.1, 0x2b2f33);
    B.glow.box(s, x, y - 0.12, 1.1, 0.35, 0.1, 0.2, 0xfff2d0);
  }
  ctx.collisions?.addBox(p[0]!, 2, p[2]!, 0.35, 2, 0.35);
}

function speedBump(B: ChunkBatches, f: Frame, r: RoadInfo, v: number): void {
  const n = Math.round((r.hw * 2 - 0.8) / 0.6);
  for (let i = 0; i < n; i++) {
    const u = -r.hw + 0.4 + i * 0.6 + 0.3;
    B.kit.box(f, u, ROAD_Y + 0.04, v, 0.6, 0.08, 0.9, i % 2 ? 0x1c1c1c : 0xe2b33a);
  }
}

// ---------------------------------------------------------------------------

/** Paved / laterite ground of a block between its sidewalks. */
export function blockGround(B: ChunkBatches, gx: number, gx2: number, gz: number, gz2: number, zone: Zone): void {
  const edge = (axisV: number, axis: 'x' | 'z') => {
    const hw = asphaltHalf(axisV, axis === 'x' ? isHighwayAxisX(axisV) : isHighwayAxisZ(axisV));
    return hw + CURB + SIDEWALK;
  };
  const x0 = gx + edge(gx, 'x');
  const x1 = gx2 - edge(gx2, 'x');
  const z0 = gz + edge(gz, 'z');
  const z1 = gz2 - edge(gz2, 'z');
  if (x1 <= x0 || z1 <= z0) return;
  const hex =
    zone === 'core' ? 0xa8a39a : zone === 'market' ? 0x8f8478 : zone === 'premium' ? 0x8c8a78 : zone === 'logistics' || zone === 'airport' ? 0x8a8780 : zone === 'fringe' ? 0x7a7048 : zone === 'family' || zone === 'periurban' ? 0x7f7050 : 0x8e6c52;
  B.ground.flat(ID, x0, x1, z0, z1, 0.035, hex);
}
