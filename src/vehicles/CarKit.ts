import * as THREE from 'three';
import { drawSignFace } from '../render/designedArt';
import type { VehicleProfile } from './catalog';

export type VehicleDetail = 'street' | 'full';

const paintCache = new Map<string, THREE.MeshStandardMaterial>();
const stdCache = new Map<string, THREE.MeshStandardMaterial>();
const geoCache = new Map<string, THREE.BufferGeometry>();

export function carPaint(
  color: number,
  opts?: { luxury?: boolean; street?: boolean },
): THREE.MeshStandardMaterial {
  const key = `${color}_${opts?.luxury ? 1 : 0}_${opts?.street ? 1 : 0}`;
  const hit = paintCache.get(key);
  if (hit) return hit as THREE.MeshStandardMaterial;
  const m = new THREE.MeshStandardMaterial({
    color,
    metalness: opts?.luxury ? 0.55 : opts?.street ? 0.36 : 0.42,
    roughness: opts?.luxury ? 0.24 : opts?.street ? 0.4 : 0.32,
    envMapIntensity: opts?.luxury ? 1.05 : opts?.street ? 0.7 : 0.88,
  });
  paintCache.set(key, m);
  return m;
}

function std(color: number, roughness: number, metalness: number, extra?: string): THREE.MeshStandardMaterial {
  const key = `${color}_${roughness}_${metalness}_${extra ?? ''}`;
  const hit = stdCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: 0.7 });
  stdCache.set(key, m);
  return m;
}

export const kitMats = {
  rubber: () => std(0x1a1c1e, 0.92, 0.04),
  rim: () => std(0xcfd8dc, 0.28, 0.72),
  rimDark: () => std(0x42464a, 0.32, 0.65),
  chrome: () => std(0xdfe6ea, 0.18, 0.88),
  brushed: () => std(0xb0bec5, 0.42, 0.7),
  darkTrim: () => std(0x1c1c1e, 0.48, 0.28),
  plastic: () => std(0x2a2d30, 0.72, 0.12),
  plate: () => std(0xfafafa, 0.55, 0.08),
  leather: () => std(0x3e2723, 0.62, 0.08),
  leatherDark: () => std(0x1c1210, 0.58, 0.06),
  leatherCream: () => std(0xcbb59b, 0.55, 0.08),
  wood: () => std(0x5d4037, 0.48, 0.12),
  screen: () =>
    new THREE.MeshStandardMaterial({
      color: 0x0a1218,
      emissive: 0x12324a,
      emissiveIntensity: 0.55,
      roughness: 0.22,
      metalness: 0.15,
    }),
};

let glassShared: THREE.MeshStandardMaterial | null = null;
export function glassMat(): THREE.MeshStandardMaterial {
  if (!glassShared) {
    glassShared = new THREE.MeshStandardMaterial({
      color: 0x152028,
      roughness: 0.06,
      metalness: 0.18,
      transparent: true,
      opacity: 0.32,
      envMapIntensity: 1.15,
      depthWrite: false,
    });
  }
  return glassShared;
}

let tintedShared: THREE.MeshStandardMaterial | null = null;
export function tintedGlass(): THREE.MeshStandardMaterial {
  if (!tintedShared) {
    tintedShared = new THREE.MeshStandardMaterial({
      color: 0x101820,
      roughness: 0.08,
      metalness: 0.28,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      envMapIntensity: 0.9,
    });
  }
  return tintedShared;
}

export function boxGeo(w: number, h: number, d: number): THREE.BoxGeometry {
  const k = `b_${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
  let g = geoCache.get(k) as THREE.BoxGeometry | undefined;
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    geoCache.set(k, g);
  }
  return g;
}

export function cylGeo(r: number, h: number, seg: number): THREE.CylinderGeometry {
  const k = `c_${r.toFixed(3)}_${h.toFixed(3)}_${seg}`;
  let g = geoCache.get(k) as THREE.CylinderGeometry | undefined;
  if (!g) {
    g = new THREE.CylinderGeometry(r, r, h, seg);
    geoCache.set(k, g);
  }
  return g;
}

export function addMesh(
  g: THREE.Object3D,
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  opts?: { rx?: number; ry?: number; rz?: number; cast?: boolean },
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  if (opts?.rx) mesh.rotation.x = opts.rx;
  if (opts?.ry) mesh.rotation.y = opts.ry;
  if (opts?.rz) mesh.rotation.z = opts.rz;
  mesh.castShadow = opts?.cast !== false;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

export type LightSet = {
  head: THREE.MeshStandardMaterial;
  brake: THREE.MeshStandardMaterial;
  reverse: THREE.MeshStandardMaterial;
  indicator: THREE.MeshStandardMaterial;
};

export function makeLightSet(animated: boolean): LightSet {
  const mk = (color: number, emissive: number, intensity: number) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: intensity,
      roughness: 0.28,
      metalness: 0.22,
    });
    return m;
  };
  return {
    head: mk(0xf5f5f5, 0xfff4d6, animated ? 0.35 : 0.85),
    brake: mk(0x8b1515, 0xe53935, animated ? 0.25 : 0.7),
    reverse: mk(0xeeeeee, 0xffffff, animated ? 0.08 : 0.2),
    indicator: mk(0xff8f00, 0xff6d00, animated ? 0.15 : 0.4),
  };
}

export function addWheels(
  root: THREE.Group,
  p: VehicleProfile,
  detail: VehicleDetail,
): { steer: THREE.Group[]; spin: THREE.Group[] } {
  const steer: THREE.Group[] = [];
  const spin: THREE.Group[] = [];
  const zOff = p.wheelbase / 2;
  const xOff = p.track;
  const y = p.wheelR;
  const segs = detail === 'full' ? 16 : 10;
  const tire = cylGeo(p.wheelR, p.wheelW, segs);
  const rim = cylGeo(p.wheelR * 0.58, p.wheelW * 0.55, segs);
  const hub = cylGeo(p.wheelR * 0.2, p.wheelW * 0.62, 8);
  const spoke = boxGeo(p.wheelR * 0.08, p.wheelW * 0.18, p.wheelR * 0.85);
  const rimMat = p.luxury ? kitMats.chrome() : kitMats.rim();
  const rearXs = p.dualRear ? [-xOff - 0.18, -xOff + 0.18, xOff - 0.18, xOff + 0.18] : [-xOff, xOff];

  const place = (wx: number, wz: number, front: boolean) => {
    const holder = new THREE.Group();
    holder.position.set(wx, y, wz);
    const spinner = new THREE.Group();
    spinner.userData.spinWheel = true;
    const t = new THREE.Mesh(tire, kitMats.rubber());
    t.rotation.z = Math.PI / 2;
    t.castShadow = true;
    const r = new THREE.Mesh(rim, rimMat);
    r.rotation.z = Math.PI / 2;
    const h = new THREE.Mesh(hub, kitMats.chrome());
    h.rotation.z = Math.PI / 2;
    spinner.add(t, r, h);
    if (detail === 'full' && p.luxury) {
      for (let i = 0; i < 6; i++) {
        const s = new THREE.Mesh(spoke, rimMat);
        s.rotation.z = Math.PI / 2;
        s.rotation.x = (i / 6) * Math.PI;
        spinner.add(s);
      }
    }
    holder.add(spinner);
    root.add(holder);
    spin.push(spinner);
    if (front) steer.push(holder);
  };

  place(-xOff, zOff, true);
  place(xOff, zOff, true);
  for (const wx of rearXs) place(wx, -zOff, false);
  return { steer, spin };
}

export function addContactShadow(g: THREE.Group, p: VehicleProfile): void {
  const mat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(p.width * 1.05, p.length * 0.92), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.02;
  plane.receiveShadow = false;
  plane.castShadow = false;
  g.add(plane);
}

export function addMirrors(g: THREE.Object3D, x: number, y: number, z: number): void {
  addMesh(g, boxGeo(0.08, 0.12, 0.22), kitMats.darkTrim(), x, y, z);
  addMesh(g, boxGeo(0.08, 0.12, 0.22), kitMats.darkTrim(), -x, y, z);
  addMesh(g, boxGeo(0.02, 0.09, 0.16), tintedGlass(), x + 0.05, y, z);
  addMesh(g, boxGeo(0.02, 0.09, 0.16), tintedGlass(), -x - 0.05, y, z);
}

export function addPlate(g: THREE.Object3D, y: number, z: number): void {
  addMesh(g, boxGeo(0.42, 0.12, 0.03), kitMats.plate(), 0, y, z, { cast: false });
}

const badgeCache = new Map<string, THREE.MeshBasicMaterial>();

export function addBadge(
  g: THREE.Object3D,
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
    canvas.width = 512;
    canvas.height = 128;
    drawSignFace(canvas.getContext('2d')!, 512, 128, text, undefined, bg, fg);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    material = new THREE.MeshBasicMaterial({ map: tex });
    badgeCache.set(key, material);
  }
  const badge = new THREE.Mesh(boxGeo(w, h, 0.03), material);
  badge.position.set(x, y, z);
  g.add(badge);
}

export function addInterior(chassis: THREE.Object3D, p: VehicleProfile): void {
  const leather = p.luxury ? kitMats.leatherCream() : kitMats.leather();
  const dashY = p.clearance + 0.62;
  const cabinFront = p.cabinZ + p.cabinL * 0.38;
  const w = p.width * 0.78;
  addMesh(chassis, boxGeo(w, 0.28, 0.42), kitMats.plastic(), 0, dashY, cabinFront, { cast: false });
  addMesh(chassis, boxGeo(w * 0.55, 0.08, 0.28), kitMats.screen(), 0, dashY + 0.16, cabinFront - 0.02, {
    cast: false,
  });
  if (p.luxury) {
    addMesh(chassis, boxGeo(w * 0.92, 0.04, 0.08), kitMats.wood(), 0, dashY + 0.08, cabinFront + 0.12, {
      cast: false,
    });
  }
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 18), kitMats.darkTrim());
  wheel.position.set(-0.32, dashY + 0.08, cabinFront - 0.22);
  wheel.rotation.x = 0.35;
  chassis.add(wheel);
  addMesh(chassis, boxGeo(0.22, 0.18, 0.55), kitMats.plastic(), 0, dashY - 0.12, cabinFront - 0.45, {
    cast: false,
  });
  addMesh(chassis, boxGeo(0.08, 0.06, 0.12), kitMats.brushed(), 0.08, dashY - 0.02, cabinFront - 0.35, {
    cast: false,
  });

  const seat = (x: number, z: number, tall: number) => {
    addMesh(chassis, boxGeo(0.42, 0.1, 0.42), leather, x, p.clearance + 0.52, z, { cast: false });
    addMesh(chassis, boxGeo(0.42, tall, 0.1), leather, x, p.clearance + 0.52 + tall / 2, z - 0.18, {
      cast: false,
    });
  };
  seat(-0.32, cabinFront - 0.72, 0.42);
  seat(0.32, cabinFront - 0.72, 0.42);
  if (p.luxury && p.cabinL > 1.7 && p.kind !== 'pickup' && p.kind !== 'truck') {
    seat(-0.32, cabinFront - 1.35, 0.38);
    seat(0.32, cabinFront - 1.35, 0.38);
  }
  addMesh(chassis, boxGeo(0.04, 0.22, 0.18), tintedGlass(), 0, dashY + 0.22, cabinFront - 0.08, { cast: false });
}

let qrMat: THREE.MeshBasicMaterial | null = null;
export function qrMaterial(): THREE.MeshBasicMaterial {
  if (qrMat) return qrMat;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#111';
  const cells = 21;
  const s = 64 / cells;
  const bit = (x: number, y: number) => ((x * 7 + y * 13 + x * y) >>> 0) % 5 !== 1;
  const finder = (ox: number, oy: number) => {
    ctx.fillRect(ox * s, oy * s, 7 * s, 7 * s);
    ctx.fillStyle = '#fff';
    ctx.fillRect((ox + 1) * s, (oy + 1) * s, 5 * s, 5 * s);
    ctx.fillStyle = '#111';
    ctx.fillRect((ox + 2) * s, (oy + 2) * s, 3 * s, 3 * s);
  };
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const inFinder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      if (!inFinder && bit(x, y)) ctx.fillRect(x * s, y * s, s, s);
    }
  }
  finder(0, 0);
  finder(14, 0);
  finder(0, 14);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  qrMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  return qrMat;
}

export function addDoorQr(g: THREE.Object3D, x: number, y: number, z: number): void {
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), qrMaterial());
  plate.position.set(x, y, z);
  plate.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
  g.add(plate);
}
