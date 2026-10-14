import { safeSetItem } from '../save/storage';

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';
export type ShadowQuality = 0 | 1 | 2 | 3;
export type DeviceTier = 'desktop' | 'low' | 'mid' | 'high';

const STORAGE_KEY = 'lifecity-graphics-v2';

export const GraphicsConfig = {
  quality: 'medium' as GraphicsQuality,
  /** Upper bound for devicePixelRatio before renderScale. */
  maxPixelRatio: 1.25,
  /** Render resolution multiplier (0.5–1). */
  renderScale: 1,
  /** Multisampled scene target (or canvas MSAA when post-processing is off). */
  antialias: false,
  shadows: true,
  /** 0 off · 1 low · 2 medium · 3 high */
  shadowQuality: 2 as ShadowQuality,
  shadowMapSize: 1024,
  /** Ortho half-size of the sun shadow, in meters. Tighter = sharper contact shadows. */
  shadowExtent: 40,
  shadowRadius: 1.6,
  shadowSoft: false,
  /** Metres: city chunks, fog and camera far plane all derive from this. */
  viewDistance: 560,
  fogNear: 120,
  fogFar: 560,
  cameraFar: 620,
  toneMappingExposure: 1.0,
  /** 0–1 share of generated trees and shrubs that are drawn. */
  vegetationDensity: 0.8,
  /** Relative NPC multiplier (0.35–1.6). */
  npcDensity: 1.0,
  /** Relative traffic multiplier (0.4–1.5). */
  trafficDensity: 1.0,
  /** Screen-space ambient occlusion. */
  ao: false,
  /** Sky environment reflections on glass, metal, paint and wet roads. */
  reflections: true,
  /** Composer chain: colour grading, bloom, vignette. */
  postFx: true,
  ambientAudio: true,
  /** Detected at launch. Not written into the graphics save. */
  deviceTier: 'desktop' as DeviceTier,
};

const PRESETS: Record<GraphicsQuality, Partial<typeof GraphicsConfig>> = {
  low: {
    maxPixelRatio: 1,
    renderScale: 0.8,
    antialias: false,
    shadowQuality: 0,
    viewDistance: 360,
    vegetationDensity: 0.35,
    npcDensity: 0.45,
    trafficDensity: 0.5,
    ao: false,
    reflections: false,
    postFx: false,
  },
  medium: {
    maxPixelRatio: 1.25,
    renderScale: 1,
    antialias: false,
    shadowQuality: 1,
    viewDistance: 520,
    vegetationDensity: 0.7,
    npcDensity: 1,
    trafficDensity: 1,
    ao: false,
    reflections: true,
    postFx: true,
  },
  high: {
    maxPixelRatio: 1.6,
    renderScale: 1,
    antialias: true,
    shadowQuality: 2,
    viewDistance: 720,
    vegetationDensity: 0.9,
    npcDensity: 1.25,
    trafficDensity: 1.15,
    ao: true,
    reflections: true,
    postFx: true,
  },
  ultra: {
    maxPixelRatio: 2,
    renderScale: 1,
    antialias: true,
    shadowQuality: 3,
    viewDistance: 950,
    vegetationDensity: 1,
    npcDensity: 1.45,
    trafficDensity: 1.3,
    ao: true,
    reflections: true,
    postFx: true,
  },
};

/** Phone caps. Applied only when the player has no saved graphics settings. */
const PHONE_PROFILES: Record<'low' | 'mid' | 'high', Partial<typeof GraphicsConfig>> = {
  low: {
    quality: 'low',
    maxPixelRatio: 1,
    renderScale: 0.7,
    antialias: false,
    shadowQuality: 0,
    viewDistance: 300,
    vegetationDensity: 0.25,
    npcDensity: 0.35,
    trafficDensity: 0.4,
    ao: false,
    reflections: false,
    postFx: false,
  },
  mid: {
    quality: 'medium',
    maxPixelRatio: 1.15,
    renderScale: 0.85,
    antialias: false,
    shadowQuality: 1,
    viewDistance: 420,
    vegetationDensity: 0.5,
    npcDensity: 0.7,
    trafficDensity: 0.65,
    ao: false,
    reflections: false,
    postFx: false,
  },
  high: {
    quality: 'high',
    maxPixelRatio: 1.5,
    renderScale: 0.9,
    antialias: false,
    shadowQuality: 1,
    viewDistance: 560,
    vegetationDensity: 0.75,
    npcDensity: 0.9,
    trafficDensity: 0.85,
    ao: false,
    reflections: true,
    postFx: true,
  },
};

export function detectDeviceTier(): DeviceTier {
  try {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const touch = navigator.maxTouchPoints > 0;
    const shortSide = Math.min(window.screen.width, window.screen.height);
    const phoneLike = coarse || (touch && shortSide <= 900);
    if (!phoneLike) return 'desktop';

    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean; effectiveType?: string };
    };
    const mem = nav.deviceMemory;
    const cores = nav.hardwareConcurrency ?? 0;
    const effective = nav.connection?.effectiveType;
    const slow = nav.connection?.saveData === true || effective === 'slow-2g' || effective === '2g';
    if (slow || (typeof mem === 'number' && mem <= 2)) return 'low';
    if (typeof mem === 'number') {
      if (mem <= 4 && cores > 0 && cores <= 4) return 'low';
      if (mem <= 4) return 'mid';
      if (mem >= 8 && cores >= 8) return 'high';
      return 'mid';
    }
    if (cores >= 8) return 'high';
    if (shortSide <= 340) return 'low';
    return 'mid';
  } catch {
    return 'desktop';
  }
}

function applyPhoneProfile(tier: 'low' | 'mid' | 'high'): void {
  GraphicsConfig.quality = PHONE_PROFILES[tier].quality ?? 'medium';
  Object.assign(GraphicsConfig, PHONE_PROFILES[tier]);
  deriveGraphics();
}

function applyAutomaticQuality(): void {
  if (GraphicsConfig.deviceTier === 'desktop') applyQuality('medium');
  else applyPhoneProfile(GraphicsConfig.deviceTier);
}

/** WebGL power hint. Low presets avoid heating small phones. */
export function rendererPowerPreference(): 'high-performance' | 'low-power' | 'default' {
  if (GraphicsConfig.quality === 'low') return 'low-power';
  if (GraphicsConfig.quality === 'medium' && GraphicsConfig.deviceTier !== 'desktop') return 'default';
  return 'high-performance';
}

/** Derive dependent values (shadow map, fog, far plane) from the primary settings. */
export function deriveGraphics(): void {
  const g = GraphicsConfig;
  g.shadows = g.shadowQuality > 0;
  g.shadowMapSize = [512, 1024, 2048, 4096][g.shadowQuality]!;
  g.shadowExtent = [30, 34, 46, 60][g.shadowQuality]!;
  g.shadowRadius = [0, 1.4, 2.0, 2.6][g.shadowQuality]!;
  g.shadowSoft = g.shadowQuality >= 2;
  g.fogFar = g.viewDistance;
  g.fogNear = Math.max(60, g.viewDistance * 0.2);
  g.cameraFar = g.viewDistance * 1.1;
}

/** The preset whose values all match the current settings, or null once the player customises. */
export function matchingPreset(): GraphicsQuality | null {
  const g = GraphicsConfig as Record<string, unknown>;
  for (const [q, p] of Object.entries(PRESETS) as Array<[GraphicsQuality, Record<string, unknown>]>) {
    if (Object.entries(p).every(([k, v]) => (typeof v === 'number' ? Math.abs((g[k] as number) - v) < 1e-3 : g[k] === v))) return q;
  }
  return null;
}

export function applyQuality(quality: GraphicsQuality): void {
  GraphicsConfig.quality = quality;
  Object.assign(GraphicsConfig, PRESETS[quality]);
  deriveGraphics();
}

const SAVED_KEYS = [
  'quality',
  'maxPixelRatio',
  'renderScale',
  'antialias',
  'shadowQuality',
  'viewDistance',
  'vegetationDensity',
  'npcDensity',
  'trafficDensity',
  'ao',
  'reflections',
  'postFx',
  'ambientAudio',
] as const;

export function saveGraphicsSettings(): void {
  const out: Record<string, unknown> = {};
  for (const k of SAVED_KEYS) out[k] = GraphicsConfig[k];
  if (!safeSetItem(STORAGE_KEY, JSON.stringify(out))) {
    console.warn('[graphics] réglages non enregistrés');
  }
}

export function loadGraphicsSettings(): void {
  GraphicsConfig.deviceTier = detectDeviceTier();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      applyAutomaticQuality();
      return;
    }
    const p = JSON.parse(raw) as Partial<typeof GraphicsConfig>;
    const q = p.quality && p.quality in PRESETS ? p.quality : 'medium';
    applyQuality(q);
    const g = GraphicsConfig;
    const num = (v: unknown, lo: number, hi: number, d: number): number =>
      typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
    g.maxPixelRatio = num(p.maxPixelRatio, 0.75, 2, g.maxPixelRatio);
    g.renderScale = num(p.renderScale, 0.5, 1, g.renderScale);
    g.shadowQuality = Math.round(num(p.shadowQuality, 0, 3, g.shadowQuality)) as ShadowQuality;
    g.viewDistance = num(p.viewDistance, 260, 1200, g.viewDistance);
    g.vegetationDensity = num(p.vegetationDensity, 0, 1, g.vegetationDensity);
    g.npcDensity = num(p.npcDensity, 0.35, 1.6, g.npcDensity);
    g.trafficDensity = num(p.trafficDensity, 0.4, 1.5, g.trafficDensity);
    if (typeof p.antialias === 'boolean') g.antialias = p.antialias;
    if (typeof p.ao === 'boolean') g.ao = p.ao;
    if (typeof p.reflections === 'boolean') g.reflections = p.reflections;
    if (typeof p.postFx === 'boolean') g.postFx = p.postFx;
    if (typeof p.ambientAudio === 'boolean') g.ambientAudio = p.ambientAudio;
    deriveGraphics();
  } catch {
    applyAutomaticQuality();
  }
}

loadGraphicsSettings();
