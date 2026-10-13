import * as THREE from 'three';
import { surfaceMat } from '../render/surfaces';

/** Warm yellow plaster — the original starter-room paint. */
export const HOME_WALL_YELLOW = 0xf2d06b;
/** Brown ceramic floor — the original starter-room tiles. */
export const HOME_FLOOR_BROWN = 0x9a6b3f;
/** Remodelled starter house defaults. */
export const HOME_WALL_WARM_WHITE = 0xf3ede2;
export const HOME_FLOOR_BEIGE = 0xe0d4c0;

/** Painted interior plaster. Color is the tint; the surface map stays shared. */
export function homeWallMat(color: number): THREE.MeshStandardMaterial {
  return surfaceMat('plaster', color, 0.9, 0.02);
}

export type FloorKind = 'tile60' | 'tile30' | 'wood' | 'marble';
export type WallPattern = 'stripes' | 'wax';

function hex(c: THREE.Color): string {
  return `#${c.getHexString()}`;
}

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Metres covered by one texture repeat. */
const FLOOR_REPEAT_M: Record<FloorKind, number> = { tile60: 2.4, tile30: 1.2, wood: 1.8, marble: 3.2 };

const floorCache = new Map<string, THREE.MeshStandardMaterial>();

/**
 * Floor finish for the 16.3 × 14.3 m slab (box top UVs span 0..1).
 * Tiles with grout and per-tile shade, staggered planks, or veined marble.
 */
export function makeFloorMaterial(kind: FloorKind, color: number): THREE.MeshStandardMaterial {
  const key = `${kind}:${color}`;
  const hit = floorCache.get(key);
  if (hit) return hit;
  const base = new THREE.Color(color);
  const tmp = new THREE.Color();
  const size = 512;
  let rough = 0.35;
  const map = canvasTexture(size, (g) => {
    if (kind === 'wood') {
      rough = 0.55;
      const planks = 12;
      const ph = size / planks;
      for (let i = 0; i < planks; i++) {
        const offset = ((i * 37) % 5) / 5;
        for (let s = -1; s < 3; s++) {
          const x0 = (s + offset) * (size / 2);
          tmp.copy(base).multiplyScalar(0.86 + ((i * 7 + s * 3 + 11) % 9) * 0.03);
          g.fillStyle = hex(tmp);
          g.fillRect(x0, i * ph, size / 2, ph);
          g.strokeStyle = 'rgba(40,24,12,0.18)';
          for (let l = 0; l < 6; l++) {
            g.beginPath();
            const y = i * ph + ((l * 13 + s * 5) % ph);
            g.moveTo(x0, y);
            g.bezierCurveTo(x0 + size * 0.15, y + 2, x0 + size * 0.3, y - 2, x0 + size / 2, y + 1);
            g.stroke();
          }
          g.fillStyle = 'rgba(30,18,10,0.45)';
          g.fillRect(x0, i * ph, 2, ph);
        }
        g.fillStyle = 'rgba(30,18,10,0.35)';
        g.fillRect(0, i * ph, size, 1.5);
      }
      return;
    }
    if (kind === 'marble') {
      rough = 0.12;
      const n = 4;
      const cell = size / n;
      for (let iy = 0; iy < n; iy++) {
        for (let ix = 0; ix < n; ix++) {
          tmp.copy(base).multiplyScalar(0.95 + ((ix * 5 + iy * 3) % 4) * 0.015);
          g.fillStyle = hex(tmp);
          g.fillRect(ix * cell, iy * cell, cell, cell);
          g.strokeStyle = 'rgba(120,115,110,0.22)';
          g.lineWidth = 1.2;
          for (let v = 0; v < 3; v++) {
            g.beginPath();
            let x = ix * cell + ((v * 47 + ix * 13) % cell);
            let y = iy * cell;
            g.moveTo(x, y);
            for (let s = 0; s < 6; s++) {
              x += ((s * 31 + v * 17) % 21) - 10;
              y += cell / 6;
              g.lineTo(x, y);
            }
            g.stroke();
          }
        }
      }
      g.fillStyle = 'rgba(160,150,140,0.5)';
      for (let i = 0; i <= n; i++) {
        g.fillRect(i * cell - 0.5, 0, 1, size);
        g.fillRect(0, i * cell - 0.5, size, 1);
      }
      return;
    }
    const n = 4;
    const cell = size / n;
    const grout = base.clone().multiplyScalar(0.72);
    g.fillStyle = hex(grout);
    g.fillRect(0, 0, size, size);
    for (let iy = 0; iy < n; iy++) {
      for (let ix = 0; ix < n; ix++) {
        tmp.copy(base).multiplyScalar(0.94 + ((ix * 17 + iy * 31) % 7) * 0.018);
        const x = ix * cell + 2;
        const y = iy * cell + 2;
        const grad = g.createLinearGradient(x, y, x + cell, y + cell);
        grad.addColorStop(0, hex(tmp.clone().multiplyScalar(1.03)));
        grad.addColorStop(1, hex(tmp.clone().multiplyScalar(0.97)));
        g.fillStyle = grad;
        g.fillRect(x, y, cell - 4, cell - 4);
      }
    }
  });
  const W = 16.3;
  const D = 14.3;
  map.repeat.set(W / FLOOR_REPEAT_M[kind], D / FLOOR_REPEAT_M[kind]);
  const m = new THREE.MeshStandardMaterial({ map, roughness: rough, metalness: 0 });
  m.name = `home-floor-${kind}`;
  floorCache.set(key, m);
  return m;
}

const wallpaperCache = new Map<string, THREE.MeshStandardMaterial>();

/** Wallpaper (wall UVs are metres / 2.2, so one repeat spans 2.2 m). */
export function makeWallpaperMaterial(pattern: WallPattern, color: number): THREE.MeshStandardMaterial {
  const key = `${pattern}:${color}`;
  const hit = wallpaperCache.get(key);
  if (hit) return hit;
  const base = new THREE.Color(color);
  const map = canvasTexture(512, (g) => {
    g.fillStyle = hex(base);
    g.fillRect(0, 0, 512, 512);
    if (pattern === 'stripes') {
      g.fillStyle = hex(base.clone().multiplyScalar(0.9));
      for (let i = 0; i < 16; i++) g.fillRect(i * 32, 0, 12, 512);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      for (let i = 0; i < 16; i++) g.fillRect(i * 32 + 14, 0, 2, 512);
      return;
    }
    // Wax-print inspired geometric motif
    const acc = ['#b8643c', '#2f4858', '#d9a441'];
    for (let iy = 0; iy < 8; iy++) {
      for (let ix = 0; ix < 8; ix++) {
        const x = ix * 64 + (iy % 2) * 32;
        const y = iy * 64;
        g.fillStyle = acc[(ix + iy) % 3]!;
        g.globalAlpha = 0.55;
        g.beginPath();
        g.moveTo(x + 32, y + 8);
        g.lineTo(x + 56, y + 32);
        g.lineTo(x + 32, y + 56);
        g.lineTo(x + 8, y + 32);
        g.closePath();
        g.fill();
        g.globalAlpha = 0.9;
        g.fillStyle = hex(base);
        g.beginPath();
        g.arc(x + 32, y + 32, 8, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
  });
  map.repeat.set(2, 2);
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0 });
  m.name = `home-wallpaper-${pattern}`;
  wallpaperCache.set(key, m);
  return m;
}
