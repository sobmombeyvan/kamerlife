/** Palais de l’Unité — restricted military perimeter (game sim). */

export const PALACE = {
  cx: 140,
  cz: -655,
  /** North gate wall (city / +Z side). */
  gateZ: -599,
  wallHalfW: 66,
  southZ: -707,
  warnHalfW: 20,
  /** Approach strip from the city, outside the gate. */
  warnOuterZ: -578,
  gapHalf: 1.6,
} as const;

export type PalaceZone = 'safe' | 'warn' | 'fire';

export type PalaceGuardPost = { x: number; z: number; rotY: number };

/** Posts shared by the landmark builder and muzzle tracers. */
export const PALACE_GUARDS: PalaceGuardPost[] = [
  { x: PALACE.cx - 3.2, z: PALACE.gateZ + 3.2, rotY: Math.PI },
  { x: PALACE.cx + 3.2, z: PALACE.gateZ + 3.2, rotY: Math.PI },
  { x: PALACE.cx - 8.5, z: PALACE.gateZ + 1.6, rotY: Math.PI + 0.18 },
  { x: PALACE.cx + 8.5, z: PALACE.gateZ + 1.6, rotY: Math.PI - 0.18 },
  { x: PALACE.cx - 18, z: PALACE.gateZ + 1.2, rotY: Math.PI + 0.08 },
  { x: PALACE.cx + 18, z: PALACE.gateZ + 1.2, rotY: Math.PI - 0.08 },
  { x: PALACE.cx - 10, z: PALACE.gateZ - 8, rotY: Math.PI },
  { x: PALACE.cx + 10, z: PALACE.gateZ - 8, rotY: Math.PI },
  { x: PALACE.cx - 64, z: PALACE.cz + 22, rotY: -Math.PI / 2 },
  { x: PALACE.cx + 64, z: PALACE.cz + 22, rotY: Math.PI / 2 },
  { x: PALACE.cx - 64, z: PALACE.cz - 8, rotY: -Math.PI / 2 },
  { x: PALACE.cx + 64, z: PALACE.cz - 8, rotY: Math.PI / 2 },
];

export function palaceZone(x: number, z: number): PalaceZone {
  const dx = Math.abs(x - PALACE.cx);
  const insideWalls = dx < PALACE.wallHalfW;
  const onGrounds = z < PALACE.gateZ - 0.35 && z > PALACE.southZ - 2;
  if (insideWalls && onGrounds) return 'fire';
  const approach =
    z >= PALACE.gateZ - 0.35 && z < PALACE.warnOuterZ && dx < PALACE.warnHalfW;
  if (approach) return 'warn';
  return 'safe';
}

export function palaceEjectPos(): { x: number; z: number } {
  return { x: PALACE.cx, z: PALACE.gateZ + 16 };
}

export function nearestPalaceMuzzles(
  x: number,
  z: number,
  n = 2,
): { x: number; y: number; z: number }[] {
  return [...PALACE_GUARDS]
    .map((g) => ({ g, d: (g.x - x) * (g.x - x) + (g.z - z) * (g.z - z) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map(({ g }) => ({ x: g.x, y: 1.48, z: g.z }));
}
