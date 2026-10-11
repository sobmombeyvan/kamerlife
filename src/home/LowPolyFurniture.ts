import * as THREE from 'three';
import { homeMat, homeSoftMat } from './homeMaterials';

type CollideFn = (cx: number, cy: number, cz: number, hx: number, hy: number, hz: number) => void;

function box(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  color: number,
  x: number,
  y: number,
  z: number,
  opts?: { cast?: boolean; receive?: boolean; roughness?: number },
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    homeMat(color, { roughness: opts?.roughness }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = opts?.cast !== false;
  mesh.receiveShadow = opts?.receive !== false;
  parent.add(mesh);
  return mesh;
}

function cyl(
  parent: THREE.Object3D,
  rTop: number,
  rBot: number,
  h: number,
  color: number,
  x: number,
  y: number,
  z: number,
  seg = 8,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), homeMat(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Low-poly bed with headboard + pillows. */
export function createBed(color = 0x5c6bc0, accent = 0x3949ab): THREE.Group {
  const g = new THREE.Group();
  g.name = 'furn-bed';
  const wood = 0x6d4c41;
  box(g, 2.1, 0.28, 2.5, wood, 0, 0.2, 0);
  box(g, 1.95, 0.22, 2.3, color, 0, 0.42, 0.05);
  box(g, 2.1, 1.05, 0.14, wood, 0, 0.85, -1.15);
  box(g, 0.7, 0.18, 0.4, 0xfafafa, -0.45, 0.62, -0.75);
  box(g, 0.7, 0.18, 0.4, 0xfafafa, 0.45, 0.62, -0.75);
  box(g, 1.9, 0.08, 0.9, accent, 0, 0.55, 0.55);
  return g;
}

/** Desk with legs + top. */
export function createDesk(wood = 0x8d6e63): THREE.Group {
  const g = new THREE.Group();
  g.name = 'furn-desk';
  box(g, 1.6, 0.1, 0.75, wood, 0, 0.78, 0);
  for (const [lx, lz] of [
    [-0.7, -0.28],
    [0.7, -0.28],
    [-0.7, 0.28],
    [0.7, 0.28],
  ] as const) {
    box(g, 0.1, 0.72, 0.1, wood, lx, 0.36, lz);
  }
  box(g, 0.55, 0.35, 0.55, 0x5d4037, 0.45, 0.52, 0); // drawer block
  // Laptop
  box(g, 0.45, 0.03, 0.3, 0x37474f, -0.25, 0.85, 0);
  box(g, 0.45, 0.28, 0.02, 0x263238, -0.25, 1.0, -0.14);
  box(g, 0.4, 0.22, 0.01, 0x4fc3f7, -0.25, 1.0, -0.13);
  return g;
}

/** Simple chair. */
export function createChair(wood = 0x795548, seat = 0xc62828): THREE.Group {
  const g = new THREE.Group();
  g.name = 'furn-chair';
  box(g, 0.55, 0.1, 0.55, seat, 0, 0.48, 0);
  for (const [lx, lz] of [
    [-0.2, -0.2],
    [0.2, -0.2],
    [-0.2, 0.2],
    [0.2, 0.2],
  ] as const) {
    box(g, 0.07, 0.45, 0.07, wood, lx, 0.22, lz);
  }
  box(g, 0.55, 0.55, 0.08, wood, 0, 0.8, -0.24);
  return g;
}

/** Nightstand. */
export function createNightstand(wood = 0x6d4c41): THREE.Group {
  const g = new THREE.Group();
  g.name = 'furn-nightstand';
  box(g, 0.55, 0.55, 0.45, wood, 0, 0.35, 0);
  box(g, 0.5, 0.04, 0.4, 0x8d6e63, 0, 0.64, 0);
  cyl(g, 0.08, 0.1, 0.2, 0xfff8e1, 0, 0.78, 0, 6);
  return g;
}

/** Wardrobe. */
export function createWardrobe(wood = 0x5d4037): THREE.Group {
  const g = new THREE.Group();
  g.name = 'furn-wardrobe';
  box(g, 1.35, 2.2, 0.55, wood, 0, 1.15, 0);
  box(g, 0.04, 2.0, 0.02, 0x3e2723, 0, 1.15, 0.28);
  cyl(g, 0.04, 0.04, 0.08, 0xffc857, -0.25, 1.15, 0.3, 6);
  cyl(g, 0.04, 0.04, 0.08, 0xffc857, 0.25, 1.15, 0.3, 6);
  return g;
}

/** Fridge with freezer door seam. */
export function createFridge(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'furn-fridge';
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 1.85, 0.75),
    homeMat(0xeceff1, { roughness: 0.45, metalness: 0.18 }),
  );
  body.position.set(0, 0.95, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  box(g, 0.78, 0.02, 0.02, 0xb0bec5, 0, 1.35, 0.38);
  box(g, 0.08, 0.55, 0.04, 0x90a4ae, 0.32, 0.7, 0.4);
  box(g, 0.08, 0.25, 0.04, 0x90a4ae, 0.32, 1.55, 0.4);
  return g;
}

/** Kitchen counter + stove. */
export function createKitchenCounter(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'furn-counter';
  box(g, 2.4, 0.9, 0.7, 0xb0bec5, 0, 0.5, 0);
  box(g, 2.45, 0.06, 0.75, 0xefebe9, 0, 0.98, 0);
  box(g, 0.7, 0.08, 0.55, 0x37474f, -0.6, 1.05, 0); // cooktop
  for (const ox of [-0.75, -0.45]) {
    cyl(g, 0.1, 0.1, 0.04, 0x212121, ox, 1.1, 0.1, 8);
  }
  box(g, 0.35, 0.25, 0.35, 0xffffff, 0.7, 1.15, 0); // kettle-ish
  return g;
}

/** Wall-mounted lamp with warm glow. */
export function createWallLamp(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'furn-wall-lamp';
  box(g, 0.18, 0.18, 0.1, 0x5d4037, 0, 0, 0);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.28, 8), homeSoftMat(0xffe082, 0.92));
  shade.position.set(0, -0.05, 0.18);
  shade.rotation.x = Math.PI;
  g.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), homeSoftMat(0xfff8e1, 0.85));
  bulb.position.set(0, -0.08, 0.2);
  g.add(bulb);
  return g;
}

/** Potted plant. */
export function createPlant(leaf = 0x2e7d32): THREE.Group {
  const g = new THREE.Group();
  g.name = 'furn-plant';
  cyl(g, 0.22, 0.28, 0.4, 0x8d6e63, 0, 0.25, 0, 8);
  cyl(g, 0.06, 0.08, 0.55, 0x5d4037, 0, 0.7, 0, 5);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leafMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 6, 5),
      homeMat(i % 2 ? leaf : 0x1b5e20),
    );
    leafMesh.scale.set(1.1, 0.45, 0.7);
    leafMesh.position.set(Math.cos(a) * 0.28, 1.05 + (i % 2) * 0.1, Math.sin(a) * 0.28);
    leafMesh.castShadow = true;
    g.add(leafMesh);
  }
  return g;
}

/** Window with frame + sky pane (interior side). */
export function createWindow(w = 1.6, h = 1.2): THREE.Group {
  const g = new THREE.Group();
  g.name = 'furn-window';
  box(g, w + 0.16, h + 0.16, 0.1, 0x5d4037, 0, 0, 0, { cast: false });
  box(g, w, h, 0.04, 0x81d4fa, 0, 0, 0.04, { cast: false, roughness: 0.35 });
  const pane = g.children[1] as THREE.Mesh;
  pane.material = homeSoftMat(0x81d4fa, 0.55);
  box(g, 0.06, h, 0.06, 0x6d4c41, 0, 0, 0.06, { cast: false });
  box(g, w, 0.06, 0.06, 0x6d4c41, 0, 0, 0.06, { cast: false });
  // Curtain strip
  box(g, 0.2, h + 0.1, 0.08, 0xfff3e0, -w / 2 - 0.05, 0, 0.1, { cast: false });
  box(g, 0.2, h + 0.1, 0.08, 0xfff3e0, w / 2 + 0.05, 0, 0.1, { cast: false });
  return g;
}

/** Sofa. */
export function createSofa(color = 0x1565c0, accent = 0x0d47a1): THREE.Group {
  const g = new THREE.Group();
  g.name = 'furn-sofa';
  box(g, 2.6, 0.45, 0.95, color, 0, 0.35, 0);
  box(g, 2.6, 0.55, 0.22, accent, 0, 0.85, -0.4);
  box(g, 0.22, 0.45, 0.95, accent, -1.2, 0.55, 0);
  box(g, 0.22, 0.45, 0.95, accent, 1.2, 0.55, 0);
  box(g, 0.7, 0.15, 0.55, 0xffc857, -0.55, 0.62, 0.05);
  box(g, 0.7, 0.15, 0.55, 0xffc857, 0.55, 0.62, 0.05);
  return g;
}

/** Coffee table. */
export function createCoffeeTable(wood = 0x6d4c41): THREE.Group {
  const g = new THREE.Group();
  g.name = 'furn-table';
  box(g, 1.15, 0.08, 0.65, wood, 0, 0.38, 0);
  for (const [lx, lz] of [
    [-0.45, -0.22],
    [0.45, -0.22],
    [-0.45, 0.22],
    [0.45, 0.22],
  ] as const) {
    box(g, 0.08, 0.34, 0.08, wood, lx, 0.17, lz);
  }
  return g;
}

/** TV on stand. */
export function createTv(screen = 0x111111, glow = 0x00bcd4): THREE.Group {
  const g = new THREE.Group();
  g.name = 'furn-tv';
  box(g, 1.7, 0.45, 0.45, 0x37474f, 0, 0.3, 0);
  box(g, 1.45, 0.85, 0.08, screen, 0, 1.0, -0.12);
  const glowM = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 0.03), homeSoftMat(glow, 0.5));
  glowM.position.set(0, 1.0, -0.08);
  g.add(glowM);
  return g;
}

/** Floor rug. */
export function createRug(color = 0xc62828): THREE.Group {
  const g = new THREE.Group();
  g.name = 'furn-rug';
  box(g, 2.4, 0.03, 1.8, color, 0, 0.02, 0, { cast: false });
  box(g, 2.1, 0.02, 1.5, 0xffc857, 0, 0.03, 0, { cast: false });
  return g;
}

/** Walk-in shower stall. */
export function createShower(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'furn-shower';
  const glass = homeSoftMat(0xb3e5fc, 0.35);
  // Tray
  box(g, 1.2, 0.08, 1.2, 0xb0bec5, 0, 0.04, 0, { cast: false });
  // Back + side panels
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.06), glass);
  back.position.set(0, 1.1, -0.55);
  g.add(back);
  const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.1, 1.1), glass);
  side.position.set(-0.55, 1.1, 0);
  g.add(side);
  // Head
  box(g, 0.25, 0.08, 0.25, 0x78909c, 0, 2.0, -0.2, { cast: false });
  box(g, 0.06, 0.5, 0.06, 0x90a4ae, 0, 1.7, -0.2, { cast: false });
  // Curtain accent
  box(g, 0.08, 1.9, 1.0, 0x4fc3f7, 0.55, 1.05, 0, { cast: false });
  return g;
}

/** Small bookshelf. */
export function createBookshelf(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'furn-shelf';
  box(g, 0.9, 1.4, 0.35, 0x6d4c41, 0, 0.75, 0);
  const colors = [0xc62828, 0x1565c0, 0xffc857, 0x2e7d32, 0x6a1b9a];
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4; i++) {
      box(g, 0.12, 0.28, 0.22, colors[(row + i) % colors.length]!, -0.3 + i * 0.2, 0.35 + row * 0.4, 0.02);
    }
  }
  return g;
}

/** Place furniture at world coords with optional collision. */
export function place(
  parent: THREE.Object3D,
  piece: THREE.Group,
  x: number,
  y: number,
  z: number,
  yaw = 0,
  collide?: { fn: CollideFn; hx: number; hy: number; hz: number; cy?: number },
): THREE.Group {
  piece.position.set(x, y, z);
  piece.rotation.y = yaw;
  parent.add(piece);
  if (collide) {
    collide.fn(x, collide.cy ?? y + collide.hy, z, collide.hx, collide.hy, collide.hz);
  }
  return piece;
}
