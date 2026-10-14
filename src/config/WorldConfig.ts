/**
 * Central world settings. Add districts / assets here without touching systems.
 */
export const WorldConfig = {
  title: 'KAMERLIFE',
  version: '0.6.0-living-city',
  worldScale: 1,
  unitMeters: 1,
  /** Half-extent (~1.4 km from centre) so Nsimalen airport fits on southern edge. */
  worldHalfSize: 1400,
  loadDistance: 320,
  unloadDistance: 420,
  lodNear: 60,
  lodFar: 200,
  /** Spawn inside Maison du Joueur (living room). */
  spawn: { x: 38, y: 0, z: 108 },
  player: {
    walkSpeed: 5.2,
    runSpeed: 11.5,
    jumpSpeed: 7.0,
    gravity: 18,
    radius: 0.4,
    height: 1.8,
  },
  camera: {
    distance: 7.2,
    height: 1.6,
    minPitch: -0.1,
    maxPitch: 0.72,
    sensitivity: 0.0024,
    lerp: 10,
  },
  sky: 0x9bcbdc,
  groundGrass: 0x5f8a52,
  groundEarth: 0x8a7358,
  road: 0x2a2e32,
} as const;
