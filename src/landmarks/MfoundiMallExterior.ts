import * as THREE from 'three';
import { mat } from '../world/materials';
import type { CollisionSystem } from '../world/CollisionSystem';
import { addLampPost, addTextSign } from './signage';
import { createNpcAvatar } from '../pedestrians/NpcAvatar';
import { createBrandVehicle, createMotoMesh, pickParkedBrand } from '../vehicles/VehicleFactory';
import { iphoneScreenMat, macScreenMat } from '../render/designedArt';
import { MFOUNDI_MALL } from '../sim/MallSpots';

const { cx, cz, halfW, halfD, wallH, doorHalfW, floor2Y, roofY } = MFOUNDI_MALL;
const FLOOR_Y = 0.04;
const STORY = wallH;

type StoreDef = {
  id: string;
  name: string;
  subtitle: string;
  side: 'west' | 'east';
  z: number;
  color: number;
  accent: number;
  apple?: boolean;
  vendorSeed: number;
};

const STORES_RDC: StoreDef[] = [
  { id: 'free-deal', name: 'FREE DEAL', subtitle: 'Destockage · Apple', side: 'west', z: cz - 8, color: 0xf9a825, accent: 0x1a1a1a, apple: true, vendorSeed: 901 },
  { id: 'pirate', name: 'PIRATE SOLDEUR', subtitle: 'High-tech · Apple', side: 'west', z: cz + 2, color: 0x6d1a36, accent: 0xffc857, apple: true, vendorSeed: 902 },
  { id: 'amani', name: 'AMANI', subtitle: 'Mode · Apple', side: 'west', z: cz + 12, color: 0xc9a227, accent: 0x3e2723, apple: true, vendorSeed: 903 },
  { id: 'smile', name: 'SMILE MARKET', subtitle: 'Courses · Apple', side: 'east', z: cz - 8, color: 0x2e7d32, accent: 0xffffff, apple: true, vendorSeed: 904 },
  { id: 'jm', name: 'JM STORE', subtitle: 'Maison · Apple', side: 'east', z: cz + 2, color: 0x1565c0, accent: 0xffc857, apple: true, vendorSeed: 905 },
  { id: 'food', name: 'FOOD COURT', subtitle: 'Ndolé · jus', side: 'east', z: cz + 12, color: 0xef6c00, accent: 0x3e2723, vendorSeed: 906 },
];

const STORES_ETAGE: StoreDef[] = [
  { id: 'pharma', name: 'PHARMACIE', subtitle: 'Bénédicte', side: 'west', z: cz - 8, color: 0x43a047, accent: 0xffffff, vendorSeed: 911 },
  { id: 'librairie', name: 'LIBRAIRIE', subtitle: 'Papeterie', side: 'west', z: cz + 2, color: 0x6d4c41, accent: 0xffecb3, vendorSeed: 912 },
  { id: 'bijoux', name: 'OR & BIJOUX', subtitle: 'Montres · or', side: 'west', z: cz + 12, color: 0xc9a227, accent: 0x3e2723, vendorSeed: 913 },
  { id: 'shoes', name: 'CHAUSSURES ELITE', subtitle: 'Cuir · baskets', side: 'east', z: cz - 8, color: 0x4e342e, accent: 0xffffff, vendorSeed: 914 },
  { id: 'sport', name: 'SPORT 237', subtitle: 'Lions Indomptables', side: 'east', z: cz + 2, color: 0x1b5e20, accent: 0xffc857, vendorSeed: 915 },
  { id: 'opticien', name: 'OPTICIEN CRYSTAL', subtitle: 'Lunettes', side: 'east', z: cz + 12, color: 0x0277bd, accent: 0xffffff, vendorSeed: 916 },
];

/**
 * Walkable two-storey mall: RDC boutiques + étage, stairs, vendors, Apple displays.
 * Enter from the south plaza through the glass doors.
 */
export function buildMfoundiMallExterior(collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'landmark-mfoundi-mall';
  root.userData = {
    type: 'landmark',
    landmarkId: 'mfoundi-mall',
    phase: 2,
    note: 'Two floors — Apple at RDC counters, étage boutiques, magasinier job.',
  };

  addPlaza(root, collisions);
  addShell(root, collisions);
  addFloor2(root, collisions);
  addStairs(root, collisions, cx - 8.2, 1);
  addStairs(root, collisions, cx + 8.2, -1);
  for (const store of STORES_RDC) addStore(root, collisions, store, 0);
  for (const store of STORES_ETAGE) addStore(root, collisions, store, floor2Y);
  addAtrium(root, collisions);
  addStaffDesk(root, collisions);
  addLights(root);

  return root;
}

function addPlaza(root: THREE.Group, collisions: CollisionSystem): void {
  const plaza = box(root, cx, 0.04, cz, 72, 0.08, 78, 0x3a3f42);
  plaza.receiveShadow = true;

  const stallW = 4.5;
  const stallD = 5.8;
  const nStalls = 5;
  const lotW = nStalls * stallW;
  const lotX0 = cx - lotW / 2;
  const rowZ = cz + halfD + 8.2;
  for (let i = 0; i <= nStalls; i++) {
    box(root, lotX0 + i * stallW, 0.08, rowZ, 0.08, 0.04, stallD, 0xeceff1);
  }
  box(root, cx, 0.08, rowZ - stallD / 2, lotW, 0.04, 0.08, 0xeceff1);
  box(root, cx, 0.08, rowZ + stallD / 2, lotW, 0.04, 0.08, 0xeceff1);

  addTextSign(root, cx, roofY + 1.4, cz - halfD - 0.4, 26, 2.6, 'Mfoundi Mall', {
    subtitle: 'Centre commercial · 2 étages',
    bg: 0x0d47a1,
    fg: 0xffc857,
  });

  for (const i of [0, 2, 4]) {
    const x = lotX0 + stallW * (i + 0.5);
    const car = createBrandVehicle(50 + i, pickParkedBrand(50 + i));
    car.position.set(x, 0, rowZ);
    car.rotation.y = Math.PI;
    car.userData.driveable = true;
    car.userData.parkedCar = true;
    root.add(car);
    const hl = Number(car.userData.halfLength) || 2.2;
    const hw = Number(car.userData.halfWidth) || 1.0;
    collisions.addBox(x, 0.75, rowZ, hw + 0.15, 0.75, hl + 0.1);
  }
  const motoX0 = lotX0 + lotW + 3.4;
  for (let i = 0; i < 4; i++) {
    const moto = createMotoMesh(70 + i);
    moto.position.set(motoX0 + i * 2.4, 0, rowZ);
    moto.rotation.y = Math.PI;
    root.add(moto);
  }
  addLampPost(root, lotX0 - 2.4, rowZ + stallD / 2 + 1.2);
  addLampPost(root, lotX0 + lotW + 2.4, rowZ + stallD / 2 + 1.2);
  addLampPost(root, motoX0 + 8, cz + 24);
  addLampPost(root, cx + 34, cz + 8);

  collisions.addBox(motoX0 + 3.6, 0.5, rowZ, 5.0, 0.5, 1.15);
}

function addShell(root: THREE.Group, collisions: CollisionSystem): void {
  const x0 = cx - halfW;
  const x1 = cx + halfW;
  const z0 = cz - halfD;
  const z1 = cz + halfD;
  const t = 0.45;

  box(root, cx, FLOOR_Y, cz, halfW * 2 - 0.2, 0.08, halfD * 2 - 0.2, 0xd8cfc2);
  for (let i = -2; i <= 2; i++) {
    box(root, cx + i * 8, FLOOR_Y + 0.02, cz, 0.35, 0.02, halfD * 2 - 1.2, 0xc4b8a8);
  }

  // Ground-floor walls (south has the door)
  wallX(root, collisions, x0, cx - doorHalfW, z0, t, 0, STORY);
  wallX(root, collisions, cx + doorHalfW, x1, z0, t, 0, STORY);
  wallX(root, collisions, x0, x1, z1, t, 0, STORY);
  wallZ(root, collisions, x0, z0, z1, t, 0, STORY);
  wallZ(root, collisions, x1, z0, z1, t, 0, STORY);

  // Upper storey walls — full south (windows, no door)
  wallX(root, collisions, x0, x1, z0, t, STORY, roofY - STORY);
  wallX(root, collisions, x0, x1, z1, t, STORY, roofY - STORY);
  wallZ(root, collisions, x0, z0, z1, t, STORY, roofY - STORY);
  wallZ(root, collisions, x1, z0, z1, t, STORY, roofY - STORY);

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xb3e5fc,
    transparent: true,
    opacity: 0.28,
    roughness: 0.08,
    metalness: 0.35,
    depthWrite: false,
  });
  addGlassDoor(root, cx - 2.4, z0 + 0.1, glassMat);
  addGlassDoor(root, cx + 2.4, z0 + 0.1, glassMat);

  box(root, cx, 4.3, z0 - 3.2, 16, 0.32, 7, 0x2a3034);
  for (const sx of [-7.5, 7.5]) {
    box(root, cx + sx, 2.1, z0 - 3.2, 0.5, 4.2, 0.5, 0x555555, true, collisions);
  }
  addTextSign(root, cx, 5.55, z0 - 6.55, 12, 1.25, 'Mfoundi Mall', {
    subtitle: 'Entrez · RDC + étage',
    bg: 0x0d47a1,
    fg: 0xffc857,
    yaw: Math.PI,
  });

  const facadeW = halfW - doorHalfW - 0.6;
  box(root, cx - doorHalfW - facadeW / 2, roofY / 2, z0 - 0.55, facadeW, roofY - 0.4, 0.35, 0xb8c4c8);
  box(root, cx + doorHalfW + facadeW / 2, roofY / 2, z0 - 0.55, facadeW, roofY - 0.4, 0.35, 0xb8c4c8);
  for (let floor = 0; floor < 3; floor++) {
    const gy = 2.2 + floor * 2.9;
    const glassL = box(root, cx - doorHalfW - facadeW / 2, gy, z0 - 0.72, facadeW - 1.2, 2.1, 0.12, 0x7ec8e3);
    glassL.material = mat(0x7ec8e3, 0.3, 0.25);
    const glassR = box(root, cx + doorHalfW + facadeW / 2, gy, z0 - 0.72, facadeW - 1.2, 2.1, 0.12, 0x7ec8e3);
    glassR.material = mat(0x7ec8e3, 0.3, 0.25);
  }

  box(root, cx, roofY, cz, halfW * 2 - 0.2, 0.28, halfD * 2 - 0.2, 0xeceff1);
  const sky = box(root, cx, roofY - 0.02, cz, 8, 0.08, 8, 0xa8d4e6);
  sky.material = mat(0xa8d4e6, 0.4, 0.15);

  addTextSign(root, cx, 3.2, z0 + 4.2, 7.5, 1.05, 'Galerie RDC', {
    subtitle: 'Boutiques · Apple · Food · Jobs',
    bg: 0x0d47a1,
    fg: 0xffc857,
    yaw: Math.PI,
  });
}

function addFloor2(root: THREE.Group, collisions: CollisionSystem): void {
  const x0 = cx - halfW + 0.5;
  const x1 = cx + halfW - 0.5;
  const z0 = cz - halfD + 0.5;
  const z1 = cz + halfD - 0.5;
  const thick = 0.2;
  const y = floor2Y - thick / 2;
  const hole = 6.4;

  // North / south rings, east / west galleries. Stair wells cut on the south.
  walkSlab(root, collisions, cx, y, (z1 + (cz + hole)) / 2, x1 - x0, thick, z1 - (cz + hole));
  walkSlab(root, collisions, (x0 + (cx - hole)) / 2, y, cz, cx - hole - x0, thick, hole * 2);
  walkSlab(root, collisions, (x1 + (cx + hole)) / 2, y, cz, x1 - (cx + hole), thick, hole * 2);

  // South balcony, split around the two stair wells (x = cx ± 8.2, width ~2.8)
  const stairHalf = 1.55;
  walkSlab(root, collisions, (x0 + (cx - 8.2 - stairHalf)) / 2, y, (z0 + (cz - hole)) / 2, cx - 8.2 - stairHalf - x0, thick, cz - hole - z0);
  walkSlab(root, collisions, cx, y, (z0 + (cz - hole)) / 2, 8.2 * 2 - stairHalf * 2 - 0.4, thick, cz - hole - z0);
  walkSlab(root, collisions, (x1 + (cx + 8.2 + stairHalf)) / 2, y, (z0 + (cz - hole)) / 2, x1 - (cx + 8.2 + stairHalf), thick, cz - hole - z0);

  // Atrium railings
  const railH = 0.85;
  const railY = floor2Y + railH / 2;
  box(root, cx - hole, railY, cz, 0.12, railH, hole * 2, 0xcfd8dc, true, collisions);
  box(root, cx + hole, railY, cz, 0.12, railH, hole * 2, 0xcfd8dc, true, collisions);
  box(root, cx, railY, cz - hole, hole * 2, railH, 0.12, 0xcfd8dc, true, collisions);
  box(root, cx, railY, cz + hole, hole * 2, railH, 0.12, 0xcfd8dc, true, collisions);

  addTextSign(root, cx, floor2Y + 2.6, cz - hole - 0.4, 6.4, 0.85, 'Étage', {
    subtitle: 'Pharmacie · Sport · Bijoux',
    bg: 0x1565c0,
    fg: 0xffc857,
    yaw: Math.PI,
  });
}

function walkSlab(
  root: THREE.Group,
  collisions: CollisionSystem,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
): void {
  if (w < 0.4 || d < 0.4) return;
  box(root, x, y, z, w, h, d, 0xd5ccc0, true, collisions, 'walk');
}

function addStairs(root: THREE.Group, collisions: CollisionSystem, x: number, face: 1 | -1): void {
  const n = 11;
  const rise = floor2Y / n;
  const run = 0.76;
  const z0 = cz - halfD + 2.15;
  const width = 2.6;
  for (let i = 0; i < n; i++) {
    const top = rise * (i + 1);
    const thick = Math.min(0.18, top);
    const z = z0 + run * (i + 0.5);
    box(root, x, top - thick / 2, z, width, thick, run + 0.28, 0xb0bec5, true, collisions, 'walk');
  }
  // Rails
  const runLen = run * n;
  const midZ = z0 + runLen / 2;
  const railH = 0.7;
  for (const sx of [-width / 2 + 0.06, width / 2 - 0.06]) {
    box(root, x + sx, railH / 2 + 0.4, midZ, 0.08, railH + 0.8, runLen, 0x90a4ae, true, collisions);
  }
  addTextSign(root, x + face * 1.55, 1.7, z0 + 0.4, 2.2, 0.45, 'Étage', {
    subtitle: '↑',
    bg: 0x1565c0,
    fg: 0xffffff,
    yaw: face > 0 ? Math.PI / 2 : -Math.PI / 2,
  });
}

function addStore(root: THREE.Group, collisions: CollisionSystem, def: StoreDef, floorY: number): void {
  const width = 9.2;
  const face = def.side === 'west' ? 1 : -1;
  const backX = def.side === 'west' ? cx - halfW + 0.4 : cx + halfW - 0.4;
  const counterX = def.side === 'west' ? cx - 14.5 : cx + 14.5;
  const midX = (backX + counterX) / 2;
  const depth = Math.abs(counterX - backX) + 1.4;
  const storyTop = floorY < 1 ? STORY : roofY - floor2Y - 0.15;

  box(root, midX, floorY + 0.03, def.z, depth, 0.05, width, def.color);

  const zA = def.z - width / 2;
  const zB = def.z + width / 2;
  box(root, midX, floorY + storyTop / 2, zA, depth, storyTop, 0.22, 0xe8e0d4, true, collisions);
  box(root, midX, floorY + storyTop / 2, zB, depth, storyTop, 0.22, 0xe8e0d4, true, collisions);

  addTextSign(root, counterX + face * 0.15, floorY + 3.45, def.z, 8.2, 1.1, def.name, {
    subtitle: def.subtitle,
    bg: def.color,
    fg: 0xffffff,
    yaw: def.side === 'west' ? Math.PI / 2 : -Math.PI / 2,
  });

  box(root, counterX, floorY + 0.55, def.z, 1.1, 1.1, 4.2, 0x4e342e, true, collisions);
  box(root, counterX, floorY + 1.15, def.z, 1.2, 0.08, 4.3, 0xefebe9);

  const shelfX = backX + face * 2.2;
  for (let i = -1; i <= 1; i++) {
    box(root, shelfX, floorY + 1.2, def.z + i * 2.4, 1.6, 2.4, 0.7, 0x6d4c41, true, collisions);
    box(root, shelfX, floorY + 1.3, def.z + i * 2.4, 1.4, 0.18, 0.55, def.color);
    box(root, shelfX, floorY + 1.9, def.z + i * 2.4, 1.4, 0.18, 0.55, def.accent);
  }

  box(root, counterX + face * 1.3, floorY + 0.45, def.z - 2.2, 0.7, 0.9, 0.7, def.color);

  if (def.apple) addAppleDisplay(root, counterX, floorY + 1.22, def.z, def.side);

  const vendor = createNpcAvatar(def.vendorSeed, 'employee');
  vendor.position.set(counterX - face * 0.75, floorY, def.z + 0.35);
  vendor.rotation.y = def.side === 'west' ? Math.PI / 2 : -Math.PI / 2;
  root.add(vendor);
}

function addAppleDisplay(root: THREE.Group, cx0: number, y: number, z: number, side: 'west' | 'east'): void {
  const yaw = side === 'west' ? Math.PI / 2 : -Math.PI / 2;
  addIphone(root, cx0 + 0.15, y, z - 1.15, yaw);
  addIphone(root, cx0 - 0.12, y, z - 0.85, yaw + 0.2);
  addMacbook(root, cx0, y, z + 0.95, yaw);
  addMacbook(root, cx0 + 0.08, y, z + 1.45, yaw - 0.15);
}

function addIphone(root: THREE.Group, x: number, y: number, z: number, yaw: number): void {
  const g = new THREE.Group();
  g.position.set(x, y + 0.12, z);
  g.rotation.y = yaw;
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.1), mat(0x37474f));
  stand.position.y = -0.12;
  g.add(stand);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.018), mat(0xc5cdd4, 0.25, 0.65));
  g.add(body);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.006), iphoneScreenMat());
  screen.position.z = 0.01;
  g.add(screen);
  root.add(g);
}

function addMacbook(root: THREE.Group, x: number, y: number, z: number, yaw: number): void {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.018, 0.36), mat(0xc8cdd2, 0.22, 0.7));
  g.add(base);
  const kb = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.006, 0.2), mat(0x2a2d32));
  kb.position.set(0, 0.012, 0.03);
  g.add(kb);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.32, 0.014), mat(0xc8cdd2, 0.22, 0.7));
  lid.position.set(0, 0.17, -0.16);
  lid.rotation.x = -0.55;
  g.add(lid);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.28, 0.006), macScreenMat());
  screen.position.set(0, 0.17, -0.148);
  screen.rotation.x = -0.55;
  g.add(screen);
  root.add(g);
}

function addAtrium(root: THREE.Group, collisions: CollisionSystem): void {
  for (const [px, pz] of [
    [cx - 5, cz - 11],
    [cx + 5, cz - 11],
    [cx - 5, cz + 6],
    [cx + 5, cz + 6],
  ] as const) {
    box(root, px, 0.4, pz, 1.3, 0.8, 1.3, 0x5d4037, true, collisions);
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), mat(0x3d7a45));
    bush.position.set(px, 1.15, pz);
    root.add(bush);
  }

  box(root, cx, 0.32, cz - 1, 3.4, 0.42, 0.7, 0x6d4c41, true, collisions);
  box(root, cx, 0.28, cz + 4.5, 2.4, 0.5, 2.4, 0x90a4ae, true, collisions);
  const water = box(root, cx, 0.52, cz + 4.5, 1.8, 0.08, 1.8, 0x4fc3f7);
  water.material = mat(0x4fc3f7, 0.2, 0.15);
}

function addStaffDesk(root: THREE.Group, collisions: CollisionSystem): void {
  const z = cz + 13.5;
  box(root, cx, 0.55, z, 4.6, 1.1, 1.4, 0x00695c, true, collisions);
  box(root, cx, 1.18, z, 4.8, 0.08, 1.5, 0xefebe9);
  addTextSign(root, cx, 2.5, z + 0.8, 5.4, 0.9, 'Accueil · Jobs', {
    subtitle: 'Magasinier · caisse · rayons',
    bg: 0x004d40,
    fg: 0xffc857,
    yaw: Math.PI,
  });
  const clerk = createNpcAvatar(920, 'employee');
  clerk.position.set(cx, 0, z + 0.85);
  clerk.rotation.y = Math.PI;
  root.add(clerk);
}

function addLights(root: THREE.Group): void {
  const hemi = new THREE.HemisphereLight(0xfff3e0, 0x6d5c4a, 0.6);
  hemi.position.set(cx, 7, cz);
  root.add(hemi);
  for (const [lx, lz, ly] of [
    [cx - 8, cz - 8, 4.2],
    [cx + 8, cz - 8, 4.2],
    [cx - 8, cz + 8, 4.2],
    [cx + 8, cz + 8, 4.2],
    [cx, cz, 4.2],
    [cx - 8, cz - 8, 8.6],
    [cx + 8, cz - 8, 8.6],
    [cx - 8, cz + 8, 8.6],
    [cx + 8, cz + 8, 8.6],
    [cx, cz, 8.6],
  ] as const) {
    const light = new THREE.PointLight(0xffe0b2, ly > 6 ? 3.4 : 4.0, 20, 1.6);
    light.position.set(lx, ly, lz);
    root.add(light);
    box(root, lx, ly + 0.55, lz, 0.8, 0.12, 0.8, 0xfafafa);
  }
}

function addGlassDoor(
  root: THREE.Group,
  x: number,
  z: number,
  glassMat: THREE.Material,
): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const pane = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 0.07), glassMat);
  pane.position.y = 1.72;
  g.add(pane);
  const frameCol = mat(0x263238);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.1, 0.12), frameCol);
  top.position.y = 3.32;
  g.add(top);
  const bot = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.1, 0.12), frameCol);
  bot.position.y = 0.12;
  g.add(bot);
  const stile = new THREE.Mesh(new THREE.BoxGeometry(0.09, 3.2, 0.12), frameCol);
  stile.position.set(x < cx ? 1.05 : -1.05, 1.72, 0);
  g.add(stile);
  root.add(g);
}

function wallX(
  root: THREE.Group,
  collisions: CollisionSystem,
  x0: number,
  x1: number,
  z: number,
  thick: number,
  y0: number,
  height: number,
): void {
  const w = Math.abs(x1 - x0);
  if (w < 0.2 || height < 0.2) return;
  box(root, (x0 + x1) / 2, y0 + height / 2, z, w, height, thick, 0xece6dc, true, collisions);
}

function wallZ(
  root: THREE.Group,
  collisions: CollisionSystem,
  x: number,
  z0: number,
  z1: number,
  thick: number,
  y0: number,
  height: number,
): void {
  const d = Math.abs(z1 - z0);
  if (d < 0.2 || height < 0.2) return;
  box(root, x, y0 + height / 2, (z0 + z1) / 2, thick, height, d, 0xece6dc, true, collisions);
}

function box(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: number,
  collide = false,
  collisions?: CollisionSystem,
  tag?: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = h > 0.3;
  mesh.receiveShadow = true;
  parent.add(mesh);
  if (collide && collisions) collisions.addBox(x, y, z, w / 2, h / 2, d / 2, tag);
  return mesh;
}
