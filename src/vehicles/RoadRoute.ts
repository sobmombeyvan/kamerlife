import { ROAD_GRID, carLaneOffsets, gridAxes, isHighwayAxisX, isHighwayAxisZ, roadHalfAtX, roadHalfAtZ } from '../roads/CityRoadPlan';
import { landmarkGapsForRoad } from '../roads/RoadGaps';
import { asphaltHalf } from '../city/StreetKit';

export type Pt = { x: number; z: number };
type Axis = 'x' | 'z';

/** A point on a road: `axis` is the direction the road runs, `center` its fixed coordinate. */
export type RoadPoint = { axis: Axis; center: number; along: number; side: 1 | -1 };

const G = ROAD_GRID;
const CORNER = 5;

function spanOpen(axis: Axis, center: number, a: number, b: number): boolean {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  for (const g of landmarkGapsForRoad(axis, center)) if (g.b >= lo && g.a <= hi) return false;
  return true;
}

function limit(): number {
  const axes = gridAxes();
  return axes[axes.length - 1]!;
}

function isHighway(axis: Axis, center: number): boolean {
  return axis === 'z' ? isHighwayAxisX(center) : isHighwayAxisZ(center);
}

/** Outer (right-hand, kerb-side) lane offset of a road. */
function outerLane(axis: Axis, center: number): number {
  const half = axis === 'z' ? roadHalfAtX(center) : roadHalfAtZ(center);
  return Math.max(...carLaneOffsets(half).map(Math.abs));
}

/** Pavement walking line from the road centre. */
export function kerbOffset(axis: Axis, center: number): number {
  return asphaltHalf(center, isHighway(axis, center)) + 1.75;
}

/** Driving direction sign whose right-hand side is `side` (right-hand traffic). */
function dirForSide(axis: Axis, side: 1 | -1): 1 | -1 {
  // heading +z keeps the −x side on its right; heading +x keeps the +z side on its right
  return axis === 'z' ? ((-side) as 1 | -1) : side;
}

function toWorld(axis: Axis, center: number, along: number, lat = 0): Pt {
  return axis === 'z' ? { x: center + lat, z: along } : { x: along, z: center + lat };
}

/** Nearest open road to a world point. */
export function snapToRoad(x: number, z: number): RoadPoint | null {
  const max = limit();
  let best: RoadPoint | null = null;
  let bestD = Infinity;
  const consider = (axis: Axis, center: number, along: number, lateral: number) => {
    if (Math.abs(center) > max || Math.abs(along) > max) return;
    const d = Math.abs(lateral);
    if (d >= bestD || !spanOpen(axis, center, along - 4, along + 4)) return;
    // the stretch must reach a junction, or the taxi would be stuck between two closures
    const lo = Math.floor(along / G) * G;
    const hi = lo + G;
    if (!spanOpen(axis, center, along, lo) && !spanOpen(axis, center, along, hi)) return;
    bestD = d;
    best = { axis, center, along, side: lateral >= 0 ? 1 : -1 };
  };
  for (const k of [Math.floor(x / G), Math.ceil(x / G), Math.floor(x / G) - 1, Math.ceil(x / G) + 1]) {
    consider('z', k * G, z, x - k * G);
  }
  for (const k of [Math.floor(z / G), Math.ceil(z / G), Math.floor(z / G) - 1, Math.ceil(z / G) + 1]) {
    consider('x', k * G, x, z - k * G);
  }
  return best;
}

/** Junction world position for road `axis/center` at `along`. */
function junction(axis: Axis, center: number, J: number): Pt {
  return toWorld(axis, center, J);
}

const key = (x: number, z: number) => `${Math.round(x / G)},${Math.round(z / G)}`;

/**
 * Shortest route over open road segments from road point `a` to road point `b`.
 * The taxi leaves `a` heading so the pick-up kerb is on its right and arrives
 * at `b` with the drop-off kerb on its right. Returns centreline corner points.
 */
function routeNodes(a: RoadPoint, b: RoadPoint): Pt[] | null {
  const max = limit();
  const startDir = dirForSide(a.axis, a.side);
  const endDir = dirForSide(b.axis, b.side);
  const pa = toWorld(a.axis, a.center, a.along);
  const pb = toWorld(b.axis, b.center, b.along);

  // same road, b straight ahead with nothing in between
  if (a.axis === b.axis && a.center === b.center && startDir === endDir && (b.along - a.along) * startDir > 0) {
    if (spanOpen(a.axis, a.center, a.along, b.along)) return [pa, pb];
  }

  // Dijkstra over (junction, heading) so the route never U-turns on a road
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const pos = new Map<string, Pt>();
  const head = new Map<string, number>();
  const open: Array<{ k: string; d: number }> = [];
  const push = (p: Pt, h: number, d: number, from: string) => {
    const k = `${key(p.x, p.z)}|${h}`;
    if (d >= (dist.get(k) ?? Infinity)) return;
    dist.set(k, d);
    prev.set(k, from);
    pos.set(k, p);
    head.set(k, h);
    open.push({ k, d });
  };
  const MOVES = [
    [G, 0],
    [0, G],
    [-G, 0],
    [0, -G],
  ] as const;
  const headingOf = (axis: Axis, dir: 1 | -1) => (axis === 'x' ? (dir > 0 ? 0 : 2) : dir > 0 ? 1 : 3);
  const jStart = startDir > 0 ? Math.floor(a.along / G + 1e-6) * G + G : Math.ceil(a.along / G - 1e-6) * G - G;
  const firstJ = Math.abs(jStart - a.along) < 6 ? jStart + startDir * G : jStart;
  const reachable = (j: number) => Math.abs(j) <= max && spanOpen(a.axis, a.center, a.along, j);
  let start = firstJ;
  if (!reachable(start)) start = jStart;
  if (!reachable(start)) return null;
  push(junction(a.axis, a.center, start), headingOf(a.axis, startDir), Math.abs(start - a.along), 'S');

  // the junction b must be entered from, so the final leg runs in endDir
  const jBefore = endDir > 0 ? Math.floor(b.along / G) * G : Math.ceil(b.along / G) * G;
  const lastJ = Math.abs(b.along - jBefore) < 6 ? jBefore - endDir * G : jBefore;
  const goalP = junction(b.axis, b.center, lastJ);
  const goalK = key(goalP.x, goalP.z);
  const goalOk = Math.abs(lastJ) <= max && spanOpen(b.axis, b.center, lastJ, b.along);

  if (!goalOk) return null;
  const done = new Set<string>();
  let reached: string | null = null;
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i]!.d < open[bi]!.d) bi = i;
    const { k, d } = open.splice(bi, 1)[0]!;
    if (done.has(k)) continue;
    done.add(k);
    const h = head.get(k)!;
    if (k.startsWith(`${goalK}|`) && h !== (headingOf(b.axis, endDir) + 2) % 4) {
      reached = k;
      break;
    }
    const p = pos.get(k)!;
    for (let m = 0; m < 4; m++) {
      // U-turns only as a last resort (dead ends next to landmarks)
      const uTurn = m === (h + 2) % 4;
      const [dx, dz] = MOVES[m]!;
      const q = { x: p.x + dx, z: p.z + dz };
      if (Math.abs(q.x) > max || Math.abs(q.z) > max) continue;
      const ok = dz === 0 ? spanOpen('x', p.z, p.x, q.x) : spanOpen('z', p.x, p.z, q.z);
      if (!ok) continue;
      // reaching the goal junction over b's own block would mean passing b then U-turning
      if (key(q.x, q.z) === goalK) {
        const axis: Axis = dz === 0 ? 'x' : 'z';
        const center = dz === 0 ? p.z : p.x;
        const step = Math.sign(dz === 0 ? dx : dz);
        if (axis === b.axis && center === b.center && step === -endDir) continue;
      }
      // prefer the wide roads a driver would take
      const road = dz === 0 ? p.z : p.x;
      const w = isHighwayAxisX(road) || isHighwayAxisZ(road) ? 0.75 : Math.abs(road) % (G * 2) === 0 ? 0.9 : 1;
      push(q, m, d + G * w + (m === h ? 0 : uTurn ? 420 : 6), k);
    }
  }
  if (!reached) return null;

  const chain: Pt[] = [];
  let k: string | undefined = reached;
  while (k && k !== 'S') {
    chain.push(pos.get(k)!);
    k = prev.get(k);
  }
  chain.reverse();
  return [pa, ...chain, pb];
}

function dirOf(a: Pt, b: Pt): Pt {
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return { x: (b.x - a.x) / l, z: (b.z - a.z) / l };
}

/** Right-hand lane offset for a leg heading `d` on the road through `p`. */
function laneOffset(p: Pt, d: Pt): Pt {
  const alongX = Math.abs(d.x) > Math.abs(d.z);
  const L = alongX ? outerLane('x', Math.round(p.z / G) * G) : outerLane('z', Math.round(p.x / G) * G);
  return { x: -d.z * L, z: d.x * L };
}

/** Centreline corner points → right-lane polyline with rounded turns. */
function toLane(nodes: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i]!;
    const dIn = i > 0 ? dirOf(nodes[i - 1]!, p) : null;
    const dOut = i < nodes.length - 1 ? dirOf(p, nodes[i + 1]!) : null;
    if (!dIn || !dOut) {
      const o = laneOffset(p, (dIn ?? dOut)!);
      out.push({ x: p.x + o.x, z: p.z + o.z });
      continue;
    }
    const oIn = laneOffset(p, dIn);
    const oOut = laneOffset(p, dOut);
    const dot = dIn.x * dOut.x + dIn.z * dOut.z;
    if (dot < -0.9) {
      // U-turn inside the junction box, lane to lane
      const reach = 3;
      out.push({ x: p.x + oIn.x, z: p.z + oIn.z });
      out.push({ x: p.x + oIn.x * 0.5 + dIn.x * reach, z: p.z + oIn.z * 0.5 + dIn.z * reach });
      out.push({ x: p.x + oOut.x * 0.5 + dIn.x * reach, z: p.z + oOut.z * 0.5 + dIn.z * reach });
      out.push({ x: p.x + oOut.x, z: p.z + oOut.z });
      continue;
    }
    if (dot > 0.9) {
      out.push({ x: p.x + oIn.x, z: p.z + oIn.z });
      continue;
    }
    const c = { x: p.x + oIn.x + oOut.x, z: p.z + oIn.z + oOut.z };
    out.push({ x: c.x - dIn.x * CORNER, z: c.z - dIn.z * CORNER });
    out.push({ x: c.x + (dOut.x - dIn.x) * CORNER * 0.3, z: c.z + (dOut.z - dIn.z) * CORNER * 0.3 });
    out.push({ x: c.x + dOut.x * CORNER, z: c.z + dOut.z * CORNER });
  }
  return out;
}

export type TaxiRoute = {
  /** Lane polyline from the pick-up stop to the drop-off stop. */
  path: Pt[];
  /** Pavement point where the passenger steps out. */
  exit: Pt;
};

/** Kerb-side stop on the road nearest (x, z), heading so the kerb is on the right. */
export function pickupStop(x: number, z: number): { stop: Pt; approach: Pt; road: RoadPoint } | null {
  const r = snapToRoad(x, z);
  if (!r) return null;
  const aheadOpen = (d: 1 | -1) => {
    const J = d > 0 ? Math.floor(r.along / G) * G + G : Math.ceil(r.along / G) * G - G;
    return Math.abs(J) <= limit() && spanOpen(r.axis, r.center, r.along, J);
  };
  // road blocked ahead on the passenger's kerb: the taxi comes up the far lane instead
  if (!aheadOpen(dirForSide(r.axis, r.side)) && aheadOpen(dirForSide(r.axis, (-r.side) as 1 | -1))) {
    r.side = (-r.side) as 1 | -1;
  }
  const dir = dirForSide(r.axis, r.side);
  const lane = outerLane(r.axis, r.center);
  const lat = r.side * lane;
  let back = 55;
  while (back > 10 && !spanOpen(r.axis, r.center, r.along - dir * back, r.along)) back -= 15;
  return {
    road: r,
    stop: toWorld(r.axis, r.center, r.along, lat),
    approach: toWorld(r.axis, r.center, r.along - dir * back, lat),
  };
}

/** Road-only route from the pick-up road point to the road nearest (toX, toZ), or null when no road link exists. */
export function taxiRoute(a: RoadPoint, toX: number, toZ: number): TaxiRoute | null {
  const b = snapToRoad(toX, toZ);
  if (!b) return null;
  let nodes = routeNodes(a, b);
  // drop-off kerb unreachable in that direction: accept the opposite kerb
  if (!nodes) nodes = routeNodes(a, { ...b, side: (-b.side) as 1 | -1 });
  if (!nodes) return null;
  const path = toLane(nodes);
  const last = path[path.length - 1]!;
  const dEnd = dirOf(nodes[nodes.length - 2]!, nodes[nodes.length - 1]!);
  const off = laneOffset(nodes[nodes.length - 1]!, dEnd);
  const ol = Math.hypot(off.x, off.z) || 1;
  const kerb = kerbOffset(b.axis, b.center);
  const exit = { x: nodes[nodes.length - 1]!.x + (off.x / ol) * kerb, z: nodes[nodes.length - 1]!.z + (off.z / ol) * kerb };
  void last;
  return { path, exit };
}
