import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BuiltHairId } from './catalog';
import type { RigFit } from './fit';
import { strandTexture } from './textures';

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Skull = RigFit['skull'];

const onSkull = (s: Skull, n: THREE.Vector3, k: number) =>
  new THREE.Vector3(s.cx + n.x * s.rx * k, s.cy + n.y * s.ry * k, s.cz + n.z * s.rz * k);

/** Directions on the unit sphere that grow hair: above the forehead, around the ears, down to the nape. */
function inHairline(n: THREE.Vector3): boolean {
  if (n.z > 0.3 && n.y < 0.36) return false;
  if (n.y < -0.5) return false;
  if (n.y < 0.05 && n.z > -0.35) return false;
  return true;
}

function scalpPoints(count: number, seed: number): THREE.Vector3[] {
  const rand = rng(seed);
  const out: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count * 3 && out.length < count; i++) {
    const y = 1 - (i / (count * 3 - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = i * golden + rand() * 0.2;
    const n = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    if (inHairline(n)) out.push(n);
  }
  return out;
}

/** Scalp cover in the hair color, trimmed to the hairline. */
function scalpCap(s: Skull, mat: THREE.Material, k = 1.045): THREE.Mesh {
  const geo = new THREE.SphereGeometry(1, 48, 32);
  const pos = geo.getAttribute('position');
  const index = geo.getIndex()!;
  const keep: number[] = [];
  const n = new THREE.Vector3();
  for (let t = 0; t < index.count; t += 3) {
    n.set(0, 0, 0);
    for (let j = 0; j < 3; j++) {
      const i = index.getX(t + j);
      n.x += pos.getX(i);
      n.y += pos.getY(i);
      n.z += pos.getZ(i);
    }
    n.normalize();
    if (inHairline(n)) keep.push(index.getX(t), index.getX(t + 1), index.getX(t + 2));
  }
  geo.setIndex(keep);
  const cap = new THREE.Mesh(geo, mat);
  cap.position.set(s.cx, s.cy, s.cz);
  cap.scale.set(s.rx * k, s.ry * k, s.rz * k);
  return cap;
}

/** Pushes a strand point outside the head, neck, shoulders and face. */
function collide(p: THREE.Vector3, fit: RigFit): void {
  const s = fit.skull;
  const k = 1.06;
  const lx = (p.x - s.cx) / (s.rx * k);
  const ly = (p.y - s.cy) / (s.ry * k);
  const lz = (p.z - s.cz) / (s.rz * k);
  const d = Math.sqrt(lx * lx + ly * ly + lz * lz);
  if (d < 1 && d > 1e-4) {
    p.set(s.cx + (lx / d) * s.rx * k, s.cy + (ly / d) * s.ry * k, s.cz + (lz / d) * s.rz * k);
  }
  if (p.y < s.cy - 0.03 && p.y > fit.shoulderTopY - 0.02) {
    const dx = p.x;
    const dz = p.z - fit.neckZ;
    const r = Math.hypot(dx, dz);
    if (r < 0.075 && r > 1e-4) {
      p.x = (dx / r) * 0.075;
      p.z = fit.neckZ + (dz / r) * 0.075;
    }
  }
  if (p.y < fit.shoulderTopY + 0.015) {
    const cz = (fit.chestFrontZ + fit.chestBackZ) / 2;
    const rx = fit.shoulderX + 0.02;
    const rz = (fit.chestFrontZ - fit.chestBackZ) / 2 + 0.02;
    const ex = p.x / rx;
    const ez = (p.z - cz) / rz;
    if (ex * ex + ez * ez < 1) {
      const depth = Math.sqrt(Math.max(0, 1 - ex * ex)) * rz;
      p.z = ez > 0.55 ? cz + depth : cz - depth;
    }
  }
  if (p.z > fit.eyeFrontZ - 0.07 && p.y < s.cy + 0.05 && Math.abs(p.x) < s.rx * 1.05) {
    p.x = Math.sign(p.x || 1) * s.rx * 1.05;
  }
}

function drape(fit: RigFit, n: THREE.Vector3, length: number, seg: number, rand: () => number): THREE.Vector3[] {
  const s = fit.skull;
  const pts = [onSkull(s, n, 1.04)];
  const dir = n.clone().multiplyScalar(0.3).add(new THREE.Vector3(0, -0.6, -0.25));
  if (n.z > 0.2) dir.add(new THREE.Vector3(Math.sign(n.x || rand() - 0.5) * 0.6, 0.3, -0.9));
  dir.normalize();
  const steps = Math.max(3, Math.round(length / seg));
  const gravity = new THREE.Vector3(0, -1, -0.18);
  for (let i = 0; i < steps; i++) {
    dir.addScaledVector(gravity, 0.55).normalize();
    const p = pts[pts.length - 1]!.clone().addScaledVector(dir, seg);
    collide(p, fit);
    pts.push(p);
  }
  return pts;
}

function strands(paths: THREE.Vector3[][], radius: number, mat: THREE.Material): THREE.Mesh {
  const geos = paths.map((path) => {
    const curve = new THREE.CatmullRomCurve3(path, false, 'centripetal');
    return new THREE.TubeGeometry(curve, Math.max(6, path.length * 2), radius, 6, false);
  });
  const merged = mergeGeometries(geos, false)!;
  for (const g of geos) g.dispose();
  const m = new THREE.Mesh(merged, mat);
  m.castShadow = true;
  return m;
}

function hairMat(color: number, kind: 'locs' | 'braid' | 'curl', repeat: [number, number]): THREE.MeshStandardMaterial {
  const map = strandTexture(kind).clone();
  map.repeat.set(repeat[0], repeat[1]);
  map.needsUpdate = true;
  map.userData.owned = true;
  return new THREE.MeshStandardMaterial({ color, map, bumpMap: map, bumpScale: 1.2, roughness: 0.82, metalness: 0 });
}

/** Volume ball with a curly surface, flattened where it would cover the face. */
function puffBall(fit: RigFit, center: THREE.Vector3, radii: THREE.Vector3, mat: THREE.Material, seed: number): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(1, 5);
  const pos = geo.getAttribute('position');
  const rand = rng(seed);
  const s = fit.skull;
  const front = fit.eyeFrontZ - 0.012;
  for (let i = 0; i < pos.count; i++) {
    const n = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const bump = 1 + (Math.sin(n.x * 23 + n.y * 17) * Math.cos(n.z * 19 + n.y * 11)) * 0.035 + (rand() - 0.5) * 0.02;
    const p = new THREE.Vector3(
      center.x + n.x * radii.x * bump,
      center.y + n.y * radii.y * bump,
      center.z + n.z * radii.z * bump,
    );
    if (p.z > front && p.y < s.cy + 0.07) p.z = front + Math.max(0, p.y - (s.cy + 0.04)) * 0.4;
    if (p.y < s.cy - 0.02 && p.z > s.cz + 0.02) p.y = s.cy - 0.02;
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

/** Extra clearance a hat needs over this hairstyle. */
export function builtHairPad(id: BuiltHairId): number {
  if (id === 'afro') return 0.06;
  if (id === 'afro-court' || id === 'twists') return 0.032;
  if (id === 'puff' || id === 'chignon') return 0.03;
  return 0.016;
}

export function buildHair(id: BuiltHairId, fit: RigFit, color: number): THREE.Group {
  const g = new THREE.Group();
  g.name = `built-hair-${id}`;
  const s = fit.skull;
  const rand = rng(id.length * 131 + 7);
  const capMat = hairMat(color, id === 'cornrows' || id === 'chignon' ? 'braid' : 'curl', [6, 6]);

  if (id === 'afro' || id === 'afro-court') {
    const big = id === 'afro';
    const mat = hairMat(color, 'curl', [5, 5]);
    g.add(scalpCap(s, capMat));
    g.add(
      puffBall(
        fit,
        new THREE.Vector3(0, s.cy + (big ? 0.06 : 0.035), s.cz - (big ? 0.02 : 0.01)),
        new THREE.Vector3(s.rx + (big ? 0.06 : 0.026), s.ry + (big ? 0.04 : 0.016), s.rz + (big ? 0.055 : 0.024)),
        mat,
        big ? 11 : 5,
      ),
    );
    return g;
  }

  if (id === 'puff') {
    g.add(scalpCap(s, capMat));
    const mat = hairMat(color, 'curl', [4, 4]);
    g.add(puffBall(fit, new THREE.Vector3(0, s.cy + s.ry + 0.035, s.cz - s.rz * 0.35), new THREE.Vector3(0.075, 0.065, 0.075), mat, 3));
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.006, 8, 24), new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.6 }));
    band.rotation.x = Math.PI / 2 - 0.5;
    band.position.set(0, s.cy + s.ry - 0.005, s.cz - s.rz * 0.25);
    g.add(band);
    return g;
  }

  if (id === 'cornrows' || id === 'chignon') {
    g.add(scalpCap(s, capMat));
    const mat = hairMat(color, 'braid', [10, 1]);
    const rows: THREE.Vector3[][] = [];
    const count = 9;
    for (let r = 0; r < count; r++) {
      const u = -0.82 + (r / (count - 1)) * 1.64;
      const path: THREE.Vector3[] = [];
      const end = id === 'chignon' ? 0.55 : 1.18;
      for (let i = 0; i <= 16; i++) {
        const a = (0.16 + (i / 16) * (end - 0.16)) * Math.PI;
        const shrink = id === 'chignon' ? 1 - (i / 16) * 0.85 : 1;
        const n = new THREE.Vector3(u * Math.sqrt(Math.max(0, 1 - u * u * 0.3)) * shrink, Math.sin(a), Math.cos(a)).normalize();
        if (!inHairline(n) && i > 0 && i < 16) continue;
        path.push(onSkull(s, n, 1.065));
      }
      if (path.length > 2) rows.push(path);
    }
    g.add(strands(rows, 0.0068, mat));
    if (id === 'chignon') {
      const bunMat = hairMat(color, 'braid', [8, 2]);
      const bun = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.022, 12, 32), bunMat);
      bun.rotation.x = Math.PI / 2;
      bun.position.set(0, s.cy + s.ry + 0.018, s.cz - 0.01);
      g.add(bun);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), bunMat);
      top.position.set(0, s.cy + s.ry + 0.032, s.cz - 0.01);
      g.add(top);
    }
    return g;
  }

  if (id === 'twists') {
    g.add(scalpCap(s, capMat));
    const mat = hairMat(color, 'locs', [1, 3]);
    const paths = scalpPoints(170, 21).map((n) => {
      const len = 0.045 + rand() * 0.03;
      const a = onSkull(s, n, 1.035);
      const dir = n.clone().add(new THREE.Vector3(0, -0.35, 0)).normalize();
      if (n.z > 0.3) dir.add(new THREE.Vector3(0, 0.3, -0.4)).normalize();
      return [a, a.clone().addScaledVector(dir, len * 0.5), a.clone().addScaledVector(dir, len)];
    });
    g.add(strands(paths, 0.0062, mat));
    return g;
  }

  const braids = id === 'box-braids';
  const tied = id === 'locs-attachees';
  const mat = hairMat(color, braids ? 'braid' : 'locs', braids ? [1, 14] : [1, 8]);
  g.add(scalpCap(s, capMat));
  const roots = scalpPoints(braids ? 120 : 78, braids ? 17 : 13);
  const length = id === 'locs' ? 0.24 : 0.42;
  const paths: THREE.Vector3[][] = [];
  const gather = new THREE.Vector3(0, s.cy - 0.005, s.cz - s.rz * 1.04);
  for (const n of roots) {
    if (tied) {
      const path: THREE.Vector3[] = [];
      const back = new THREE.Vector3(0, -0.05, -1).normalize();
      for (let i = 0; i <= 6; i++) {
        const dir = n.clone().lerp(back, i / 6).normalize();
        path.push(onSkull(s, dir, 1.06));
      }
      path.push(gather.clone().add(new THREE.Vector3((rand() - 0.5) * 0.01, (rand() - 0.5) * 0.01, -0.01)));
      let p = path[path.length - 1]!.clone();
      for (let i = 0; i < 9; i++) {
        p = p.clone().add(new THREE.Vector3((rand() - 0.5) * 0.008, -0.03, -0.008));
        collide(p, fit);
        path.push(p);
      }
      paths.push(path);
    } else {
      paths.push(drape(fit, n, length * (0.85 + rand() * 0.3), 0.022, rand));
    }
  }
  g.add(strands(paths, braids ? 0.0052 : 0.0078, mat));
  if (tied) {
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 20), new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.4, metalness: 0.6 }));
    tie.position.copy(gather).add(new THREE.Vector3(0, -0.02, -0.012));
    tie.rotation.x = Math.PI / 2;
    g.add(tie);
  }
  return g;
}
