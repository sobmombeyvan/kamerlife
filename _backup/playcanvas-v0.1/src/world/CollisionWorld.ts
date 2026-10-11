import type { Vec3 } from 'playcanvas';

export type Aabb = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

export class CollisionWorld {
  private boxes: Aabb[] = [];

  clear(): void {
    this.boxes = [];
  }

  addBox(centerX: number, centerY: number, centerZ: number, halfX: number, halfY: number, halfZ: number): void {
    this.boxes.push({
      minX: centerX - halfX,
      maxX: centerX + halfX,
      minY: centerY - halfY,
      maxY: centerY + halfY,
      minZ: centerZ - halfZ,
      maxZ: centerZ + halfZ,
    });
  }

  resolveHorizontal(x: number, z: number, radius: number, y: number, height: number): { x: number; z: number } {
    let outX = x;
    let outZ = z;
    const feet = y;
    const head = y + height;

    for (const box of this.boxes) {
      if (head <= box.minY || feet >= box.maxY) continue;

      const closestX = clamp(outX, box.minX, box.maxX);
      const closestZ = clamp(outZ, box.minZ, box.maxZ);
      const dx = outX - closestX;
      const dz = outZ - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq >= radius * radius) continue;

      if (distSq < 1e-8) {
        const left = Math.abs(outX - box.minX);
        const right = Math.abs(box.maxX - outX);
        const near = Math.abs(outZ - box.minZ);
        const far = Math.abs(box.maxZ - outZ);
        const min = Math.min(left, right, near, far);
        if (min === left) outX = box.minX - radius;
        else if (min === right) outX = box.maxX + radius;
        else if (min === near) outZ = box.minZ - radius;
        else outZ = box.maxZ + radius;
      } else {
        const dist = Math.sqrt(distSq);
        const push = (radius - dist) / dist;
        outX += dx * push;
        outZ += dz * push;
      }
    }

    return { x: outX, z: outZ };
  }

  /** Returns hit distance along the segment, or null if clear. */
  raycast(origin: Vec3, direction: Vec3, maxDistance: number): number | null {
    let closest: number | null = null;

    for (const box of this.boxes) {
      const t = rayAabb(origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, box, maxDistance);
      if (t !== null && (closest === null || t < closest)) {
        closest = t;
      }
    }
    return closest;
  }

  getBoxes(): readonly Aabb[] {
    return this.boxes;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rayAabb(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  box: Aabb,
  maxDistance: number,
): number | null {
  let tMin = 0;
  let tMax = maxDistance;

  const slam = (o: number, d: number, min: number, max: number): boolean => {
    if (Math.abs(d) < 1e-8) {
      return o >= min && o <= max;
    }
    let t1 = (min - o) / d;
    let t2 = (max - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    return tMin <= tMax;
  };

  if (!slam(ox, dx, box.minX, box.maxX)) return null;
  if (!slam(oy, dy, box.minY, box.maxY)) return null;
  if (!slam(oz, dz, box.minZ, box.maxZ)) return null;
  return tMin >= 0 ? tMin : null;
}
