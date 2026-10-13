/** Shared apartment dimensions — used by shell, door, and interact spots. */
export const HOME_SHELL = {
  wallH: 3.1,
  wallT: 0.28,
  innerW: 16,
  innerD: 14,
  /** Center of the floor slab. */
  floorY: 0.12,
  /** Slab thickness. The walkable top is floorY + floorH / 2. */
  floorH: 0.14,
} as const;

/** Top of the apartment floor. The player stands on this, not on world y = 0. */
export const HOME_FLOOR_TOP = HOME_SHELL.floorY + HOME_SHELL.floorH / 2;

/** Interior partition thickness. */
export const PARTITION_T = 0.14;

export type OpeningKind = 'window' | 'door' | 'arch' | 'entry';

/**
 * Hole in a wall run. `at` is the centre along the run axis, sill/head are heights above the floor top.
 * Doors: `hinge` picks the low (-1) or high (+1) end of the gap, `swing` the side the open leaf points to.
 */
export type Opening = {
  at: number;
  w: number;
  sill: number;
  head: number;
  kind: OpeningKind;
  hinge?: -1 | 1;
  swing?: -1 | 1;
};

/**
 * Straight wall in house-local metres (origin = house centre). axis 'x' runs along x at z = fixed.
 * `outward` marks exterior walls: sign of the outside along the perpendicular axis.
 */
export type WallRun = {
  id: string;
  axis: 'x' | 'z';
  fixed: number;
  from: number;
  to: number;
  t: number;
  outward?: 1 | -1;
  openings: Opening[];
};

export type Rect = { x0: number; x1: number; z0: number; z1: number };
export type FixtureRect = Rect & { h: number; id: string };

const T = HOME_SHELL.wallT;
const HW = HOME_SHELL.innerW / 2;
const HD = HOME_SHELL.innerD / 2;
const t = PARTITION_T;

/** Front door (local x) — entrance hall, front-left of the house. */
export const FRONT_DOOR = { x: -5.0, w: 1.3, h: 2.35 } as const;

export const HOME_WALLS: WallRun[] = [
  {
    id: 'front',
    axis: 'x',
    fixed: HD,
    from: -HW - T / 2,
    to: HW + T / 2,
    t: T,
    outward: 1,
    openings: [
      { at: -7.0, w: 0.9, sill: 1.0, head: 2.2, kind: 'window' },
      { at: FRONT_DOOR.x, w: FRONT_DOOR.w, sill: 0, head: FRONT_DOOR.h, kind: 'entry' },
      { at: 1.0, w: 1.8, sill: 0.8, head: 2.25, kind: 'window' },
      { at: 5.0, w: 1.8, sill: 0.8, head: 2.25, kind: 'window' },
    ],
  },
  {
    id: 'back',
    axis: 'x',
    fixed: -HD,
    from: -HW - T / 2,
    to: HW + T / 2,
    t: T,
    outward: -1,
    openings: [
      { at: -5.0, w: 1.4, sill: 0.9, head: 2.2, kind: 'window' },
      { at: -0.7, w: 1.2, sill: 0.9, head: 2.2, kind: 'window' },
      { at: 4.0, w: 1.4, sill: 1.15, head: 2.2, kind: 'window' },
    ],
  },
  {
    id: 'west',
    axis: 'z',
    fixed: -HW,
    from: -HD + T / 2,
    to: HD - T / 2,
    t: T,
    outward: -1,
    openings: [
      { at: -1.0, w: 1.2, sill: 0.9, head: 2.2, kind: 'window' },
      { at: 1.9, w: 0.7, sill: 1.6, head: 2.2, kind: 'window' },
    ],
  },
  {
    id: 'east',
    axis: 'z',
    fixed: HW,
    from: -HD + T / 2,
    to: HD - T / 2,
    t: T,
    outward: 1,
    openings: [
      { at: 0.6, w: 1.6, sill: 0.85, head: 2.25, kind: 'window' },
      { at: -3.6, w: 1.2, sill: 0.9, head: 2.2, kind: 'window' },
    ],
  },
  // Bedroom / hall strip | open living-kitchen
  {
    id: 'partA',
    axis: 'z',
    fixed: -2.2,
    from: -HD + T / 2,
    to: HD - T / 2,
    t,
    openings: [
      { at: -1.05, w: 1.1, sill: 0, head: 2.15, kind: 'door', hinge: 1, swing: -1 },
      { at: 5.35, w: 2.0, sill: 0, head: 2.45, kind: 'arch' },
    ],
  },
  // Bedroom south wall (en-suite bathroom door + storage back)
  {
    id: 'partB',
    axis: 'x',
    fixed: 0.2,
    from: -HW + T / 2,
    to: -2.2 - t / 2,
    t,
    openings: [{ at: -6.3, w: 1.0, sill: 0, head: 2.15, kind: 'door', hinge: -1, swing: 1 }],
  },
  // Bathroom | storage
  { id: 'partC', axis: 'z', fixed: -4.6, from: 0.2 + t / 2, to: 3.6 - t / 2, t, openings: [] },
  // Hall north wall (storage door)
  {
    id: 'partD',
    axis: 'x',
    fixed: 3.6,
    from: -HW + T / 2,
    to: -2.2 - t / 2,
    t,
    openings: [{ at: -3.4, w: 1.0, sill: 0, head: 2.15, kind: 'door', hinge: 1, swing: -1 }],
  },
];

export const HOME_ROOMS: Record<'bedroom' | 'bath' | 'storage' | 'hall' | 'living', Rect> = {
  bedroom: { x0: -HW + T / 2, x1: -2.2 - t / 2, z0: -HD + T / 2, z1: 0.2 - t / 2 },
  bath: { x0: -HW + T / 2, x1: -4.6 - t / 2, z0: 0.2 + t / 2, z1: 3.6 - t / 2 },
  storage: { x0: -4.6 + t / 2, x1: -2.2 - t / 2, z0: 0.2 + t / 2, z1: 3.6 - t / 2 },
  hall: { x0: -HW + T / 2, x1: -2.2 - t / 2, z0: 3.6 + t / 2, z1: HD - T / 2 },
  living: { x0: -2.2 + t / 2, x1: HW - T / 2, z0: -HD + T / 2, z1: HD - T / 2 },
};

const IN = { x0: -HW + T / 2, x1: HW - T / 2, z0: -HD + T / 2, z1: HD - T / 2 };
export const HOME_INNER: Rect = IN;

/** Built-in fixtures (static collision + furniture placement blockers). */
export const HOME_FIXTURES: FixtureRect[] = [
  { id: 'fridge', x0: 0.575, x1: 1.325, z0: IN.z0, z1: IN.z0 + 0.7, h: 1.85 },
  { id: 'counter', x0: 1.35, x1: IN.x1, z0: IN.z0, z1: IN.z0 + 0.64, h: 0.95 },
  { id: 'wardrobe', x0: -2.2 - t / 2 - 0.62, x1: -2.2 - t / 2, z0: -6.4, z1: -4.6, h: 2.15 },
  { id: 'night-a', x0: IN.x0, x1: IN.x0 + 0.48, z0: -4.8, z1: -4.32, h: 0.6 },
  { id: 'night-b', x0: IN.x0, x1: IN.x0 + 0.48, z0: -2.48, z1: -2.0, h: 0.6 },
  { id: 'desk', x0: -5.05, x1: -3.85, z0: 0.2 - t / 2 - 0.52, z1: 0.2 - t / 2, h: 0.8 },
  { id: 'shower-glass', x0: -6.8, x1: -6.72, z0: 2.95, z1: 3.6 - t / 2, h: 2.0 },
  { id: 'toilet', x0: -5.82, x1: -5.38, z0: 2.85, z1: 3.6 - t / 2, h: 0.8 },
  { id: 'vanity', x0: -4.6 - t / 2 - 0.5, x1: -4.6 - t / 2, z0: 1.1, z1: 1.9, h: 0.88 },
  { id: 'bath-cabinet', x0: IN.x0, x1: IN.x0 + 0.42, z0: 0.45, z1: 1.05, h: 1.7 },
  { id: 'shelves', x0: -4.6 + t / 2, x1: -4.6 + t / 2 + 0.42, z0: 0.5, z1: 2.3, h: 1.9 },
  { id: 'washer', x0: -2.2 - t / 2 - 0.62, x1: -2.2 - t / 2, z0: 0.2 + t / 2 + 0.05, z1: 0.92, h: 0.88 },
  { id: 'drums', x0: -4.5, x1: -4.0, z0: 2.85, z1: 3.35, h: 0.9 },
  { id: 'console', x0: IN.x0, x1: IN.x0 + 0.4, z0: 4.4, z1: 5.6, h: 0.85 },
  { id: 'bookshelf', x0: -2.2 + t / 2, x1: -2.2 + t / 2 + 0.36, z0: 0.3, z1: 1.5, h: 1.85 },
];

/** Solid part of a wall run: along-axis range [a, b], heights from the ground. */
export type WallPiece = { a: number; b: number; y0: number; y1: number };

export const WALL_TOP = HOME_SHELL.floorY + HOME_SHELL.wallH;

export function wallPieces(run: WallRun): WallPiece[] {
  const ops = [...run.openings].sort((p, q) => p.at - q.at);
  const out: WallPiece[] = [];
  let cur = run.from;
  for (const op of ops) {
    const a = op.at - op.w / 2;
    const b = op.at + op.w / 2;
    if (a > cur + 0.001) out.push({ a: cur, b: a, y0: 0, y1: WALL_TOP });
    if (op.sill > 0) out.push({ a, b, y0: 0, y1: HOME_FLOOR_TOP + op.sill });
    if (HOME_FLOOR_TOP + op.head < WALL_TOP - 0.001) out.push({ a, b, y0: HOME_FLOOR_TOP + op.head, y1: WALL_TOP });
    cur = b;
  }
  if (run.to > cur + 0.001) out.push({ a: cur, b: run.to, y0: 0, y1: WALL_TOP });
  return out;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
}

export function inRect(r: Rect, x: number, z: number): boolean {
  return x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
}

/** Passages that must stay free so the player can never be locked in a room. */
export const HOME_CLEARANCE: Rect[] = [
  { x0: FRONT_DOOR.x - 0.8, x1: FRONT_DOOR.x + 0.8, z0: 5.4, z1: IN.z1 },
  { x0: -3.3, x1: -1.1, z0: -1.75, z1: -0.35 },
  { x0: -3.2, x1: -1.2, z0: 4.25, z1: 6.45 },
  { x0: -6.95, x1: -5.65, z0: -0.7, z1: 1.1 },
  { x0: -4.05, x1: -2.75, z0: 2.8, z1: 4.5 },
  { x0: 0.5, x1: IN.x1, z0: IN.z0 + 0.64, z1: -5.35 },
];
