import * as THREE from 'three';
import { surfaceMat } from '../render/surfaces';

/** Warm yellow plaster — Lagos Life–style bedroom walls. */
export const HOME_WALL_YELLOW = 0xf2d06b;
/** Brown ceramic floor base. */
export const HOME_FLOOR_BROWN = 0x9a6b3f;
const GROUT = '#6b4423';

const matCache = new Map<string, THREE.MeshStandardMaterial>();

export function homeMat(
  color: number,
  opts?: { roughness?: number; metalness?: number; flat?: boolean },
): THREE.MeshStandardMaterial {
  const roughness = opts?.roughness ?? 0.82;
  const metalness = opts?.metalness ?? 0.04;
  const flat = opts?.flat ?? true;
  const key = `${color}_${roughness}_${metalness}_${flat ? 1 : 0}`;
  const hit = matCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    flatShading: flat,
  });
  matCache.set(key, m);
  return m;
}

/** Painted interior plaster. Color is the tint; the surface map stays shared. */
export function homeWallMat(color: number): THREE.MeshStandardMaterial {
  return surfaceMat('plaster', color, 0.9, 0.02);
}

export function homeSoftMat(color: number, opacity = 1): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.65,
    metalness: 0.05,
    flatShading: true,
    transparent: opacity < 1,
    opacity,
  });
}

/** Procedural brown tile map (repeating). */
export function makeBrownTileTexture(tiles = 8): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cell = size / tiles;

  ctx.fillStyle = GROUT;
  ctx.fillRect(0, 0, size, size);

  for (let iy = 0; iy < tiles; iy++) {
    for (let ix = 0; ix < tiles; ix++) {
      const shade = 0.85 + ((ix * 17 + iy * 31) % 7) * 0.02;
      const r = Math.floor(154 * shade);
      const g = Math.floor(107 * shade);
      const b = Math.floor(63 * shade);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      const pad = 2;
      ctx.fillRect(ix * cell + pad, iy * cell + pad, cell - pad * 2, cell - pad * 2);
      // Subtle highlight corner
      ctx.fillStyle = `rgba(255,220,160,${0.06 + ((ix + iy) % 3) * 0.02})`;
      ctx.fillRect(ix * cell + pad, iy * cell + pad, cell * 0.35, cell * 0.2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function makeTiledFloorMaterial(repeatX = 6, repeatZ = 5): THREE.MeshStandardMaterial {
  const map = makeBrownTileTexture(8);
  map.repeat.set(repeatX, repeatZ);
  return new THREE.MeshStandardMaterial({
    map,
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.02,
    flatShading: false,
  });
}
