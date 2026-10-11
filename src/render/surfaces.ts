import * as THREE from 'three';

export type SurfaceKind =
  | 'plaster'
  | 'concrete'
  | 'asphalt'
  | 'sidewalk'
  | 'earth'
  | 'grass'
  | 'metal'
  | 'wood'
  | 'roof';

type SurfaceMaps = {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
};

const TILE_METERS: Record<SurfaceKind, number> = {
  plaster: 2.2,
  concrete: 2.4,
  asphalt: 3.2,
  sidewalk: 1.7,
  earth: 3.4,
  grass: 2.6,
  metal: 1.4,
  wood: 1.3,
  roof: 1.1,
};

const ROUGHNESS: Record<SurfaceKind, number> = {
  plaster: 0.88,
  concrete: 0.92,
  asphalt: 0.94,
  sidewalk: 0.9,
  earth: 0.96,
  grass: 0.86,
  metal: 0.42,
  wood: 0.78,
  roof: 0.62,
};

const METALNESS: Record<SurfaceKind, number> = {
  plaster: 0.02,
  concrete: 0.03,
  asphalt: 0.02,
  sidewalk: 0.02,
  earth: 0.0,
  grass: 0.0,
  metal: 0.55,
  wood: 0.02,
  roof: 0.28,
};

const NORMAL_STRENGTH: Record<SurfaceKind, number> = {
  plaster: 1.4,
  concrete: 1.1,
  asphalt: 2.2,
  sidewalk: 1.3,
  earth: 1.6,
  grass: 1.2,
  metal: 0.7,
  wood: 1.5,
  roof: 0.85,
};

const cache = new Map<string, THREE.MeshStandardMaterial>();
const maps = new Map<SurfaceKind, SurfaceMaps>();
let anisotropy = 4;

export function setSurfaceAnisotropy(value: number): void {
  anisotropy = Math.max(1, Math.min(8, value));
  for (const set of maps.values()) {
    set.map.anisotropy = anisotropy;
    set.roughnessMap.anisotropy = anisotropy;
    set.normalMap.anisotropy = anisotropy;
  }
}

export function tileMetersFor(kind: SurfaceKind): number {
  return TILE_METERS[kind];
}

export function surfaceMat(
  kind: SurfaceKind,
  tint: number,
  roughness = ROUGHNESS[kind],
  metalness = METALNESS[kind],
): THREE.MeshStandardMaterial {
  const key = `${kind}:${tint}:${roughness}:${metalness}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const tex = mapsFor(kind);
  const material = new THREE.MeshStandardMaterial({
    color: tint,
    map: tex.map,
    roughnessMap: tex.roughnessMap,
    normalMap: tex.normalMap,
    roughness,
    metalness,
  });
  const normal = kind === 'roof' || kind === 'asphalt' ? 0.4 : 0.32;
  material.normalScale.set(normal, normal);
  material.userData.surface = kind;
  material.userData.tileMeters = TILE_METERS[kind];
  cache.set(key, material);
  return material;
}

function mapsFor(kind: SurfaceKind): SurfaceMaps {
  const hit = maps.get(kind);
  if (hit) return hit;
  const size = 256;
  const albedo = new Uint8ClampedArray(size * size * 4);
  const rough = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);
  const seed = kindSeed(kind);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n = fbm(u * 7, v * 7, seed);
      const fine = fbm(u * 23, v * 23, seed + 19);
      let h = n * 0.75 + fine * 0.25;
      let shade = 0.86 + h * 0.18;
      let roughV = 0.72 + (1 - h) * 0.22;

      if (kind === 'asphalt') {
        const crack = Math.abs(Math.sin((n * 6 + u * 3) * Math.PI));
        h = fine * 0.65 + (crack < 0.08 ? 0.15 : 0);
        shade = 0.78 + fine * 0.22 - (crack < 0.08 ? 0.12 : 0);
        roughV = 0.82 + fine * 0.16;
      } else if (kind === 'grass') {
        h = fine * 0.8 + n * 0.2;
        shade = 0.8 + fine * 0.25;
        const blade = (Math.sin(u * 90) * Math.sin(v * 40) + 1) * 0.5;
        shade += blade * 0.06;
      } else if (kind === 'roof') {
        const ridge = Math.abs((u * 14) % 1 - 0.5);
        h = 0.35 + ridge * 0.45 + fine * 0.1;
        shade = 0.9 + fine * 0.08;
        roughV = 0.48 + ridge * 0.12;
      } else if (kind === 'wood') {
        const grain = Math.sin((v * 18 + n) * Math.PI);
        h = grain * 0.35 + fine * 0.2;
        shade = 0.84 + grain * 0.08;
      } else if (kind === 'metal') {
        h = fine * 0.25;
        shade = 0.9 + fine * 0.1;
        roughV = 0.28 + fine * 0.2;
      } else if (kind === 'sidewalk') {
        const cell = 4;
        const gx = (u * cell) % 1;
        const gy = (v * cell) % 1;
        const grout = gx < 0.06 || gy < 0.06 || gx > 0.94 || gy > 0.94;
        h = grout ? 0.05 : 0.45 + fine * 0.3;
        shade = grout ? 0.7 : 0.92 + fine * 0.08;
      }

      const i = y * size + x;
      height[i] = h;
      const c = Math.max(0, Math.min(255, Math.round(shade * 255)));
      const p = i * 4;
      albedo[p] = c;
      albedo[p + 1] = c;
      albedo[p + 2] = c;
      albedo[p + 3] = 255;
      const rv = Math.max(0, Math.min(255, Math.round(roughV * 255)));
      rough[p] = rv;
      rough[p + 1] = rv;
      rough[p + 2] = rv;
      rough[p + 3] = 255;
    }
  }

  const normal = new Uint8ClampedArray(size * size * 4);
  const strength = NORMAL_STRENGTH[kind];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hL = height[y * size + (x - 1 + size) % size]!;
      const hR = height[y * size + (x + 1) % size]!;
      const hD = height[((y - 1 + size) % size) * size + x]!;
      const hU = height[((y + 1) % size) * size + x]!;
      const nx = (hL - hR) * strength;
      const ny = (hD - hU) * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      const p = (y * size + x) * 4;
      normal[p] = Math.round((nx / len) * 127 + 128);
      normal[p + 1] = Math.round((ny / len) * 127 + 128);
      normal[p + 2] = Math.round((nz / len) * 127 + 128);
      normal[p + 3] = 255;
    }
  }

  const set: SurfaceMaps = {
    map: makeTex(albedo, size, THREE.SRGBColorSpace),
    roughnessMap: makeTex(rough, size, THREE.NoColorSpace),
    normalMap: makeTex(normal, size, THREE.NoColorSpace),
  };
  maps.set(kind, set);
  return set;
}

function makeTex(data: Uint8ClampedArray, size: number, colorSpace: THREE.ColorSpace): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponible pour les textures de surface');
  const image = ctx.createImageData(size, size);
  image.data.set(data);
  ctx.putImageData(image, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function kindSeed(kind: SurfaceKind): number {
  let s = 17;
  for (let i = 0; i < kind.length; i++) s = (s * 33 + kind.charCodeAt(i)) | 0;
  return s;
}

function hash(ix: number, iy: number, seed: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1440662683);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x: number, y: number, seed: number): number {
  let amp = 0.5;
  let sum = 0;
  let f = 1;
  for (let i = 0; i < 4; i++) {
    sum += valueNoise(x * f, y * f, seed + i * 13) * amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum;
}

/** Repeat a shared surface map across a mesh using its world size. Safe on shared geometries. */
export function retileMeshInPlace(mesh: THREE.Mesh, tile: number): void {
  if (!(tile > 0)) return;
  const [sx, sy, sz] = worldExtents(mesh.geometry, mesh);
  let geo = mesh.geometry;
  if (geo.userData.shared) {
    geo = geo.clone();
    mesh.geometry = geo;
  }
  retileGeometry(geo, sx, sy, sz, tile);
}

export function retileGeometry(
  geo: THREE.BufferGeometry,
  worldX: number,
  worldY: number,
  worldZ: number,
  tile: number,
): void {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (!uv || !(tile > 0)) return;

  if (geo.type === 'BoxGeometry' && uv.count % 6 === 0) {
    const faces: Array<[number, number]> = [
      [worldZ / tile, worldY / tile],
      [worldZ / tile, worldY / tile],
      [worldX / tile, worldZ / tile],
      [worldX / tile, worldZ / tile],
      [worldX / tile, worldY / tile],
      [worldX / tile, worldY / tile],
    ];
    const vertsPerFace = uv.count / 6;
    for (let f = 0; f < 6; f++) {
      const scale = faces[f]!;
      for (let i = 0; i < vertsPerFace; i++) {
        const idx = f * vertsPerFace + i;
        uv.setXY(idx, uv.getX(idx) * scale[0], uv.getY(idx) * scale[1]);
      }
    }
    uv.needsUpdate = true;
    return;
  }

  const uRep = Math.max(worldX, worldZ, tile) / tile;
  const vRep = Math.max(worldY, tile) / tile;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * uRep, uv.getY(i) * vRep);
  }
  uv.needsUpdate = true;
}

type GeoParams = {
  width?: number;
  height?: number;
  depth?: number;
  radius?: number;
  radiusTop?: number;
  radiusBottom?: number;
};

function geoParams(geo: THREE.BufferGeometry): GeoParams | undefined {
  return (geo as THREE.BufferGeometry & { parameters?: GeoParams }).parameters;
}

function worldExtents(geo: THREE.BufferGeometry, mesh: THREE.Mesh): [number, number, number] {
  const p = geoParams(geo);
  const sx = Math.abs(mesh.scale.x);
  const sy = Math.abs(mesh.scale.y);
  const sz = Math.abs(mesh.scale.z);
  if (!p) return [sx, sy, sz];
  if (geo.type === 'BoxGeometry') {
    return [(p.width ?? 1) * sx, (p.height ?? 1) * sy, (p.depth ?? 1) * sz];
  }
  if (geo.type === 'SphereGeometry') {
    const d = (p.radius ?? 1) * 2;
    return [d * sx, d * sy, d * sz];
  }
  const radius = Math.max(p.radiusBottom ?? 0, p.radiusTop ?? 0, p.radius ?? 1);
  const height = p.height ?? radius * 2;
  return [radius * 2 * sx, height * sy, radius * 2 * sz];
}
