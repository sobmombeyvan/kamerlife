import { LANDMARK_FOOTPRINTS } from '../landmarks/LandmarkSites';
import { roadHalfAtX, roadHalfAtZ } from './CityRoadPlan';

const GAP_MARGIN = 6;

export type Interval = { a: number; b: number };

const gapCache = new Map<string, Interval[]>();

/** Merged along-axis gaps where a road must stop for landmarks. */
export function landmarkGapsForRoad(axis: 'x' | 'z', roadCenter: number): Interval[] {
  const key = `${axis}:${roadCenter}`;
  const hit = gapCache.get(key);
  if (hit) return hit;

  const roadHalf = axis === 'z' ? roadHalfAtX(roadCenter) : roadHalfAtZ(roadCenter);
  const raw: Interval[] = [];

  for (const f of LANDMARK_FOOTPRINTS) {
    if (axis === 'z') {
      if (Math.abs(f.x - roadCenter) < f.halfW + roadHalf + 1) {
        raw.push({ a: f.z - f.halfD - GAP_MARGIN, b: f.z + f.halfD + GAP_MARGIN });
      }
    } else if (Math.abs(f.z - roadCenter) < f.halfD + roadHalf + 1) {
      raw.push({ a: f.x - f.halfW - GAP_MARGIN, b: f.x + f.halfW + GAP_MARGIN });
    }
  }

  const merged = mergeIntervals(raw);
  gapCache.set(key, merged);
  return merged;
}

/** Jump past a gap in travel direction. */
export function skipRoadGap(
  axis: 'x' | 'z',
  roadCenter: number,
  along: number,
  dir: 1 | -1,
): number {
  for (const g of landmarkGapsForRoad(axis, roadCenter)) {
    if (along >= g.a && along <= g.b) {
      return dir > 0 ? g.b + 2 : g.a - 2;
    }
  }
  return along;
}

export function mergeIntervals(raw: Interval[]): Interval[] {
  if (!raw.length) return [];
  const sorted = [...raw].sort((u, v) => u.a - v.a);
  const out: Interval[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = out[out.length - 1]!;
    if (cur.a <= last.b + 1) last.b = Math.max(last.b, cur.b);
    else out.push({ ...cur });
  }
  return out;
}

/** Split [-half, half] into open segments around gaps. */
export function openSpans(half: number, gaps: Interval[]): Array<{ mid: number; length: number }> {
  const spans: Array<{ mid: number; length: number }> = [];
  let cursor = -half;
  for (const g of gaps) {
    const a = Math.max(-half, g.a);
    const b = Math.min(half, g.b);
    if (b <= -half || a >= half) continue;
    if (a > cursor + 8) {
      const length = a - cursor;
      spans.push({ mid: cursor + length / 2, length });
    }
    cursor = Math.max(cursor, b);
  }
  if (cursor < half - 8) {
    const length = half - cursor;
    spans.push({ mid: cursor + length / 2, length });
  }
  return spans;
}
