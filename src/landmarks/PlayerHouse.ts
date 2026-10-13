import * as THREE from 'three';
import type { CollisionSystem } from '../world/CollisionSystem';
import { addTextSign } from './signage';
import { createBrandVehicle } from '../vehicles/VehicleFactory';
import { applyHomeDecor, equippedItem, loadHomeDecor, type HomeDecorState } from '../home/HomeDecor';
import { buildHomeInteriorShell } from '../home/buildHomeInterior';
import { FRONT_DOOR, HOME_SHELL, HOME_WALLS, WALL_TOP, wallPieces } from '../home/homeLayout';
import { applyIndoorAtmosphere, restoreOutdoorAtmosphere } from '../render/atmosphere';
import { Frame, KitBatch } from '../city/Batch';
import { KIT_UV, kitMaterial, poolMaterial, type KitKind } from '../city/kitMaterials';
import { buildTree } from '../city/Vegetation';
import type { TreeKind } from '../city/CityPlan';

/** Player home — start here, walk in/out through the front door. */
export const PLAYER_HOUSE = {
  id: 'player-house',
  name: 'Maison du Joueur',
  cx: 36,
  cz: 108,
  /** Living room spawn. */
  spawn: { x: 38, y: 0, z: 108 },
  /** On the porch, outside the front door. */
  doorOutside: { x: 36 + FRONT_DOOR.x, z: 108 + HOME_SHELL.innerD / 2 + 1.4 },
  halfW: 15,
  halfD: 16,
  interiorHalfW: 8.2,
  interiorHalfD: 7.2,
} as const;

/** Compound wall (house-local half extents) with a pedestrian gate and a car gate on the street side. */
const YARD = { hx: 16.4, hz: 17.4, wallH: 2.1, wallT: 0.22 } as const;
const PED_GATE = { x: FRONT_DOOR.x, w: 1.3 } as const;
const CAR_GATE = { x: 5.0, w: 3.8 } as const;
const PORCH = { x0: -7.9, x1: -2.3, z1: HOME_SHELL.innerD / 2 + 2.5, h: 0.12 } as const;

type ExtKey = Exclude<KitKind, 'asphalt'>;
const EXT_KEYS: ExtKey[] = ['kit', 'metal', 'tin', 'glow', 'ground', 'leaf', 'walk', 'grass'];
const SHADOW = new Set<ExtKey>(['kit', 'metal', 'tin', 'leaf']);

/** City lot ground uses polygonOffset −2; the compound surfaces must win over it at any distance. */
const YARD_OFFSET: Partial<Record<ExtKey, number>> = { grass: -4, ground: -5, walk: -6 };
const yardMats = new Map<ExtKey, THREE.Material>();
function yardMaterial(k: ExtKey): THREE.Material {
  const off = YARD_OFFSET[k];
  if (off == null) return kitMaterial(k);
  let m = yardMats.get(k);
  if (!m) {
    const base = kitMaterial(k);
    const c = base.clone();
    c.onBeforeCompile = base.onBeforeCompile;
    c.customProgramCacheKey = base.customProgramCacheKey;
    c.polygonOffset = true;
    c.polygonOffsetFactor = off;
    c.polygonOffsetUnits = off;
    c.name = `house-yard-${k}`;
    yardMats.set(k, (m = c));
  }
  return m;
}

class ExtBatches {
  readonly b = new Map<ExtKey | 'pool', KitBatch>();
  get(k: ExtKey | 'pool'): KitBatch {
    let x = this.b.get(k);
    if (!x) this.b.set(k, (x = new KitBatch()));
    return x;
  }
  group(name: string): THREE.Group {
    const g = new THREE.Group();
    g.name = name;
    for (const k of EXT_KEYS) {
      const geo = this.b.get(k)?.build(KIT_UV[k]);
      if (!geo) continue;
      const m = new THREE.Mesh(geo, yardMaterial(k));
      m.name = `house-${k}`;
      m.castShadow = SHADOW.has(k);
      m.receiveShadow = k !== 'glow';
      g.add(m);
    }
    const pool = this.b.get('pool')?.build(1);
    if (pool) {
      const m = new THREE.Mesh(pool, poolMaterial());
      m.name = 'house-pool';
      m.renderOrder = 2;
      g.add(m);
    }
    return g;
  }
}

function shade(hex: number, k: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * k));
  const b = Math.min(255, Math.round((hex & 255) * k));
  return (r << 16) | (g << 8) | b;
}

function pool(B: ExtBatches, x: number, y: number, z: number, r: number, hex = 0xd09050): void {
  B.get('pool').quadWorld([x - r, y, z - r], [x - r, y, z + r], [x + r, y, z + r], [x + r, y, z - r], hex, 1, 1);
}

/**
 * Modern single-storey Yaoundé house: rendered concrete, metal hip roof, covered porch,
 * compound wall with gates, driveway, garden and night lighting.
 * Interior is walkable (see buildHomeInteriorShell); home mode shows it from above.
 */
export function buildPlayerHouse(collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'landmark-player-house';
  const { cx, cz } = PLAYER_HOUSE;
  root.userData = {
    type: 'landmark',
    landmarkId: PLAYER_HOUSE.id,
    displayName: PLAYER_HOUSE.name,
    homeMode: false,
  };

  const exterior = new THREE.Group();
  exterior.name = 'player-house-exterior';
  const interior = new THREE.Group();
  interior.name = 'player-house-interior';
  root.add(exterior);
  root.add(interior);

  buildHomeInteriorShell(interior, collisions, cx, cz);

  const car = createBrandVehicle(3, 'jetour');
  car.position.set(cx + CAR_GATE.x, 0, cz + 12.2);
  car.rotation.y = 0;
  car.userData.driveable = true;
  car.userData.parkedCar = true;
  car.userData.owner = 'player';
  exterior.add(car);

  const roof = buildRoof(cx, cz);
  exterior.add(roof);
  root.userData.roof = roof;

  addTextSign(exterior, cx - 8.6, 1.55, cz + YARD.hz + YARD.wallT / 2 + 0.07, 2.6, 0.62, 'Maison du Joueur', {
    subtitle: 'Nlongkak · N° 12',
    bg: 0x2b2d30,
    fg: 0xe8c27a,
  });

  addExteriorCollisions(collisions, cx, cz);

  let visual: THREE.Group | null = null;
  root.userData.rebuildExterior = (state: HomeDecorState) => {
    if (visual) {
      exterior.remove(visual);
      visual.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    }
    visual = buildExteriorVisual(state, cx, cz);
    exterior.add(visual);
  };

  root.userData.insideZone = {
    minX: cx - HOME_SHELL.innerW / 2 + 0.4,
    maxX: cx + HOME_SHELL.innerW / 2 - 0.4,
    minZ: cz - HOME_SHELL.innerD / 2 + 0.4,
    maxZ: cz + HOME_SHELL.innerD / 2 - 0.2,
  };
  root.userData.exterior = exterior;
  root.userData.interior = interior;

  applyHomeDecor(root, loadHomeDecor(), collisions);

  return root;
}

function compoundRuns(): Array<{ axis: 'x' | 'z'; fixed: number; from: number; to: number; gaps: Array<[number, number]> }> {
  const { hx, hz } = YARD;
  return [
    {
      axis: 'x',
      fixed: hz,
      from: -hx,
      to: hx,
      gaps: [
        [PED_GATE.x - PED_GATE.w / 2, PED_GATE.x + PED_GATE.w / 2],
        [CAR_GATE.x - CAR_GATE.w / 2, CAR_GATE.x + CAR_GATE.w / 2],
      ],
    },
    { axis: 'x', fixed: -hz, from: -hx, to: hx, gaps: [] },
    { axis: 'z', fixed: -hx, from: -hz, to: hz, gaps: [] },
    { axis: 'z', fixed: hx, from: -hz, to: hz, gaps: [] },
  ];
}

function spans(from: number, to: number, gaps: Array<[number, number]>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let cur = from;
  for (const [a, b] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (a > cur) out.push([cur, a]);
    cur = b;
  }
  if (to > cur) out.push([cur, to]);
  return out;
}

const TREES: Array<{ x: number; z: number; kind: TreeKind; s: number }> = [
  { x: -11.5, z: -12.0, kind: 2, s: 0.95 },
  { x: -13.2, z: 13.4, kind: 0, s: 0.75 },
  { x: 12.8, z: 12.6, kind: 0, s: 0.7 },
  { x: 12.4, z: -13.2, kind: 4, s: 1.0 },
  { x: 9.6, z: -14.8, kind: 4, s: 0.85 },
  { x: -14.4, z: -2.0, kind: 4, s: 0.9 },
];

function addExteriorCollisions(collisions: CollisionSystem, cx: number, cz: number): void {
  const { wallH, wallT } = YARD;
  for (const run of compoundRuns()) {
    for (const [a, b] of spans(run.from, run.to, run.gaps)) {
      const mid = (a + b) / 2;
      const len = b - a;
      if (run.axis === 'x') collisions.addBox(cx + mid, wallH / 2, cz + run.fixed, len / 2 + 0.05, wallH / 2, wallT / 2 + 0.05);
      else collisions.addBox(cx + run.fixed, wallH / 2, cz + mid, wallT / 2 + 0.05, wallH / 2, len / 2 + 0.05);
    }
  }
  for (const x of [PORCH.x0 + 0.3, PORCH.x1 - 0.3]) collisions.addBox(cx + x, 1.5, cz + PORCH.z1 - 0.3, 0.16, 1.5, 0.16);
  for (const t of TREES) {
    const r = t.kind === 2 ? 0.4 : t.kind === 4 ? 0.22 : 0.3;
    collisions.addBox(cx + t.x, 1.2, cz + t.z, r, 1.2, r);
  }
  // Water tank stand + front flower beds
  collisions.addBox(cx + 14.6, 1.2, cz - 15.6, 0.9, 1.2, 0.9);
  collisions.addBox(cx + 0.35, 0.18, cz + 7.75, 2.15, 0.18, 0.4);
}

function buildRoof(cx: number, cz: number): THREE.Group {
  const B = new ExtBatches();
  const f = new Frame(cx, cz, 0, 0);
  const ov = 0.7;
  const X = HOME_SHELL.innerW / 2 + HOME_SHELL.wallT / 2 + ov;
  const Z = HOME_SHELL.innerD / 2 + HOME_SHELL.wallT / 2 + ov;
  const slope = 0.4;
  const e = WALL_TOP + 0.08 - ov * slope;
  const r = e + Z * slope;
  const rx = X - Z;
  const tin = B.get('tin');
  const roofHex = 0x4d5257;
  const A: [number, number, number] = [-X, e, -Z];
  const Bk: [number, number, number] = [X, e, -Z];
  const C: [number, number, number] = [X, e, Z];
  const D: [number, number, number] = [-X, e, Z];
  const R1: [number, number, number] = [-rx, r, 0];
  const R2: [number, number, number] = [rx, r, 0];
  const w = (p: [number, number, number]) => {
    const o = [0, 0, 0];
    f.apply(p[0], p[1], p[2], o);
    return o;
  };
  const slant = Math.hypot(Z, r - e);
  tin.quadWorld(w(D), w(C), w(R2), w(R1), roofHex, X * 2, slant);
  tin.quadWorld(w(Bk), w(A), w(R1), w(R2), roofHex, X * 2, slant);
  tin.tri(f, C, Bk, R2, shade(roofHex, 0.96));
  tin.tri(f, A, D, R1, shade(roofHex, 0.96));
  // Ridge + hip caps
  const metal = B.get('metal');
  metal.ribbon(w([-rx, r + 0.03, 0]), w([rx, r + 0.03, 0]), 0.3, 0x3b3f43);
  for (const [p, q] of [
    [A, R1],
    [D, R1],
    [Bk, R2],
    [C, R2],
  ] as const) {
    const a = w([p[0], p[1] + 0.03, p[2]]);
    const b = w([q[0], q[1] + 0.03, q[2]]);
    metal.ribbon(a, b, 0.22, 0x3b3f43);
  }
  // Fascia, gutters, soffit
  const kit = B.get('kit');
  const fascia = 0xf2efe8;
  kit.box(f, 0, e - 0.1, Z + 0.02, X * 2 + 0.08, 0.22, 0.04, fascia);
  kit.box(f, 0, e - 0.1, -Z - 0.02, X * 2 + 0.08, 0.22, 0.04, fascia);
  kit.box(f, X + 0.02, e - 0.1, 0, 0.04, 0.22, Z * 2, fascia);
  kit.box(f, -X - 0.02, e - 0.1, 0, 0.04, 0.22, Z * 2, fascia);
  metal.box(f, 0, e - 0.16, Z + 0.1, X * 2, 0.1, 0.12, 0x6c7176);
  metal.box(f, 0, e - 0.16, -Z - 0.1, X * 2, 0.1, 0.12, 0x6c7176);
  for (const [x, z] of [
    [X - 0.15, Z + 0.1],
    [-X + 0.15, -Z - 0.1],
  ] as const) {
    metal.cylinder(f, x, 0.15, z, 0.05, 0.05, e - 0.3, 0x6c7176, 8);
  }
  const s0 = [0, 0, 0];
  const s1 = [0, 0, 0];
  const s2 = [0, 0, 0];
  const s3 = [0, 0, 0];
  f.apply(-X, e - 0.02, -Z, s0);
  f.apply(X, e - 0.02, -Z, s1);
  f.apply(X, e - 0.02, Z, s2);
  f.apply(-X, e - 0.02, Z, s3);
  kit.quadWorld(s0, s1, s2, s3, 0xf4f1ea, X * 2, Z * 2);
  const g = B.group('player-house-roof');
  return g;
}

function buildExteriorVisual(state: HomeDecorState, cx: number, cz: number): THREE.Group {
  const facadeItem = equippedItem(state, 'facade');
  const gateItem = equippedItem(state, 'gate');
  const garden = equippedItem(state, 'garden').variant ?? 'basic';
  const facade = facadeItem.color;
  const accent = facadeItem.accent ?? 0xb9b3a8;
  const gateHex = gateItem.color;
  const B = new ExtBatches();
  const f = new Frame(cx, cz, 0, 0);
  const kit = B.get('kit');
  const metal = B.get('metal');
  const glow = B.get('glow');
  const ground = B.get('ground');
  const walk = B.get('walk');
  const grass = B.get('grass');
  const leaf = B.get('leaf');
  const T = HOME_SHELL.wallT;

  // —— Ground: lawn, laterite beds, walkway, driveway + apron to the street ——
  // City lot paving sits at y 0.06, so the compound surfaces stack just above it.
  grass.flat(f, -YARD.hx, YARD.hx, -YARD.hz, YARD.hz, 0.075, 0x6f8a4f);
  ground.flat(f, -YARD.hx + 0.1, YARD.hx - 0.1, -YARD.hz + 0.1, -YARD.hz + 0.8, 0.08, 0x8a5a3c);
  ground.flat(f, -YARD.hx + 0.1, -YARD.hx + 0.8, -YARD.hz + 0.8, YARD.hz - 0.1, 0.08, 0x8a5a3c);
  ground.flat(f, YARD.hx - 0.8, YARD.hx - 0.1, -YARD.hz + 0.8, YARD.hz - 0.1, 0.08, 0x8a5a3c);
  // Gravel apron around the house (drip line)
  ground.flat(f, -8.9, 8.9, -7.9, -7.15, 0.082, 0xa49c90);
  ground.flat(f, -8.9, -8.15, -7.15, 7.15, 0.082, 0xa49c90);
  ground.flat(f, 8.15, 8.9, -7.15, 7.15, 0.082, 0xa49c90);
  walk.flat(f, PED_GATE.x - 0.7, PED_GATE.x + 0.7, PORCH.z1 + 0.4, YARD.hz + 1.5, 0.095, 0xc2b8a6);
  for (const dx of [-0.76, 0.76]) kit.box(f, PED_GATE.x + dx, 0.08, (PORCH.z1 + 0.4 + YARD.hz) / 2, 0.1, 0.1, YARD.hz - PORCH.z1 - 0.4, 0xb0a898);
  ground.flat(f, CAR_GATE.x - 2.2, CAR_GATE.x + 2.2, 7.6, YARD.hz + 9.6, 0.088, 0xaaa59c);
  for (let z = 9; z < YARD.hz; z += 1.8) ground.flat(f, CAR_GATE.x - 2.2, CAR_GATE.x + 2.2, z, z + 0.04, 0.09, 0x8f8a82);

  // —— Porch: tiled slab, step, columns, canopy, wall lamps ——
  walk.box(f, (PORCH.x0 + PORCH.x1) / 2, PORCH.h / 2, (HOME_SHELL.innerD / 2 + PORCH.z1) / 2, PORCH.x1 - PORCH.x0, PORCH.h, PORCH.z1 - HOME_SHELL.innerD / 2, 0xcfc6b6);
  walk.box(f, PED_GATE.x, 0.05, PORCH.z1 + 0.2, 1.8, 0.1, 0.4, 0xbfb6a6);
  for (const x of [PORCH.x0 + 0.3, PORCH.x1 - 0.3]) {
    kit.box(f, x, PORCH.h + 1.26, PORCH.z1 - 0.3, 0.28, 2.52, 0.28, facade);
    kit.box(f, x, PORCH.h + 0.12, PORCH.z1 - 0.3, 0.34, 0.24, 0.34, accent);
  }
  const canopyZ = (HOME_SHELL.innerD / 2 + PORCH.z1) / 2 + 0.1;
  const canopyD = PORCH.z1 - HOME_SHELL.innerD / 2 + 0.2;
  kit.box(f, (PORCH.x0 + PORCH.x1) / 2, 2.73, canopyZ, PORCH.x1 - PORCH.x0 + 0.5, 0.18, canopyD, facade, false);
  kit.box(f, (PORCH.x0 + PORCH.x1) / 2, 2.73, canopyZ + canopyD / 2 + 0.02, PORCH.x1 - PORCH.x0 + 0.5, 0.2, 0.04, accent);
  const frontFace = HOME_SHELL.innerD / 2 + T / 2 + 0.024;
  for (const dx of [-1.0, 1.0]) {
    metal.box(f, FRONT_DOOR.x + dx, 2.2, frontFace + 0.05, 0.14, 0.24, 0.1, 0x2b2d30);
    glow.box(f, FRONT_DOOR.x + dx, 2.18, frontFace + 0.11, 0.1, 0.16, 0.03, 0xffe2b0);
    pool(B, cx + FRONT_DOOR.x + dx, 0.13, cz + frontFace + 1.0, 1.6);
  }
  glow.box(f, (PORCH.x0 + PORCH.x1) / 2, 2.63, (HOME_SHELL.innerD / 2 + PORCH.z1) / 2, 0.3, 0.02, 0.3, 0xfff0d0, false);
  // Door casing + house number
  kit.box(f, FRONT_DOOR.x - FRONT_DOOR.w / 2 - 0.06, (FRONT_DOOR.h + 0.19) / 2, frontFace + 0.015, 0.12, FRONT_DOOR.h + 0.19, 0.03, accent);
  kit.box(f, FRONT_DOOR.x + FRONT_DOOR.w / 2 + 0.06, (FRONT_DOOR.h + 0.19) / 2, frontFace + 0.015, 0.12, FRONT_DOOR.h + 0.19, 0.03, accent);
  kit.box(f, FRONT_DOOR.x, FRONT_DOOR.h + 0.25, frontFace + 0.015, FRONT_DOOR.w + 0.24, 0.12, 0.03, accent);
  metal.box(f, FRONT_DOOR.x + 1.45, 1.75, frontFace + 0.01, 0.3, 0.2, 0.02, 0x2b2d30);
  // Pots on the porch
  for (const x of [PORCH.x0 + 0.7, PORCH.x1 - 0.7]) {
    kit.cylinder(f, x, PORCH.h, PORCH.z1 - 0.9, 0.2, 0.26, 0.5, 0xb8643c, 12);
    blob(leaf, cx + x, PORCH.h + 0.85, cz + PORCH.z1 - 0.9, 0.35, 0.45, 0.35, 0x4f7f3a);
  }

  // —— Façade skins, plinth, window surrounds, sills, burglar bars ——
  for (const run of HOME_WALLS) {
    if (!run.outward) continue;
    const o = run.outward;
    const endExt = run.axis === 'x' ? 0.024 : T + 0.024;
    const skinOff = T / 2 + 0.012;
    for (const p of wallPieces(run)) {
      const a = p.a - (Math.abs(p.a - run.from) < 0.001 ? endExt : 0);
      const b = p.b + (Math.abs(p.b - run.to) < 0.001 ? endExt : 0);
      const mid = (a + b) / 2;
      wallBox(kit, f, run.axis, mid, run.fixed + o * skinOff, b - a, 0.024, p.y0, p.y1, facade);
      if (p.y0 === 0) {
        const pa = a - (Math.abs(p.a - run.from) < 0.001 ? 0.03 : 0);
        const pb = b + (Math.abs(p.b - run.to) < 0.001 ? 0.03 : 0);
        wallBox(kit, f, run.axis, (pa + pb) / 2, run.fixed + o * (skinOff + 0.027), pb - pa, 0.03, 0, 0.55, accent);
      }
    }
    for (const op of run.openings) {
      if (op.kind !== 'window') continue;
      const FT = HOME_SHELL.floorY + HOME_SHELL.floorH / 2;
      const y0 = FT + op.sill;
      const y1 = FT + op.head;
      const off = run.fixed + o * (skinOff + 0.025);
      const sur = shade(facade, 0.9);
      wallBox(kit, f, run.axis, op.at - op.w / 2 - 0.05, off, 0.1, 0.03, y0 - 0.02, y1 + 0.1, sur);
      wallBox(kit, f, run.axis, op.at + op.w / 2 + 0.05, off, 0.1, 0.03, y0 - 0.02, y1 + 0.1, sur);
      wallBox(kit, f, run.axis, op.at, off, op.w, 0.03, y1, y1 + 0.1, sur);
      wallBox(kit, f, run.axis, op.at, run.fixed + o * (skinOff + 0.06), op.w + 0.24, 0.12, y0 - 0.07, y0 - 0.01, 0xd8d2c8);
      const bars = run.fixed + o * (T / 2 - 0.03);
      const n = Math.max(3, Math.round(op.w / 0.14));
      for (let i = 1; i < n; i++) {
        wallBox(metal, f, run.axis, op.at - op.w / 2 + (op.w * i) / n, bars, 0.018, 0.018, y0, y1, gateHex);
      }
      for (const y of [y0 + 0.08, (y0 + y1) / 2, y1 - 0.08]) wallBox(metal, f, run.axis, op.at, bars, op.w, 0.012, y - 0.015, y + 0.015, gateHex);
    }
  }

  // —— Compound wall, pillars, caps, gate lamps ——
  const wallHex = shade(facade, 0.97);
  const capHex = accent;
  for (const run of compoundRuns()) {
    for (const [a, b] of spans(run.from, run.to, run.gaps)) {
      const len = b - a;
      const mid = (a + b) / 2;
      wallBox(kit, f, run.axis, mid, run.fixed, len, YARD.wallT, 0, YARD.wallH, wallHex);
      wallBox(kit, f, run.axis, mid, run.fixed, len + 0.02, YARD.wallT + 0.05, 0, 0.45, capHex);
      wallBox(kit, f, run.axis, mid, run.fixed, len + 0.06, YARD.wallT + 0.08, YARD.wallH, YARD.wallH + 0.08, capHex);
      const n = Math.max(1, Math.round(len / 3.6));
      for (let i = 0; i <= n; i++) {
        const at = a + (len * i) / n;
        wallBox(kit, f, run.axis, at, run.fixed, 0.38, 0.38, 0, YARD.wallH + 0.18, wallHex);
        wallBox(kit, f, run.axis, at, run.fixed, 0.44, 0.44, YARD.wallH + 0.18, YARD.wallH + 0.26, capHex);
      }
    }
  }
  for (const [g0, g1] of compoundRuns()[0]!.gaps) {
    for (const x of [g0 - 0.25, g1 + 0.25]) {
      kit.box(f, x, 1.25, YARD.hz, 0.5, 2.5, 0.5, wallHex);
      kit.box(f, x, 2.54, YARD.hz, 0.58, 0.08, 0.58, capHex);
      metal.box(f, x, 2.6, YARD.hz, 0.22, 0.04, 0.22, 0x2b2d30);
      glow.box(f, x, 2.75, YARD.hz, 0.16, 0.26, 0.16, 0xffe2b0);
      metal.box(f, x, 2.9, YARD.hz, 0.26, 0.05, 0.26, 0x2b2d30);
      pool(B, cx + x, 0.08, cz + YARD.hz + 0.6, 2.2);
      pool(B, cx + x, 0.1, cz + YARD.hz - 0.8, 2.0);
    }
  }

  // —— Gates: pedestrian leaf swung in, sliding car gate parked behind the wall ——
  const wood = gateItem.variant === 'wood';
  {
    const hinge = PED_GATE.x - PED_GATE.w / 2 + 0.03;
    const z0 = YARD.hz - 0.06;
    const len = PED_GATE.w - 0.06;
    metal.box(f, hinge, 1.0, z0 - len / 2, 0.05, 1.9, len, gateHex);
    for (let i = 0; i < 6; i++) metal.box(f, hinge + 0.03, 1.0, z0 - 0.1 - i * (len / 6), 0.02, 1.8, 0.04, shade(gateHex, 1.2));
  }
  {
    const x0 = CAR_GATE.x + CAR_GATE.w / 2 + 0.1;
    const x1 = x0 + CAR_GATE.w + 0.2;
    const z = YARD.hz - 0.32;
    metal.box(f, (x0 + x1) / 2, 0.04, z, x1 - x0 + 0.6, 0.04, 0.08, 0x55595e);
    metal.box(f, (x0 + x1) / 2, 0.15, z, x1 - x0, 0.12, 0.06, gateHex);
    metal.box(f, (x0 + x1) / 2, 2.0, z, x1 - x0, 0.1, 0.06, gateHex);
    if (wood) {
      for (let y = 0.3; y < 1.95; y += 0.16) B.get('kit').box(f, (x0 + x1) / 2, y, z, x1 - x0 - 0.1, 0.12, 0.05, 0x7a5232);
    } else {
      metal.box(f, (x0 + x1) / 2, 0.75, z, x1 - x0 - 0.1, 1.1, 0.03, gateHex);
      for (let x = x0 + 0.12; x < x1 - 0.05; x += 0.14) metal.box(f, x, 1.6, z, 0.025, 0.7, 0.025, gateHex);
    }
    for (const x of [x0, x1]) metal.box(f, x, 1.05, z, 0.07, 2.0, 0.07, gateHex);
  }

  // —— Garden ——
  const kitB = kit;
  for (const t of TREES) buildTree(kitB, leaf, { x: cx + t.x, z: cz + t.z, kind: t.kind, s: t.s });
  // Front bed under the living-room windows
  kit.box(f, 0.35, 0.15, 7.75, 4.3, 0.2, 0.8, 0xb0a898);
  ground.flat(f, -1.75, 2.45, 7.42, 8.08, 0.26, 0x5b3a29);
  for (let i = 0; i < 6; i++) blob(leaf, cx - 1.4 + i * 0.72, 0.55, cz + 7.75, 0.38, 0.32, 0.32, i % 2 ? 0x4f7f3a : 0x3e6a2f);
  // Hedges along the back and side walls
  for (let x = -14; x <= 14; x += 2.4) {
    if (Math.abs(x - 14.6) < 2) continue;
    blob(leaf, cx + x, 0.55, cz - YARD.hz + 0.55, 0.9, 0.6, 0.45, (x * 7) & 1 ? 0x4c7a34 : 0x3f6b2e);
  }
  for (let z = -10; z <= 10; z += 2.6) {
    blob(leaf, cx - YARD.hx + 0.55, 0.5, cz + z, 0.45, 0.55, 0.85, 0x47723a);
    blob(leaf, cx + YARD.hx - 0.55, 0.5, cz + z, 0.45, 0.55, 0.85, 0x47723a);
  }
  // Water tank on its stand + clothesline
  {
    const tx = 14.6;
    const tz = -15.6;
    for (const [dx, dz] of [
      [-0.7, -0.7],
      [0.7, -0.7],
      [-0.7, 0.7],
      [0.7, 0.7],
    ] as const) {
      metal.box(f, tx + dx, 1.0, tz + dz, 0.08, 2.0, 0.08, 0x55595e);
    }
    metal.box(f, tx, 2.02, tz, 1.6, 0.06, 1.6, 0x55595e);
    kit.cylinder(f, tx, 2.05, tz, 0.72, 0.68, 1.4, 0x1e1f21, 16);
    metal.cylinder(f, tx + 0.4, 0.1, tz + 0.6, 0.03, 0.03, 2.0, 0x8a8f93, 6);
    for (const x of [-6, -1]) metal.cylinder(f, x, 0.05, -12.5, 0.04, 0.04, 1.85, 0x8a8f93, 6);
    metal.ribbon([cx - 6, 1.85, cz - 12.5], [cx - 1, 1.85, cz - 12.5], 0.015, 0xd0d0d0);
    const clothes = [0xd9822b, 0x2f4858, 0xf2ede4, 0xb8643c];
    for (let i = 0; i < 4; i++) kit.box(f, -5.2 + i * 1.1, 1.5, -12.5, 0.7, 0.68, 0.02, clothes[i]!);
  }
  // Garden lights along the walkway
  for (const z of [11.5, 14.5]) {
    for (const dx of [-1.0, 1.0]) {
      metal.cylinder(f, PED_GATE.x + dx, 0.05, z, 0.05, 0.05, 0.6, 0x2b2d30, 8);
      glow.box(f, PED_GATE.x + dx, 0.68, z, 0.12, 0.12, 0.12, 0xffdcaa);
      pool(B, cx + PED_GATE.x + dx, 0.1, cz + z, 1.4);
    }
  }

  if (garden === 'flowers' || garden === 'terrace') {
    const pinks = [0xd94f8a, 0xe86aa6, 0xc23d78];
    // Bougainvillea spilling over the street wall
    for (let x = -15; x < 15; x += 1.2) {
      if (x > PED_GATE.x - 1.2 && x < PED_GATE.x + 1.2) continue;
      if (x > CAR_GATE.x - 2.4 && x < CAR_GATE.x + 2.4) continue;
      const pink = pinks[Math.abs(Math.round(x)) % 3]!;
      blob(leaf, cx + x, YARD.wallH + 0.16, cz + YARD.hz - 0.05, 0.62, 0.2, 0.34, 0x4f7f3a);
      blob(leaf, cx + x - 0.2, YARD.wallH + 0.24, cz + YARD.hz + 0.05, 0.36, 0.16, 0.26, pink);
      blob(leaf, cx + x + 0.25, YARD.wallH + 0.2, cz + YARD.hz - 0.12, 0.3, 0.14, 0.24, pink);
      blob(leaf, cx + x + 0.05, YARD.wallH - 0.25, cz + YARD.hz + 0.2, 0.3, 0.3, 0.12, pink);
    }
    // Flower borders along the walkway and the front bed
    const flowers = [0xf2c14e, 0xe86a3a, 0xf4f1ea, 0xd94f8a];
    for (let z = PORCH.z1 + 0.8; z < YARD.hz - 0.6; z += 0.55) {
      for (const dx of [-1.15, 1.15]) blob(leaf, cx + PED_GATE.x + dx, 0.25, cz + z, 0.2, 0.18, 0.2, flowers[Math.round(z * 3) % 4]!);
    }
    for (let i = 0; i < 6; i++) blob(leaf, cx - 1.35 + i * 0.72, 0.78, cz + 7.6, 0.16, 0.1, 0.16, flowers[i % 4]!);
  }
  if (garden === 'terrace') {
    // Paved terrace on the east side with a table, chairs and parasol
    walk.flat(f, 9.3, 14.2, -4.2, 3.8, 0.095, 0xd2c6b2);
    kit.cylinder(f, 11.8, 0.08, -0.2, 0.06, 0.06, 0.72, 0x2b2d30, 8);
    kit.cylinder(f, 11.8, 0.78, -0.2, 0.55, 0.55, 0.04, 0xe9e1d0, 18);
    for (const dx of [-0.95, 0.95]) {
      kit.box(f, 11.8 + dx, 0.45, -0.2, 0.46, 0.06, 0.46, 0x7a5232);
      kit.box(f, 11.8 + dx * 1.18, 0.75, -0.2, 0.06, 0.6, 0.46, 0x7a5232);
    }
    metal.cylinder(f, 11.8, 0.82, -0.2, 0.025, 0.025, 1.6, 0x8a8f93, 6);
    kit.cylinder(f, 11.8, 2.3, -0.2, 1.4, 0.05, 0.42, 0xb8643c, 12);
    for (const [x, z] of [
      [9.6, -3.9],
      [13.9, -3.9],
      [9.6, 3.5],
      [13.9, 3.5],
    ] as const) {
      metal.cylinder(f, x, 0.07, z, 0.04, 0.04, 0.45, 0x2b2d30, 8);
      glow.box(f, x, 0.55, z, 0.1, 0.08, 0.1, 0xffdcaa);
      pool(B, cx + x, 0.11, cz + z, 1.3);
    }
  }

  return B.group('player-house-visual');
}

/** Axis-aligned slab of a wall run in house-local metres (y range from the ground). */
function wallBox(
  B: KitBatch,
  f: Frame,
  axis: 'x' | 'z',
  along: number,
  across: number,
  len: number,
  thick: number,
  y0: number,
  y1: number,
  hex: number,
): void {
  const y = (y0 + y1) / 2;
  if (axis === 'x') B.box(f, along, y, across, len, y1 - y0, thick, hex);
  else B.box(f, across, y, along, thick, y1 - y0, len, hex);
}

const ID = new Frame();
function blob(B: KitBatch, x: number, y: number, z: number, rx: number, ry: number, rz: number, hex: number): void {
  // Octahedron-ish clump: cheap rounded foliage in the shared leaf batch
  const pts: Array<[number, number, number]> = [
    [x + rx, y, z],
    [x - rx, y, z],
    [x, y + ry, z],
    [x, y - ry * 0.6, z],
    [x, y, z + rz],
    [x, y, z - rz],
  ];
  const faces: Array<[number, number, number]> = [
    [2, 4, 0],
    [2, 1, 4],
    [2, 5, 1],
    [2, 0, 5],
    [3, 0, 4],
    [3, 4, 1],
    [3, 1, 5],
    [3, 5, 0],
  ];
  faces.forEach(([a, b, c], i) => B.tri(ID, pts[a]!, pts[b]!, pts[c]!, i % 2 ? hex : shade(hex, 0.88)));
}

export function isInsidePlayerHouse(x: number, z: number): boolean {
  const { cx, cz, interiorHalfW, interiorHalfD } = PLAYER_HOUSE;
  return Math.abs(x - cx) < interiorHalfW - 0.35 && Math.abs(z - cz) < interiorHalfD - 0.35;
}

export function vehicleBlockedByPlayerHouse(x: number, z: number, pad = 1.1): boolean {
  const { cx, cz, interiorHalfW, interiorHalfD } = PLAYER_HOUSE;
  return Math.abs(x - cx) < interiorHalfW + pad && Math.abs(z - cz) < interiorHalfD + pad;
}

/**
 * Home mode: hide city + façade/ceiling; warm isometric-friendly lighting.
 */
export function setHomeInteriorMode(
  houseRoot: THREE.Object3D,
  cityRoot: THREE.Object3D,
  scene: THREE.Scene,
  enabled: boolean,
): void {
  const house =
    houseRoot.name === 'landmark-player-house'
      ? (houseRoot as THREE.Group)
      : (houseRoot.getObjectByName('landmark-player-house') as THREE.Group | null);
  if (!house) return;

  const was = !!house.userData.homeMode;
  if (was === enabled) return;
  house.userData.homeMode = enabled;

  const exterior = house.userData.exterior as THREE.Object3D | undefined;
  const roof = house.userData.roof as THREE.Object3D | undefined;
  const ceiling = house.getObjectByName('home-ceiling');
  if (exterior) exterior.visible = !enabled;
  if (roof) roof.visible = !enabled;
  if (ceiling) ceiling.visible = !enabled;

  for (const name of ['parked-cars', 'traffic', 'pedestrians', 'taxi-stands']) {
    const g = scene.getObjectByName(name);
    if (g) g.visible = !enabled;
  }

  if (enabled) {
    if (house.parent !== scene) {
      house.userData.prevParent = house.parent;
      scene.attach(house);
    }
    cityRoot.visible = false;
    dimSunForInterior(house, scene);
  } else {
    cityRoot.visible = true;
    const prev = house.userData.prevParent as THREE.Object3D | undefined;
    if (prev) prev.attach(house);
    house.userData.prevParent = undefined;
    restoreOutdoorAtmosphere(scene);
    const sun = scene.children.find((c) => c instanceof THREE.DirectionalLight) as THREE.DirectionalLight | undefined;
    if (sun && house.userData.prevSunIntensity != null) {
      sun.intensity = house.userData.prevSunIntensity as number;
      sun.color.setHex(0xffe0ac);
    }
  }
}

function dimSunForInterior(house: THREE.Group, scene: THREE.Scene): void {
  applyIndoorAtmosphere(scene);
  const sun = scene.children.find((c) => c instanceof THREE.DirectionalLight) as THREE.DirectionalLight | undefined;
  if (!sun) return;
  house.userData.prevSunIntensity = sun.intensity;
  sun.intensity = 0.55;
  sun.color.setHex(0xffe0b2);
}

/** Re-dim after a day/night pass ran while the player was still indoors. */
export function refreshHomeInteriorLook(houseRoot: THREE.Object3D, scene: THREE.Scene): void {
  const house =
    houseRoot.name === 'landmark-player-house'
      ? (houseRoot as THREE.Group)
      : (houseRoot.getObjectByName('landmark-player-house') as THREE.Group | null);
  if (!house || !house.userData.homeMode) return;
  dimSunForInterior(house, scene);
}

export function updatePlayerHouseInterior(root: THREE.Object3D, playerX: number, playerZ: number): void {
  const house = root.getObjectByName('landmark-player-house') as THREE.Group | undefined;
  if (!house || house.userData.homeMode) return;
  const roof = house.userData.roof as THREE.Object3D | undefined;
  if (roof) roof.visible = !isInsidePlayerHouse(playerX, playerZ);
}
