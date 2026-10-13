import * as THREE from 'three';
import { Frame, KitBatch } from '../city/Batch';
import { surfaceMaps, tileMetersFor } from '../render/surfaces';

/**
 * Home material families. Furniture and fixtures are vertex-coloured into one batch per family,
 * so a whole sofa or kitchen is a handful of draw calls.
 */
export type HomeMatKey =
  | 'wood'
  | 'fabric'
  | 'paint'
  | 'metal'
  | 'chrome'
  | 'ceramic'
  | 'stone'
  | 'glass'
  | 'glow'
  | 'leaf'
  | 'tile'
  | 'screen';

const ORDER: HomeMatKey[] = [
  'wood',
  'fabric',
  'paint',
  'metal',
  'chrome',
  'ceramic',
  'stone',
  'glass',
  'glow',
  'leaf',
  'tile',
  'screen',
];

const NO_SHADOW = new Set<HomeMatKey>(['glass', 'glow', 'screen', 'tile']);
const cache = new Map<HomeMatKey, THREE.MeshStandardMaterial>();

let tileTex: THREE.CanvasTexture | null = null;
/** 30 cm ceramic tile with grout, tinted by vertex colour. */
function tileTexture(): THREE.CanvasTexture {
  if (tileTex) return tileTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#bdb7ad';
  g.fillRect(0, 0, 128, 128);
  const grad = g.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#ecebe7');
  g.fillStyle = grad;
  g.fillRect(3, 3, 122, 122);
  tileTex = new THREE.CanvasTexture(c);
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
  tileTex.colorSpace = THREE.SRGBColorSpace;
  tileTex.anisotropy = 4;
  return tileTex;
}

export function homeKitMaterial(key: HomeMatKey): THREE.MeshStandardMaterial {
  const hit = cache.get(key);
  if (hit) return hit;
  let m: THREE.MeshStandardMaterial;
  switch (key) {
    case 'wood': {
      const t = surfaceMaps('wood');
      m = new THREE.MeshStandardMaterial({
        vertexColors: true,
        map: t.map,
        roughnessMap: t.roughnessMap,
        normalMap: t.normalMap,
        roughness: 0.62,
        metalness: 0.02,
      });
      m.normalScale.set(0.35, 0.35);
      break;
    }
    case 'fabric': {
      const t = surfaceMaps('plaster');
      m = new THREE.MeshStandardMaterial({
        vertexColors: true,
        map: t.map,
        normalMap: t.normalMap,
        roughness: 0.96,
        metalness: 0,
      });
      m.normalScale.set(0.55, 0.55);
      break;
    }
    case 'paint':
      m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.02 });
      break;
    case 'metal': {
      const t = surfaceMaps('metal');
      m = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughnessMap: t.roughnessMap,
        roughness: 0.42,
        metalness: 0.65,
      });
      break;
    }
    case 'chrome':
      m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.16, metalness: 0.95 });
      break;
    case 'ceramic':
      m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0 });
      break;
    case 'stone': {
      const t = surfaceMaps('concrete');
      m = new THREE.MeshStandardMaterial({
        vertexColors: true,
        map: t.map,
        normalMap: t.normalMap,
        roughness: 0.3,
        metalness: 0.02,
      });
      m.normalScale.set(0.15, 0.15);
      break;
    }
    case 'glass':
      m = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.04,
        metalness: 0.1,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      break;
    case 'glow':
      m = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.5,
        metalness: 0,
        emissive: 0xffffff,
        emissiveIntensity: 1.25,
      });
      m.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb;',
        );
      };
      m.customProgramCacheKey = () => 'home-glow-v1';
      break;
    case 'leaf':
      m = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.78,
        metalness: 0,
        side: THREE.DoubleSide,
        flatShading: true,
      });
      break;
    case 'tile':
      m = new THREE.MeshStandardMaterial({
        vertexColors: true,
        map: tileTexture(),
        roughness: 0.22,
        metalness: 0,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      break;
    case 'screen':
      m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.3 });
      break;
  }
  m.name = `home-${key}`;
  cache.set(key, m);
  return m;
}

/** UV scale baked per family (KitBatch UVs are metres). */
const UV: Partial<Record<HomeMatKey, number>> = {
  wood: 1 / tileMetersFor('wood'),
  fabric: 1 / 0.9,
  stone: 1 / 1.6,
  metal: 1 / 1.4,
  tile: 1 / 0.3,
};

export const ORIGIN = new Frame(0, 0, 0, 0);

/** Batches for one object (a furniture piece, a fixture set, a room shell). */
export class HomeKit {
  private readonly batches = new Map<HomeMatKey, KitBatch>();

  b(key: HomeMatKey): KitBatch {
    let batch = this.batches.get(key);
    if (!batch) {
      batch = new KitBatch();
      this.batches.set(key, batch);
    }
    return batch;
  }

  box(key: HomeMatKey, x: number, y: number, z: number, sx: number, sy: number, sz: number, hex: number, f = ORIGIN): void {
    this.b(key).box(f, x, y, z, sx, sy, sz, hex, false);
  }

  /** Chamfered box: soft edges catch light like upholstery or rounded MDF. */
  soft(key: HomeMatKey, x: number, y: number, z: number, sx: number, sy: number, sz: number, r: number, hex: number, f = ORIGIN): void {
    chamferBox(this.b(key), f, x, y, z, sx, sy, sz, Math.min(r, sx / 2.2, sy / 2.2, sz / 2.2), hex);
  }

  cyl(key: HomeMatKey, x: number, y: number, z: number, rB: number, rT: number, h: number, hex: number, seg = 12, f = ORIGIN): void {
    this.b(key).cylinder(f, x, y, z, rB, rT, h, hex, seg, true);
  }

  /** Horizontal cylinder along local x (rails, rods). */
  rod(key: HomeMatKey, x0: number, x1: number, y: number, z: number, r: number, hex: number, f = ORIGIN): void {
    const B = this.b(key);
    const seg = 8;
    const a = [0, 0, 0];
    const b = [0, 0, 0];
    const c = [0, 0, 0];
    const d = [0, 0, 0];
    for (let i = 0; i < seg; i++) {
      const t0 = (i / seg) * Math.PI * 2;
      const t1 = ((i + 1) / seg) * Math.PI * 2;
      f.apply(x0, y + Math.cos(t0) * r, z + Math.sin(t0) * r, a);
      f.apply(x1, y + Math.cos(t0) * r, z + Math.sin(t0) * r, b);
      f.apply(x1, y + Math.cos(t1) * r, z + Math.sin(t1) * r, c);
      f.apply(x0, y + Math.cos(t1) * r, z + Math.sin(t1) * r, d);
      B.quadWorld(a, d, c, b, hex, x1 - x0, r);
    }
  }

  /** Squashed ball (pillows, foliage, fruit). */
  blob(key: HomeMatKey, x: number, y: number, z: number, rx: number, ry: number, rz: number, hex: number, f = ORIGIN, seg = 8): void {
    const B = this.b(key);
    const rings = Math.max(3, Math.round(seg * 0.6));
    const pts: number[][][] = [];
    for (let i = 0; i <= rings; i++) {
      const v = (i / rings) * Math.PI;
      const row: number[][] = [];
      for (let j = 0; j <= seg; j++) {
        const u = (j / seg) * Math.PI * 2;
        const p = [0, 0, 0];
        f.apply(x + Math.sin(v) * Math.cos(u) * rx, y + Math.cos(v) * ry, z + Math.sin(v) * Math.sin(u) * rz, p);
        row.push(p);
      }
      pts.push(row);
    }
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < seg; j++) {
        const a = pts[i]![j]!;
        const c = pts[i + 1]![j + 1]!;
        const d = pts[i + 1]![j]!;
        // Top ring collapses to the pole: a quad there has a zero-length normal (NaN in the shader).
        if (i === 0) B.tri(ORIGIN, a as [number, number, number], c as [number, number, number], d as [number, number, number], hex);
        else B.quadWorld(a, pts[i]![j + 1]!, c, d, hex, 1, 1);
      }
    }
  }

  /** Builds meshes into `group` (cleared of nothing — appends). */
  into(group: THREE.Object3D, opts?: { shadows?: boolean; name?: string }): THREE.Object3D {
    const shadows = opts?.shadows !== false;
    for (const key of ORDER) {
      const batch = this.batches.get(key);
      if (!batch) continue;
      const geo = batch.build(UV[key] ?? 1);
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, homeKitMaterial(key));
      mesh.name = opts?.name ? `${opts.name}-${key}` : `home-${key}`;
      mesh.castShadow = shadows && !NO_SHADOW.has(key);
      mesh.receiveShadow = key !== 'glow' && key !== 'glass';
      if (key === 'glass') mesh.renderOrder = 2;
      group.add(mesh);
    }
    this.batches.clear();
    return group;
  }

  group(name: string, opts?: { shadows?: boolean }): THREE.Group {
    const g = new THREE.Group();
    g.name = name;
    this.into(g, { ...opts, name });
    return g;
  }
}

const P = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
];

/** Box with 45° chamfers on every edge (6 faces, 12 bevels, 8 corner triangles). */
function chamferBox(
  B: KitBatch,
  f: Frame,
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  r: number,
  hex: number,
): void {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const ix = hx - r;
  const iy = hy - r;
  const iz = hz - r;
  const w = (lx: number, ly: number, lz: number, out: number[]) => f.apply(cx + lx, cy + ly, cz + lz, out);
  const quad = (a: number[], b: number[], c: number[], d: number[], uw: number, vh: number) => {
    w(a[0]!, a[1]!, a[2]!, P[0]!);
    w(b[0]!, b[1]!, b[2]!, P[1]!);
    w(c[0]!, c[1]!, c[2]!, P[2]!);
    w(d[0]!, d[1]!, d[2]!, P[3]!);
    B.quadWorld(P[0]!, P[1]!, P[2]!, P[3]!, hex, uw, vh);
  };
  // faces
  quad([-ix, -iy, hz], [ix, -iy, hz], [ix, iy, hz], [-ix, iy, hz], sx, sy);
  quad([ix, -iy, -hz], [-ix, -iy, -hz], [-ix, iy, -hz], [ix, iy, -hz], sx, sy);
  quad([hx, -iy, iz], [hx, -iy, -iz], [hx, iy, -iz], [hx, iy, iz], sz, sy);
  quad([-hx, -iy, -iz], [-hx, -iy, iz], [-hx, iy, iz], [-hx, iy, -iz], sz, sy);
  quad([-ix, hy, iz], [ix, hy, iz], [ix, hy, -iz], [-ix, hy, -iz], sx, sz);
  quad([-ix, -hy, -iz], [ix, -hy, -iz], [ix, -hy, iz], [-ix, -hy, iz], sx, sz);
  // top edges
  quad([-ix, iy, hz], [ix, iy, hz], [ix, hy, iz], [-ix, hy, iz], sx, r);
  quad([ix, iy, -hz], [-ix, iy, -hz], [-ix, hy, -iz], [ix, hy, -iz], sx, r);
  quad([hx, iy, iz], [hx, iy, -iz], [ix, hy, -iz], [ix, hy, iz], sz, r);
  quad([-hx, iy, -iz], [-hx, iy, iz], [-ix, hy, iz], [-ix, hy, -iz], sz, r);
  // bottom edges
  quad([-ix, -hy, iz], [ix, -hy, iz], [ix, -iy, hz], [-ix, -iy, hz], sx, r);
  quad([ix, -hy, -iz], [-ix, -hy, -iz], [-ix, -iy, -hz], [ix, -iy, -hz], sx, r);
  quad([ix, -hy, iz], [ix, -hy, -iz], [hx, -iy, -iz], [hx, -iy, iz], sz, r);
  quad([-ix, -hy, -iz], [-ix, -hy, iz], [-hx, -iy, iz], [-hx, -iy, -iz], sz, r);
  // vertical edges
  quad([ix, -iy, hz], [hx, -iy, iz], [hx, iy, iz], [ix, iy, hz], r, sy);
  quad([hx, -iy, -iz], [ix, -iy, -hz], [ix, iy, -hz], [hx, iy, -iz], r, sy);
  quad([-ix, -iy, -hz], [-hx, -iy, -iz], [-hx, iy, -iz], [-ix, iy, -hz], r, sy);
  quad([-hx, -iy, iz], [-ix, -iy, hz], [-ix, iy, hz], [-hx, iy, iz], r, sy);
  // corners
  const tri = (a: number[], b: number[], c: number[]) => {
    w(a[0]!, a[1]!, a[2]!, P[0]!);
    w(b[0]!, b[1]!, b[2]!, P[1]!);
    w(c[0]!, c[1]!, c[2]!, P[2]!);
    B.tri(ORIGIN, P[0] as [number, number, number], P[1] as [number, number, number], P[2] as [number, number, number], hex);
  };
  for (const sxn of [-1, 1]) {
    for (const syn of [-1, 1]) {
      for (const szn of [-1, 1]) {
        const a = [sxn * hx, syn * iy, szn * iz];
        const b = [sxn * ix, syn * hy, szn * iz];
        const c = [sxn * ix, syn * iy, szn * hz];
        if (sxn * syn * szn > 0) tri(a, b, c);
        else tri(a, c, b);
      }
    }
  }
}
