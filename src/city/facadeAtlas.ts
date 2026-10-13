import * as THREE from 'three';
import { CityUniforms } from '../render/nightState';

/** Atlas tile ids — each tile is one bay (≈3.2 m) × one storey (≈3.1 m). */
export const T = {
  RES_WINDOW: 0,
  RES_SHUTTER: 1,
  BALCONY_DOOR: 2,
  OFFICE_GLASS: 3,
  OFFICE_RIBBON: 4,
  SHOP_SHUTTER: 5,
  SHOP_GLASS: 6,
  BLANK: 7,
  SMALL_WINDOW: 8,
  BLOCKWORK: 9,
  PLANKS: 10,
  CORRUGATED: 11,
  GARAGE: 12,
  HOTEL_AC: 13,
  ARCH: 14,
  ENTRANCE: 15,
} as const;
export type TileId = (typeof T)[keyof typeof T];

const GRID = 4;
const PX = 256;

export function tileRect(id: number): [number, number, number, number] {
  const col = id % GRID;
  const row = Math.floor(id / GRID);
  const s = 1 / GRID;
  return [col * s, 1 - (row + 1) * s, s, s];
}

type Ctx = CanvasRenderingContext2D;

function rnd(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/**
 * Canvas 2D stores premultiplied alpha, so a zero-alpha paint mask would destroy colour.
 * Albedo is painted opaque, the paint mask in its own canvas, and both are merged into raw bytes.
 */
function buildAtlas(): { albedo: Uint8Array; props: Uint8Array; size: number } {
  const size = GRID * PX;
  const albedo = document.createElement('canvas');
  albedo.width = size;
  albedo.height = size;
  const mask = document.createElement('canvas');
  mask.width = size;
  mask.height = size;
  const props = document.createElement('canvas');
  props.width = size;
  props.height = size;
  const A = albedo.getContext('2d')!;
  const M = mask.getContext('2d')!;
  const P = props.getContext('2d')!;
  M.fillStyle = '#fff';
  M.fillRect(0, 0, size, size);

  for (let id = 0; id < GRID * GRID; id++) {
    const ox = (id % GRID) * PX;
    const oy = Math.floor(id / GRID) * PX;
    paintTile(id, new TilePainter(A, M, P, ox, oy, id));
  }

  // Merge: alpha channel = paint mask (white = paintable wall).
  const out = new Uint8Array(A.getImageData(0, 0, size, size).data.buffer.slice(0));
  const mk = M.getImageData(0, 0, size, size).data;
  for (let i = 0; i < out.length; i += 4) out[i + 3] = mk[i]!;
  return { albedo: flipRows(out, size), props: flipRows(new Uint8Array(P.getImageData(0, 0, size, size).data.buffer.slice(0)), size), size };
}

/** Canvas rows run top-down; DataTexture rows run bottom-up. */
function flipRows(data: Uint8Array, size: number): Uint8Array {
  const row = size * 4;
  const out = new Uint8Array(data.length);
  for (let y = 0; y < size; y++) out.set(data.subarray(y * row, (y + 1) * row), (size - 1 - y) * row);
  return out;
}

class TilePainter {
  private readonly r: () => number;
  constructor(
    readonly A: Ctx,
    readonly M: Ctx,
    readonly P: Ctx,
    readonly ox: number,
    readonly oy: number,
    id: number,
  ) {
    this.r = rnd(id * 7919 + 13);
  }

  rand(): number {
    return this.r();
  }

  private rect(ctx: Ctx, x: number, y: number, w: number, h: number, css: string): void {
    ctx.fillStyle = css;
    ctx.fillRect(this.ox + x, this.oy + y, w, h);
  }

  /** Paintable plaster with subtle stains + rain streaks. */
  plaster(): void {
    this.rect(this.A, 0, 0, PX, PX, 'rgb(236,234,230)');
    for (let i = 0; i < 260; i++) {
      const x = this.rand() * PX;
      const y = this.rand() * PX;
      const s = 2 + this.rand() * 14;
      const g = 214 + Math.floor(this.rand() * 34);
      this.A.fillStyle = `rgba(${g},${g - 2},${g - 6},0.35)`;
      this.A.fillRect(this.ox + x, this.oy + y, s, s * 0.7);
    }
    this.rect(this.M, 0, 0, PX, PX, '#fff');
    this.rect(this.P, 0, 0, PX, PX, 'rgb(0,230,0)');
    // slab line between storeys
    this.solidPaint(0, PX - 10, PX, 10, 'rgb(205,203,198)');
  }

  /** Paintable but shaded (cornices, reveals). */
  solidPaint(x: number, y: number, w: number, h: number, css: string): void {
    this.rect(this.A, x, y, w, h, css);
    this.rect(this.M, x, y, w, h, '#fff');
  }

  /** Unpainted fixed colour (frames, metal, wood). */
  fixed(x: number, y: number, w: number, h: number, css: string, rough = 150): void {
    this.rect(this.A, x, y, w, h, css);
    this.rect(this.M, x, y, w, h, '#000');
    this.rect(this.P, x, y, w, h, `rgb(0,${rough},0)`);
  }

  glass(x: number, y: number, w: number, h: number, lit = true, top = 'rgb(58,74,86)', bottom = 'rgb(24,32,40)'): void {
    const g = this.A.createLinearGradient(0, this.oy + y, 0, this.oy + y + h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    this.A.fillStyle = g;
    this.A.fillRect(this.ox + x, this.oy + y, w, h);
    this.rect(this.M, x, y, w, h, '#000');
    this.rect(this.P, x, y, w, h, `rgb(255,16,${lit ? 255 : 0})`);
  }

  /** Curtain inside the glass: tints both day look and night glow. */
  curtain(x: number, y: number, w: number, h: number, css: string): void {
    this.A.fillStyle = css;
    this.A.fillRect(this.ox + x, this.oy + y, w, h);
    this.P.fillStyle = 'rgb(150,200,255)';
    this.P.fillRect(this.ox + x, this.oy + y, w, h);
  }

  frame(x: number, y: number, w: number, h: number, css = 'rgb(60,64,66)', t = 6): void {
    this.fixed(x - t, y - t, w + t * 2, t, css);
    this.fixed(x - t, y + h, w + t * 2, t, css);
    this.fixed(x - t, y, t, h, css);
    this.fixed(x + w, y, t, h, css);
  }

  bars(x: number, y: number, w: number, h: number, css = 'rgb(46,46,48)', n = 5): void {
    for (let i = 1; i < n; i++) this.fixed(x + (w / n) * i - 1.5, y, 3, h, css, 110);
    this.fixed(x, y + h * 0.5 - 1.5, w, 3, css, 110);
  }

  sill(x: number, y: number, w: number): void {
    this.solidPaint(x - 10, y, w + 20, 8, 'rgb(212,210,204)');
    this.rect(this.A, x - 10, y + 8, w + 20, 3, 'rgba(0,0,0,0.25)');
  }

  streak(x: number, y: number, h: number): void {
    const g = this.A.createLinearGradient(0, this.oy + y, 0, this.oy + y + h);
    g.addColorStop(0, 'rgba(90,84,74,0.28)');
    g.addColorStop(1, 'rgba(90,84,74,0)');
    this.A.fillStyle = g;
    this.A.fillRect(this.ox + x, this.oy + y, 18, h);
  }
}

function paintTile(id: number, t: TilePainter): void {
  const W = PX;
  switch (id) {
    case T.RES_WINDOW: {
      t.plaster();
      const x = 64;
      const y = 62;
      const w = 128;
      const h = 112;
      t.glass(x, y, w, h);
      t.curtain(x + 6, y + 4, 34, h - 8, 'rgb(150,104,78)');
      t.curtain(x + w - 40, y + 4, 34, h - 8, 'rgb(150,104,78)');
      t.fixed(x + w / 2 - 3, y, 6, h, 'rgb(70,72,74)');
      t.bars(x, y, w, h);
      t.frame(x, y, w, h);
      t.sill(x, y + h + 6, w);
      t.streak(x + 8, y + h + 16, 60);
      break;
    }
    case T.RES_SHUTTER: {
      t.plaster();
      const x = 70;
      const y = 60;
      const w = 116;
      const h = 116;
      t.glass(x, y, w, h);
      t.curtain(x + 30, y + 6, 56, h - 12, 'rgb(178,150,110)');
      // louvred shutters, left closed, right open against the wall
      t.fixed(x, y, w / 2, h, 'rgb(96,62,40)', 170);
      for (let i = 0; i < 14; i++) t.fixed(x, y + 4 + i * 8, w / 2, 3, 'rgb(70,44,28)', 170);
      t.fixed(x + w + 8, y, 26, h, 'rgb(96,62,40)', 170);
      for (let i = 0; i < 14; i++) t.fixed(x + w + 8, y + 4 + i * 8, 26, 3, 'rgb(70,44,28)', 170);
      t.frame(x, y, w, h, 'rgb(220,218,212)', 5);
      t.sill(x, y + h + 5, w);
      break;
    }
    case T.BALCONY_DOOR: {
      t.plaster();
      const x = 74;
      const y = 26;
      const w = 108;
      const h = 220;
      t.glass(x, y, w, h);
      t.curtain(x + 4, y + 4, 40, h - 8, 'rgb(200,190,170)');
      t.fixed(x + w / 2 - 3, y, 6, h, 'rgb(58,60,62)');
      t.fixed(x, y + 120, w, 5, 'rgb(58,60,62)');
      t.frame(x, y, w, h);
      break;
    }
    case T.OFFICE_GLASS: {
      t.fixed(0, 0, W, W, 'rgb(58,64,70)', 90);
      for (let c = 0; c < 2; c++) {
        t.glass(6 + c * 125, 6, 119, 190, true, 'rgb(98,128,150)', 'rgb(40,58,72)');
      }
      t.fixed(0, 200, W, 56, 'rgb(72,80,88)', 80);
      t.fixed(0, 238, W, 18, 'rgb(46,50,54)', 80);
      break;
    }
    case T.OFFICE_RIBBON: {
      t.plaster();
      t.glass(0, 40, W, 120, true, 'rgb(86,112,132)', 'rgb(34,48,60)');
      for (let i = 0; i < 4; i++) t.fixed(i * 64, 40, 4, 120, 'rgb(48,52,56)', 90);
      t.solidPaint(0, 160, W, 12, 'rgb(214,212,206)');
      break;
    }
    case T.SHOP_SHUTTER: {
      t.plaster();
      // rolling metal shutter, raised two-thirds
      t.glass(14, 120, 228, 126, true, 'rgb(80,70,58)', 'rgb(30,26,22)');
      t.fixed(14, 40, 228, 80, 'rgb(150,154,156)', 120);
      for (let i = 0; i < 10; i++) t.fixed(14, 42 + i * 8, 228, 2, 'rgb(110,114,118)', 120);
      t.fixed(14, 114, 228, 6, 'rgb(90,92,96)', 120);
      // goods inside
      for (let i = 0; i < 9; i++) {
        const c = ['rgb(200,60,50)', 'rgb(230,190,60)', 'rgb(60,140,90)', 'rgb(60,110,180)', 'rgb(220,120,40)'][i % 5]!;
        t.fixed(24 + i * 24, 150 + (i % 3) * 18, 18, 30, c, 200);
      }
      t.frame(14, 40, 228, 206, 'rgb(64,66,70)', 7);
      break;
    }
    case T.SHOP_GLASS: {
      t.plaster();
      t.glass(14, 40, 150, 206, true, 'rgb(120,140,150)', 'rgb(52,62,70)');
      // shelves seen through the glass
      for (let s = 0; s < 3; s++) {
        t.fixed(20, 92 + s * 50, 138, 4, 'rgb(170,160,140)', 200);
        for (let i = 0; i < 7; i++) {
          const c = ['rgb(230,80,60)', 'rgb(240,200,80)', 'rgb(90,170,110)', 'rgb(80,130,210)'][(i + s) % 4]!;
          t.fixed(24 + i * 19, 70 + s * 50, 14, 22, c, 200);
        }
      }
      t.glass(176, 60, 66, 186, true, 'rgb(110,130,140)', 'rgb(46,56,62)');
      t.fixed(206, 140, 4, 30, 'rgb(200,200,200)', 60);
      t.frame(14, 40, 150, 206, 'rgb(60,62,66)', 6);
      t.frame(176, 60, 66, 186, 'rgb(60,62,66)', 6);
      break;
    }
    case T.BLANK: {
      t.plaster();
      t.streak(40, 0, 180);
      t.streak(180, 30, 120);
      t.fixed(222, 0, 10, W, 'rgb(90,94,96)', 120);
      break;
    }
    case T.SMALL_WINDOW: {
      t.plaster();
      t.glass(96, 50, 64, 54);
      t.bars(96, 50, 64, 54, 'rgb(46,46,48)', 3);
      t.frame(96, 50, 64, 54, 'rgb(64,66,68)', 5);
      // split AC unit
      t.fixed(70, 140, 116, 64, 'rgb(226,226,222)', 110);
      for (let i = 0; i < 6; i++) t.fixed(78, 148 + i * 8, 100, 3, 'rgb(170,170,168)', 110);
      t.fixed(70, 204, 116, 6, 'rgb(120,120,118)', 110);
      t.streak(120, 210, 40);
      break;
    }
    case T.BLOCKWORK: {
      t.fixed(0, 0, W, W, 'rgb(150,148,142)', 245);
      for (let row = 0; row < 13; row++) {
        const off = row % 2 ? 0 : 32;
        t.fixed(0, row * 20, W, 2, 'rgb(118,116,110)', 245);
        for (let c = -1; c < 5; c++) t.fixed(off + c * 64, row * 20, 2, 20, 'rgb(118,116,110)', 245);
      }
      // opening without frame
      t.fixed(76, 60, 104, 108, 'rgb(28,26,24)', 250);
      t.fixed(0, 236, W, 20, 'rgb(128,126,120)', 245);
      break;
    }
    case T.PLANKS: {
      for (let i = 0; i < 16; i++) {
        const g = 104 + Math.floor(t.rand() * 40);
        t.fixed(i * 16, 0, 16, W, `rgb(${g},${g - 26},${g - 52})`, 235);
        t.fixed(i * 16, 0, 2, W, 'rgb(52,36,24)', 235);
      }
      t.glass(92, 70, 72, 70, true, 'rgb(40,34,28)', 'rgb(20,16,12)');
      t.fixed(70, 66, 22, 78, 'rgb(70,96,120)', 200);
      t.fixed(164, 66, 22, 78, 'rgb(70,96,120)', 200);
      break;
    }
    case T.CORRUGATED: {
      t.plaster();
      for (let i = 0; i < 32; i++) t.solidPaint(i * 8, 0, 3, W, 'rgb(206,206,204)');
      t.streak(60, 0, 200);
      t.streak(170, 0, 150);
      break;
    }
    case T.GARAGE: {
      t.plaster();
      t.glass(18, 60, 220, 186, false, 'rgb(36,34,32)', 'rgb(16,15,14)');
      t.fixed(18, 60, 220, 70, 'rgb(170,172,170)', 130);
      for (let i = 0; i < 8; i++) t.fixed(18, 62 + i * 8, 220, 2, 'rgb(120,122,120)', 130);
      t.frame(18, 60, 220, 186, 'rgb(70,70,70)', 8);
      break;
    }
    case T.HOTEL_AC: {
      t.plaster();
      t.glass(58, 46, 140, 120);
      t.curtain(62, 50, 132, 112, 'rgb(205,186,150)');
      t.fixed(126, 46, 4, 120, 'rgb(220,220,220)');
      t.frame(58, 46, 140, 120, 'rgb(230,230,228)', 6);
      t.fixed(92, 182, 72, 42, 'rgb(220,220,216)', 110);
      for (let i = 0; i < 4; i++) t.fixed(98, 188 + i * 8, 60, 3, 'rgb(168,168,166)', 110);
      break;
    }
    case T.ARCH: {
      t.plaster();
      const x = 82;
      const y = 40;
      const w = 92;
      const h = 176;
      t.glass(x, y + 40, w, h - 40, true, 'rgb(120,90,60)', 'rgb(60,40,30)');
      const ctx = t.A;
      ctx.fillStyle = 'rgb(110,80,140)';
      ctx.beginPath();
      ctx.arc(t.ox + x + w / 2, t.oy + y + 46, w / 2, Math.PI, 0);
      ctx.fill();
      t.M.fillStyle = '#000';
      t.M.beginPath();
      t.M.arc(t.ox + x + w / 2, t.oy + y + 46, w / 2, Math.PI, 0);
      t.M.fill();
      t.P.fillStyle = 'rgb(255,16,255)';
      t.P.beginPath();
      t.P.arc(t.ox + x + w / 2, t.oy + y + 46, w / 2, Math.PI, 0);
      t.P.fill();
      t.fixed(x + w / 2 - 3, y + 40, 6, h - 40, 'rgb(70,60,50)');
      break;
    }
    case T.ENTRANCE: {
      t.plaster();
      t.glass(36, 50, 184, 196, true, 'rgb(130,150,160)', 'rgb(50,62,70)');
      t.fixed(126, 50, 6, 196, 'rgb(170,172,176)', 60);
      t.frame(36, 50, 184, 196, 'rgb(170,172,176)', 7);
      t.fixed(20, 30, 216, 14, 'rgb(60,64,68)', 90);
      break;
    }
  }
}

let shared: { atlas: THREE.DataTexture; props: THREE.DataTexture } | null = null;

function textures(): { atlas: THREE.DataTexture; props: THREE.DataTexture } {
  if (shared) return shared;
  const { albedo, props, size } = buildAtlas();
  const atlas = new THREE.DataTexture(albedo, size, size, THREE.RGBAFormat);
  atlas.colorSpace = THREE.SRGBColorSpace;
  const p = new THREE.DataTexture(props, size, size, THREE.RGBAFormat);
  p.colorSpace = THREE.NoColorSpace;
  for (const t of [atlas, p]) {
    t.anisotropy = 8;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
  }
  shared = { atlas, props: p };
  return shared;
}

let facadeMat: THREE.MeshStandardMaterial | null = null;

/** Single facade material for every generated building. */
export function facadeMaterial(): THREE.MeshStandardMaterial {
  if (facadeMat) return facadeMat;
  const tex = textures();
  const m = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.02 });
  m.name = 'city-facade';
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uAtlas = { value: tex.atlas };
    shader.uniforms.uProps = { value: tex.props };
    shader.uniforms.uNight = CityUniforms.uNight;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec2 aRep; attribute vec4 aTile; attribute vec3 aTint; attribute float aSeed;
varying vec2 vRep; varying vec4 vTile; varying vec3 vTint; varying float vSeed;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vRep = aRep; vTile = aTile; vTint = aTint; vSeed = aSeed;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uAtlas; uniform sampler2D uProps; uniform float uNight;
varying vec2 vRep; varying vec4 vTile; varying vec3 vTint; varying float vSeed;
float fh(vec2 p) { return fract(sin(dot(p, vec2(41.31, 289.17))) * 45758.5453); }`,
      )
      .replace(
        '#include <map_fragment>',
        `vec2 cellF = fract(vRep);
vec2 cellI = floor(vRep);
vec2 auv = vTile.xy + (cellF * 0.97 + 0.015) * vTile.zw;
vec2 gx = dFdx(vRep) * vTile.zw; vec2 gy = dFdy(vRep) * vTile.zw;
vec4 fAlb = textureGrad(uAtlas, auv, gx, gy);
vec4 fPro = textureGrad(uProps, auv, gx, gy);
float ground = step(vRep.y, 1.0);
float grime = 1.0 - 0.16 * ground * (1.0 - smoothstep(0.0, 0.3, cellF.y));
vec3 painted = fAlb.rgb * vTint;
diffuseColor.rgb *= mix(fAlb.rgb, painted, fAlb.a) * grime;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `float roughnessFactor = mix(clamp(fPro.g, 0.3, 1.0), 0.05, fPro.r);`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `float metalnessFactor = mix(metalness, 0.25, fPro.r);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float wHash = fh(cellI + vec2(vSeed * 13.7, vSeed * 3.3));
float lit = step(wHash, 0.36 + 0.34 * ground) * fPro.b * uNight;
vec3 warm = mix(vec3(1.0, 0.66, 0.36), vec3(0.78, 0.86, 1.0), step(0.78, fh(cellI * 1.31 + vSeed)));
float glassDim = 1.0 - 0.5 * fPro.r;
totalEmissiveRadiance += warm * lit * glassDim * (0.6 + 0.8 * fh(cellI * 2.7 + vSeed * 5.1)) * (0.3 + fAlb.rgb * 3.0) * 1.7;`,
      );
  };
  m.customProgramCacheKey = () => 'city-facade-v2';
  facadeMat = m;
  return m;
}
