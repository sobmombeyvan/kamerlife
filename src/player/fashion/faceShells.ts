import * as THREE from 'three';
import type { BeardId } from './catalog';
import { beardAlpha, dotsAlpha } from './textures';

/** Face landmarks on the bind-pose body mesh, measured down from the top of the head. */
type FaceMarks = { ymax: number; tipD: number; chinD: number; eyeD: number };

function marks(geo: THREE.BufferGeometry): FaceMarks {
  const pos = geo.getAttribute('position');
  let ymax = -Infinity;
  for (let i = 0; i < pos.count; i++) ymax = Math.max(ymax, pos.getY(i));
  const bands = new Map<number, number>();
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getX(i)) > 0.004) continue;
    const d = ymax - pos.getY(i);
    if (d < 0.05 || d > 0.34) continue;
    const k = Math.round(d * 200);
    bands.set(k, Math.max(bands.get(k) ?? -Infinity, pos.getZ(i)));
  }
  let tipK = 0;
  let tipZ = -Infinity;
  for (const [k, z] of bands) {
    if (k >= 18 && k <= 40 && z > tipZ) {
      tipZ = z;
      tipK = k;
    }
  }
  let chinK = tipK + 16;
  let prev = tipZ;
  for (let k = tipK + 8; k <= 68; k++) {
    const z = bands.get(k);
    if (z === undefined) continue;
    if (z < prev - 0.02) {
      chinK = k - 1;
      break;
    }
    prev = z;
  }
  const tipD = tipK / 200;
  return { ymax, tipD, chinD: chinK / 200, eyeD: tipD - 0.025 };
}

type Pick = (x: number, d: number, z: number, nz: number, ny: number) => number;

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Copies the body triangles where `pick` > 0, lifts them along the normal and
 * binds them to the body skeleton so they deform with the face.
 */
function shell(body: THREE.SkinnedMesh, pick: Pick, lift: number, drop: number, mat: THREE.Material): THREE.SkinnedMesh | null {
  const src = body.geometry;
  const pos = src.getAttribute('position');
  const nor = src.getAttribute('normal');
  if (!nor) return null;
  const m = (src.userData.faceMarks as FaceMarks | undefined) ?? (src.userData.faceMarks = marks(src));
  const alpha = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const d = m.ymax - pos.getY(i);
    if (d > 0.4) continue;
    alpha[i] = pick(pos.getX(i), d, pos.getZ(i), nor.getZ(i), nor.getY(i));
  }
  const index = src.getIndex();
  const tri: number[] = [];
  const count = index ? index.count : pos.count;
  for (let t = 0; t < count; t += 3) {
    const a = index ? index.getX(t) : t;
    const b = index ? index.getX(t + 1) : t + 1;
    const c = index ? index.getX(t + 2) : t + 2;
    if (alpha[a]! > 0 && alpha[b]! > 0 && alpha[c]! > 0) tri.push(a, b, c);
  }
  if (tri.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  const outPos = new Float32Array(pos.count * 3);
  const color = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const w = alpha[i]!;
    const d = m.ymax - pos.getY(i);
    const below = smooth(m.tipD + 0.04, m.chinD, d);
    const l = lift * Math.sqrt(w);
    outPos[i * 3] = pos.getX(i) + nor.getX(i) * l;
    outPos[i * 3 + 1] = pos.getY(i) + nor.getY(i) * l - drop * below * w;
    outPos[i * 3 + 2] = pos.getZ(i) + nor.getZ(i) * l + drop * 0.4 * below * w;
    color[i * 4] = 1;
    color[i * 4 + 1] = 1;
    color[i * 4 + 2] = 1;
    color[i * 4 + 3] = w;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(outPos, 3));
  geo.setAttribute('normal', nor);
  const uv = src.getAttribute('uv');
  if (uv) geo.setAttribute('uv', uv);
  geo.setAttribute('skinIndex', src.getAttribute('skinIndex'));
  geo.setAttribute('skinWeight', src.getAttribute('skinWeight'));
  geo.setAttribute('color', new THREE.BufferAttribute(color, 4));
  geo.setIndex(tri);
  geo.computeBoundingSphere();
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.bind(body.skeleton, body.bindMatrix);
  mesh.name = 'face-shell';
  mesh.frustumCulled = false;
  return mesh;
}

function layerMat(color: number, opts: { alphaMap?: THREE.Texture; roughness?: number; opacity?: number; physical?: boolean }): THREE.Material {
  const base = {
    color,
    roughness: opts.roughness ?? 0.85,
    metalness: 0,
    transparent: true,
    opacity: opts.opacity ?? 1,
    vertexColors: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    alphaMap: opts.alphaMap ?? null,
  };
  return opts.physical
    ? new THREE.MeshPhysicalMaterial({ ...base, clearcoat: 1, clearcoatRoughness: 0.15 })
    : new THREE.MeshStandardMaterial(base);
}

function lipsOf(m: FaceMarks) {
  const span = m.chinD - m.tipD;
  return { top: m.tipD + 0.25 * span, bottom: m.tipD + 0.6 * span };
}

export function buildBeard(body: THREE.SkinnedMesh, id: BeardId, hex: number): THREE.SkinnedMesh | null {
  if (id === 'aucune') return null;
  const geo = body.geometry;
  const m = (geo.userData.faceMarks as FaceMarks | undefined) ?? (geo.userData.faceMarks = marks(geo));
  const lips = lipsOf(m);
  const onLips = (ax: number, d: number, nz: number) => ax < 0.027 && d > lips.top + 0.003 && d < lips.bottom && nz > 0.25;
  const full: Pick = (x, d, z, nz, ny) => {
    const ax = Math.abs(x);
    if (ax > 0.09 || z < 0.005) return 0;
    if (onLips(ax, d, nz)) return 0;
    if (d < m.tipD + 0.014 && ax < 0.024) return 0;
    const cheekTop = ax > 0.055 ? m.eyeD + 0.04 : m.tipD + 0.004 - (ax - 0.03) * 0.6;
    if (d < cheekTop) return 0;
    if (d > m.chinD + 0.04) return 0;
    if (d > m.chinD && (z < 0.035 || ny > 0.2)) return 0;
    const fade = smooth(cheekTop, cheekTop + 0.012, d) * (1 - smooth(m.chinD + 0.025, m.chinD + 0.04, d)) * (1 - smooth(0.082, 0.09, ax));
    return Math.max(0.001, fade);
  };
  const goatee: Pick = (x, d, z, nz, ny) => {
    const ax = Math.abs(x);
    if (ax > 0.034 || z < 0.03 || onLips(ax, d, nz)) return 0;
    if (d < m.tipD + 0.014 || d > m.chinD + 0.02) return 0;
    if (d > m.chinD && ny > 0.2) return 0;
    return Math.max(0.001, 1 - smooth(0.024, 0.034, ax));
  };
  const stache: Pick = (x, d, z, nz) => {
    const ax = Math.abs(x);
    if (ax > 0.036 || nz < 0.15 || z < 0.05) return 0;
    if (d < m.tipD + 0.013 || d > lips.top + 0.004) return 0;
    return Math.max(0.001, (1 - smooth(0.026, 0.036, ax)) * smooth(m.tipD + 0.013, m.tipD + 0.017, d));
  };
  if (id === 'trois-jours') return shell(body, full, 0.0008, 0, layerMat(hex, { alphaMap: beardAlpha(false), opacity: 0.75 }));
  if (id === 'courte') return shell(body, full, 0.0032, 0.002, layerMat(hex, { alphaMap: beardAlpha(true) }));
  if (id === 'pleine') return shell(body, full, 0.0065, 0.012, layerMat(hex, { alphaMap: beardAlpha(true) }));
  if (id === 'bouc') return shell(body, goatee, 0.004, 0.006, layerMat(hex, { alphaMap: beardAlpha(true) }));
  return shell(body, stache, 0.0032, 0, layerMat(hex, { alphaMap: beardAlpha(true) }));
}

export type MakeupSpec = { lips: number | null; gloss: boolean; blush: number | null; shadow: number | null; freckles: boolean };

export function buildMakeup(body: THREE.SkinnedMesh, spec: MakeupSpec): THREE.SkinnedMesh[] {
  const geo = body.geometry;
  const m = (geo.userData.faceMarks as FaceMarks | undefined) ?? (geo.userData.faceMarks = marks(geo));
  const lips = lipsOf(m);
  const out: (THREE.SkinnedMesh | null)[] = [];
  if (spec.lips !== null) {
    out.push(
      shell(
        body,
        (x, d, _z, nz) => {
          const ax = Math.abs(x);
          if (ax > 0.028 || nz < 0.1 || d < lips.top || d > lips.bottom + 0.003) return 0;
          return Math.max(0.001, (1 - smooth(0.02, 0.028, ax)) * smooth(lips.top, lips.top + 0.003, d) * (1 - smooth(lips.bottom - 0.002, lips.bottom + 0.003, d)));
        },
        0.0004,
        0,
        layerMat(spec.lips, { roughness: spec.gloss ? 0.12 : 0.45, physical: spec.gloss, opacity: 0.92 }),
      ),
    );
  }
  if (spec.blush !== null) {
    out.push(
      shell(
        body,
        (x, d, _z, nz) => {
          if (nz < 0.2) return 0;
          const r = Math.hypot(Math.abs(x) - 0.047, d - (m.tipD - 0.002));
          return r < 0.024 ? Math.max(0.001, 0.5 * (1 - smooth(0.008, 0.024, r))) : 0;
        },
        0.0003,
        0,
        layerMat(spec.blush, { roughness: 0.9 }),
      ),
    );
  }
  if (spec.shadow !== null) {
    out.push(
      shell(
        body,
        (x, d, _z, nz) => {
          const ax = Math.abs(x);
          if (nz < 0.25 || ax < 0.012 || ax > 0.056) return 0;
          if (d < m.eyeD - 0.024 || d > m.eyeD - 0.004) return 0;
          return Math.max(0.001, 0.75 * smooth(m.eyeD - 0.024, m.eyeD - 0.016, d) * (1 - smooth(0.046, 0.056, ax)));
        },
        0.0003,
        0,
        layerMat(spec.shadow, { roughness: 0.6 }),
      ),
    );
  }
  if (spec.freckles) {
    out.push(
      shell(
        body,
        (x, d, _z, nz) => {
          if (nz < 0.3 || Math.abs(x) > 0.065) return 0;
          if (d < m.tipD - 0.035 || d > m.tipD + 0.008) return 0;
          return 1;
        },
        0.0003,
        0,
        layerMat(0x4a2614, { alphaMap: dotsAlpha(), opacity: 0.8 }),
      ),
    );
  }
  return out.filter((mesh): mesh is THREE.SkinnedMesh => mesh !== null);
}
