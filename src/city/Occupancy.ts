/**
 * Keep-out registry for procedural fill: landmarks, hand-placed buildings, life spots,
 * taxi stands and plazas register here so generated blocks never overlap them.
 */
type Rect = { minX: number; maxX: number; minZ: number; maxZ: number; tag: string };

const CELL = 64;
const grid = new Map<number, Rect[]>();
const all: Rect[] = [];

function key(ix: number, iz: number): number {
  return (ix + 1000) * 4096 + (iz + 1000);
}

export function occupyRect(cx: number, cz: number, hw: number, hd: number, tag = 'static'): void {
  const r: Rect = { minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd, tag };
  all.push(r);
  for (let ix = Math.floor(r.minX / CELL); ix <= Math.floor(r.maxX / CELL); ix++) {
    for (let iz = Math.floor(r.minZ / CELL); iz <= Math.floor(r.maxZ / CELL); iz++) {
      const k = key(ix, iz);
      const list = grid.get(k);
      if (list) list.push(r);
      else grid.set(k, [r]);
    }
  }
}

/** Rotated footprint → conservative AABB. */
export function occupyFootprint(cx: number, cz: number, hw: number, hd: number, yaw: number, tag = 'static'): void {
  const c = Math.abs(Math.cos(yaw));
  const s = Math.abs(Math.sin(yaw));
  occupyRect(cx, cz, hw * c + hd * s, hw * s + hd * c, tag);
}

export function isFree(cx: number, cz: number, hw: number, hd: number, pad = 0.5): boolean {
  const minX = cx - hw - pad;
  const maxX = cx + hw + pad;
  const minZ = cz - hd - pad;
  const maxZ = cz + hd + pad;
  for (let ix = Math.floor(minX / CELL); ix <= Math.floor(maxX / CELL); ix++) {
    for (let iz = Math.floor(minZ / CELL); iz <= Math.floor(maxZ / CELL); iz++) {
      const list = grid.get(key(ix, iz));
      if (!list) continue;
      for (const r of list) {
        if (maxX > r.minX && minX < r.maxX && maxZ > r.minZ && minZ < r.maxZ) return false;
      }
    }
  }
  return true;
}

export function occupiedCount(): number {
  return all.length;
}

export function clearOccupancy(): void {
  grid.clear();
  all.length = 0;
}
