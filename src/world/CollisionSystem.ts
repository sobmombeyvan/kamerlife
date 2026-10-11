export type Aabb = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

const CELL = 48;

/**
 * Spatial-hashed AABB collisions — only nearby cells are tested.
 */
export class CollisionSystem {
  private readonly grid = new Map<string, Aabb[]>();
  /** Temporary blockers (e.g. closed house door) keyed by id. */
  private readonly dynamic = new Map<string, Aabb>();

  clear(): void {
    this.grid.clear();
    this.dynamic.clear();
  }

  setDynamicBox(
    id: string,
    cx: number,
    cy: number,
    cz: number,
    hx: number,
    hy: number,
    hz: number,
  ): void {
    this.dynamic.set(id, {
      minX: cx - hx,
      maxX: cx + hx,
      minY: cy - hy,
      maxY: cy + hy,
      minZ: cz - hz,
      maxZ: cz + hz,
    });
  }

  clearDynamicBox(id: string): void {
    this.dynamic.delete(id);
  }

  addBox(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number): void {
    const box: Aabb = {
      minX: cx - hx,
      maxX: cx + hx,
      minY: cy - hy,
      maxY: cy + hy,
      minZ: cz - hz,
      maxZ: cz + hz,
    };
    const x0 = Math.floor(box.minX / CELL);
    const x1 = Math.floor(box.maxX / CELL);
    const z0 = Math.floor(box.minZ / CELL);
    const z1 = Math.floor(box.maxZ / CELL);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const key = `${ix},${iz}`;
        let list = this.grid.get(key);
        if (!list) {
          list = [];
          this.grid.set(key, list);
        }
        list.push(box);
      }
    }
  }

  resolve(x: number, z: number, radius: number, y: number, height: number): { x: number; z: number } {
    let outX = x;
    let outZ = z;
    const feet = y;
    const head = y + height;
    const pad = radius + 0.5;
    const x0 = Math.floor((outX - pad) / CELL);
    const x1 = Math.floor((outX + pad) / CELL);
    const z0 = Math.floor((outZ - pad) / CELL);
    const z1 = Math.floor((outZ + pad) / CELL);

    const pushOut = (box: Aabb) => {
      if (head <= box.minY || feet >= box.maxY) return;
      const closestX = clamp(outX, box.minX, box.maxX);
      const closestZ = clamp(outZ, box.minZ, box.maxZ);
      const dx = outX - closestX;
      const dz = outZ - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq >= radius * radius) return;

      if (distSq < 1e-8) {
        const left = Math.abs(outX - box.minX);
        const right = Math.abs(box.maxX - outX);
        const near = Math.abs(outZ - box.minZ);
        const far = Math.abs(box.maxZ - outZ);
        const m = Math.min(left, right, near, far);
        if (m === left) outX = box.minX - radius;
        else if (m === right) outX = box.maxX + radius;
        else if (m === near) outZ = box.minZ - radius;
        else outZ = box.maxZ + radius;
      } else {
        const dist = Math.sqrt(distSq);
        const push = (radius - dist) / dist;
        outX += dx * push;
        outZ += dz * push;
      }
    };

    // Two passes reduce residual overlap when cornered
    for (let pass = 0; pass < 2; pass++) {
      for (let ix = x0; ix <= x1; ix++) {
        for (let iz = z0; iz <= z1; iz++) {
          const list = this.grid.get(`${ix},${iz}`);
          if (!list) continue;
          for (const box of list) pushOut(box);
        }
      }
      for (const box of this.dynamic.values()) pushOut(box);
    }
    return { x: outX, z: outZ };
  }

  /**
   * Oriented vehicle footprint (faces local +Z). Samples several points
   * so long cars don't clip through walls with a single circle.
   */
  resolveVehicle(
    x: number,
    z: number,
    yaw: number,
    halfLength: number,
    halfWidth: number,
    y = 0,
    height = 1.8,
  ): { x: number; z: number; hit: boolean } {
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const pointR = Math.max(0.45, halfWidth * 0.55);
    const samples: Array<[number, number]> = [
      [0, 0],
      [0, halfLength * 0.92],
      [0, -halfLength * 0.92],
      [0, halfLength * 0.45],
      [0, -halfLength * 0.45],
      [halfWidth * 0.75, halfLength * 0.7],
      [-halfWidth * 0.75, halfLength * 0.7],
      [halfWidth * 0.75, -halfLength * 0.7],
      [-halfWidth * 0.75, -halfLength * 0.7],
      [halfWidth * 0.85, 0],
      [-halfWidth * 0.85, 0],
    ];

    let cx = x;
    let cz = z;
    let hit = false;

    for (let iter = 0; iter < 3; iter++) {
      for (const [lx, lz] of samples) {
        const wx = cx + cos * lx + sin * lz;
        const wz = cz - sin * lx + cos * lz;
        const r = this.resolve(wx, wz, pointR, y, height);
        const px = r.x - wx;
        const pz = r.z - wz;
        if (px * px + pz * pz > 1e-8) {
          hit = true;
          cx += px;
          cz += pz;
        }
      }
    }

    return { x: cx, z: cz, hit };
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
