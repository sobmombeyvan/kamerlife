import * as THREE from 'three';
import { surfaceMaps } from '../render/surfaces';
import { CityUniforms } from '../render/nightState';
import { cssToRgb, drawSignFace } from '../render/designedArt';

export type KitKind = 'kit' | 'metal' | 'tin' | 'glow' | 'ground' | 'leaf' | 'asphalt' | 'walk' | 'grass';

/** Rain: darker albedo, glossy surface so lamps and the sky reflect off roads. */
function addWetness(m: THREE.MeshStandardMaterial, key: string, strength: number): void {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWet = CityUniforms.uWet;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uWet;
float wetHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wetNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wetHash(i), wetHash(i + vec2(1.0, 0.0)), f.x), mix(wetHash(i + vec2(0.0, 1.0)), wetHash(i + vec2(1.0)), f.x), f.y);
}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
float wetK = uWet * ${strength.toFixed(2)};
float puddle = 0.0;
#ifdef USE_MAP
  // puddles collect in low spots once the surface is soaked
  float pn = wetNoise(vMapUv * 0.55) * 0.65 + wetNoise(vMapUv * 1.7) * 0.35;
  puddle = smoothstep(0.58, 0.7, pn) * smoothstep(0.45, 0.95, uWet);
#endif
roughnessFactor = mix(roughnessFactor, mix(0.26, 0.03, puddle), wetK);
diffuseColor.rgb *= 1.0 - (0.32 + 0.18 * puddle) * wetK;`,
      );
  };
  m.customProgramCacheKey = () => `city-wet-v2-${key}`;
}

const cache = new Map<KitKind, THREE.MeshStandardMaterial>();

/** Vertex-coloured city materials; one instance each, shared by every chunk. */
export function kitMaterial(kind: KitKind): THREE.MeshStandardMaterial {
  const hit = cache.get(kind);
  if (hit) return hit;
  let m: THREE.MeshStandardMaterial;
  if (kind === 'kit') {
    const t = surfaceMaps('plaster');
    m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: t.map,
      roughnessMap: t.roughnessMap,
      normalMap: t.normalMap,
      roughness: 0.9,
      metalness: 0.02,
    });
    m.normalScale.set(0.3, 0.3);
  } else if (kind === 'ground') {
    const t = surfaceMaps('concrete');
    m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: t.map,
      roughnessMap: t.roughnessMap,
      normalMap: t.normalMap,
      roughness: 0.95,
      metalness: 0,
    });
    m.normalScale.set(0.35, 0.35);
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    m.polygonOffsetUnits = -2;
    addWetness(m, 'ground', 0.8);
  } else if (kind === 'metal') {
    const t = surfaceMaps('metal');
    m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: t.map,
      roughnessMap: t.roughnessMap,
      roughness: 0.55,
      metalness: 0.55,
    });
  } else if (kind === 'tin') {
    const t = surfaceMaps('roof');
    m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: t.map,
      roughnessMap: t.roughnessMap,
      normalMap: t.normalMap,
      roughness: 0.6,
      metalness: 0.35,
      side: THREE.DoubleSide,
    });
    m.normalScale.set(0.9, 0.9);
  } else if (kind === 'asphalt' || kind === 'walk' || kind === 'grass') {
    const t = surfaceMaps(kind === 'walk' ? 'sidewalk' : kind);
    m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: t.map,
      roughnessMap: t.roughnessMap,
      normalMap: t.normalMap,
      roughness: kind === 'asphalt' ? 0.92 : 0.9,
      metalness: 0,
    });
    m.normalScale.set(kind === 'asphalt' ? 0.45 : 0.32, kind === 'asphalt' ? 0.45 : 0.32);
    if (kind !== 'walk') {
      m.polygonOffset = true;
      m.polygonOffsetFactor = -1;
      m.polygonOffsetUnits = -1;
    }
    addWetness(m, kind, kind === 'grass' ? 0.25 : kind === 'walk' ? 0.7 : 1);
  } else if (kind === 'leaf') {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, side: THREE.DoubleSide, flatShading: true });
  } else {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.1 });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uNight = CityUniforms.uNight;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uNight;')
        .replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * (0.15 + uNight * 3.2);',
        );
    };
    m.customProgramCacheKey = () => 'city-glow-v1';
  }
  m.name = `city-${kind}`;
  cache.set(kind, m);
  return m;
}

/** UV scale (1 / metres per texture repeat) baked into each kit batch. */
export const KIT_UV: Record<KitKind, number> = {
  kit: 1 / 2.2,
  ground: 1 / 3.2,
  metal: 1 / 1.4,
  tin: 1 / 1.1,
  glow: 1,
  leaf: 1,
  asphalt: 1 / 3.2,
  walk: 1 / 1.7,
  grass: 1 / 2.6,
};

let sigMat: THREE.MeshStandardMaterial | null = null;

/**
 * Traffic-light lenses. Vertex colour encodes the lens, not its paint:
 * r = lens (0 red · 0.5 amber · 1 green), g = axis (0 N–S traffic · 1 E–W traffic).
 */
export function signalMaterial(): THREE.MeshStandardMaterial {
  if (sigMat) return sigMat;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSigNS = CityUniforms.uSigNS;
    shader.uniforms.uSigEW = CityUniforms.uSigEW;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSigNS;\nuniform float uSigEW;\nvec3 sigLens; float sigOn;')
      .replace(
        '#include <color_fragment>',
        `float sigType = vColor.r;
float sigState = vColor.g < 0.5 ? uSigNS : uSigEW;
sigLens = sigType < 0.2 ? vec3(1.0, 0.06, 0.04) : (sigType < 0.7 ? vec3(1.0, 0.55, 0.0) : vec3(0.1, 1.0, 0.4));
float want = sigType < 0.2 ? 0.0 : (sigType < 0.7 ? 1.0 : 2.0);
sigOn = 1.0 - step(0.5, abs(sigState - want));
diffuseColor.rgb = sigLens * (0.06 + 0.1 * sigOn);`,
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance = sigLens * sigOn * 4.0;');
  };
  m.customProgramCacheKey = () => 'city-signal-v1';
  m.name = 'city-signal';
  sigMat = m;
  return m;
}

let poolMat: THREE.MeshBasicMaterial | null = null;

/** Additive ground light pools under street lamps; invisible by day. */
export function poolMaterial(): THREE.MeshBasicMaterial {
  if (poolMat) return poolMat;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.MeshBasicMaterial({
    map: tex,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = CityUniforms.uNight;
    shader.uniforms.uWet = CityUniforms.uWet;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nuniform float uWet;')
      .replace('#include <opaque_fragment>', 'outgoingLight *= uNight * (0.55 + uWet * 0.6);\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'city-pool-v1';
  m.name = 'city-pool';
  poolMat = m;
  return m;
}

// ---------------------------------------------------------------------------
// Sign atlas: fictional shop names painted on demand, backlit at night.

const SIGN_W = 640;
const SIGN_H = 96;
const SIGN_COLS = 5;
const SIGN_ROWS = 39;
const signCanvas = document.createElement('canvas');
signCanvas.width = SIGN_W * SIGN_COLS;
signCanvas.height = SIGN_H * SIGN_ROWS;
const signCtx = signCanvas.getContext('2d')!;
const signTex = new THREE.CanvasTexture(signCanvas);
signTex.colorSpace = THREE.SRGBColorSpace;
signTex.anisotropy = 8;
const slots = new Map<string, [number, number, number, number]>();

export type SignStyle = { bg: string; fg: string; accent?: string };

/** Returns the UV rect of a painted sign panel. */
export function signSlot(text: string, style: SignStyle): [number, number, number, number] {
  const key = text;
  const hit = slots.get(key);
  if (hit) return hit;
  if (slots.size >= SIGN_COLS * SIGN_ROWS) return slots.values().next().value!;
  const i = slots.size;
  const col = i % SIGN_COLS;
  const row = Math.floor(i / SIGN_COLS);
  const x = col * SIGN_W;
  const y = row * SIGN_H;
  const c = signCtx;
  c.save();
  c.beginPath();
  c.rect(x, y, SIGN_W, SIGN_H);
  c.clip();
  c.translate(x, y);
  drawSignFace(c, SIGN_W, SIGN_H, text, undefined, cssToRgb(style.bg), cssToRgb(style.fg));
  c.restore();
  signTex.needsUpdate = true;
  const rect: [number, number, number, number] = [
    x / signCanvas.width,
    1 - (y + SIGN_H) / signCanvas.height,
    SIGN_W / signCanvas.width,
    SIGN_H / signCanvas.height,
  ];
  slots.set(key, rect);
  return rect;
}

let signMat: THREE.MeshStandardMaterial | null = null;

export function signMaterial(): THREE.MeshStandardMaterial {
  if (signMat) return signMat;
  const m = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.5, metalness: 0.05, emissiveMap: signTex, emissive: 0xffffff });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = CityUniforms.uNight;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace(
        '#include <emissivemap_fragment>',
        `vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
totalEmissiveRadiance *= emissiveColor.rgb * (0.04 + uNight * 1.6);`,
      );
  };
  m.customProgramCacheKey = () => 'city-sign-v1';
  m.polygonOffset = true;
  m.polygonOffsetFactor = -2;
  m.polygonOffsetUnits = -2;
  signMat = m;
  return m;
}

/** Quads with explicit UV rects (signs, billboards). */
export class SignBatch {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  idx: number[] = [];

  /** World-space quad; a/b bottom edge, c/d top edge, rect in atlas UV. */
  quad(a: number[], b: number[], c: number[], d: number[], n: number[], rect: readonly number[]): void {
    const base = this.pos.length / 3;
    for (const p of [a, b, c, d]) this.pos.push(p[0]!, p[1]!, p[2]!);
    for (let i = 0; i < 4; i++) this.nor.push(n[0]!, n[1]!, n[2]!);
    const [u0, v0, du, dv] = rect as [number, number, number, number];
    this.uv.push(u0, v0, u0 + du, v0, u0 + du, v0 + dv, u0, v0 + dv);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  build(): THREE.BufferGeometry | null {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}
