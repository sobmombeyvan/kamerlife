import * as THREE from 'three';
import { mat } from '../world/materials';
import type { CollisionSystem } from '../world/CollisionSystem';
import { shopNameFor } from '../data/shopNames';
import { addTextSign } from '../landmarks/signage';
import { surfaceMat } from '../render/surfaces';
import { bakeAndMerge } from '../render/mergeStatic';

export type BuildingKind =
  | 'house'
  | 'shop'
  | 'flat'
  | 'landmark'
  | 'market'
  | 'villa'
  | 'fuel'
  | 'clinic'
  | 'office'
  | 'warehouse';

export type BuildingDetail = 'full' | 'medium' | 'simple';

export type BuildingSpec = {
  id: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color: number;
  kind: BuildingKind;
  districtId?: string;
  yaw?: number;
  collide?: boolean;
  /** Mesh budget: far buildings skip windows/fences. */
  detail?: BuildingDetail;
};

const geoBox = new THREE.BoxGeometry(1, 1, 1);
geoBox.userData.shared = true;
const geoCone = new THREE.ConeGeometry(0.72, 1.2, 4);
geoCone.userData.shared = true;

/** Procedural Yaoundé-style building with kind-specific details. */
export function createBuilding(spec: BuildingSpec, collisions?: CollisionSystem): THREE.Group {
  const group = new THREE.Group();
  group.name = spec.id;
  group.position.set(spec.x, 0, spec.z);
  if (spec.yaw) group.rotation.y = spec.yaw;
  group.userData = { type: 'building', procedural: true, ...spec };

  const w = spec.width;
  const d = spec.depth;
  const h = spec.height;

  const plinthColor = spec.kind === 'villa' || spec.kind === 'office' ? 0xb0a89a : 0x9a8b78;
  group.add(mesh(geoBox, surfaceMat('concrete', plinthColor), 0, 0.08, 0, w + 1.2, 0.16, d + 1.2));

  const detail = spec.detail ?? 'full';
  const body = mesh(geoBox, surfaceMat('plaster', spec.color), 0, h / 2, 0, w, h, d);
  body.castShadow = detail === 'full' && h > 10;
  body.receiveShadow = detail !== 'simple';
  group.add(body);

  if (detail !== 'simple' && (spec.kind === 'flat' || spec.kind === 'office')) {
    const stripe = mesh(geoBox, mat(0x37474f), 0, 1.4, d / 2 + 0.05, w * 0.98, 2.6, 0.12);
    group.add(stripe);
  }

  addRoof(group, spec);
  if (detail === 'full') addWindows(group, spec);
  else if (detail === 'medium') addWindowsSparse(group, spec);
  addDoor(group, spec);

  if (detail !== 'simple') {
    if (spec.kind === 'shop' || spec.kind === 'market') addAwning(group, spec);
    if (spec.kind === 'office') addGlassCurtain(group, spec);
    if (spec.kind === 'warehouse') addWarehouseDetails(group, spec);
    if (spec.kind === 'market') addCorrugatedDetails(group, spec);
    if (spec.kind === 'fuel') addFuelCanopy(group, spec);
    if (spec.kind === 'clinic') addCross(group, spec);
    if (spec.kind === 'landmark') addLandmarkTrim(group, spec);
  }
  if (detail === 'full') {
    if (spec.kind === 'villa' || spec.kind === 'house') addFence(group, spec);
    if (spec.kind === 'flat' || spec.kind === 'landmark' || spec.kind === 'office') addRoofProps(group, spec);
    if (spec.kind === 'flat') addBalconies(group, spec);
  }

  // Named commercial facade (Santa Lucia style readable signs)
  if (
    detail !== 'simple' &&
    (spec.kind === 'shop' || spec.kind === 'market' || spec.kind === 'fuel' || spec.kind === 'clinic')
  ) {
    const shopName = shopNameFor(spec.kind, spec.x, spec.z);
    group.userData.shopName = shopName;
    group.userData.displayName = shopName;
    const signW = Math.min(spec.width * 0.92, 10);
    const signH = 0.7;
    addTextSign(group, 0, Math.max(3.4, Math.min(h - 0.4, 4.2)), d / 2 + 0.2, signW, signH, shopName, {
      bg: spec.kind === 'fuel' ? 0xc62828 : spec.kind === 'clinic' ? 0xffffff : 0x10251f,
      fg: spec.kind === 'fuel' ? 0xffffff : spec.kind === 'clinic' ? 0xc62828 : 0xffc857,
      yaw: 0,
    });
  }

  if (collisions && spec.collide !== false) {
    // Slight pad so cars / player don't sink into facades
    collisions.addBox(spec.x, h / 2, spec.z, w / 2 + 0.55, h / 2, d / 2 + 0.55);
  }

  bakeAndMerge(group);
  return group;
}

function mesh(
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

function addRoof(group: THREE.Group, spec: BuildingSpec): void {
  const w = spec.width;
  const d = spec.depth;
  const h = spec.height;
  if (spec.kind === 'house' || spec.kind === 'villa') {
    const roof = mesh(geoCone, surfaceMat('roof', spec.kind === 'villa' ? 0x5d4037 : 0x7b4c35, 0.72, 0.12), 0, h + 0.85, 0, Math.max(w, d) * 1.05, 1.4, Math.max(w, d) * 1.05);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
  } else if (spec.kind === 'market' || spec.kind === 'warehouse') {
    // Corrugated / shed roof
    const roof = mesh(geoBox, surfaceMat('roof', 0x78909c), 0, h + 0.35, 0, w + 1.2, 0.2, d + 1.0);
    group.add(roof);
    const ridge = mesh(geoBox, mat(0x546e7a), 0, h + 0.7, 0, w * 0.15, 0.5, d + 0.6);
    group.add(ridge);
  } else {
    const slab = mesh(geoBox, surfaceMat('concrete', 0x454c4a), 0, h + 0.14, 0, w + 0.45, 0.28, d + 0.45);
    group.add(slab);
    const parapet = mesh(geoBox, mat(0x3a3f3e), 0, h + 0.4, 0, w + 0.35, 0.35, d + 0.35);
    group.add(parapet);
  }
}

function addWindows(group: THREE.Group, spec: BuildingSpec): void {
  const w = spec.width;
  const d = spec.depth;
  const h = spec.height;
  if (spec.kind === 'warehouse') return;

  const glass = mat(spec.kind === 'office' ? 0x64b5f6 : 0x5b8a96, 0.35, spec.kind === 'office' ? 0.35 : 0.15);
  const frame = mat(0x2c3338);
  const floors = Math.min(6, Math.max(1, Math.floor(h / 3.4)));
  const cols = Math.min(4, Math.max(2, Math.floor(w / 3.6)));

  for (let f = 0; f < floors; f++) {
    const wy = 1.4 + f * (h / floors);
    if (wy > h - 0.6) continue;
    if ((spec.kind === 'flat' || spec.kind === 'office') && f === 0) continue;
    for (let c = 0; c < cols; c++) {
      const wx = -w / 2 + 1.2 + c * ((w - 2.4) / Math.max(1, cols - 1));
      group.add(mesh(geoBox, glass, wx, wy, d / 2 + 0.04, 1.1, 1.15, 0.08));
      group.add(mesh(geoBox, frame, wx, wy, d / 2 + 0.02, 1.25, 1.3, 0.04));
    }
  }
}

/** One glass strip per floor — far cheaper than a window grid. */
function addWindowsSparse(group: THREE.Group, spec: BuildingSpec): void {
  if (spec.kind === 'warehouse' || spec.kind === 'market') return;
  const glass = mat(0x5b8a96, 0.3, 0.1);
  const floors = Math.min(4, Math.max(1, Math.floor(spec.height / 4)));
  for (let f = 0; f < floors; f++) {
    const wy = 2 + f * (spec.height / floors);
    if (wy > spec.height - 0.8) continue;
    group.add(mesh(geoBox, glass, 0, wy, spec.depth / 2 + 0.04, spec.width * 0.7, 0.9, 0.08));
  }
}

function addDoor(group: THREE.Group, spec: BuildingSpec): void {
  const d = spec.depth;
  if (spec.kind === 'warehouse') {
    const shutter = mesh(geoBox, mat(0x455a64), 0, 2.2, d / 2 + 0.08, spec.width * 0.55, 4.2, 0.15);
    group.add(shutter);
    return;
  }
  group.add(mesh(geoBox, surfaceMat('wood', 0x3e2723), 0, 1.05, d / 2 + 0.06, 1.15, 2.1, 0.1));
  if (spec.kind === 'shop' || spec.kind === 'office') {
    group.add(mesh(geoBox, mat(0x7eb6c4, 0.3, 0.1), 0, 1.15, d / 2 + 0.1, 1.6, 2.0, 0.06));
  }
}

function addAwning(group: THREE.Group, spec: BuildingSpec): void {
  const w = spec.width;
  const d = spec.depth;
  const colors = [0xc34d38, 0xe4bb4e, 0x42876c, 0x477d9d, 0x8e24aa];
  const awning = mesh(geoBox, mat(colors[Math.abs(Math.floor(spec.x + spec.z)) % colors.length]!), 0, 2.55, d / 2 + 0.7, w * 0.92, 0.12, 1.4);
  group.add(awning);
  for (const side of [-1, 1]) {
    group.add(mesh(geoBox, mat(0x555555), side * (w * 0.4), 1.25, d / 2 + 1.2, 0.1, 2.5, 0.1));
  }
}

function addFence(group: THREE.Group, spec: BuildingSpec): void {
  const w = spec.width + 3.5;
  const d = spec.depth + 3.5;
  const fenceMat = surfaceMat('concrete', spec.kind === 'villa' ? 0x8d8478 : 0x9a8b78);
  const wallH = spec.kind === 'villa' ? 1.9 : 1.25;
  group.add(mesh(geoBox, fenceMat, -w / 2, wallH / 2, 0, 0.2, wallH, d));
  group.add(mesh(geoBox, fenceMat, w / 2, wallH / 2, 0, 0.2, wallH, d));
  group.add(mesh(geoBox, fenceMat, 0, wallH / 2, -d / 2, w, wallH, 0.2));
  group.add(mesh(geoBox, fenceMat, -w * 0.35, wallH / 2, d / 2, w * 0.3, wallH, 0.2));
  group.add(mesh(geoBox, fenceMat, w * 0.35, wallH / 2, d / 2, w * 0.3, wallH, 0.2));
  if (spec.kind === 'villa') {
    // Gate pillars
    group.add(mesh(geoBox, mat(0xeeeeee), -1.2, 1.1, d / 2, 0.35, 2.2, 0.35));
    group.add(mesh(geoBox, mat(0xeeeeee), 1.2, 1.1, d / 2, 0.35, 2.2, 0.35));
  }
}

function addRoofProps(group: THREE.Group, spec: BuildingSpec): void {
  const h = spec.height;
  group.add(mesh(geoBox, mat(0xb0bec5), spec.width * 0.25, h + 0.7, -spec.depth * 0.15, 1.4, 1.1, 1.4));
  group.add(mesh(geoBox, mat(0x78909c), -spec.width * 0.2, h + 0.35, spec.depth * 0.2, 1.2, 0.45, 0.7));
}

function addBalconies(group: THREE.Group, spec: BuildingSpec): void {
  const floors = Math.max(1, Math.floor(spec.height / 3.5));
  for (let f = 1; f < floors; f++) {
    const y = 1.2 + f * (spec.height / floors);
    if (y > spec.height - 1) continue;
    group.add(mesh(geoBox, mat(0x90a4ae), 0, y, spec.depth / 2 + 0.55, spec.width * 0.55, 0.12, 0.9));
    group.add(mesh(geoBox, mat(0x546e7a), 0, y + 0.45, spec.depth / 2 + 0.9, spec.width * 0.55, 0.7, 0.08));
  }
}

function addGlassCurtain(group: THREE.Group, spec: BuildingSpec): void {
  const glass = mesh(geoBox, mat(0x64b5f6, 0.4, 0.35), 0, spec.height * 0.55, spec.depth / 2 + 0.08, spec.width * 0.88, spec.height * 0.7, 0.1);
  group.add(glass);
}

function addWarehouseDetails(group: THREE.Group, spec: BuildingSpec): void {
  // Loading dock
  group.add(mesh(geoBox, mat(0x616161), 0, 0.6, spec.depth / 2 + 1.2, spec.width * 0.7, 1.2, 2.2));
  // Side vents
  for (const side of [-1, 1]) {
    group.add(mesh(geoBox, mat(0x455a64), side * (spec.width / 2 + 0.05), spec.height * 0.55, 0, 0.1, spec.height * 0.4, spec.depth * 0.5));
  }
}

function addCorrugatedDetails(group: THREE.Group, spec: BuildingSpec): void {
  // Stall poles + colorful front panel
  group.add(mesh(geoBox, mat(0xff7043), 0, 2.2, spec.depth / 2 + 0.2, spec.width * 0.9, 1.6, 0.1));
  for (const x of [-spec.width * 0.35, spec.width * 0.35]) {
    group.add(mesh(geoBox, mat(0x5d4037), x, 1.4, spec.depth / 2 + 0.9, 0.12, 2.8, 0.12));
  }
}

function addLandmarkTrim(group: THREE.Group, spec: BuildingSpec): void {
  group.add(mesh(geoBox, mat(0xffc857), 0, spec.height + 0.9, 0, spec.width * 0.4, 0.35, 0.35));
  group.add(mesh(geoBox, mat(0xffffff), 0, 2.8, spec.depth / 2 + 0.1, spec.width * 0.7, 1.8, 0.12));
}

function addFuelCanopy(group: THREE.Group, spec: BuildingSpec): void {
  group.add(mesh(geoBox, mat(0xffc107), 0, 4.2, spec.depth * 0.7, spec.width + 2, 0.25, 6));
  for (const x of [-spec.width * 0.35, spec.width * 0.35]) {
    group.add(mesh(geoBox, mat(0x455a64), x, 2.1, spec.depth * 0.7, 0.25, 4.2, 0.25));
  }
}

function addCross(group: THREE.Group, spec: BuildingSpec): void {
  const y = spec.height + 0.8;
  group.add(mesh(geoBox, mat(0xe53935), 0, y, 0, 0.35, 1.6, 0.2));
  group.add(mesh(geoBox, mat(0xe53935), 0, y + 0.2, 0, 1.2, 0.35, 0.2));
}
