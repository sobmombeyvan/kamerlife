import type * as THREE from 'three';
import type { CollisionSystem } from '../world/CollisionSystem';
import type { FurnPose, HomeDecorState } from './HomeDecor';
import { HOME_CLEARANCE, HOME_FIXTURES, HOME_INNER, HOME_WALLS, rectsOverlap, type Rect } from './homeLayout';

export type FurnFoot = { hx: number; hy: number; hz: number };

const FURN_FOOT: Record<string, FurnFoot | null> = {
  bed: { hx: 0.92, hy: 0.35, hz: 1.12 },
  sofa: { hx: 1.15, hy: 0.4, hz: 0.47 },
  table: { hx: 0.56, hy: 0.24, hz: 0.31 },
  tv: { hx: 0.9, hy: 0.3, hz: 0.23 },
  dining: { hx: 0.6, hy: 0.38, hz: 0.38 },
  rug: null,
  plant: null,
  plant2: null,
  lamp: null,
  art: null,
};

const TRACKED_IDS = Object.keys(FURN_FOOT);

export function footFor(id: string): FurnFoot | null {
  return FURN_FOOT[id] ?? null;
}

function extentsForYaw(foot: { hx: number; hz: number }, yaw: number): { hx: number; hz: number } {
  const swap = Math.abs(Math.sin(yaw)) > Math.abs(Math.cos(yaw));
  return swap ? { hx: foot.hz, hz: foot.hx } : { hx: foot.hx, hz: foot.hz };
}

const WALL_RECTS: Rect[] = HOME_WALLS.map((w) =>
  w.axis === 'x'
    ? { x0: w.from, x1: w.to, z0: w.fixed - w.t / 2, z1: w.fixed + w.t / 2 }
    : { x0: w.fixed - w.t / 2, x1: w.fixed + w.t / 2, z0: w.from, z1: w.to },
);

/**
 * A piece with a collision footprint may not overlap walls, built-ins or the door passages.
 * Pieces without one (rug, plants, lamp, art) never block the player, so any spot inside works.
 * Coordinates are world space; `cx/cz` is the house centre.
 */
export function poseFits(id: string, x: number, z: number, yaw: number, cx: number, cz: number): boolean {
  const lx = x - cx;
  const lz = z - cz;
  const foot = FURN_FOOT[id];
  if (!foot) {
    return lx > HOME_INNER.x0 && lx < HOME_INNER.x1 && lz > HOME_INNER.z0 && lz < HOME_INNER.z1;
  }
  const { hx, hz } = extentsForYaw(foot, yaw);
  const r: Rect = { x0: lx - hx, x1: lx + hx, z0: lz - hz, z1: lz + hz };
  if (r.x0 < HOME_INNER.x0 || r.x1 > HOME_INNER.x1 || r.z0 < HOME_INNER.z0 || r.z1 > HOME_INNER.z1) return false;
  for (const w of WALL_RECTS) if (rectsOverlap(r, w)) return false;
  for (const f of HOME_FIXTURES) if (rectsOverlap(r, f)) return false;
  for (const c of HOME_CLEARANCE) if (rectsOverlap(r, c)) return false;
  return true;
}

/** `poseFits` plus no overlap with the other footprinted pieces already placed in the room. */
export function placementFits(piece: THREE.Object3D, layer: THREE.Object3D, cx: number, cz: number): boolean {
  const id = piece.userData.furnId as string | undefined;
  if (!id) return true;
  const { x, z } = piece.position;
  const yaw = piece.rotation.y;
  if (!poseFits(id, x, z, yaw, cx, cz)) return false;
  const foot = FURN_FOOT[id];
  if (!foot) return true;
  const a = extentsForYaw(foot, yaw);
  const ra: Rect = { x0: x - a.hx, x1: x + a.hx, z0: z - a.hz, z1: z + a.hz };
  for (const other of layer.children) {
    if (other === piece) continue;
    const oid = other.userData.furnId as string | undefined;
    const of = oid ? FURN_FOOT[oid] : null;
    if (!of) continue;
    const b = extentsForYaw(of, other.rotation.y);
    const rb: Rect = {
      x0: other.position.x - b.hx,
      x1: other.position.x + b.hx,
      z0: other.position.z - b.hz,
      z1: other.position.z + b.hz,
    };
    if (rectsOverlap(ra, rb)) return false;
  }
  return true;
}

/**
 * Names a decor piece, applies the saved pose when it still fits the floor plan
 * (layouts saved before the remodel can point into a new wall), and reports which pose won.
 */
export function tagMovable(
  piece: THREE.Object3D,
  id: string,
  state: HomeDecorState,
  cx: number,
  cz: number,
): FurnPose | null {
  piece.name = `furn-${id}`;
  piece.userData.movable = true;
  piece.userData.furnId = id;
  piece.userData.foot = FURN_FOOT[id] ?? null;
  const saved = state.layout?.[id];
  if (!saved || typeof saved.x !== 'number' || typeof saved.z !== 'number') return null;
  const yaw = typeof saved.yaw === 'number' ? saved.yaw : piece.rotation.y;
  if (!poseFits(id, saved.x, saved.z, yaw, cx, cz)) return null;
  piece.position.x = saved.x;
  piece.position.z = saved.z;
  piece.rotation.y = yaw;
  return saved;
}

export function syncFurnitureCollisions(houseRoot: THREE.Object3D, collisions: CollisionSystem, floorY: number): void {
  const layer = houseRoot.getObjectByName('home-decor-layer');
  const seen = new Set<string>();
  if (layer) {
    for (const child of layer.children) {
      const id = child.userData.furnId as string | undefined;
      if (!id) continue;
      seen.add(id);
      applyFurnitureCollision(child, collisions, floorY);
    }
  }
  for (const id of TRACKED_IDS) {
    if (!seen.has(id)) collisions.clearDynamicBox(`furn-${id}`);
  }
}

export function applyFurnitureCollision(piece: THREE.Object3D, collisions: CollisionSystem, floorY: number): void {
  const id = piece.userData.furnId as string | undefined;
  if (!id) return;
  const foot = piece.userData.foot as FurnFoot | null | undefined;
  if (!foot) {
    collisions.clearDynamicBox(`furn-${id}`);
    return;
  }
  const { hx, hz } = extentsForYaw(foot, piece.rotation.y);
  collisions.setDynamicBox(`furn-${id}`, piece.position.x, floorY + foot.hy, piece.position.z, hx, foot.hy, hz);
}
