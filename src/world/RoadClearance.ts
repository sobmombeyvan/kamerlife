import { WorldConfig } from '../config/WorldConfig';
import { overlapsLandmarkFootprint } from '../landmarks/LandmarkSites';
import {
  CENTRE_PLAZA_RADIUS,
  ROAD_GRID,
  gridAxes,
  roadHalfAtX,
  roadHalfAtZ,
} from '../roads/CityRoadPlan';

export { ROAD_GRID };
/** @deprecated use CityRoadPlan — kept for older imports */
export const ROAD_CORRIDOR = 11;
export const DISTRICT_CORRIDOR = 10;

export type Lot = {
  x: number;
  z: number;
  maxHalf: number;
};

/** True if AABB overlaps any road asphalt or the centre civic plaza. */
export function overlapsRoad(x: number, z: number, halfW: number, halfD: number): boolean {
  const pad = 1.8;
  const minX = x - halfW - pad;
  const maxX = x + halfW + pad;
  const minZ = z - halfD - pad;
  const maxZ = z + halfD + pad;

  for (const gx of gridAxes()) {
    const roadHalf = roadHalfAtX(gx) + 1.2;
    if (maxX >= gx - roadHalf && minX <= gx + roadHalf) return true;
  }
  for (const gz of gridAxes()) {
    const roadHalf = roadHalfAtZ(gz) + 1.2;
    if (maxZ >= gz - roadHalf && minZ <= gz + roadHalf) return true;
  }

  // Keep centre plaza open
  if (Math.hypot(x, z) < CENTRE_PLAZA_RADIUS + Math.max(halfW, halfD)) return true;

  return false;
}

export function lotsInDistrict(cx: number, cz: number, radius: number, dense = true): Lot[] {
  const steps = dense ? [0.14, 0.38, 0.62, 0.86] : [0.28, 0.72];
  return lotsInRect(cx - radius, cz - radius, cx + radius, cz + radius, steps, (x, z) =>
    Math.hypot(x - cx, z - cz) <= radius * 0.98,
  );
}

export function lotsInCityFabric(innerHalf = 780, outerHalf = 1200): Lot[] {
  const inner = lotsInRect(-innerHalf, -innerHalf, innerHalf, innerHalf, [0.14, 0.38, 0.62, 0.86]);
  // Mid ring denser so peri-urbain quartiers stay filled
  const mid = lotsInRect(-outerHalf, -outerHalf, outerHalf, outerHalf, [0.2, 0.5, 0.8], (x, z) => {
    const d = Math.max(Math.abs(x), Math.abs(z));
    return d > innerHalf && d <= Math.min(outerHalf, innerHalf + 280);
  });
  const outer = lotsInRect(-outerHalf, -outerHalf, outerHalf, outerHalf, [0.25, 0.55, 0.85], (x, z) => {
    const d = Math.max(Math.abs(x), Math.abs(z));
    return d > innerHalf + 280 && d <= outerHalf;
  });
  return inner.concat(mid, outer);
}

function lotsInRect(
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
  steps: number[],
  filter?: (x: number, z: number) => boolean,
): Lot[] {
  const lots: Lot[] = [];
  // Inset from road edge so façades stay off asphalt + sidewalk
  const inset = 18.5;
  const usable = ROAD_GRID - inset * 2;
  if (usable < 12) return lots;

  const half = WorldConfig.worldHalfSize;
  const minGx = Math.max(-half, Math.floor(minX / ROAD_GRID) * ROAD_GRID);
  const maxGx = Math.min(half, Math.ceil(maxX / ROAD_GRID) * ROAD_GRID);
  const minGz = Math.max(-half, Math.floor(minZ / ROAD_GRID) * ROAD_GRID);
  const maxGz = Math.min(half, Math.ceil(maxZ / ROAD_GRID) * ROAD_GRID);
  const maxHalf = usable * (steps.length >= 4 ? 0.11 : 0.16);

  for (let gx = minGx; gx < maxGx; gx += ROAD_GRID) {
    for (let gz = minGz; gz < maxGz; gz += ROAD_GRID) {
      for (const u of steps) {
        for (const v of steps) {
          const x = gx + inset + usable * u;
          const z = gz + inset + usable * v;
          if (filter && !filter(x, z)) continue;
          if (overlapsRoad(x, z, maxHalf, maxHalf)) continue;
          if (overlapsLandmarkFootprint(x, z, maxHalf, maxHalf)) continue;
          lots.push({ x, z, maxHalf });
        }
      }
    }
  }
  return lots;
}
