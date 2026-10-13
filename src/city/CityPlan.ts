import { nearestDistrict } from '../data/districts';
import { profileFor, type DistrictCharacter } from '../data/districtProfiles';
import { ROAD_GRID, gridAxes, isHighwayAxisX, isHighwayAxisZ } from '../roads/CityRoadPlan';
import type { CollisionSystem } from '../world/CollisionSystem';
import { compoundSegments, heightOf, type Arch, type BuildingPlan, type Compound } from './BuildingKit';
import { isFree, occupyFootprint } from './Occupancy';
import { Frame } from './Batch';
import { hash2, mulberry32, pick, range, weighted, type Rand } from './rng';
import {
  BANK_SIGNS,
  CHURCH_SIGNS,
  CLINIC_SIGNS,
  FOOD_SIGNS,
  FUEL_SIGNS,
  GARAGE_SIGNS,
  HOTEL_SIGNS,
  MARKET_SIGNS,
  OFFICE_SIGNS,
  SCHOOL_SIGNS,
  SHOP_SIGNS,
  SUPER_SIGNS,
} from './names';

export type Zone =
  | 'core'
  | 'market'
  | 'dense'
  | 'student'
  | 'family'
  | 'premium'
  | 'logistics'
  | 'periurban'
  | 'institutional'
  | 'airport'
  | 'fringe';

/** 0 palm · 1 broadleaf · 2 mango · 3 shrub · 4 banana */
export type TreeKind = 0 | 1 | 2 | 3 | 4;
export type TreeSpot = { x: number; z: number; kind: TreeKind; s: number };
export type GroundPatch = { x: number; z: number; hw: number; hd: number; color: number };
export type Special = { kind: 'park' | 'pitch' | 'parking' | 'construction' | 'bush'; x: number; z: number; hw: number; hd: number; seed: number };

export type BlockPlan = {
  gx: number;
  gz: number;
  zone: Zone;
  buildings: BuildingPlan[];
  trees: TreeSpot[];
  grounds: GroundPatch[];
  specials: Special[];
};

export const CHUNK = ROAD_GRID * 2;

const ZONE_OF: Record<DistrictCharacter, Zone> = {
  commercial_core: 'core',
  market: 'market',
  premium: 'premium',
  student: 'student',
  residential_dense: 'dense',
  residential_family: 'family',
  logistics: 'logistics',
  periurban: 'periurban',
  institutional: 'institutional',
  airport: 'airport',
};

const PAINT = [
  0xefe6d4, 0xe8d3a9, 0xdcb98a, 0xd9a07a, 0xc98b6b, 0xe7c39a, 0xbfd3c0, 0xa9c7d6, 0xd7d0e6, 0xf2efe6, 0xe9e0a1, 0xcfb59a,
  0xb7c2c8, 0xe0a890, 0x9fbfa5, 0xf0d8c0,
];
const ROOFS = [0x9aa3a8, 0x8a4b2f, 0x7d3b2b, 0x9c3326, 0x2f6b4a, 0x2e5b8a, 0x6f7477, 0x94493a];
const WALLS = [0xe8e0d0, 0xd8c8a8, 0xc9b79a, 0xf0ece4, 0xb9a88c, 0xd2c5b0];

/** Distance from a road axis to the building frontage line. */
function frontageOffset(highway: boolean): number {
  return highway ? 21 : 13.6;
}

/** Outer edge of the paved sidewalk from the road axis (see RoadBuilder). */
function sidewalkEdge(axis: number, highway: boolean): number {
  if (highway) return 14 + 3.3;
  const avenue = Math.abs(axis) % (ROAD_GRID * 2) === 0;
  return (avenue ? 8 : 5.5) + 3.3;
}

let nextId = 1;

type Side = 'S' | 'N' | 'E' | 'W';

type BlockCtx = {
  block: BlockPlan;
  r: Rand;
  zone: Zone;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  shoulder: Record<Side, number>;
  palette: number[];
  hMin: number;
  hMax: number;
  collisions: CollisionSystem;
};

export class CityPlan {
  readonly blocks: BlockPlan[] = [];
  private readonly chunks = new Map<string, BlockPlan[]>();
  private readonly extras = new Map<string, BuildingPlan[]>();
  buildingCount = 0;

  /** Buildings placed by hand-written code (landmarks, hubs) rendered through the kit. */
  addExtra(p: BuildingPlan): void {
    const k = CityPlan.chunkKey(Math.floor(p.x / CHUNK), Math.floor(p.z / CHUNK));
    const list = this.extras.get(k);
    if (list) list.push(p);
    else this.extras.set(k, [p]);
  }

  static chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  chunk(cx: number, cz: number): { blocks: BlockPlan[]; extras: BuildingPlan[] } {
    const k = CityPlan.chunkKey(cx, cz);
    return { blocks: this.chunks.get(k) ?? [], extras: this.extras.get(k) ?? [] };
  }

  private readonly byCell = new Map<string, BlockPlan>();

  /** Lay out every city block: zoning, frontage rows, compounds, interiors, specials. */
  generate(collisions: CollisionSystem): void {
    const axes = gridAxes();
    for (let i = 0; i + 1 < axes.length; i++) {
      for (let j = 0; j + 1 < axes.length; j++) {
        const gx = axes[i]!;
        const gz = axes[j]!;
        const block = this.planBlock(gx, axes[i + 1]!, gz, axes[j + 1]!, collisions);
        if (!block) continue;
        this.blocks.push(block);
        this.byCell.set(`${gx},${gz}`, block);
        this.buildingCount += block.buildings.length;
        const k = CityPlan.chunkKey(Math.floor(gx / CHUNK), Math.floor(gz / CHUNK));
        const list = this.chunks.get(k);
        if (list) list.push(block);
        else this.chunks.set(k, [block]);
      }
    }
  }

  blockAt(x: number, z: number): BlockPlan | undefined {
    return this.byCell.get(`${Math.floor(x / ROAD_GRID) * ROAD_GRID},${Math.floor(z / ROAD_GRID) * ROAD_GRID}`);
  }

  zoneAt(x: number, z: number): Zone {
    return this.blockAt(x, z)?.zone ?? 'fringe';
  }

  private planBlock(gx: number, gx2: number, gz: number, gz2: number, collisions: CollisionSystem): BlockPlan | null {
    const hxW = isHighwayAxisX(gx);
    const hxE = isHighwayAxisX(gx2);
    const hzN = isHighwayAxisZ(gz);
    const hzS = isHighwayAxisZ(gz2);
    const x0 = gx + frontageOffset(hxW);
    const x1 = gx2 - frontageOffset(hxE);
    const z0 = gz + frontageOffset(hzN);
    const z1 = gz2 - frontageOffset(hzS);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    if (Math.hypot(cx, cz) < 30) return null;

    const district = nearestDistrict(cx, cz);
    const profile = profileFor(district, cx, cz);
    const distToDistrict = Math.hypot(cx - district.center.x, cz - district.center.z);
    let zone: Zone = ZONE_OF[profile.character];
    const far = Math.max(Math.abs(cx), Math.abs(cz));
    if (far > 1240) zone = 'fringe';
    else if (distToDistrict > district.radius * 1.6) zone = far < 780 ? (hash2(gx, gz, 9) % 5 === 0 ? 'dense' : 'family') : 'periurban';
    else if (far > 1150 && zone !== 'airport') zone = 'periurban';

    const r = mulberry32(hash2(gx, gz, 4242));
    const block: BlockPlan = { gx, gz, zone, buildings: [], trees: [], grounds: [], specials: [] };
    const ctx: BlockCtx = {
      block,
      r,
      zone,
      x0,
      x1,
      z0,
      z1,
      shoulder: {
        S: frontageOffset(hzS) - sidewalkEdge(gz2, hzS),
        N: frontageOffset(hzN) - sidewalkEdge(gz, hzN),
        E: frontageOffset(hxE) - sidewalkEdge(gx2, hxE),
        W: frontageOffset(hxW) - sidewalkEdge(gx, hxW),
      },
      palette: [...profile.palette.map((c) => soften(c)), ...PAINT],
      hMin: profile.height.min,
      hMax: profile.height.max,
      collisions,
    };

    // Block-wide specials
    const roll = r();
    const parkChance = zone === 'institutional' || zone === 'premium' ? 0.1 : zone === 'fringe' ? 0 : 0.035;
    const pitchChance = zone === 'family' || zone === 'periurban' || zone === 'student' ? 0.035 : 0;
    const siteChance = zone === 'fringe' ? 0 : 0.025;
    if (roll < parkChance) {
      this.special(ctx, 'park');
    } else if (roll < parkChance + pitchChance) {
      this.special(ctx, 'pitch');
    } else if (roll < parkChance + pitchChance + siteChance) {
      this.construction(ctx);
    } else if (zone === 'fringe') {
      this.fringe(ctx);
    } else if (zone === 'family' || zone === 'premium' || zone === 'periurban' || zone === 'logistics' || zone === 'institutional' || zone === 'airport') {
      this.compoundBlock(ctx);
    } else {
      this.denseBlock(ctx);
    }
    return block;
  }

  // -------------------------------------------------------------------------

  /** Perimeter of street-facing buildings on all four sides, interior fill behind. */
  private denseBlock(ctx: BlockCtx): void {
    const { r, zone, x0, x1, z0, z1 } = ctx;
    const depth = zone === 'core' ? range(r, 15, 19) : zone === 'market' ? range(r, 9, 11) : range(r, 11.5, 14.5);
    const dN = Math.min(depth, (z1 - z0) / 2 - 2);
    const dS = dN;
    const dE = Math.min(depth, (x1 - x0) / 2 - 2);
    const dW = dE;
    this.row(ctx, 'S', x0, x1, dS);
    this.row(ctx, 'N', x0, x1, dN);
    this.row(ctx, 'E', z0 + dN, z1 - dS, dE);
    this.row(ctx, 'W', z0 + dN, z1 - dS, dW);
    this.interior(ctx, x0 + dW + 1.5, x1 - dE - 1.5, z0 + dN + 1.5, z1 - dS - 1.5);
  }

  /** Back-to-back walled compounds facing two opposite streets. */
  private compoundBlock(ctx: BlockCtx): void {
    const { r, x0, x1, z0, z1 } = ctx;
    const alongX = r() < 0.5;
    if (alongX) {
      const d = (z1 - z0) / 2;
      this.row(ctx, 'S', x0, x1, d - 0.3, true);
      this.row(ctx, 'N', x0, x1, d - 0.3, true);
    } else {
      const d = (x1 - x0) / 2;
      this.row(ctx, 'E', z0, z1, d - 0.3, true);
      this.row(ctx, 'W', z0, z1, d - 0.3, true);
    }
  }

  private fringe(ctx: BlockCtx): void {
    const { r, x0, x1, z0, z1, block } = ctx;
    block.specials.push({ kind: 'bush', x: (x0 + x1) / 2, z: (z0 + z1) / 2, hw: (x1 - x0) / 2, hd: (z1 - z0) / 2, seed: hash2(block.gx, block.gz, 5) });
    for (let i = 0; i < 30; i++) {
      block.trees.push({ x: range(r, x0, x1), z: range(r, z0, z1), kind: pick(r, [1, 2, 3, 3, 4, 0, 1] as const), s: range(r, 0.8, 1.5) });
    }
    if (r() < 0.6) this.row(ctx, 'S', x0, x1, (z1 - z0) / 2 - 0.3, true);
  }

  // -------------------------------------------------------------------------

  private archFor(ctx: BlockCtx, compound: boolean, corner: boolean): Arch | 'empty' {
    const { r, zone } = ctx;
    if (compound) {
      switch (zone) {
        case 'premium':
          return weighted<Arch | 'empty'>(r, { villa: 0.72, house: 0.1, apartment: 0.1, unfinished: 0.05, empty: 0.03 });
        case 'logistics':
          return weighted<Arch | 'empty'>(r, { warehouse: 0.45, garage: 0.22, shoprow: 0.08, house: 0.12, fuel: corner ? 0.2 : 0, empty: 0.05 });
        case 'periurban':
          return weighted<Arch | 'empty'>(r, { house: 0.48, planks: 0.14, unfinished: 0.12, villa: 0.04, shoprow: corner ? 0.15 : 0.03, empty: 0.18 });
        case 'institutional':
          return weighted<Arch | 'empty'>(r, { civic: 0.28, office: 0.22, school: 0.15, church: 0.1, villa: 0.2, empty: 0.05 });
        case 'airport':
          return weighted<Arch | 'empty'>(r, { warehouse: 0.5, office: 0.22, hotel: 0.15, garage: 0.08, fuel: corner ? 0.15 : 0 });
        default:
          return weighted<Arch | 'empty'>(r, {
            house: 0.5,
            villa: 0.1,
            apartment: 0.12,
            unfinished: 0.08,
            planks: 0.04,
            shoprow: corner ? 0.2 : 0.04,
            school: 0.03,
            church: 0.025,
            clinic: 0.02,
            empty: 0.04,
          });
      }
    }
    switch (zone) {
      case 'core':
        return weighted<Arch>(r, { office: 0.28, apartment: 0.3, hotel: 0.1, bank: corner ? 0.15 : 0.04, shoprow: 0.1, clinic: 0.05, supermarket: 0.03, restaurant: 0.06 });
      case 'market':
        return weighted<Arch>(r, { shoprow: 0.58, apartment: 0.2, restaurant: 0.1, unfinished: 0.05, clinic: 0.04, garage: 0.03 });
      case 'student':
        return weighted<Arch>(r, { apartment: 0.45, shoprow: 0.18, restaurant: 0.15, unfinished: 0.14, clinic: 0.05, garage: 0.03 });
      default:
        return weighted<Arch>(r, {
          apartment: 0.44,
          shoprow: 0.2,
          unfinished: 0.13,
          restaurant: 0.08,
          clinic: corner ? 0.08 : 0.04,
          house: 0.06,
          garage: 0.04,
          supermarket: 0.01,
        });
    }
  }

  private lotWidth(ctx: BlockCtx, arch: Arch, compound: boolean): number {
    const r = ctx.r;
    if (compound) {
      if (ctx.zone === 'premium' || arch === 'villa') return range(r, 20, 27);
      if (arch === 'warehouse' || arch === 'school' || arch === 'civic' || arch === 'office') return range(r, 22, 32);
      if (arch === 'church') return range(r, 20, 26);
      if (arch === 'planks') return range(r, 8, 11);
      if (arch === 'shoprow') return range(r, 10, 16);
      if (arch === 'garage' || arch === 'fuel') return range(r, 14, 20);
      if (ctx.zone === 'periurban') return range(r, 12, 17);
      return range(r, 11, 15);
    }
    switch (arch) {
      case 'office':
      case 'hotel':
        return range(r, 15, 22);
      case 'bank':
        return range(r, 12, 16);
      case 'supermarket':
        return range(r, 22, 30);
      case 'shoprow':
        return ctx.zone === 'market' ? range(r, 9, 18) : range(r, 10, 16);
      case 'restaurant':
        return range(r, 8, 12);
      case 'garage':
        return range(r, 10, 14);
      case 'clinic':
        return range(r, 9, 12);
      default:
        return range(r, 10, 16);
    }
  }

  private floorsFor(ctx: BlockCtx, arch: Arch): number {
    const r = ctx.r;
    const hiF = Math.max(2, Math.round(ctx.hMax / 3.1));
    const loF = Math.max(1, Math.round(ctx.hMin / 3.1));
    switch (arch) {
      case 'office':
        return Math.round(range(r, Math.max(5, loF), Math.max(8, hiF + 3)));
      case 'hotel':
        return Math.round(range(r, 4, Math.max(6, hiF + 1)));
      case 'apartment':
        return Math.max(2, Math.round(range(r, Math.max(2, loF), Math.max(3, hiF))));
      case 'bank':
        return Math.round(range(r, 2, 4));
      case 'shoprow':
        return r() < (ctx.zone === 'market' ? 0.6 : 0.45) ? 1 : 2;
      case 'restaurant':
      case 'clinic':
        return r() < 0.5 ? 1 : 2;
      case 'villa':
        return r() < 0.7 ? 2 : 1;
      case 'unfinished':
        return Math.round(range(r, 2, 5));
      case 'school':
      case 'civic':
        return r() < 0.6 ? 2 : 1;
      case 'warehouse':
        return r() < 0.5 ? 2 : 1;
      default:
        return 1;
    }
  }

  /** Frontage row along one side, from u0 to u1 along the street, `depth` deep into the block. */
  private row(ctx: BlockCtx, side: Side, u0: number, u1: number, depth: number, compound = false): void {
    const { r } = ctx;
    if (u1 - u0 < 6 || depth < 5) return;
    let u = u0;
    let first = true;
    while (u1 - u > 6) {
      let arch = this.archFor(ctx, compound, first || u1 - u < 22);
      let width = arch === 'empty' ? range(r, 10, 18) : this.lotWidth(ctx, arch, compound);
      const rest = u1 - u - width;
      if (rest < 6) width = u1 - u;
      if (arch !== 'empty' && arch !== 'house' && arch !== 'planks' && width < 8) arch = 'shoprow';
      const gap = compound ? 0 : ctx.zone === 'core' || ctx.zone === 'market' ? (r() < 0.2 ? 2.2 : 0) : r() < 0.45 ? range(r, 1.6, 3) : 0;
      if (arch === 'empty') {
        this.emptyLot(ctx, side, u, u + width, depth);
      } else {
        this.lot(ctx, side, arch, u, u + width - gap, depth, compound);
      }
      u += width;
      first = false;
    }
  }

  /** Lot rect along a side → world centre, yaw and frame-local offsets. */
  private sideFrame(ctx: BlockCtx, side: Side, uMid: number, inset: number): { x: number; z: number; yaw: number } {
    switch (side) {
      case 'S':
        return { x: uMid, z: ctx.z1 - inset, yaw: 0 };
      case 'N':
        return { x: uMid, z: ctx.z0 + inset, yaw: Math.PI };
      case 'E':
        return { x: ctx.x1 - inset, z: uMid, yaw: Math.PI / 2 };
      default:
        return { x: ctx.x0 + inset, z: uMid, yaw: -Math.PI / 2 };
    }
  }

  private lot(ctx: BlockCtx, side: Side, arch: Arch, ua: number, ub: number, depth: number, compound: boolean): void {
    const { r, block } = ctx;
    const lotW = ub - ua;
    const uMid = (ua + ub) / 2;
    const floors = this.floorsFor(ctx, arch);
    let w = lotW;
    let d = Math.min(depth, 16);
    let setback = 0.4 + r() * 1.2;
    let comp: Compound | undefined;

    if (compound) {
      // building inside a walled plot
      const maxD = depth - 2;
      if (arch === 'villa') {
        w = Math.min(lotW - 6, range(r, 12, 16));
        d = Math.min(maxD - 6, range(r, 10, 13));
        setback = range(r, 4.5, 6.5);
      } else if (arch === 'warehouse') {
        w = Math.min(lotW - 3, range(r, 14, 24));
        d = Math.min(maxD - 7, range(r, 12, 18));
        setback = range(r, 6, 8);
      } else if (arch === 'school' || arch === 'civic') {
        w = Math.min(lotW - 4, range(r, 18, 28));
        d = Math.min(maxD - 9, range(r, 8, 11));
        setback = range(r, 7, 9);
      } else if (arch === 'church') {
        w = Math.min(lotW - 6, range(r, 10, 13));
        d = Math.min(maxD - 9, range(r, 16, 20));
        setback = range(r, 7, 8);
      } else if (arch === 'office' || arch === 'hotel') {
        w = Math.min(lotW - 4, range(r, 14, 20));
        d = Math.min(maxD - 6, range(r, 12, 15));
        setback = range(r, 4, 6);
      } else if (arch === 'apartment') {
        w = Math.min(lotW - 3, range(r, 10, 14));
        d = Math.min(maxD - 5, range(r, 9, 12));
        setback = range(r, 3, 4.5);
      } else if (arch === 'planks') {
        w = Math.min(lotW - 1.5, range(r, 6, 8.5));
        d = Math.min(maxD - 3, range(r, 5, 7));
        setback = range(r, 1.5, 4);
      } else if (arch === 'garage' || arch === 'fuel' || arch === 'shoprow') {
        w = lotW - 1;
        d = Math.min(maxD - 2, arch === 'fuel' ? 16 : range(r, 7, 10));
        setback = arch === 'fuel' ? 0.5 : range(r, 0.3, 1);
      } else {
        w = Math.min(lotW - range(r, 2, 3.4), 14);
        d = Math.min(maxD - 7, range(r, 8.5, 12.5));
        setback = range(r, 2.6, 4.2);
      }
      if (w < 5 || d < 4) return;
      const walled = arch !== 'planks' && arch !== 'garage' && arch !== 'fuel' && arch !== 'shoprow' && !(ctx.zone === 'periurban' && r() < 0.3);
      if (walled) {
        const lotDepth = depth;
        // compound in building-local coords: front of lot at z = hd + setback
        const hdB = d / 2;
        const front = hdB + setback;
        comp = {
          cx: 0,
          cz: front - lotDepth / 2,
          hw: lotW / 2 - 0.25,
          hd: lotDepth / 2 - 0.25,
          wall: pick(r, WALLS),
          gate: (r() < 0.5 ? -1 : 1) * Math.max(0, Math.min(lotW / 2 - 2.6, w / 2 + 0.5)),
          gateW: arch === 'warehouse' ? 5 : 3.2,
          height: arch === 'villa' ? 2.6 : 2.1,
        };
        comp.cz -= 0.0;
      }
    } else {
      if (arch === 'supermarket') {
        d = Math.min(depth - 1, range(r, 14, 18));
        setback = Math.max(0.5, depth - d - 0.5);
      } else if (arch === 'restaurant') {
        d = Math.min(depth - 4, range(r, 8, 11));
        setback = Math.min(depth - d - 0.5, range(r, 3.5, 5));
      } else if (arch === 'garage') {
        d = Math.min(depth - 1, range(r, 7, 10));
      } else {
        d = Math.min(depth - setback - 0.5, Math.max(8, depth * range(r, 0.75, 0.98)));
      }
      if (d < 5) return;
    }

    const f = this.sideFrame(ctx, side, uMid, setback + d / 2);
    const hw = w / 2;
    const hd = d / 2;
    // Keep clear of landmarks / static buildings / spots
    const swap = side === 'E' || side === 'W';
    const ext = comp ? { hw: comp.hw, hd: comp.hd, ox: 0, oz: comp.cz } : { hw, hd, ox: 0, oz: 0 };
    const wc = new Frame(f.x, f.z, f.yaw);
    const cc = [0, 0, 0];
    wc.apply(ext.ox, 0, ext.oz, cc);
    const ahw = swap ? ext.hd : ext.hw;
    const ahd = swap ? ext.hw : ext.hd;
    if (!isFree(cc[0]!, cc[2]!, ahw, ahd, 0.4)) {
      // Try the bare building without the compound wall
      if (!comp || !isFree(f.x, f.z, swap ? hd : hw, swap ? hw : hd, 0.6)) return;
      comp = undefined;
    }

    const name = nameFor(arch, r);
    const plan: BuildingPlan = {
      id: nextId++,
      arch,
      x: f.x,
      z: f.z,
      yaw: f.yaw,
      w,
      d,
      floors,
      seed: hash2(Math.round(f.x * 10), Math.round(f.z * 10), 99),
      paint: pick(r, ctx.palette),
      trim: 0x8a8378,
      roof: pick(r, ROOFS),
      name,
      shopGround: arch === 'apartment' && !compound && (ctx.zone !== 'family' ? r() < 0.65 : r() < 0.3),
      apron: setback + ctx.shoulder[side],
      compound: comp,
      unfinishedTop: (arch === 'apartment' && r() < 0.35) || arch === 'unfinished',
      old: r() < (ctx.zone === 'market' || ctx.zone === 'dense' ? 0.15 : 0.05),
    };
    block.buildings.push(plan);
    this.register(ctx, plan);

    // annex against the back wall: kitchen, boys' quarters, rented rooms
    let annexed = false;
    if (comp && (arch === 'house' || arch === 'villa' || arch === 'apartment' || arch === 'unfinished')) {
      const back = comp.cz - comp.hd;
      const room = -hd - back;
      if (room > 6.5 && r() < 0.8) {
        const ad = Math.min(4.6, room - 2.6);
        const aw = Math.min(comp.hw * 2 - 1, range(r, comp.hw * 0.9, comp.hw * 1.7));
        const ax = (r() < 0.5 ? -1 : 1) * (comp.hw - aw / 2 - 0.35);
        const p = [0, 0, 0];
        wc.apply(ax, 0, back + 0.35 + ad / 2, p);
        const annex: BuildingPlan = {
          id: nextId++,
          arch: r() < 0.3 ? 'planks' : 'house',
          x: p[0]!,
          z: p[2]!,
          yaw: f.yaw,
          w: aw,
          d: ad,
          floors: 1,
          seed: plan.seed ^ 0x9e37,
          paint: pick(r, ctx.palette),
          trim: 0,
          roof: pick(r, [0x8a4b2f, 0x7d3b2b, 0x9aa3a8, 0x6f7477]),
          shopGround: false,
          apron: 0,
          old: r() < 0.4,
        };
        block.buildings.push(annex);
        this.register(ctx, annex);
        annexed = true;
      }
    }

    // yard trees inside compounds, behind the house (one beside the annex when there is one)
    if (comp && r() < 0.85) {
      const n = annexed ? 1 : arch === 'villa' ? 3 : 1 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) {
        const lx = annexed ? (r() < 0.5 ? -1 : 1) * range(r, 1.4, 2.4) : range(r, -comp.hw + 1.5, comp.hw - 1.5);
        const lz = annexed ? -hd - 1.3 : comp.cz - comp.hd + range(r, 1.2, Math.max(1.4, comp.hd * 2 - d - setback - 1.5));
        const p = [0, 0, 0];
        wc.apply(lx, 0, lz, p);
        block.trees.push({ x: p[0]!, z: p[2]!, kind: pick(r, [0, 1, 2, 2, 4] as const), s: range(r, annexed ? 0.7 : 0.8, annexed ? 1.0 : 1.25) });
      }
    }
    // front-yard mango / palm / banana, on the side away from the gate path
    if (comp && setback > 3 && r() < 0.7) {
      const away = comp.gate >= 0 ? -1 : 1;
      const lx = away * Math.min(comp.hw - 1.3, range(r, hw * 0.55, hw * 0.9));
      const p = [0, 0, 0];
      wc.apply(lx, 0, hd + setback * 0.55, p);
      block.trees.push({ x: p[0]!, z: p[2]!, kind: pick(r, [2, 0, 4, 1, 2] as const), s: range(r, 0.65, 0.95) });
    }
  }

  private emptyLot(ctx: BlockCtx, side: Side, ua: number, ub: number, depth: number): void {
    const { r, block } = ctx;
    const f = this.sideFrame(ctx, side, (ua + ub) / 2, depth / 2);
    const swap = side === 'E' || side === 'W';
    const hw = (ub - ua) / 2;
    const hd = depth / 2;
    if (!isFree(f.x, f.z, swap ? hd : hw, swap ? hw : hd, 0)) return;
    block.specials.push({ kind: 'bush', x: f.x, z: f.z, hw: swap ? hd : hw, hd: swap ? hw : hd, seed: hash2(Math.round(f.x), Math.round(f.z), 3) });
    const n = 2 + Math.floor(r() * 5);
    for (let i = 0; i < n; i++) {
      block.trees.push({
        x: f.x + range(r, -(swap ? hd : hw) + 1, (swap ? hd : hw) - 1),
        z: f.z + range(r, -(swap ? hw : hd) + 1, (swap ? hw : hd) - 1),
        kind: pick(r, [1, 3, 3, 4, 0] as const),
        s: range(r, 0.7, 1.3),
      });
    }
  }

  /** Block interior behind the street rows. */
  private interior(ctx: BlockCtx, x0: number, x1: number, z0: number, z1: number): void {
    const { r, zone, block } = ctx;
    const w = x1 - x0;
    const d = z1 - z0;
    if (w < 6 || d < 6) return;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    if (zone === 'core') {
      if (isFree(cx, cz, w / 2, d / 2, 0)) {
        block.specials.push({ kind: 'parking', x: cx, z: cz, hw: w / 2, hd: d / 2, seed: hash2(block.gx, block.gz, 8) });
        for (let i = 0; i < 2; i++) block.trees.push({ x: x0 + 1 + r() * (w - 2), z: z0 + 1, kind: 1, s: 0.9 });
      }
      return;
    }
    if (zone === 'market' && w > 10 && d > 10 && r() < 0.6) {
      const plan: BuildingPlan = {
        id: nextId++,
        arch: 'market',
        x: cx,
        z: cz,
        yaw: 0,
        w: w - 1,
        d: d - 1,
        floors: 1,
        seed: hash2(block.gx, block.gz, 77),
        paint: 0xd8c8a8,
        trim: 0,
        roof: pick(r, ROOFS),
        name: pick(r, MARKET_SIGNS),
        shopGround: false,
        apron: 0,
      };
      if (isFree(cx, cz, w / 2, d / 2, 0)) {
        block.buildings.push(plan);
        this.register(ctx, plan);
      }
      return;
    }
    // Dense courtyard housing: small houses / plank shacks along alleys
    const cell = 7.2;
    const nx = Math.floor(w / cell);
    const nz = Math.floor(d / cell);
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        if (r() < 0.14) {
          if (r() < 0.5) block.trees.push({ x: x0 + (i + 0.5) * cell, z: z0 + (j + 0.5) * cell, kind: pick(r, [2, 4, 1] as const), s: range(r, 0.7, 1.1) });
          continue;
        }
        const px = x0 + (i + 0.5) * (w / nx);
        const pz = z0 + (j + 0.5) * (d / nz);
        const arch: Arch = r() < 0.45 ? 'planks' : 'house';
        const bw = Math.min(w / nx - 1.8, arch === 'planks' ? range(r, 5, 7) : range(r, 6, 7.5));
        const bd = Math.min(d / nz - 1.8, arch === 'planks' ? range(r, 4.5, 6) : range(r, 5.5, 7));
        if (bw < 4 || bd < 4) continue;
        const yaw = pick(r, [0, Math.PI / 2, Math.PI, -Math.PI / 2] as const);
        const swap = Math.abs(Math.sin(yaw)) > 0.5;
        const ahw = swap ? bd / 2 : bw / 2;
        const ahd = swap ? bw / 2 : bd / 2;
        if (!isFree(px, pz, ahw, ahd, 0.3)) continue;
        const plan: BuildingPlan = {
          id: nextId++,
          arch,
          x: px,
          z: pz,
          yaw,
          w: bw,
          d: bd,
          floors: 1,
          seed: hash2(Math.round(px * 10), Math.round(pz * 10), 11),
          paint: pick(r, ctx.palette),
          trim: 0,
          roof: pick(r, [0x8a4b2f, 0x7d3b2b, 0x94493a, 0x9aa3a8, 0x6f7477]),
          shopGround: false,
          apron: 0,
          old: r() < 0.3,
        };
        block.buildings.push(plan);
        this.register(ctx, plan);
      }
    }
    if (zone !== 'market') block.grounds.push({ x: cx, z: cz, hw: w / 2 + 1.2, hd: d / 2 + 1.2, color: 0x7a6650 });
  }

  private special(ctx: BlockCtx, kind: 'park' | 'pitch'): void {
    const { x0, x1, z0, z1, block, r } = ctx;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const hw = (x1 - x0) / 2;
    const hd = (z1 - z0) / 2;
    if (!isFree(cx, cz, hw, hd, 0)) {
      this.compoundBlock(ctx);
      return;
    }
    block.specials.push({ kind, x: cx, z: cz, hw, hd, seed: hash2(block.gx, block.gz, 21) });
    occupyFootprint(cx, cz, hw, hd, 0, kind);
    const n = kind === 'park' ? 16 : 10;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const edge = i % 4;
      const along = range(r, -0.9, 0.9);
      const x = edge < 2 ? cx + along * hw : cx + (edge === 2 ? -1 : 1) * (hw - 1.6);
      const z = edge < 2 ? cz + (edge === 0 ? -1 : 1) * (hd - 1.6) : cz + along * hd;
      block.trees.push({ x, z, kind: t < 0.4 ? 0 : t < 0.8 ? 1 : 2, s: range(r, 0.9, 1.4) });
    }
    if (kind === 'park') {
      for (let i = 0; i < 6; i++) block.trees.push({ x: cx + range(r, -hw * 0.6, hw * 0.6), z: cz + range(r, -hd * 0.6, hd * 0.6), kind: pick(r, [0, 1, 2, 3] as const), s: range(r, 0.8, 1.3) });
    }
  }

  private construction(ctx: BlockCtx): void {
    const { x0, x1, z0, z1, block, r } = ctx;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const hw = (x1 - x0) / 2 - 1;
    const hd = (z1 - z0) / 2 - 1;
    if (!isFree(cx, cz, hw, hd, 0)) {
      this.denseBlock(ctx);
      return;
    }
    block.specials.push({ kind: 'construction', x: cx, z: cz, hw, hd, seed: hash2(block.gx, block.gz, 31) });
    const plan: BuildingPlan = {
      id: nextId++,
      arch: 'unfinished',
      x: cx,
      z: cz - 2,
      yaw: 0,
      w: Math.min(hw * 2 - 10, 22),
      d: Math.min(hd * 2 - 12, 16),
      floors: Math.round(range(r, 4, 7)),
      seed: hash2(block.gx, block.gz, 32),
      paint: 0x9a9890,
      trim: 0,
      roof: 0x777777,
      shopGround: false,
      apron: 0,
      unfinishedTop: true,
    };
    block.buildings.push(plan);
    this.register(ctx, plan);
    // Site fence (corrugated sheets) collision
    const segs = [
      { x: cx, z: cz - hd, hw, hd: 0.08 },
      { x: cx, z: cz + hd, hw: hw * 0.4, hd: 0.08, ox: -hw * 0.6 },
      { x: cx + hw * 0.6, z: cz + hd, hw: hw * 0.4, hd: 0.08 },
      { x: cx - hw, z: cz, hw: 0.08, hd },
      { x: cx + hw, z: cz, hw: 0.08, hd },
    ];
    for (const s of segs) ctx.collisions.addBox(s.x + ((s as { ox?: number }).ox ?? 0), 1.25, s.z, s.hw, 1.25, s.hd);
    occupyFootprint(cx, cz, hw, hd, 0, 'site');
  }

  private register(ctx: BlockCtx, p: BuildingPlan): void {
    registerPlan(ctx.collisions, p);
  }
}

/** Collisions + occupancy for a placed building and its compound wall. */
export function registerPlan(collisions: CollisionSystem, p: BuildingPlan): void {
  const ctx = { collisions };
  {
    const f = new Frame(p.x, p.z, p.yaw);
    const swap = Math.abs(Math.sin(p.yaw)) > 0.5;
    const h = heightOf(p);
    const hw = p.w / 2;
    const hd = p.d / 2;
    occupyFootprint(p.x, p.z, hw, hd, p.yaw, 'gen');
    if (p.arch === 'market') {
      // stall tables only — aisles stay walkable
      const rows = Math.max(1, Math.round(p.d / 5));
      const rw = p.d / rows;
      for (let i = 0; i < rows; i++) {
        const c = [0, 0, 0];
        f.apply(0, 0, -hd + rw * (i + 0.5), c);
        ctx.collisions.addBox(c[0]!, 0.5, c[2]!, swap ? rw * 0.23 : hw, 0.5, swap ? hw : rw * 0.23);
      }
    } else if (p.arch === 'fuel') {
      const c = [0, 0, 0];
      f.apply(0, 0, 0, c);
      ctx.collisions.addBox(c[0]!, 2, c[2]!, (swap ? hd * 0.4 : hw * 0.45) + 0.3, 2, (swap ? hw * 0.45 : hd * 0.4) + 0.3);
    } else if (p.arch === 'garage') {
      const c = [0, 0, 0];
      f.apply(0, 0, -hd + 0.3, c);
      ctx.collisions.addBox(c[0]!, h / 2, c[2]!, swap ? 0.4 : hw, h / 2, swap ? hw : 0.4);
    } else {
      const c = Math.abs(Math.cos(p.yaw));
      const s = Math.abs(Math.sin(p.yaw));
      ctx.collisions.addBox(p.x, h / 2, p.z, hw * c + hd * s + 0.3, h / 2 + 1, hw * s + hd * c + 0.3);
    }
    if (p.compound) {
      occupyFootprint(...worldOf(f, 0, p.compound.cz), p.compound.hw, p.compound.hd, p.yaw, 'compound');
      for (const s of compoundSegments(p.compound)) {
        const c = [0, 0, 0];
        f.apply(s.x, 0, s.z, c);
        ctx.collisions.addBox(c[0]!, p.compound.height / 2, c[2]!, swap ? s.hd : s.hw, p.compound.height / 2, swap ? s.hw : s.hd);
      }
    }
  }
}

function worldOf(f: Frame, lx: number, lz: number): [number, number] {
  const c = [0, 0, 0];
  f.apply(lx, 0, lz, c);
  return [c[0]!, c[2]!];
}

function soften(hex: number): number {
  // District palettes are saturated UI colours — pull them towards weathered plaster.
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  const m = (r + g + b) / 3;
  const k = 0.55;
  const mix = (c: number) => Math.round(c * k + (m * 0.35 + 150) * (1 - k));
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

function nameFor(arch: Arch, r: Rand): string | undefined {
  switch (arch) {
    case 'apartment':
    case 'shoprow':
      return pick(r, SHOP_SIGNS);
    case 'restaurant':
      return pick(r, FOOD_SIGNS);
    case 'hotel':
      return pick(r, HOTEL_SIGNS);
    case 'office':
      return pick(r, OFFICE_SIGNS);
    case 'bank':
      return pick(r, BANK_SIGNS);
    case 'clinic':
      return pick(r, CLINIC_SIGNS);
    case 'school':
      return pick(r, SCHOOL_SIGNS);
    case 'church':
      return pick(r, CHURCH_SIGNS);
    case 'garage':
      return pick(r, GARAGE_SIGNS);
    case 'fuel':
      return pick(r, FUEL_SIGNS);
    case 'supermarket':
      return pick(r, SUPER_SIGNS);
    case 'civic':
      return pick(r, ['Mairie d’Arrondissement', 'Sous-Préfecture', 'Centre des Impôts', 'Poste du Quartier', 'Commissariat']);
    default:
      return undefined;
  }
}
