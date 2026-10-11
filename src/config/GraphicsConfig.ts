export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

const STORAGE_KEY = 'lifecity-graphics-v1';

export const GraphicsConfig = {
  quality: 'medium' as GraphicsQuality,
  maxPixelRatio: 1.25,
  antialias: false,
  shadows: true,
  shadowMapSize: 1024,
  fogNear: 140,
  fogFar: 720,
  toneMappingExposure: 1.02,
  /** Ortho half-size of the sun shadow, in meters. Tighter = sharper contact shadows. */
  shadowExtent: 36,
  shadowRadius: 1.6,
  shadowSoft: false,
  /** Kept in sync with fog — don't draw past fog. */
  cameraFar: 780,
  /** Relative NPC spawn multiplier (0.4–1.6). */
  npcDensity: 1.0,
  /** Relative traffic count multiplier. */
  trafficDensity: 1.0,
  /** Ambient audio master preference. */
  ambientAudio: true,
};

export function applyQuality(quality: GraphicsQuality): void {
  GraphicsConfig.quality = quality;
  if (quality === 'low') {
    GraphicsConfig.maxPixelRatio = 1.0;
    GraphicsConfig.antialias = false;
    GraphicsConfig.shadows = false;
    GraphicsConfig.shadowMapSize = 512;
    GraphicsConfig.shadowExtent = 28;
    GraphicsConfig.shadowRadius = 0;
    GraphicsConfig.shadowSoft = false;
    GraphicsConfig.fogNear = 70;
    GraphicsConfig.fogFar = 340;
    GraphicsConfig.npcDensity = 0.45;
    GraphicsConfig.trafficDensity = 0.5;
  } else if (quality === 'medium') {
    GraphicsConfig.maxPixelRatio = 1.15;
    GraphicsConfig.antialias = false;
    GraphicsConfig.shadows = true;
    GraphicsConfig.shadowMapSize = 1024;
    GraphicsConfig.shadowExtent = 36;
    GraphicsConfig.shadowRadius = 1.6;
    GraphicsConfig.shadowSoft = false;
    GraphicsConfig.fogNear = 120;
    GraphicsConfig.fogFar = 560;
    GraphicsConfig.npcDensity = 1.0;
    GraphicsConfig.trafficDensity = 1.0;
  } else if (quality === 'high') {
    GraphicsConfig.maxPixelRatio = 1.6;
    GraphicsConfig.antialias = true;
    GraphicsConfig.shadows = true;
    GraphicsConfig.shadowMapSize = 1536;
    GraphicsConfig.shadowExtent = 48;
    GraphicsConfig.shadowRadius = 2.2;
    GraphicsConfig.shadowSoft = true;
    GraphicsConfig.fogNear = 180;
    GraphicsConfig.fogFar = 960;
    GraphicsConfig.npcDensity = 1.25;
    GraphicsConfig.trafficDensity = 1.15;
  } else {
    // ultra
    GraphicsConfig.maxPixelRatio = 2.0;
    GraphicsConfig.antialias = true;
    GraphicsConfig.shadows = true;
    GraphicsConfig.shadowMapSize = 2048;
    GraphicsConfig.shadowExtent = 56;
    GraphicsConfig.shadowRadius = 2.6;
    GraphicsConfig.shadowSoft = true;
    GraphicsConfig.fogNear = 220;
    GraphicsConfig.fogFar = 1200;
    GraphicsConfig.npcDensity = 1.45;
    GraphicsConfig.trafficDensity = 1.3;
  }
  GraphicsConfig.cameraFar = GraphicsConfig.fogFar * 1.08;
}

export function saveGraphicsSettings(): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      quality: GraphicsConfig.quality,
      npcDensity: GraphicsConfig.npcDensity,
      trafficDensity: GraphicsConfig.trafficDensity,
      ambientAudio: GraphicsConfig.ambientAudio,
    }),
  );
}

export function loadGraphicsSettings(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      applyQuality('medium');
      return;
    }
    const parsed = JSON.parse(raw) as {
      quality?: GraphicsQuality;
      npcDensity?: number;
      trafficDensity?: number;
      ambientAudio?: boolean;
    };
    applyQuality(parsed.quality ?? 'medium');
    if (typeof parsed.npcDensity === 'number') {
      GraphicsConfig.npcDensity = Math.max(0.35, Math.min(1.6, parsed.npcDensity));
    }
    if (typeof parsed.trafficDensity === 'number') {
      GraphicsConfig.trafficDensity = Math.max(0.4, Math.min(1.5, parsed.trafficDensity));
    }
    if (typeof parsed.ambientAudio === 'boolean') {
      GraphicsConfig.ambientAudio = parsed.ambientAudio;
    }
  } catch {
    applyQuality('medium');
  }
}

loadGraphicsSettings();
