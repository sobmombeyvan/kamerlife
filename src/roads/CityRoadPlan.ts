import { WorldConfig } from '../config/WorldConfig';

/**
 * Logical Yaoundé-inspired road hierarchy (game layout).
 * - Main cross highway through centre (wide boulevard)
 * - Grid avenues / local streets
 * - Sidewalks offset outside asphalt — NPCs walk here only
 */

/** Primary N–S & E–W boulevards through Centre-ville. */
export const HIGHWAY_NS_X = 0;
export const HIGHWAY_EW_Z = 0;

/** Full asphalt width of main highway (metres). */
export const HIGHWAY_WIDTH = 28;
export const HIGHWAY_HALF = HIGHWAY_WIDTH / 2;

/** Regular grid street asphalt half-width (clearance). */
export const STREET_HALF = 9.5;
export const AVENUE_HALF = 12;

/** Distance from road centreline to sidewalk walking line. */
export const SIDEWALK_FROM_CENTER_STREET = STREET_HALF + 2.4;
export const SIDEWALK_FROM_CENTER_HIGHWAY = HIGHWAY_HALF + 2.6;

/** Keep buildings off the highway cross core (no roundabout). */
export const CENTRE_PLAZA_RADIUS = 30;

export const ROAD_GRID = 72;

export function isHighwayAxisX(x: number): boolean {
  return Math.abs(x - HIGHWAY_NS_X) < 0.5;
}

export function isHighwayAxisZ(z: number): boolean {
  return Math.abs(z - HIGHWAY_EW_Z) < 0.5;
}

export function roadHalfAtX(gx: number): number {
  return isHighwayAxisX(gx) ? HIGHWAY_HALF : Math.abs(gx) % (ROAD_GRID * 2) === 0 ? AVENUE_HALF : STREET_HALF;
}

export function roadHalfAtZ(gz: number): number {
  return isHighwayAxisZ(gz) ? HIGHWAY_HALF : Math.abs(gz) % (ROAD_GRID * 2) === 0 ? AVENUE_HALF : STREET_HALF;
}

export function sidewalkOffsetForX(gx: number): number {
  return isHighwayAxisX(gx) ? SIDEWALK_FROM_CENTER_HIGHWAY : SIDEWALK_FROM_CENTER_STREET;
}

export function sidewalkOffsetForZ(gz: number): number {
  return isHighwayAxisZ(gz) ? SIDEWALK_FROM_CENTER_HIGHWAY : SIDEWALK_FROM_CENTER_STREET;
}

/** Lane centre offsets from road axis for cars (metres). */
export function carLaneOffsets(halfWidth: number): number[] {
  if (halfWidth >= HIGHWAY_HALF - 0.5) {
    return [-9.5, -5.5, 5.5, 9.5];
  }
  if (halfWidth >= AVENUE_HALF - 0.5) {
    return [-4.2, 4.2];
  }
  return [-2.8, 2.8];
}

export function worldHalf(): number {
  return WorldConfig.worldHalfSize;
}

let axesCache: number[] | null = null;

/** Road grid lines: multiples of ROAD_GRID (the highway cross is the 0 line). */
export function gridAxes(): number[] {
  if (axesCache) return axesCache;
  const n = Math.floor(worldHalf() / ROAD_GRID);
  const axes: number[] = [];
  for (let k = -n; k <= n; k++) axes.push(k * ROAD_GRID);
  axesCache = axes;
  return axes;
}

export function isAvenueAxis(v: number): boolean {
  return Math.abs(v) % (ROAD_GRID * 2) === 0 && Math.abs(v) > 0.5;
}
