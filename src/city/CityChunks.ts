import * as THREE from 'three';
import { GraphicsConfig } from '../config/GraphicsConfig';
import type { CollisionSystem } from '../world/CollisionSystem';
import { Frame, KitBatch } from './Batch';
import { buildPlan, compoundWallBase, newBatches, type BuildingPlan } from './BuildingKit';
import { CHUNK, CityPlan, type BlockPlan, type Special, type TreeSpot } from './CityPlan';
import { facadeMaterial } from './facadeAtlas';
import { KIT_UV, kitMaterial, poolMaterial, signalMaterial, signMaterial, type KitKind } from './kitMaterials';
import { hash2, mulberry32, range } from './rng';
import { blockGround, buildStreets, setTreeHook, type ChunkBatches } from './StreetKit';
import { buildFarTree, buildTree } from './Vegetation';
import { gridAxes, ROAD_GRID } from '../roads/CityRoadPlan';

type ChunkState = {
  key: string;
  cx: number;
  cz: number;
  x: number;
  z: number;
  base: THREE.Group | null;
  far: THREE.Mesh | null;
  detail: THREE.Group | null;
  /** Previous build kept on screen until its replacement is ready (settings rebuild). */
  staleBase: THREE.Group | null;
  staleDetail: THREE.Group | null;
};

function newChunkBatches(): ChunkBatches {
  return {
    ...newBatches(),
    leaf: new KitBatch(),
    asphalt: new KitBatch(),
    walk: new KitBatch(),
    grass: new KitBatch(),
    pool: new KitBatch(),
    signal: new KitBatch(),
  };
}

const KIT_KEYS: KitKind[] = ['kit', 'metal', 'tin', 'glow', 'ground', 'leaf', 'asphalt', 'walk', 'grass'];
const SHADOW_CASTERS = new Set<string>(['facade', 'kit', 'metal', 'tin', 'leaf']);

function meshesFrom(B: ChunkBatches, name: string): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.matrixAutoUpdate = false;
  const add = (geo: THREE.BufferGeometry | null, mat: THREE.Material, key: string) => {
    if (!geo) return;
    const m = new THREE.Mesh(geo, mat);
    m.name = key;
    m.matrixAutoUpdate = false;
    m.castShadow = SHADOW_CASTERS.has(key);
    m.receiveShadow = key !== 'glow' && key !== 'pool' && key !== 'sign' && key !== 'signal';
    if (key === 'pool') m.renderOrder = 2;
    g.add(m);
  };
  add(B.facade.build(), facadeMaterial(), 'facade');
  for (const k of KIT_KEYS) add((B[k] as KitBatch).build(KIT_UV[k]), kitMaterial(k), k);
  add(B.pool.build(1), poolMaterial(), 'pool');
  add(B.signal.build(1), signalMaterial(), 'signal');
  add(B.sign.build(), signMaterial(), 'sign');
  return g;
}

function disposeGroup(g: THREE.Object3D | null): void {
  if (!g) return;
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
  g.removeFromParent();
}

/**
 * Streams the planned city in 144 m chunks: a cheap base layer (roads, facades, roofs, far
 * trees) out to the view distance and a detail layer (street furniture, balconies, signs,
 * full trees) close to the camera. Chunks are built lazily, one at a time, and disposed when
 * the camera moves away.
 */
export class CityChunks {
  readonly group = new THREE.Group();
  private readonly chunks = new Map<string, ChunkState>();
  /** Chunks whose detail collisions are already in the collision system. */
  private readonly collided = new Set<string>();
  private acc = 1;
  private queue: Array<{ c: ChunkState; layer: 'base' | 'detail'; d: number }> = [];
  private lastX = Infinity;
  private lastZ = Infinity;
  builds = 0;

  constructor(
    private readonly plan: CityPlan,
    private readonly collisions: CollisionSystem,
  ) {
    this.group.name = 'city-chunks';
    this.group.matrixAutoUpdate = false;
  }

  get detailDistance(): number {
    return Math.max(150, Math.min(380, GraphicsConfig.viewDistance * 0.4));
  }

  get baseDistance(): number {
    return GraphicsConfig.viewDistance + CHUNK * 0.6;
  }

  private chunkAt(cx: number, cz: number): ChunkState {
    const key = CityPlan.chunkKey(cx, cz);
    let c = this.chunks.get(key);
    if (!c) {
      c = { key, cx, cz, x: cx * CHUNK + CHUNK / 2, z: cz * CHUNK + CHUNK / 2, base: null, far: null, detail: null, staleBase: null, staleDetail: null };
      this.chunks.set(key, c);
    }
    return c;
  }

  /** Build everything the camera needs right now (loading screen / teleport). */
  warm(x: number, z: number): void {
    this.refresh(x, z);
    const t0 = performance.now();
    for (const job of this.queue) {
      if (job.d > this.detailDistance + CHUNK && job.layer === 'detail') continue;
      if (job.d > 420 && performance.now() - t0 > 2500) break;
      this.run(job);
    }
    this.queue.length = 0;
    this.refresh(x, z);
  }

  update(dt: number, x: number, z: number): void {
    this.acc += dt;
    const moved = Math.hypot(x - this.lastX, z - this.lastZ);
    if (this.acc > 0.5 || moved > 24) {
      this.acc = 0;
      this.refresh(x, z);
    }
    const t0 = performance.now();
    let n = 0;
    while (this.queue.length && n < 3) {
      const job = this.queue.shift()!;
      // re-check: the camera may have moved since queuing
      const d = Math.hypot(job.c.x - x, job.c.z - z);
      if (job.layer === 'detail' && d > this.detailDistance + 40) continue;
      if (job.layer === 'base' && d > this.baseDistance + 60) continue;
      this.run(job);
      n++;
      if (performance.now() - t0 > 6) break;
    }
  }

  private refresh(x: number, z: number): void {
    this.lastX = x;
    this.lastZ = z;
    const baseD = this.baseDistance;
    const detD = this.detailDistance;
    const r = Math.ceil(baseD / CHUNK) + 1;
    const ccx = Math.floor(x / CHUNK);
    const ccz = Math.floor(z / CHUNK);
    const lim = Math.ceil(gridAxes()[gridAxes().length - 1]! / CHUNK);
    const jobs: typeof this.queue = [];
    for (let i = -r; i <= r; i++) {
      for (let j = -r; j <= r; j++) {
        const cx = ccx + i;
        const cz = ccz + j;
        if (Math.abs(cx) > lim + 1 || Math.abs(cz) > lim + 1) continue;
        const cxm = cx * CHUNK + CHUNK / 2;
        const czm = cz * CHUNK + CHUNK / 2;
        // nearest point of the chunk square
        const dx = Math.max(Math.abs(x - cxm) - CHUNK / 2, 0);
        const dz = Math.max(Math.abs(z - czm) - CHUNK / 2, 0);
        const d = Math.hypot(dx, dz);
        if (d > baseD) continue;
        const c = this.chunkAt(cx, cz);
        if (!c.base) jobs.push({ c, layer: 'base', d });
        if (d < detD && !c.detail) jobs.push({ c, layer: 'detail', d: d + 30 });
      }
    }
    // unload
    for (const c of this.chunks.values()) {
      const dx = Math.max(Math.abs(x - c.x) - CHUNK / 2, 0);
      const dz = Math.max(Math.abs(z - c.z) - CHUNK / 2, 0);
      const d = Math.hypot(dx, dz);
      // a stale layer that will not be rebuilt at this distance goes now
      if (c.staleDetail && d > detD) {
        disposeGroup(c.staleDetail);
        c.staleDetail = null;
      }
      if (c.staleBase && d > baseD) {
        disposeGroup(c.staleBase);
        c.staleBase = null;
      }
      if ((c.detail || c.staleDetail) && d > detD + 60) {
        disposeGroup(c.detail);
        disposeGroup(c.staleDetail);
        c.detail = null;
        c.staleDetail = null;
      }
      if ((c.base || c.staleBase) && d > baseD + 90) {
        disposeGroup(c.base);
        disposeGroup(c.staleBase);
        c.base = null;
        c.staleBase = null;
        c.far = null;
      }
      if (c.far) c.far.visible = !c.detail;
    }
    jobs.sort((a, b) => a.d - b.d);
    this.queue = jobs;
  }

  private run(job: { c: ChunkState; layer: 'base' | 'detail' }): void {
    const c = job.c;
    if (job.layer === 'base') {
      if (c.base) return;
      this.buildBase(c);
    } else {
      if (c.detail) return;
      if (!c.base) this.buildBase(c);
      this.buildDetail(c);
    }
    this.builds++;
  }

  /** Drop every chunk (graphics settings that change content, e.g. vegetation density). */
  rebuildAll(): void {
    for (const c of this.chunks.values()) {
      if (c.base) {
        disposeGroup(c.staleBase);
        c.staleBase = c.base;
      }
      if (c.detail) {
        disposeGroup(c.staleDetail);
        c.staleDetail = c.detail;
      }
      c.base = null;
      c.detail = null;
      c.far = null;
    }
    this.lastX = Infinity;
    this.acc = 1;
  }

  stats(): { chunks: number; base: number; detail: number } {
    let base = 0;
    let detail = 0;
    for (const c of this.chunks.values()) {
      if (c.base) base++;
      if (c.detail) detail++;
    }
    return { chunks: this.chunks.size, base, detail };
  }

  // -------------------------------------------------------------------------

  private buildBase(c: ChunkState): void {
    const B = newChunkBatches();
    const far = new KitBatch();
    const { blocks, extras } = this.plan.chunk(c.cx, c.cz);
    setTreeHook((t) => buildFarTree(far, t));
    buildStreets({ B, plan: this.plan, collisions: null, vegetation: GraphicsConfig.vegetationDensity, base: true }, c.cx, c.cz);
    setTreeHook(null);
    for (const b of blocks) {
      blockGround(B, b.gx, b.gx + ROAD_GRID, b.gz, b.gz + ROAD_GRID, b.zone);
      for (const g of b.grounds) B.ground.flat(new Frame(), g.x - g.hw, g.x + g.hw, g.z - g.hd, g.z + g.hd, 0.045, g.color);
      for (const s of b.specials) special(B, s, true);
      for (const p of b.buildings) this.plot(B, p, true);
      for (const t of this.treesOf(b)) buildFarTree(far, t);
    }
    for (const p of extras) this.plot(B, p, true);
    const g = meshesFrom(B, `chunk-${c.key}-base`);
    const farGeo = far.build(KIT_UV.leaf);
    if (farGeo) {
      const m = new THREE.Mesh(farGeo, kitMaterial('leaf'));
      m.name = 'far-trees';
      m.matrixAutoUpdate = false;
      m.castShadow = true;
      g.add(m);
      c.far = m;
      m.visible = !c.detail;
    }
    this.group.add(g);
    c.base = g;
    disposeGroup(c.staleBase);
    c.staleBase = null;
  }

  private buildDetail(c: ChunkState): void {
    const B = newChunkBatches();
    const { blocks, extras } = this.plan.chunk(c.cx, c.cz);
    const collide = !this.collided.has(c.key);
    const collisions = collide ? this.collisions : null;
    // trunks follow the trees actually drawn at the current vegetation density
    const treeTag = `trees:${c.key}`;
    this.collisions.removeTag(treeTag);
    const treeBox = (x: number, z: number, r: number) => this.collisions.addBox(x, 1.5, z, r, 1.5, r, treeTag);
    setTreeHook((t) => buildTree(B.kit, B.leaf, t));
    buildStreets({ B, plan: this.plan, collisions, treeBox, vegetation: GraphicsConfig.vegetationDensity, base: false }, c.cx, c.cz);
    setTreeHook(null);
    for (const b of blocks) {
      for (const s of b.specials) special(B, s, false);
      for (const p of b.buildings) this.plot(B, p, false);
      for (const t of this.treesOf(b)) {
        buildTree(B.kit, B.leaf, t);
        if (t.kind !== 3) treeBox(t.x, t.z, 0.3 * t.s);
      }
    }
    for (const p of extras) this.plot(B, p, false);
    if (collide) this.collided.add(c.key);
    const g = meshesFrom(B, `chunk-${c.key}-detail`);
    this.group.add(g);
    c.detail = g;
    if (c.far) c.far.visible = false;
    disposeGroup(c.staleDetail);
    c.staleDetail = null;
  }

  private treesOf(b: BlockPlan): TreeSpot[] {
    const dens = GraphicsConfig.vegetationDensity;
    if (dens >= 0.999) return b.trees;
    return b.trees.filter((t) => (hash2(Math.round(t.x * 7), Math.round(t.z * 7), 3) % 1000) / 1000 < dens);
  }

  private plot(B: ChunkBatches, p: BuildingPlan, base: boolean): void {
    buildPlan(B, p, base);
    if (base && p.compound) {
      const f = new Frame(p.x, p.z, p.yaw);
      const k = p.seed % 10;
      const yard =
        p.arch === 'villa' ? (k < 6 ? 0x7f8f5e : 0x9a968c) : p.arch === 'warehouse' ? 0x86837c : k < 3 ? 0x928e86 : k < 6 ? 0x7c8556 : k < 8 ? 0x9c7a5c : 0x8a6a4e;
      B.ground.box(f, p.compound.cx, 0.024, p.compound.cz, p.compound.hw * 2 - 0.2, 0.048, p.compound.hd * 2 - 0.2, yard);
      compoundWallBase(B, p);
    }
  }
}

// ---------------------------------------------------------------------------

function special(B: ChunkBatches, s: Special, base: boolean): void {
  const r = mulberry32(s.seed);
  const f = new Frame(s.x, s.z, 0);
  const { hw, hd } = s;
  switch (s.kind) {
    case 'park': {
      if (base) {
        B.grass.flat(f, -hw, hw, -hd, hd, 0.045, 0x8fb069);
        B.walk.flat(f, -1.3, 1.3, -hd, hd, 0.06, 0xcfc6b4);
        B.walk.flat(f, -hw, hw, -1.3, 1.3, 0.06, 0xcfc6b4);
        B.kit.cylinder(f, 0, 0, 0, 3.2, 3.2, 0.45, 0xb9b1a3, 16);
        B.kit.cylinder(f, 0, 0.45, 0, 2.7, 2.7, 0.05, 0x5a88a0, 16);
        return;
      }
      for (const [x, z] of [[-4, 6], [4, -6], [6, 4], [-6, -4]] as const) {
        B.kit.box(f, x, 0.42, z, 1.8, 0.08, 0.5, 0x7a5a3a);
        B.metal.box(f, x - 0.7, 0.21, z, 0.06, 0.42, 0.45, 0x333333);
        B.metal.box(f, x + 0.7, 0.21, z, 0.06, 0.42, 0.45, 0x333333);
      }
      for (const [x, z] of [[-hw + 2, -hd + 2], [hw - 2, hd - 2], [-hw + 2, hd - 2], [hw - 2, -hd + 2]] as const) {
        B.metal.cylinder(f, x, 0, z, 0.06, 0.05, 4, 0x2f3437, 6);
        B.glow.box(f, x, 4.05, z, 0.35, 0.3, 0.35, 0xffe0a0);
        B.pool.quadWorld([s.x + x - 5, 0.07, s.z + z - 5], [s.x + x - 5, 0.07, s.z + z + 5], [s.x + x + 5, 0.07, s.z + z + 5], [s.x + x + 5, 0.07, s.z + z - 5], 0xd08a3a, 1, 1);
      }
      return;
    }
    case 'pitch': {
      const w = Math.min(hw - 2, 26);
      const d = Math.min(hd - 2, 17);
      if (base) {
        B.ground.flat(f, -hw, hw, -hd, hd, 0.045, 0x9c6b47);
        const line = (u0: number, u1: number, v0: number, v1: number) => B.ground.flat(f, u0, u1, v0, v1, 0.052, 0xe8e2d6);
        line(-w, w, -d - 0.06, -d + 0.06);
        line(-w, w, d - 0.06, d + 0.06);
        line(-w - 0.06, -w + 0.06, -d, d);
        line(w - 0.06, w + 0.06, -d, d);
        line(-0.06, 0.06, -d, d);
        return;
      }
      for (const sgn of [-1, 1]) {
        const x = sgn * w;
        B.metal.box(f, x, 1.2, -3.6, 0.12, 2.4, 0.12, 0xf2f2f2);
        B.metal.box(f, x, 1.2, 3.6, 0.12, 2.4, 0.12, 0xf2f2f2);
        B.metal.box(f, x, 2.4, 0, 0.12, 0.12, 7.3, 0xf2f2f2);
      }
      // wooden bench stand on one side
      for (let i = 0; i < 3; i++) B.kit.box(f, 0, 0.3 + i * 0.35, -d - 2 - i * 0.6, w, 0.1, 0.5, 0x7a5a3a);
      return;
    }
    case 'parking': {
      if (base) {
        B.asphalt.flat(f, -hw, hw, -hd, hd, 0.045, 0x8f9193);
        for (let x = -hw + 2.6; x < hw - 1; x += 2.6) {
          B.ground.flat(f, x - 0.06, x + 0.06, -hd + 0.5, -hd + 5.5, 0.052, 0xe8e6df);
          B.ground.flat(f, x - 0.06, x + 0.06, hd - 5.5, hd - 0.5, 0.052, 0xe8e6df);
        }
        return;
      }
      B.kit.box(f, hw - 1.5, 1.2, 0, 1.8, 2.4, 1.8, 0xe8e2d6);
      B.tin.slab(f, [[hw - 2.6, 2.6, 1.1], [hw - 0.4, 2.6, 1.1], [hw - 0.4, 2.5, -1.1], [hw - 2.6, 2.5, -1.1]], 0x9aa3a8, 2.2, 2.2);
      return;
    }
    case 'construction': {
      if (base) {
        B.ground.flat(f, -hw, hw, -hd, hd, 0.045, 0x8f6a48);
        return;
      }
      // corrugated hoarding with a gate gap on the +Z side
      const fence = (x0: number, z0: number, x1: number, z1: number) => {
        const p = [0, 0, 0];
        const q = [0, 0, 0];
        const t = [0, 0, 0];
        const u = [0, 0, 0];
        f.apply(x0, 0, z0, p);
        f.apply(x1, 0, z1, q);
        f.apply(x1, 2.5, z1, t);
        f.apply(x0, 2.5, z0, u);
        B.tin.quadWorld(p, q, t, u, 0x9aa3a8, Math.hypot(x1 - x0, z1 - z0), 2.5);
      };
      fence(-hw, -hd, hw, -hd);
      fence(-hw, hd, -hw * 0.2, hd);
      fence(hw * 0.2, hd, hw, hd);
      fence(-hw, -hd, -hw, hd);
      fence(hw, -hd, hw, hd);
      B.kit.cylinder(f, -hw + 5, 0, hd - 6, 2.4, 0.2, 1.6, 0xc9a66b, 10, false);
      B.kit.cylinder(f, -hw + 9, 0, hd - 5, 1.8, 0.2, 1.2, 0x8a8a84, 10, false);
      if (r() < 0.6) {
        // tower crane
        const cx = hw - 6;
        const cz = -hd + 6;
        const h = range(r, 24, 34);
        B.metal.box(f, cx, h / 2, cz, 1.4, h, 1.4, 0xe0a800);
        B.metal.box(f, cx - 8, h + 0.6, cz, 30, 1.0, 1.0, 0xe0a800);
        B.kit.box(f, cx + 5, h + 0.2, cz, 3, 2, 2, 0x8a8a84);
        B.metal.box(f, cx - 18, h - 4, cz, 0.05, 8, 0.05, 0x222222);
        B.glow.box(f, cx - 22.8, h + 1.2, cz, 0.3, 0.3, 0.3, 0xff3b30);
      }
      return;
    }
    case 'bush': {
      if (base) B.grass.flat(f, -hw, hw, -hd, hd, 0.045, 0x7d8a4c);
      return;
    }
  }
}
