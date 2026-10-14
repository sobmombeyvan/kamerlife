import * as THREE from 'three';
import { mat } from '../world/materials';
import type { CollisionSystem } from '../world/CollisionSystem';
import { addLampPost, addTextSign } from './signage';
import { createNpcAvatar } from '../pedestrians/NpcAvatar';
import { SANTA_LUCIA } from '../sim/SantaLuciaSpots';

const { cx, cz, halfW, halfD, wallH, floor2Y, roofY, doorHalfW } = SANTA_LUCIA;
const FLOOR_Y = 0.04;
const T = 0.42;
const FLOOR = 0x6c7068;
const SHELF = 0x4e3b2a;

const bottleGeo = new THREE.CylinderGeometry(0.032, 0.038, 1, 7);
const baguetteGeo = new THREE.CylinderGeometry(0.032, 0.038, 0.52, 7);
const bunGeo = new THREE.SphereGeometry(0.07, 8, 6);

/**
 * Two-storey Santa Lucia. South doors, stairs to ménage / textile.
 * Shelves hold bread, bottles and packs — not empty colour slabs.
 */
export function buildSantaLuciaExterior(collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'landmark-santa-lucia';
  root.userData = {
    type: 'landmark',
    landmarkId: 'santa-lucia',
    brand: 'Santa Lucia',
    fictionalPlacement: true,
    phase: 3,
    note: 'Two floors — supermarché + boulangerie, étage ménage / textile.',
  };

  addLot(root);
  addShell(root, collisions);
  addStairs(root, collisions);
  addFloor2(root, collisions);
  addAisles(root, collisions, 0);
  addBakery(root, collisions);
  addCheckout(root, collisions);
  addUpperShops(root, collisions);
  addStaff(root);
  addLights(root);
  return root;
}

export function setSantaRoofVisible(root: THREE.Object3D, on: boolean): void {
  const roof = root.getObjectByName('santa-roof');
  if (roof) roof.visible = on;
}

function addLot(root: THREE.Group): void {
  box(root, cx, 0.04, cz + 2, 54, 0.08, 48, 0x3d4246).receiveShadow = true;

  addTextSign(root, cx, roofY + 1.05, cz - halfD - 0.55, 22, 2.0, 'Santa Lucia', {
    subtitle: 'Grand Supermarket · 2 étages',
    bg: 0x1b5e20,
    fg: 0xffffff,
  });
  addTextSign(root, cx, 3.05, cz - halfD + 1.8, 8.2, 0.85, 'Entrez', {
    subtitle: 'RDC courses · étage ménage',
    bg: 0x1b5e20,
    fg: 0xffffff,
    yaw: Math.PI,
  });

  for (let i = 0; i < 4; i++) {
    box(root, cx - 18 + i * 5, 0.42, cz + halfD + 5.5, 3.4, 0.72, 1.55, i % 2 ? 0xc4a035 : 0x546e7a);
  }
  addLampPost(root, cx - 20, cz + halfD + 6);
  addLampPost(root, cx + 20, cz + halfD + 6);
  addLampPost(root, cx, cz - halfD - 6);
}

function addShell(root: THREE.Group, collisions: CollisionSystem): void {
  const x0 = cx - halfW;
  const x1 = cx + halfW;
  const z0 = cz - halfD;
  const z1 = cz + halfD;

  box(root, cx, FLOOR_Y, cz, halfW * 2 - 0.3, 0.08, halfD * 2 - 0.3, FLOOR);

  wallX(root, collisions, x0, cx - doorHalfW, z0, T, 0, wallH);
  wallX(root, collisions, cx + doorHalfW, x1, z0, T, 0, wallH);
  wallX(root, collisions, x0, x1, z1, T, 0, wallH);
  wallZ(root, collisions, x0, z0, z1, T, 0, wallH);
  wallZ(root, collisions, x1, z0, z1, T, 0, wallH);

  wallX(root, collisions, x0, x1, z0, T, wallH, roofY - wallH);
  wallX(root, collisions, x0, x1, z1, T, wallH, roofY - wallH);
  wallZ(root, collisions, x0, z0, z1, T, wallH, roofY - wallH);
  wallZ(root, collisions, x1, z0, z1, T, wallH, roofY - wallH);

  box(root, cx, 6.55, z0 - 0.12, halfW * 2 + 0.3, 1.35, 0.22, 0x2e7d32);
  addGlassDoor(root, cx - 1.9, z0 + 0.08);
  addGlassDoor(root, cx + 1.9, z0 + 0.08);

  for (let i = 0; i < 5; i++) {
    const win = box(root, x0 - 0.08, 3.1, cz - 7 + i * 3.4, 0.12, 1.7, 2.2, 0x81d4fa);
    win.material = mat(0x7eb8c9, 0.28, 0.18);
  }

  const roof = box(root, cx, roofY, cz, halfW * 2 - 0.25, 0.22, halfD * 2 - 0.25, 0x6e736c);
  roof.name = 'santa-roof';

  for (let i = 0; i < 4; i++) {
    box(root, cx - 14.5 + i * 1.15, 0.38, z0 + 1.3, 0.65, 0.5, 0.8, 0x78909c);
  }
}

function addStairs(root: THREE.Group, collisions: CollisionSystem): void {
  const n = 11;
  const rise = floor2Y / n;
  const run = 0.7;
  const x = cx - 15.2;
  const z0 = cz - halfD + 1.9;
  const width = 2.4;
  for (let i = 0; i < n; i++) {
    const top = rise * (i + 1);
    const thick = Math.min(0.18, top);
    box(root, x, top - thick / 2, z0 + run * (i + 0.5), width, thick, run + 0.22, 0x5c6360, true, collisions, 'walk');
  }
  const runLen = run * n;
  const midZ = z0 + runLen / 2;
  for (const sx of [-width / 2 + 0.06, width / 2 - 0.06]) {
    box(root, x + sx, 1.15, midZ, 0.08, 1.5, runLen, 0x78909c, true, collisions);
  }
  addTextSign(root, x - 1.55, 1.65, z0 + 0.35, 2.1, 0.42, 'Étage', {
    subtitle: '↑ ménage',
    bg: 0x1b5e20,
    fg: 0xffffff,
    yaw: -Math.PI / 2,
  });
}

function addFloor2(root: THREE.Group, collisions: CollisionSystem): void {
  const x0 = cx - halfW + 0.45;
  const x1 = cx + halfW - 0.45;
  const z0 = cz - halfD + 0.45;
  const z1 = cz + halfD - 0.45;
  const y = floor2Y - 0.1;
  const holeX0 = cx - 16.6;
  const holeX1 = cx - 13.8;
  const holeZ0 = z0;
  const holeZ1 = cz - halfD + 9.5;

  walkSlab(root, collisions, cx, y, (holeZ1 + z1) / 2, x1 - x0, 0.2, z1 - holeZ1);
  walkSlab(root, collisions, (holeX1 + x1) / 2, y, (z0 + holeZ1) / 2, x1 - holeX1, 0.2, holeZ1 - z0);
  walkSlab(root, collisions, (x0 + holeX0) / 2, y, (z0 + holeZ1) / 2, holeX0 - x0, 0.2, holeZ1 - z0);

  const railH = 0.8;
  const ry = floor2Y + railH / 2;
  box(root, holeX1, ry, (holeZ0 + holeZ1) / 2, 0.1, railH, holeZ1 - holeZ0, 0x90a4ae, true, collisions);
  box(root, (holeX0 + holeX1) / 2, ry, holeZ1, holeX1 - holeX0, railH, 0.1, 0x90a4ae, true, collisions);

  addTextSign(root, cx, floor2Y + 2.35, cz - 3.2, 6.2, 0.7, 'ÉTAGE', {
    subtitle: 'Ménage · textile',
    bg: 0x1b5e20,
    fg: 0xffffff,
  });
}

function addAisles(root: THREE.Group, collisions: CollisionSystem, floorY: number): void {
  const xs = [cx - 10.4, cx - 6.2, cx - 2.0];
  const palettes = [
    [0xc9a227, 0xd8c3a5, 0xbcaaa4],
    [0x2e7d32, 0x8d6e63, 0xf9a825],
    [0x1565c0, 0xc62828, 0xefebe9],
  ];
  for (let a = 0; a < xs.length; a++) {
    const x = xs[a]!;
    const pal = palettes[a]!;
    for (let i = 0; i < 4; i++) {
      const z = cz - 4.0 + i * 2.55;
      shelfBay(root, collisions, x, floorY, z, pal, a === 0 ? 'bread' : a === 1 ? 'bottles' : 'boxes');
    }
  }
  addTextSign(root, cx - 6.2, floorY + 3.45, cz + 6.6, 7.2, 0.65, 'SUPERMARCHÉ', {
    subtitle: 'Rayons garnis',
    bg: 0x1b5e20,
    fg: 0xffffff,
  });

  for (let i = 0; i < 2; i++) {
    const z = cz - 6.6 + i * 1.6;
    box(root, cx - 8.0, floorY + 0.95, z, 1.85, 1.7, 0.82, 0xb0bec5, true, collisions);
    const glass = box(root, cx - 7.02, floorY + 1.05, z, 0.08, 1.2, 0.68, 0xb3e5fc);
    glass.material = mat(0x90caf9, 0.32, 0.12);
    stockFridge(root, cx - 7.9, floorY, z);
  }
}

function shelfBay(
  root: THREE.Group,
  collisions: CollisionSystem,
  x: number,
  floorY: number,
  z: number,
  pal: number[],
  kind: 'bags' | 'bottles' | 'boxes' | 'bread',
): void {
  box(root, x, floorY + 1.1, z - 0.3, 1.5, 2.15, 0.07, SHELF, true, collisions);
  box(root, x, floorY + 1.1, z + 0.3, 1.5, 2.15, 0.07, SHELF, true, collisions);
  for (const ly of [0.38, 0.92, 1.46, 2.0]) {
    box(root, x, floorY + ly, z, 1.48, 0.05, 0.52, 0x3e2723);
  }
  const ys = [floorY + 0.5, floorY + 1.04, floorY + 1.58];
  for (let row = 0; row < 3; row++) {
    const y = ys[row]!;
    for (const side of [-0.42, 0.42] as const) {
      stockRow(root, kind, pal, row, x + side, y, z);
    }
  }
}

function stockRow(
  root: THREE.Group,
  kind: 'bags' | 'bottles' | 'boxes' | 'bread',
  pal: number[],
  row: number,
  x: number,
  y: number,
  z: number,
): void {
  if (kind === 'bags') {
    for (let k = -1; k <= 1; k++) pack(root, x, y + 0.1, z + k * 0.16, 0.22, 0.2, 0.14, pal[row % pal.length]!);
  } else if (kind === 'bottles') {
    for (let k = -1; k <= 1; k++) bottle(root, x, y + 0.12, z + k * 0.14, pal[(row + k + 3) % pal.length]!, 0.22);
  } else if (kind === 'bread') {
    loaf(root, x, y + 0.08, z - 0.12, 0xe8c27a);
    loaf(root, x, y + 0.08, z + 0.12, 0xf5deb3);
    if (row === 1) baguette(root, x, y + 0.16, z);
    if (row === 2) bun(root, x, y + 0.1, z);
  } else {
    for (let k = -1; k <= 1; k++) pack(root, x, y + 0.08, z + k * 0.16, 0.2, 0.16, 0.14, pal[(row + k + 3) % pal.length]!);
  }
}

function stockFridge(root: THREE.Group, x: number, floorY: number, z: number): void {
  const cols = [0x1565c0, 0xc62828, 0xf9a825, 0xffffff];
  for (let k = 0; k < 4; k++) bottle(root, x - 0.35 + (k % 2) * 0.28, floorY + 0.55 + Math.floor(k / 2) * 0.38, z, cols[k]!, 0.2);
}

function addBakery(root: THREE.Group, collisions: CollisionSystem): void {
  const bx = cx + 12.4;
  const fy = 0;
  box(root, bx, fy + 1.3, cz + 5.6, 6.8, 2.5, 0.26, 0xe8e0d4, true, collisions);
  for (const px of [-0.5, 0.5]) {
    for (const pz of [-2.55, 2.55]) {
      box(root, bx + px, fy + 1.1, cz + 0.3 + pz, 0.1, 2.15, 0.1, SHELF, true, collisions);
    }
  }
  box(root, bx + 0.52, fy + 1.1, cz + 0.3, 0.06, 2.15, 5.4, SHELF);
  for (const ly of [0.42, 0.98, 1.52, 2.08]) {
    box(root, bx, fy + ly, cz + 0.3, 1.08, 0.05, 5.35, 0x3e2723);
  }
  for (let i = 0; i < 6; i++) {
    const z = cz - 2.1 + i * 0.85;
    loaf(root, bx - 0.18, fy + 0.56, z, 0xe8c27a);
    loaf(root, bx + 0.16, fy + 0.56, z, 0xf5deb3);
    baguette(root, bx, fy + 1.12, z);
    loaf(root, bx - 0.16, fy + 1.66, z, 0xc45c36);
    loaf(root, bx + 0.18, fy + 1.66, z, 0xe8c27a);
    bun(root, bx - 0.18, fy + 2.2, z);
    bun(root, bx + 0.16, fy + 2.2, z);
  }

  for (let i = 0; i < 5; i++) {
    const z = cz - 2.2 + i * 1.15;
    box(root, bx + 2.2, fy + 0.42, z, 1.7, 0.78, 0.86, 0x3e2723, true, collisions);
    const glass = box(root, bx + 2.2, fy + 1.05, z, 1.55, 0.55, 0.72, 0xffecb3);
    glass.material = mat(0xdce775, 0.18, 0.06);
    loaf(root, bx + 1.95, fy + 0.9, z - 0.12, 0xe8c27a);
    loaf(root, bx + 2.35, fy + 0.9, z - 0.12, 0xc45c36);
    bun(root, bx + 2.15, fy + 0.96, z + 0.14);
    baguette(root, bx + 2.2, fy + 0.98, z + 0.22);
  }

  addTextSign(root, bx, 3.55, cz + 5.3, 6.4, 0.8, 'BOULANGERIE', {
    subtitle: 'Pain du jour',
    bg: 0x8d4a2b,
    fg: 0xfff3e0,
  });

  const baker = createNpcAvatar(940, 'employee');
  baker.position.set(bx - 0.85, 0, cz + 0.5);
  baker.rotation.y = -Math.PI / 2;
  root.add(baker);
}

function addCheckout(root: THREE.Group, collisions: CollisionSystem): void {
  for (const sx of [-4.2, 4.2]) {
    box(root, cx + sx, 0.5, cz - 7.6, 2.4, 0.92, 1.0, 0x37474f, true, collisions);
    box(root, cx + sx, 1.0, cz - 7.6, 2.5, 0.07, 1.05, 0x78909c);
    pack(root, cx + sx + 0.55, 1.12, cz - 7.55, 0.28, 0.16, 0.22, 0x1b5e20);
  }
  addTextSign(root, cx, 2.7, cz - 8.4, 5.2, 0.5, 'CAISSES', {
    bg: 0x1b5e20,
    fg: 0xffffff,
  });
}

function addUpperShops(root: THREE.Group, collisions: CollisionSystem): void {
  const fy = floor2Y;
  const xs = [cx - 6.4, cx - 2.2];
  for (const x of xs) {
    for (let i = 0; i < 3; i++) {
      shelfBay(root, collisions, x, fy, cz - 2.2 + i * 2.5, [0x90a4ae, 0x4fc3f7, 0xfff59d], 'boxes');
    }
  }
  addTextSign(root, cx - 4.2, fy + 3.2, cz + 5.8, 6.4, 0.6, 'MÉNAGE', {
    subtitle: 'Lessive · savon',
    bg: 0x37474f,
    fg: 0xffffff,
  });

  const tx = cx + 8.4;
  for (let i = 0; i < 3; i++) {
    const z = cz - 2.4 + i * 2.6;
    box(root, tx - 1.15, fy + 1.05, z, 0.1, 2.0, 0.5, SHELF, true, collisions);
    box(root, tx + 1.15, fy + 1.05, z, 0.1, 2.0, 0.5, SHELF, true, collisions);
    box(root, tx, fy + 1.05, z + 0.22, 2.4, 2.0, 0.06, SHELF);
    box(root, tx, fy + 0.55, z, 2.2, 0.05, 0.48, 0x3e2723);
    box(root, tx, fy + 1.1, z, 2.2, 0.05, 0.48, 0x3e2723);
    box(root, tx, fy + 1.65, z, 2.2, 0.05, 0.48, 0x3e2723);
    const cloth = [0xc62828, 0x1565c0, 0xf9a825, 0x2e7d32, 0x6a1b9a];
    for (let k = -2; k <= 2; k++) {
      pack(root, tx + k * 0.38, fy + 0.62, z, 0.32, 0.08, 0.28, cloth[(i + k + 5) % cloth.length]!);
      pack(root, tx + k * 0.38, fy + 1.18, z, 0.32, 0.08, 0.28, cloth[(i + k + 2) % cloth.length]!);
    }
  }
  addTextSign(root, tx, fy + 3.2, cz + 5.8, 5.6, 0.6, 'TEXTILE', {
    subtitle: 'Pagnes · t-shirts',
    bg: 0x6a1b9a,
    fg: 0xffffff,
  });

  const clerk = createNpcAvatar(943, 'employee');
  clerk.position.set(cx - 4.2, fy, cz + 2.4);
  clerk.rotation.y = Math.PI / 2;
  root.add(clerk);
}

function addLights(root: THREE.Group): void {
  const hemi = new THREE.HemisphereLight(0xf3efe6, 0x5a584e, 0.16);
  hemi.position.set(cx, 6.2, cz);
  root.add(hemi);
  for (const [lx, lz, ly] of [
    [cx - 7, cz - 4, 3.9],
    [cx + 7, cz - 4, 3.9],
    [cx - 7, cz + 4, 3.9],
    [cx + 11, cz + 2, 3.9],
    [cx - 6, cz, 7.6],
    [cx + 8, cz, 7.6],
  ] as const) {
    const light = new THREE.PointLight(0xffe7c2, ly > 6 ? 1.5 : 1.7, 15, 1.8);
    light.position.set(lx, ly, lz);
    root.add(light);
    box(root, lx, ly + 0.18, lz, 0.7, 0.08, 0.7, 0xf5f0e6);
  }
}

function addStaff(root: THREE.Group): void {
  const clerk = createNpcAvatar(941, 'employee');
  clerk.position.set(cx + 4.2, 0, cz - 6.6);
  clerk.rotation.y = Math.PI;
  root.add(clerk);

  const grocer = createNpcAvatar(942, 'employee');
  grocer.position.set(cx - 6.2, 0, cz + 2.2);
  grocer.rotation.y = Math.PI / 2;
  root.add(grocer);
}

function pack(root: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, color: number): void {
  box(root, x, y, z, w, h, d, color);
}

function bottle(root: THREE.Group, x: number, y: number, z: number, color: number, h: number): void {
  const m = new THREE.Mesh(bottleGeo, mat(color, 0.35, 0.05));
  m.position.set(x, y, z);
  m.scale.set(1, h, 1);
  root.add(m);
}

function loaf(root: THREE.Group, x: number, y: number, z: number, color: number): void {
  box(root, x, y, z, 0.34, 0.1, 0.16, color);
}

function baguette(root: THREE.Group, x: number, y: number, z: number): void {
  const m = new THREE.Mesh(baguetteGeo, mat(0xe8c27a, 0.75, 0));
  m.position.set(x, y, z);
  m.rotation.z = Math.PI / 2;
  root.add(m);
}

function bun(root: THREE.Group, x: number, y: number, z: number): void {
  const m = new THREE.Mesh(bunGeo, mat(0xd4a017, 0.7, 0));
  m.position.set(x, y, z);
  root.add(m);
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
  box(root, x, y, z, w, h, d, FLOOR, true, collisions, 'walk');
}

function addGlassDoor(root: THREE.Group, x: number, z: number): void {
  const door = box(root, x, 1.85, z, 2.5, 3.5, 0.08, 0x81d4fa);
  door.material = mat(0x64b5f6, 0.22, 0.18);
  box(root, x, 1.85, z, 0.08, 3.5, 0.12, 0x37474f);
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
  box(root, (x0 + x1) / 2, y0 + height / 2, z, w, height, thick, 0xd8d4cc, true, collisions);
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
  box(root, x, y0 + height / 2, (z0 + z1) / 2, thick, height, d, 0xd8d4cc, true, collisions);
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
  mesh.castShadow = h > 0.25;
  mesh.receiveShadow = true;
  parent.add(mesh);
  if (collide && collisions) collisions.addBox(x, y, z, w / 2, h / 2, d / 2, tag);
  return mesh;
}
