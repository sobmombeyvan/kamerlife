import * as THREE from 'three';
import { mat } from '../world/materials';

export type VehicleBrand = 'taxi' | 'car' | 'jetour' | 'prado' | 'tesla';

const CAR_COLORS = [0x455a64, 0xc62828, 0xffffff, 0x1b5e20, 0x1565c0, 0x6d4c41, 0xff8f00, 0x37474f];
const JETOUR_COLORS = [0x1a237e, 0x212121, 0xc62828, 0xffffff, 0x37474f, 0xb71c1c];
const PRADO_COLORS = [0xffffff, 0x212121, 0x4e342e, 0x455a64, 0x1b5e20, 0xbdbdbd];
const TESLA_COLORS = [0xffffff, 0x212121, 0xc62828, 0x1565c0, 0x9e9e9e];

const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 8);
const suvWheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 8);
const busBodyGeo = new THREE.BoxGeometry(2.3, 2.4, 7.5);
const busWinGeo = new THREE.BoxGeometry(2.35, 0.9, 6.5);
const motoGeo = new THREE.BoxGeometry(0.42, 0.5, 1.55);

const badgeCache = new Map<string, THREE.MeshBasicMaterial>();

/**
 * Vehicles face local +Z (forward).
 */
export function createCarMesh(seed: number, taxi = false): THREE.Group {
  return createBrandVehicle(seed, taxi ? 'taxi' : 'car');
}

export function createBrandVehicle(seed: number, brand: VehicleBrand): THREE.Group {
  switch (brand) {
    case 'taxi':
      return buildYango(seed);
    case 'jetour':
      return buildJetour(seed);
    case 'prado':
      return buildPrado(seed);
    case 'tesla':
      return buildTesla(seed);
    default:
      return buildSedan(seed, false, 'Voiture', CAR_COLORS[seed % CAR_COLORS.length]!);
  }
}

export function pickParkedBrand(seed: number): VehicleBrand {
  const r = seed % 12;
  if (r === 0 || r === 1) return 'taxi';
  if (r === 2 || r === 3 || r === 4) return 'jetour';
  if (r === 5 || r === 6 || r === 7) return 'prado';
  if (r === 8 || r === 9) return 'tesla';
  return 'car';
}

function buildSedan(_seed: number, taxi: boolean, label: string, color: number): THREE.Group {
  const g = new THREE.Group();
  g.name = taxi ? 'taxi' : 'car';
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.85, 3.8), mat(color));
  body.position.y = 0.7;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 1.9), mat(0x78909c));
  cabin.position.set(0, 1.35, -0.15);
  g.add(cabin);
  if (taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.7), mat(0x222222));
    sign.position.set(0, 1.85, 0);
    g.add(sign);
    addBadge(g, 'TAXI', 0x222222, 0xffc107, 0, 1.55, 1.85, 0.9, 0.22);
  }
  addWheels(g, 1.15, 0.85, 0.32, wheelGeo);
  tag(g, taxi ? 'taxi' : 'car', label, 2.0, 1.0);
  return g;
}

/** Yango ride-hail car — rouge / blanc. */
function buildYango(_seed: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'yango';
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.88, 3.9), mat(0xffffff));
  body.position.y = 0.72;
  g.add(body);
  // Red hood / stripe
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.12, 1.1), mat(0xe30613));
  hood.position.set(0, 1.05, 1.15);
  g.add(hood);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 3.92), mat(0xe30613));
  stripe.position.set(0, 0.75, 0);
  g.add(stripe);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.72, 1.95), mat(0x455a64));
  cabin.position.set(0, 1.38, -0.12);
  g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.85), mat(0xe30613));
  roof.position.set(0, 1.88, 0.05);
  g.add(roof);
  addBadge(g, 'YANGO', 0xe30613, 0xffffff, 0, 1.52, 1.9, 1.05, 0.24);
  addWheels(g, 1.15, 0.88, 0.32, wheelGeo);
  tag(g, 'taxi', 'Yango', 2.05, 1.05);
  return g;
}

/** Jetour-style luxury crossover — brand badge on grille. */
function buildJetour(seed: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'jetour';
  const color = JETOUR_COLORS[seed % JETOUR_COLORS.length]!;

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.95, 4.2), mat(color));
  body.position.y = 0.85;
  g.add(body);

  // Higher cabin / crossover roof
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.85, 2.2), mat(0x263238));
  cabin.position.set(0, 1.55, -0.1);
  g.add(cabin);

  // Chrome grille bar
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 0.12), mat(0xcfd8dc));
  grille.position.set(0, 0.85, 2.05);
  g.add(grille);

  // Roof rails
  for (const side of [-0.7, 0.7]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 2.0), mat(0x37474f));
    rail.position.set(side, 2.05, -0.1);
    g.add(rail);
  }

  addBadge(g, 'JETOUR', 0x0d47a1, 0xffffff, 0, 1.05, 2.08, 1.1, 0.28);
  addWheels(g, 1.25, 0.95, 0.36, suvWheelGeo);
  tag(g, 'jetour', 'Jetour Luxury', 2.2, 1.15);
  return g;
}

/** Toyota Prado-style tall boxy SUV. */
function buildPrado(seed: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'prado';
  const color = PRADO_COLORS[seed % PRADO_COLORS.length]!;

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.15, 4.4), mat(color));
  body.position.y = 1.05;
  g.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.95, 2.6), mat(0x37474f));
  cabin.position.set(0, 1.85, -0.15);
  g.add(cabin);

  // Spare tire look on back
  const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 12), mat(0x212121));
  spare.rotation.x = Math.PI / 2;
  spare.position.set(0, 1.1, -2.25);
  g.add(spare);

  // Snorkel / side detail
  const snorkel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), mat(0x424242));
  snorkel.position.set(1.05, 1.5, 0.8);
  g.add(snorkel);

  // Roof rack
  const rack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 2.2), mat(0x212121));
  rack.position.set(0, 2.4, -0.1);
  g.add(rack);

  addBadge(g, 'PRADO', 0xffffff, 0xc62828, 0, 1.2, 2.2, 1.0, 0.26);
  addWheels(g, 1.35, 1.0, 0.42, suvWheelGeo);
  tag(g, 'prado', 'Toyota Prado', 2.35, 1.2);
  return g;
}

/** Tesla-style sleek EV sedan. */
function buildTesla(seed: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'tesla';
  const color = TESLA_COLORS[seed % TESLA_COLORS.length]!;

  // Low sleek body
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.55, 4.3), mat(color));
  body.position.y = 0.55;
  g.add(body);

  // Fastback cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.55, 2.4), mat(0x111111));
  cabin.position.set(0, 1.05, -0.05);
  g.add(cabin);

  // Glass roof
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 1.8), mat(0x263238, 0.55));
  glass.position.set(0, 1.35, -0.05);
  g.add(glass);

  // Light bar front
  const light = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.08), mat(0xe3f2fd));
  light.position.set(0, 0.65, 2.12);
  g.add(light);

  addBadge(g, 'TESLA', 0x212121, 0xe0e0e0, 0, 0.75, 2.14, 0.85, 0.2);
  addWheels(g, 1.3, 0.9, 0.34, wheelGeo);
  tag(g, 'tesla', 'Tesla', 2.25, 1.05);
  return g;
}

function addWheels(
  g: THREE.Group,
  zOff: number,
  xOff: number,
  y: number,
  geo: THREE.CylinderGeometry,
): void {
  for (const wz of [-zOff, zOff] as const) {
    for (const wx of [-xOff, xOff] as const) {
      const wheel = new THREE.Mesh(geo, mat(0x222426));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, y, wz);
      wheel.userData.spinWheel = true;
      g.add(wheel);
    }
  }
}

function addBadge(
  g: THREE.Group,
  text: string,
  bg: number,
  fg: number,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
): void {
  const key = `${text}-${bg}-${fg}`;
  let material = badgeCache.get(key);
  if (!material) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = `#${bg.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = `#${fg.toString(16).padStart(6, '0')}`;
    ctx.font = 'bold 36px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    material = new THREE.MeshBasicMaterial({ map: tex });
    badgeCache.set(key, material);
  }
  const badge = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), material);
  badge.position.set(x, y, z);
  g.add(badge);
}

function tag(g: THREE.Group, brand: VehicleBrand, label: string, halfL: number, halfW: number): void {
  g.userData.driveable = true;
  g.userData.brand = brand;
  g.userData.label = label;
  g.userData.halfLength = halfL;
  g.userData.halfWidth = halfW;
}

export function createBusMesh(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(busBodyGeo, mat(0x1565c0));
  body.position.y = 1.3;
  g.add(body);
  const windows = new THREE.Mesh(busWinGeo, mat(0x81d4fa, 0.45));
  windows.position.y = 2.0;
  g.add(windows);

  // Yellow stripe + destination boards (was a plain blue box)
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.22, 7.2), mat(0xffc107));
  stripe.position.y = 1.75;
  g.add(stripe);

  addBadge(g, 'SOCATUR', 0x0d47a1, 0xffffff, 0, 2.55, 3.78, 1.6, 0.38);
  addBadge(g, 'CENTRE', 0xffc107, 0x1a237e, 0, 2.15, 3.78, 1.4, 0.32);
  addBadge(g, 'YDE · MOKOLO', 0x0d47a1, 0xffc107, 1.18, 1.95, 0.4, 0.05, 0.42);
  addWheels(g, 2.5, 0.95, 0.42, wheelGeo);

  g.userData.driveable = false;
  g.userData.brand = 'bus';
  g.userData.label = 'Bus SOCATUR';
  return g;
}

export function createMotoMesh(seed: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(motoGeo, mat(seed % 2 ? 0xc62828 : 0x212121));
  body.position.y = 0.55;
  g.add(body);
  return g;
}
