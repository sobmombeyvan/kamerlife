import * as THREE from 'three';
import { Frame } from '../city/Batch';
import type { CollisionSystem } from '../world/CollisionSystem';
import { homeWallMat } from './homeMaterials';
import { retileMeshInPlace } from '../render/surfaces';
import {
  FRONT_DOOR,
  HOME_FIXTURES,
  HOME_FLOOR_TOP,
  HOME_ROOMS,
  HOME_SHELL,
  HOME_WALLS,
  WALL_TOP,
  inRect,
  wallPieces,
  type Opening,
  type WallRun,
} from './homeLayout';
import { HomeKit } from './homeKit';
import { createHomeDoor, getHomeSpots } from './HomeInteract';

export { HOME_SHELL };

const FT = HOME_FLOOR_TOP;
const TRIM = 0xf4f1ea;
const OAK = 0xb08458;
const ALU = 0x3b3b3d;

/** Frame on a wall opening: origin at the gap centre on the wall axis, floor-top height, local +Z toward `side`. */
export function openingFrame(run: WallRun, at: number, side: 1 | -1, cx = 0, cz = 0, y = FT): Frame {
  if (run.axis === 'x') return new Frame(cx + at, cz + run.fixed, side > 0 ? 0 : Math.PI, y);
  return new Frame(cx + run.fixed, cz + at, side > 0 ? Math.PI / 2 : -Math.PI / 2, y);
}

/** Inner side of an exterior wall, or both sides of a partition. */
function roomSides(run: WallRun): Array<1 | -1> {
  if (run.outward) return [(-run.outward) as 1 | -1];
  return [1, -1];
}

function sidePoint(run: WallRun, along: number, side: 1 | -1, off = 0.25): [number, number] {
  const p = run.fixed + side * (run.t / 2 + off);
  return run.axis === 'x' ? [along, p] : [p, along];
}

/**
 * Playable interior shell: floor, painted walls with real door and window openings,
 * glazing, interior doors, built-in furniture, ceiling fixtures and lights.
 */
export function buildHomeInteriorShell(
  interior: THREE.Group,
  collisions: CollisionSystem,
  cx: number,
  cz: number,
): void {
  const { wallH, innerW, innerD, floorY, floorH } = HOME_SHELL;

  const floor = new THREE.Mesh(new THREE.BoxGeometry(innerW + 0.3, floorH, innerD + 0.3), homeWallMat(0xd9cbb4));
  floor.name = 'home-floor';
  floor.position.set(cx, floorY, cz);
  floor.receiveShadow = true;
  interior.add(floor);

  // —— Walls (one mesh, retinted by the decor shop) ——
  const wallKit = new HomeKit();
  const W = wallKit.b('paint');
  const origin = new Frame(cx, cz, 0, 0);
  for (const run of HOME_WALLS) {
    for (const p of wallPieces(run)) {
      const mid = (p.a + p.b) / 2;
      const len = p.b - p.a;
      const h = p.y1 - p.y0;
      const y = (p.y0 + p.y1) / 2;
      if (run.axis === 'x') {
        W.box(origin, mid, y, run.fixed, len, h, run.t, 0xffffff, false);
        collisions.addBox(cx + mid, y, cz + run.fixed, len / 2 + 0.02, h / 2, run.t / 2 + 0.03);
      } else {
        W.box(origin, run.fixed, y, mid, run.t, h, len, 0xffffff, false);
        collisions.addBox(cx + run.fixed, y, cz + mid, run.t / 2 + 0.03, h / 2, len / 2 + 0.02);
      }
    }
  }
  const wallGeo = W.build(1 / 2.2)!;
  const walls = new THREE.Mesh(wallGeo, homeWallMat(0xf3ede2));
  walls.name = 'homeWall';
  walls.userData.homeWall = true;
  walls.castShadow = true;
  walls.receiveShadow = true;
  interior.add(walls);

  const caps = new HomeKit();
  for (const run of HOME_WALLS) {
    for (const p of wallPieces(run)) {
      if (p.y1 < WALL_TOP - 0.02) continue;
      const mid = (p.a + p.b) / 2;
      const len = p.b - p.a;
      if (run.axis === 'x') caps.box('paint', cx + mid, WALL_TOP + 0.015, cz + run.fixed, len + 0.02, 0.03, run.t + 0.04, 0xc9bfb0);
      else caps.box('paint', cx + run.fixed, WALL_TOP + 0.015, cz + mid, run.t + 0.04, 0.03, len + 0.02, 0xc9bfb0);
    }
  }
  interior.add(caps.group('home-wall-cap', { shadows: false }));

  const k = new HomeKit();
  for (const run of HOME_WALLS) {
    addSkirting(k, run, cx, cz);
    for (const op of run.openings) {
      if (op.kind === 'window') addWindow(k, run, op, cx, cz);
      else if (op.kind === 'door') addInteriorDoor(k, run, op, cx, cz);
      else addCasing(k, run, op, cx, cz, roomSides(run));
    }
  }
  // Entry threshold
  k.box('stone', cx + FRONT_DOOR.x, FT - 0.005, cz + innerD / 2, FRONT_DOOR.w + 0.1, 0.03, HOME_SHELL.wallT + 0.04, 0x9d968a);

  addBuiltIns(k, cx, cz);
  interior.add(k.group('home-shell-detail'));

  for (const f of HOME_FIXTURES) {
    collisions.addBox(cx + (f.x0 + f.x1) / 2, FT + f.h / 2, cz + (f.z0 + f.z1) / 2, (f.x1 - f.x0) / 2, f.h / 2, (f.z1 - f.z0) / 2);
  }

  createHomeDoor(interior, collisions, cx + FRONT_DOOR.x, cz + innerD / 2, FT, FRONT_DOOR.w - 0.04, FRONT_DOOR.h - 0.03);

  // —— Ceiling + fixtures (hidden together in the top-down view) ——
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(innerW, 0.06, innerD), homeWallMat(0xfbf8f2));
  ceiling.name = 'home-ceiling';
  ceiling.position.set(cx, WALL_TOP - 0.03, cz);
  retileMeshInPlace(ceiling, 1.6);
  interior.add(ceiling);
  const ck = new HomeKit();
  const cy = -0.03;
  for (const [x, z, r] of [
    [2.9, 2.6, 0.26],
    [-5.0, -3.4, 0.24],
    [4.6, -5.4, 0.2],
    [-6.2, 1.9, 0.16],
    [-3.4, 1.9, 0.13],
    [-5.0, 5.2, 0.18],
  ] as const) {
    ck.cyl('paint', x, cy - 0.04, z, r + 0.03, r + 0.03, 0.04, 0xf6f3ec, 20);
    ck.cyl('glow', x, cy - 0.05, z, r, r, 0.012, 0xfff1d8, 20);
  }
  // Dining pendant
  ck.cyl('metal', -0.7, -0.62, -4.3, 0.006, 0.006, 0.6, 0x222222, 6);
  ck.cyl('metal', -0.7, -0.88, -4.3, 0.26, 0.05, 0.26, 0x2a2a2c, 20);
  ck.cyl('glow', -0.7, -0.9, -4.3, 0.07, 0.07, 0.06, 0xfff1d8, 10);
  ck.into(ceiling);

  // —— Lights ——
  const lights = new THREE.Group();
  lights.name = 'home-lights';
  const main = new THREE.PointLight(0xffd8ae, 9, 15, 1.6);
  main.name = 'home-point-light';
  main.position.set(cx + 2.9, FT + 2.6, cz + 1.2);
  main.castShadow = true;
  main.shadow.mapSize.set(512, 512);
  main.shadow.bias = -0.002;
  main.userData.base = 9;
  lights.add(main);
  for (const [x, z, i, d] of [
    [-5.0, -3.4, 5, 8],
    [4.6, -5.0, 5, 8],
    [-6.0, 1.9, 3, 5],
  ] as const) {
    const l = new THREE.PointLight(0xffe2bf, i, d, 1.6);
    l.name = 'home-light';
    l.userData.base = i;
    l.position.set(cx + x, FT + 2.5, cz + z);
    lights.add(l);
  }
  interior.add(lights);

  const hemi = new THREE.HemisphereLight(0xfff0d8, 0x8d7a66, 0.55);
  hemi.name = 'home-hemi';
  hemi.position.set(cx, floorY + 2, cz);
  interior.add(hemi);

  void wallH;
  interior.userData.homeSpots = getHomeSpots(cx, cz);
}

function addSkirting(k: HomeKit, run: WallRun, cx: number, cz: number): void {
  const breaks = run.openings.filter((o) => o.sill === 0).sort((a, b) => a.at - b.at);
  const spans: Array<[number, number]> = [];
  let cur = run.from;
  for (const o of breaks) {
    spans.push([cur, o.at - o.w / 2 - 0.07]);
    cur = o.at + o.w / 2 + 0.07;
  }
  spans.push([cur, run.to]);
  for (const side of roomSides(run)) {
    for (const [a, b] of spans) {
      if (b - a < 0.05) continue;
      const mid = (a + b) / 2;
      const [px, pz] = sidePoint(run, mid, side);
      if (inRect(HOME_ROOMS.bath, px, pz)) continue;
      const f = openingFrame(run, mid, side, cx, cz);
      k.box('paint', 0, 0.045, run.t / 2 + 0.007, b - a, 0.09, 0.014, 0xe9e3d8, f);
    }
  }
}

function addCasing(k: HomeKit, run: WallRun, op: Opening, cx: number, cz: number, sides: Array<1 | -1>): void {
  for (const side of sides) {
    const f = openingFrame(run, op.at, side, cx, cz);
    const z = run.t / 2 + 0.01;
    const hw = op.w / 2;
    k.box('paint', -hw - 0.035, op.head / 2, z, 0.07, op.head, 0.02, TRIM, f);
    k.box('paint', hw + 0.035, op.head / 2, z, 0.07, op.head, 0.02, TRIM, f);
    k.box('paint', 0, op.head + 0.035, z, op.w + 0.14, 0.07, 0.02, TRIM, f);
  }
  // Reveal lining inside the opening
  const f = openingFrame(run, op.at, 1, cx, cz);
  k.box('paint', -op.w / 2 + 0.01, op.head / 2, 0, 0.02, op.head, run.t, TRIM, f);
  k.box('paint', op.w / 2 - 0.01, op.head / 2, 0, 0.02, op.head, run.t, TRIM, f);
  k.box('paint', 0, op.head - 0.01, 0, op.w, 0.02, run.t, TRIM, f);
}

function addInteriorDoor(k: HomeKit, run: WallRun, op: Opening, cx: number, cz: number): void {
  addCasing(k, run, op, cx, cz, [1, -1]);
  const swing = op.swing ?? 1;
  const hinge = op.hinge ?? -1;
  const f = openingFrame(run, op.at, swing, cx, cz);
  // Sign of local x against the run axis for this frame orientation.
  const flip = run.axis === 'x' ? swing : -swing;
  const hx = hinge * flip * (op.w / 2 - 0.04);
  const leafW = op.w - 0.08;
  const leafH = op.head - 0.03;
  const lz = run.t / 2 + leafW / 2;
  const lx = hx - Math.sign(hx) * 0.025;
  k.soft('paint', lx, leafH / 2 + 0.01, lz, 0.04, leafH, leafW, 0.006, 0xf7f4ee, f);
  k.box('paint', lx + 0.021 * Math.sign(-hx || 1), leafH * 0.5, lz, 0.004, leafH * 0.82, leafW * 0.7, 0xeeeae2, f);
  k.box('chrome', lx + 0.035, 1.0, lz + leafW / 2 - 0.08, 0.03, 0.025, 0.12, 0xc9c9c9, f);
  k.box('chrome', lx - 0.035, 1.0, lz + leafW / 2 - 0.08, 0.03, 0.025, 0.12, 0xc9c9c9, f);
}

function addWindow(k: HomeKit, run: WallRun, op: Opening, cx: number, cz: number): void {
  const inner = (run.outward ? -run.outward : 1) as 1 | -1;
  const f = openingFrame(run, op.at, inner, cx, cz);
  const hw = op.w / 2;
  const h = op.head - op.sill;
  const ym = op.sill + h / 2;
  // Aluminium frame in the wall plane
  k.box('metal', -hw + 0.03, ym, 0, 0.06, h, 0.09, ALU, f);
  k.box('metal', hw - 0.03, ym, 0, 0.06, h, 0.09, ALU, f);
  k.box('metal', 0, op.head - 0.03, 0, op.w, 0.06, 0.09, ALU, f);
  k.box('metal', 0, op.sill + 0.03, 0, op.w, 0.06, 0.09, ALU, f);
  // Two sliding sashes
  const sash = (x: number, z: number) => {
    const sw = hw + 0.02;
    k.box('metal', x - sw / 2 + 0.02, ym, z, 0.04, h - 0.1, 0.03, ALU, f);
    k.box('metal', x + sw / 2 - 0.02, ym, z, 0.04, h - 0.1, 0.03, ALU, f);
    k.box('metal', x, op.head - 0.075, z, sw, 0.035, 0.03, ALU, f);
    k.box('metal', x, op.sill + 0.075, z, sw, 0.035, 0.03, ALU, f);
    k.box('glass', x, ym, z, sw - 0.06, h - 0.16, 0.008, op.sill > 1.4 ? 0xe6eef0 : 0xbcd6de, f);
  };
  sash(-hw / 2 + 0.01, -0.018);
  sash(hw / 2 - 0.01, 0.018);
  // Interior sill + reveal lining
  k.box('stone', 0, op.sill - 0.02, run.t / 2 - 0.02, op.w + 0.12, 0.04, 0.12, 0xe8e2d6, f);
  k.box('paint', -hw + 0.005, ym, run.t / 4, 0.01, h, run.t / 2, TRIM, f);
  k.box('paint', hw - 0.005, ym, run.t / 4, 0.01, h, run.t / 2, TRIM, f);
  k.box('paint', 0, op.head - 0.005, run.t / 4, op.w, 0.01, run.t / 2, TRIM, f);
}

function lamp(k: HomeKit, f: Frame, x: number, y: number, z: number, shadeHex: number): void {
  k.cyl('ceramic', x, y, z, 0.07, 0.05, 0.05, 0xd8cdb9, 14, f);
  k.cyl('ceramic', x, y + 0.05, z, 0.05, 0.07, 0.16, 0xd8cdb9, 14, f);
  k.cyl('metal', x, y + 0.21, z, 0.008, 0.008, 0.1, 0x8a7a5a, 6, f);
  k.cyl('fabric', x, y + 0.27, z, 0.15, 0.11, 0.18, shadeHex, 16, f);
  k.cyl('glow', x, y + 0.28, z, 0.04, 0.04, 0.08, 0xfff0d0, 8, f);
}

/** Static built-in furniture (finish-independent). Footprints come from HOME_FIXTURES. */
function addBuiltIns(k: HomeKit, cx: number, cz: number): void {
  // Bedroom wardrobe: 3 doors, one mirrored, facing -x
  {
    const f = new Frame(cx - 2.2 - 0.07 - 0.31, cz - 5.5, -Math.PI / 2, FT);
    k.box('wood', 0, 0.05, 0, 1.8, 0.1, 0.58, 0x4a3b2e, f);
    k.soft('paint', 0, 1.1, 0, 1.8, 2.0, 0.6, 0.01, 0xefe8dc, f);
    k.box('wood', 0, 2.115, 0.005, 1.84, 0.05, 0.62, OAK, f);
    for (let i = 0; i < 3; i++) {
      const x = -0.6 + i * 0.6;
      k.box('paint', x, 1.12, 0.302, 0.58, 1.92, 0.012, 0xf4eee4, f);
      if (i === 2) k.box('chrome', x, 1.15, 0.31, 0.46, 1.6, 0.006, 0xdfe7ea, f);
      const hx = i === 0 ? x + 0.24 : x - 0.24;
      k.box('chrome', hx, 1.1, 0.325, 0.018, 0.34, 0.02, 0xbdbdbd, f);
    }
  }
  // Nightstands + lamps
  for (const z of [-4.56, -2.24]) {
    const f = new Frame(cx - 7.86 + 0.24, cz + z, Math.PI / 2, FT);
    k.soft('wood', 0, 0.3, 0, 0.46, 0.5, 0.44, 0.015, OAK, f);
    k.box('paint', 0, 0.38, 0.222, 0.4, 0.16, 0.006, 0xa57a50, f);
    k.box('chrome', 0, 0.38, 0.23, 0.12, 0.014, 0.014, 0xbdbdbd, f);
    k.box('wood', 0, 0.03, 0, 0.42, 0.06, 0.4, 0x4a3b2e, f);
    lamp(k, f, 0.05, 0.55, -0.02, 0xf3e6cf);
  }
  // Wall art above the bed
  {
    const f = new Frame(cx - 7.86, cz - 3.4, Math.PI / 2, FT);
    k.soft('wood', 0, 1.62, 0.02, 1.3, 0.5, 0.03, 0.006, 0x2a1f18, f);
    k.box('paint', -0.32, 1.62, 0.037, 0.56, 0.38, 0.004, 0xc77d4a, f);
    k.box('paint', 0.32, 1.62, 0.037, 0.56, 0.38, 0.004, 0x3f5e5a, f);
  }
  // Bedroom rug
  {
    const f = new Frame(cx - 5.05, cz - 3.4, Math.PI / 2, FT);
    k.soft('fabric', 0, 0.008, 0, 2.0, 0.016, 1.3, 0.006, 0xd9c7a6, f);
    k.box('fabric', 0, 0.0165, 0, 1.8, 0.002, 1.1, 0xb98d62, f);
  }
  // Desk / dressing table against the bathroom wall, chair in front
  {
    const f = new Frame(cx - 4.45, cz + 0.2 - 0.07 - 0.26, Math.PI, FT);
    k.soft('wood', 0, 0.74, 0, 1.2, 0.04, 0.52, 0.01, OAK, f);
    k.soft('wood', 0.4, 0.4, 0.0, 0.38, 0.66, 0.48, 0.01, 0xefe8dc, f);
    for (const y of [0.22, 0.48]) k.box('chrome', 0.4, y, 0.245, 0.12, 0.012, 0.012, 0xbdbdbd, f);
    k.box('wood', -0.56, 0.36, 0, 0.04, 0.72, 0.46, OAK, f);
    // Laptop + books + mirror
    k.box('metal', -0.15, 0.768, 0.02, 0.34, 0.015, 0.24, 0x9da3a8, f);
    k.box('screen', -0.15, 0.88, -0.1, 0.34, 0.22, 0.01, 0x15181c, f);
    k.box('paint', -0.45, 0.78, -0.12, 0.18, 0.05, 0.24, 0x7a3b2e, f);
    k.box('paint', -0.45, 0.82, -0.12, 0.16, 0.04, 0.22, 0xd9c7a6, f);
    k.soft('wood', 0.2, 1.45, -0.24, 0.6, 0.8, 0.03, 0.01, OAK, f);
    k.box('chrome', 0.2, 1.45, -0.222, 0.52, 0.72, 0.004, 0xdfe7ea, f);
    // Chair
    const c = new Frame(cx - 4.45, cz - 0.62, Math.PI, FT);
    for (const [x, z] of [
      [-0.18, -0.17],
      [0.18, -0.17],
      [-0.18, 0.17],
      [0.18, 0.17],
    ] as const) {
      k.box('metal', x, 0.22, z, 0.03, 0.44, 0.03, 0x2a2a2c, c);
    }
    k.soft('fabric', 0, 0.47, 0, 0.42, 0.06, 0.4, 0.02, 0x8a9a7b, c);
    k.soft('fabric', 0, 0.75, 0.19, 0.42, 0.34, 0.05, 0.02, 0x8a9a7b, c);
  }
  // Living bookshelf on the partition
  {
    const f = new Frame(cx - 2.2 + 0.07 + 0.18, cz + 0.9, Math.PI / 2, FT);
    k.box('wood', -0.58, 0.92, 0, 0.03, 1.84, 0.34, WALNUT_SHELF, f);
    k.box('wood', 0.58, 0.92, 0, 0.03, 1.84, 0.34, WALNUT_SHELF, f);
    k.box('wood', 0, 0.92, -0.16, 1.16, 1.84, 0.02, 0x8a6a4a, f);
    const books = [0x7a3b2e, 0x2f4858, 0xd9c7a6, 0x3c6e71, 0xc9a66b, 0x5b3a29];
    for (let r = 0; r < 5; r++) {
      const y = 0.04 + r * 0.44;
      k.box('wood', 0, y, 0, 1.16, 0.03, 0.34, WALNUT_SHELF, f);
      if (r === 4) continue;
      let x = -0.5;
      for (let i = 0; i < 7 && x < 0.45; i++) {
        const w = 0.04 + ((r * 7 + i) % 3) * 0.02;
        const h = 0.22 + ((r + i) % 4) * 0.035;
        if ((r + i) % 5 !== 4) k.box('paint', x + w / 2, y + 0.015 + h / 2, 0.02, w, h, 0.22, books[(r * 3 + i) % books.length]!, f);
        x += w + 0.012;
      }
      if (r === 1) k.cyl('ceramic', 0.38, y + 0.015, 0, 0.06, 0.05, 0.18, 0x3c6e71, 12, f);
      if (r === 2) k.blob('leaf', 0.35, y + 0.12, 0, 0.12, 0.1, 0.1, 0x4f7f3a, f);
    }
  }
  // Storage room: metal rack, washer, water drums, broom
  {
    const f = new Frame(cx - 4.6 + 0.07 + 0.21, cz + 1.4, Math.PI / 2, FT);
    for (const x of [-0.88, 0.88]) {
      for (const z of [-0.18, 0.18]) k.box('metal', x, 0.95, z, 0.03, 1.9, 0.03, 0x8d9296, f);
    }
    const boxes = [0xc9a66b, 0xa57a50, 0xe8e2d6, 0x7f8f9a];
    for (let r = 0; r < 4; r++) {
      const y = 0.12 + r * 0.55;
      k.box('metal', 0, y, 0, 1.8, 0.02, 0.38, 0xa9aeb2, f);
      if (r < 3) {
        k.box('paint', -0.45, y + 0.15, 0, 0.5, 0.28, 0.32, boxes[r]!, f);
        k.box('paint', 0.3, y + 0.12, 0.02, 0.42, 0.22, 0.3, boxes[(r + 2) % 4]!, f);
      }
    }
    const wsh = new Frame(cx - 2.2 - 0.07 - 0.31, cz + 0.62, -Math.PI / 2, FT);
    k.soft('paint', 0, 0.43, 0, 0.6, 0.86, 0.6, 0.03, 0xf4f4f2, wsh);
    k.box('chrome', 0, 0.42, 0.302, 0.4, 0.4, 0.01, 0xc9cdd0, wsh);
    k.box('glass', 0, 0.42, 0.31, 0.32, 0.32, 0.01, 0x6f8792, wsh);
    k.box('screen', 0.15, 0.78, 0.302, 0.22, 0.05, 0.006, 0x2a2e33, wsh);
    for (const [x, z] of [
      [-4.38, 3.12],
      [-4.1, 3.12],
    ] as const) {
      k.cyl('paint', cx + x, FT, cz + z, 0.13, 0.13, 0.82, 0x2f6fb0, 14);
      k.cyl('paint', cx + x, FT + 0.82, cz + z, 0.04, 0.04, 0.06, 0x1f4f80, 8);
    }
    k.cyl('paint', cx - 3.0, FT, cz + 1.9, 0.16, 0.2, 0.28, 0x2e7d5b, 14);
    k.box('wood', cx - 2.38, FT + 0.75, cz + 2.2, 0.03, 1.5, 0.03, 0xa57a50);
    k.box('fabric', cx - 2.38, FT + 0.08, cz + 2.2, 0.06, 0.16, 0.24, 0xc9a66b);
  }
  // Entrance hall: shoe cabinet, mirror, key bowl, coat hooks, doormat, plant
  {
    const f = new Frame(cx - 7.86 + 0.2, cz + 5.0, Math.PI / 2, FT);
    k.soft('wood', 0, 0.45, 0, 1.2, 0.8, 0.38, 0.015, OAK, f);
    for (const x of [-0.3, 0.3]) {
      k.box('paint', x, 0.45, 0.192, 0.58, 0.74, 0.006, 0xa57a50, f);
      for (let s = 0; s < 6; s++) k.box('paint', x, 0.16 + s * 0.11, 0.197, 0.54, 0.012, 0.004, 0x7a5a3a, f);
    }
    k.cyl('ceramic', -0.35, 0.85, 0, 0.11, 0.07, 0.06, 0x3c6e71, 16, f);
    k.cyl('ceramic', 0.38, 0.85, 0, 0.07, 0.06, 0.22, 0xe9e1d3, 12, f);
    k.blob('leaf', 0.38, 1.18, 0, 0.13, 0.12, 0.13, 0x4f7f3a, f);
    k.soft('wood', 0, 1.6, -0.17, 0.7, 0.9, 0.03, 0.01, 0x2a1f18, f);
    k.box('chrome', 0, 1.6, -0.152, 0.62, 0.82, 0.004, 0xdfe7ea, f);
    const hooks = new Frame(cx - 6.3, cz + 7 - 0.14, Math.PI, FT);
    k.box('wood', 0, 1.65, 0.02, 0.8, 0.08, 0.025, OAK, hooks);
    for (const x of [-0.28, 0, 0.28]) k.cyl('chrome', x, 1.62, 0.05, 0.012, 0.012, 0.05, 0xbdbdbd, 6, hooks);
    k.soft('fabric', -0.28, 1.25, 0.07, 0.36, 0.7, 0.06, 0.03, 0x2f4858, hooks);
    k.soft('fabric', 0.28, 1.35, 0.07, 0.32, 0.5, 0.05, 0.03, 0xb85c38, hooks);
    k.soft('fabric', cx + FRONT_DOOR.x, FT + 0.008, cz + 6.35, 0.95, 0.016, 0.6, 0.005, 0x6b4f35);
    k.cyl('ceramic', cx - 2.75, FT, cz + 3.98, 0.17, 0.21, 0.4, 0xe8e2d6, 16);
    k.cyl('wood', cx - 2.75, FT + 0.4, cz + 3.98, 0.025, 0.02, 0.8, 0x6b4f35, 6);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      k.blob('leaf', cx - 2.75 + Math.cos(a) * 0.15, FT + 0.85 + i * 0.07, cz + 3.98 + Math.sin(a) * 0.15, 0.14, 0.06, 0.1, i % 2 ? 0x4f7f3a : 0x3e6a2f);
    }
  }
}

const WALNUT_SHELF = 0x6e4a32;
