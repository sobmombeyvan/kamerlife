export type Aabb = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  tag?: string;
};

const CELL = 48;

/**
 * Spatial-hashed AABB collisions — only nearby cells are tested.
 */
export class CollisionSystem {
  private readonly grid = new Map<string, Aabb[]>();
  /** Temporary blockers (e.g. closed house door) keyed by id. */
  private readonly dynamic = new Map<string, Aabb>();
  private readonly tagCells = new Map<string, Set<string>>();

  clear(): void {
    this.grid.clear();
    this.dynamic.clear();
    this.tagCells.clear();
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

  /** Oriented car / bus footprint as a world AABB the walker cannot step through. */
  setVehicleBox(
    id: string,
    x: number,
    z: number,
    yaw: number,
    halfL: number,
    halfW: number,
    height = 1.55,
  ): void {
    const c = Math.abs(Math.cos(yaw));
    const s = Math.abs(Math.sin(yaw));
    const hx = halfL * s + halfW * c + 0.08;
    const hz = halfL * c + halfW * s + 0.08;
    this.setDynamicBox(id, x, height * 0.5, z, hx, height * 0.5, hz);
  }

  /** Drop every box added with `tag` (layers rebuilt when settings change, e.g. trees). */
  removeTag(tag: string): void {
    const cells = this.tagCells.get(tag);
    if (!cells) return;
    for (const key of cells) {
      const list = this.grid.get(key);
      if (!list) continue;
      const kept = list.filter((b) => b.tag !== tag);
      if (kept.length) this.grid.set(key, kept);
      else this.grid.delete(key);
    }
    this.tagCells.delete(tag);
  }

  addBox(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, tag?: string): void {
    const box: Aabb = {
      tag,
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
        if (tag) {
          let cells = this.tagCells.get(tag);
          if (!cells) this.tagCells.set(tag, (cells = new Set()));
          cells.add(key);
        }
      }
    }
  }

  /**
   * First hit along segment a→b as a fraction in [0, 1] (1 = clear). Boxes that
   * contain `a`, low curbs, poles and tree trunks are ignored (camera boom use).
   */
  segmentFraction(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    let best = 1;
    const test = (box: Aabb) => {
      if (box.maxY < 0.6 || box.tag?.startsWith('trees:')) return;
      if (box.maxX - box.minX < 1 && box.maxZ - box.minZ < 1) return;
      if (ax > box.minX && ax < box.maxX && ay > box.minY && ay < box.maxY && az > box.minZ && az < box.maxZ) return;
      let t0 = 0;
      let t1 = best;
      const slab = (o: number, d: number, mn: number, mx: number): boolean => {
        if (Math.abs(d) < 1e-9) return o >= mn && o <= mx;
        let ta = (mn - o) / d;
        let tb = (mx - o) / d;
        if (ta > tb) [ta, tb] = [tb, ta];
        if (ta > t0) t0 = ta;
        if (tb < t1) t1 = tb;
        return t0 <= t1;
      };
      if (slab(ax, dx, box.minX, box.maxX) && slab(ay, dy, box.minY, box.maxY) && slab(az, dz, box.minZ, box.maxZ)) best = t0;
    };
    const x0 = Math.floor(Math.min(ax, bx) / CELL);
    const x1 = Math.floor(Math.max(ax, bx) / CELL);
    const z0 = Math.floor(Math.min(az, bz) / CELL);
    const z1 = Math.floor(Math.max(az, bz) / CELL);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const list = this.grid.get(`${ix},${iz}`);
        if (list) for (const box of list) test(box);
      }
    }
    for (const box of this.dynamic.values()) test(box);
    return best;
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
      // Thin walkable slabs (stairs / étages): allow climbing onto the top.
      if (box.tag === 'walk' && feet + 0.05 >= box.maxY - 1.15 && feet < box.maxY + 0.3) return;
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
   * Highest walkable top under the player. Ignores ceilings above `playerY + climb`.
   */
  supportY(x: number, z: number, radius: number, playerY: number, fallback = 0, climb = 1.15): number {
    let best = fallback;
    const pad = radius + 0.2;
    const x0 = Math.floor((x - pad) / CELL);
    const x1 = Math.floor((x + pad) / CELL);
    const z0 = Math.floor((z - pad) / CELL);
    const z1 = Math.floor((z + pad) / CELL);
    const r2 = radius * radius;
    const consider = (box: Aabb) => {
      if (box.tag !== 'walk') return;
      const closestX = clamp(x, box.minX, box.maxX);
      const closestZ = clamp(z, box.minZ, box.maxZ);
      const dx = x - closestX;
      const dz = z - closestZ;
      if (dx * dx + dz * dz > r2) return;
      const top = box.maxY;
      if (top > playerY + climb) return;
      if (top > best) best = top;
    };
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const list = this.grid.get(`${ix},${iz}`);
        if (list) for (const box of list) consider(box);
      }
    }
    for (const box of this.dynamic.values()) consider(box);
    return best;
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
