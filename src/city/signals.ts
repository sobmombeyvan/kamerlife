import { isAvenueAxis, isHighwayAxisX, isHighwayAxisZ } from '../roads/CityRoadPlan';
import { landmarkGapsForRoad } from '../roads/RoadGaps';
import { CityUniforms } from '../render/nightState';

/**
 * City-wide traffic-light clock. Every signalised junction shares the same phase, so the
 * lamps drawn by the street kit and the stop logic in TrafficSystem always agree.
 * State per axis: 0 red · 1 amber · 2 green. "ns" = traffic moving along z.
 */
const GREEN = 14;
const AMBER = 3;
const ALL_RED = 1.5;
const CYCLE = 2 * (GREEN + AMBER + ALL_RED);

let t = 0;

export function tickSignals(dt: number): void {
  t = (t + dt) % CYCLE;
  CityUniforms.uSigNS.value = signalState('ns');
  CityUniforms.uSigEW.value = signalState('ew');
}

export function signalState(axis: 'ns' | 'ew'): 0 | 1 | 2 {
  const local = axis === 'ns' ? t : (t + GREEN + AMBER + ALL_RED) % CYCLE;
  if (local < GREEN) return 2;
  if (local < GREEN + AMBER) return 1;
  return 0;
}

function roadOpenAt(axis: 'x' | 'z', center: number, along: number): boolean {
  for (const g of landmarkGapsForRoad(axis, center)) if (along >= g.a && along <= g.b) return false;
  return true;
}

const cache = new Map<string, boolean>();

/** Junction of an avenue or the highway with any open road, inside the urban area. */
export function hasSignal(gx: number, gz: number): boolean {
  const k = `${gx},${gz}`;
  const hit = cache.get(k);
  if (hit !== undefined) return hit;
  let v = false;
  const major = (a: number, hw: boolean) => hw || isAvenueAxis(a);
  if (Math.abs(gx) <= 1000 && Math.abs(gz) <= 1000) {
    if (major(gx, isHighwayAxisX(gx)) || major(gz, isHighwayAxisZ(gz))) {
      v = roadOpenAt('z', gx, gz) && roadOpenAt('x', gz, gx);
    }
  }
  cache.set(k, v);
  return v;
}

export function roadOpen(axis: 'x' | 'z', center: number, along: number): boolean {
  return roadOpenAt(axis, center, along);
}
