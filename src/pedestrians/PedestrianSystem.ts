import * as THREE from 'three';
import { type NpcRole } from './NpcAvatar';
import { ROAD_GRID, gridAxes, isHighwayAxisX, isHighwayAxisZ } from '../roads/CityRoadPlan';
import { landmarkGapsForRoad } from '../roads/RoadGaps';
import { asphaltHalf } from '../city/StreetKit';
import { hasSignal, signalState } from '../city/signals';
import { LIFE_SPOTS } from '../sim/LifeSpots';
import type { Zone } from '../city/CityPlan';

type Axis = 'x' | 'z';
/** Waypoint. `cross`: wait for that traffic axis to be red first. `corner`: junction reached here. */
type Pt = { x: number; z: number; cross?: 'ns' | 'ew'; gx?: number; gz?: number; corner?: number };

type Ped = {
  /** Logical handle (position / heading); drawn through the shared instanced parts. */
  mesh: THREE.Group;
  name: string;
  role: NpcRole;
  paused: boolean;
  speed: number;
  phase: number;
  /** Stand-in-place workers keep their post; walkers roam the sidewalk graph. */
  walker: boolean;
  /** Current sidewalk leg (walkers). */
  axis: Axis;
  center: number;
  side: 1 | -1;
  dir: 1 | -1;
  inset: number;
  queue: Pt[];
  /** Workers: post and the hours they are there. */
  post: { x: number; z: number; yaw: number; from: number; to: number } | null;
  active: boolean;
  crossing: boolean;
  /** Held at the kerb by a signal. */
  waiting: boolean;
  look: Look;
};

type Look = { skin: THREE.Color; shirt: THREE.Color; pants: THREE.Color; hair: THREE.Color; scale: number; hairH: number; bag: boolean };

const G = ROAD_GRID;
const CURB = 0.2;
const WALK = 3.1;
const SKIN_TONES = [0x5c3a24, 0x70452f, 0x8d5a3a, 0x3e2723, 0xa67c52];
const SHIRTS = [0x167f6b, 0xc62828, 0x1565c0, 0xff8f00, 0x6a1b9a, 0xffffff, 0x37474f, 0xf9a825, 0x2e7d32, 0xad1457];
const PANTS = [0x27364a, 0x4e342e, 0x212121, 0x455a64, 0x1b5e20, 0x3e2723];
/** Wax-print / boubou colours worn as long dresses by part of the crowd. */
const PAGNE = [0xe65100, 0x6a1b9a, 0x00838f, 0xc62828, 0xf9a825, 0x2e7d32];

const FIRST = ['Amina', 'Jean', 'Paul', 'Marie', 'Eric', 'Fatou', 'Serge', 'Claire', 'Boris', 'Nadine', 'Yves', 'Sandra', 'Hervé', 'Brenda', 'Ulrich', 'Larissa'];
const LAST = ['Ngono', 'Kamga', 'Mvondo', 'Atangana', 'Fouda', 'Owona', 'Essomba', 'Talla', 'Mbarga', 'Nkodo', 'Tchoua', 'Abena'];

function pickNpcName(seed: number, role: NpcRole): string {
  const f = FIRST[seed % FIRST.length]!;
  const l = LAST[(seed * 7) % LAST.length]!;
  if (role === 'security') return `Agent ${l}`;
  if (role === 'employee') return `${f} · employé(e)`;
  if (role === 'student') return `${f} · étudiant(e)`;
  if (role === 'tourist') return `${f} · visiteur`;
  return `${f} ${l}`;
}

function mulberry(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isHighway(axis: Axis, c: number): boolean {
  return axis === 'z' ? isHighwayAxisX(c) : isHighwayAxisZ(c);
}

/** Distance from the road axis to the middle of its sidewalk. */
function walkLine(axis: Axis, c: number): number {
  return asphaltHalf(c, isHighway(axis, c)) + CURB + WALK / 2;
}

function spanOpen(axis: Axis, center: number, a: number, b: number): boolean {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  for (const g of landmarkGapsForRoad(axis, center)) if (g.b >= lo && g.a <= hi) return false;
  return true;
}

function junctionOpen(gx: number, gz: number): boolean {
  return spanOpen('z', gx, gz - 1, gz + 1) && spanOpen('x', gz, gx - 1, gx + 1);
}

/** Instanced body parts: every NPC in the city costs nine draw calls in total. */
class CrowdMesh {
  readonly group = new THREE.Group();
  private readonly parts: THREE.InstancedMesh[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly root = new THREE.Matrix4();
  private readonly tmp = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly e = new THREE.Euler();
  private n = 0;

  constructor(cap: number) {
    this.group.name = 'pedestrians';
    const geos = [
      new THREE.CapsuleGeometry(0.26, 0.5, 2, 6), // torso
      new THREE.SphereGeometry(0.26, 10, 7), // head
      new THREE.SphereGeometry(0.27, 8, 5), // hair
      new THREE.CapsuleGeometry(0.09, 0.32, 2, 5), // arms
      new THREE.CapsuleGeometry(0.11, 0.36, 2, 5), // legs
      new THREE.BoxGeometry(0.2, 0.1, 0.32), // shoes
      new THREE.BoxGeometry(0.28, 0.35, 0.12), // bag
      new THREE.CylinderGeometry(0.2, 0.34, 0.95, 8, 1, true), // long dress
    ];
    const per = [1, 1, 1, 2, 2, 2, 1, 1];
    geos.forEach((g, i) => {
      const material = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, side: i === 7 ? THREE.DoubleSide : THREE.FrontSide });
      const im = new THREE.InstancedMesh(g, material, cap * per[i]!);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.setColorAt(0, new THREE.Color(0xffffff));
      im.count = 0;
      im.castShadow = i < 5 || i === 7;
      im.frustumCulled = false;
      this.parts.push(im);
      this.group.add(im);
    });
  }

  begin(): void {
    this.n = 0;
    for (const p of this.parts) p.count = 0;
  }

  private put(part: number, local: THREE.Matrix4, color: THREE.Color): void {
    const im = this.parts[part]!;
    const i = im.count;
    if (i >= im.instanceMatrix.count) return;
    this.tmp.multiplyMatrices(this.root, local);
    im.setMatrixAt(i, this.tmp);
    im.setColorAt(i, color);
    im.count = i + 1;
  }

  private local(x: number, y: number, z: number, rx = 0, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
    this.e.set(rx, 0, 0);
    this.q.setFromEuler(this.e);
    return this.m.compose(this.v.set(x, y, z), this.q, this.s.set(sx, sy, sz));
  }

  /** Limb hanging from a pivot, rotated about x at the pivot. */
  private limb(px: number, py: number, rx: number, oy: number, oz = 0): THREE.Matrix4 {
    const c = Math.cos(rx);
    const s = Math.sin(rx);
    // pivot · Rx · offset(0, oy, oz)
    return this.m.set(1, 0, 0, px, 0, c, -s, py + c * oy - s * oz, 0, s, c, s * oy + c * oz, 0, 0, 0, 1);
  }

  add(x: number, z: number, yaw: number, look: Look, swing: number, idle: boolean, dress: boolean): void {
    this.n++;
    this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    this.root.compose(this.v.set(x, 0, z), this.q, this.s.setScalar(look.scale));
    this.put(0, this.local(0, 1.15, 0), look.shirt);
    this.put(1, this.local(0, 1.85, 0), look.skin);
    this.put(2, this.local(0, 2.0, -0.02, 0, 1, look.hairH, 1), look.hair);
    const armL = idle ? -0.4 + swing : -swing * 0.6;
    const armR = idle ? -0.35 - swing : swing * 0.6;
    this.put(3, this.limb(-0.36, 1.45, armL, -0.22), look.shirt);
    this.put(3, this.limb(0.36, 1.45, armR, -0.22), look.shirt);
    if (dress) {
      this.put(7, this.local(0, 0.62, 0), look.pants);
      this.put(5, this.local(-0.12, 0.05, 0.08), look.hair);
      this.put(5, this.local(0.12, 0.05, 0.08), look.hair);
    } else {
      this.put(4, this.limb(-0.14, 0.72, swing, -0.26), look.pants);
      this.put(4, this.limb(0.14, 0.72, -swing, -0.26), look.pants);
      this.put(5, this.limb(-0.14, 0.72, swing, -0.52, 0.06), look.hair);
      this.put(5, this.limb(0.14, 0.72, -swing, -0.52, 0.06), look.hair);
    }
    if (look.bag) this.put(6, this.local(0.45, 1.05, 0.1), look.pants);
  }

  end(): void {
    for (const p of this.parts) {
      p.instanceMatrix.needsUpdate = true;
      if (p.instanceColor) p.instanceColor.needsUpdate = true;
    }
  }

  get drawn(): number {
    return this.n;
  }
}

/**
 * City crowd. Walkers live on real sidewalks: they follow a sidewalk to the next corner, then
 * cross on the zebra (waiting for the signal phase where there is one), turn the corner, or
 * cross to the other side. Shop staff, vendors and guards keep their post during working hours.
 * Only the neighbourhood around the player is simulated; walkers that fall behind respawn on a
 * sidewalk in a ring around the player, and fewer people are out at night.
 */
export class PedestrianSystem {
  private readonly crowd: CrowdMesh;
  private readonly peds: Ped[] = [];
  private readonly maxAxis: number;
  private seed = 7;
  private walkerTarget: number;
  private hour = 12;
  private lastX = 1e9;
  private lastZ = 1e9;
  /** Walkers on a crosswalk right now (fed to traffic as obstacles). */
  readonly crossers: Array<{ x: number; z: number; r: number }> = [];

  static readonly DRAW = 150;
  static readonly SPAWN_MIN = 110;
  static readonly SPAWN_MAX = 170;
  static readonly RECYCLE = 200;

  constructor(
    scene: THREE.Scene,
    density = 1,
    private readonly zoneAt: (x: number, z: number) => Zone = () => 'dense',
  ) {
    const axes = gridAxes();
    this.maxAxis = axes[axes.length - 1]!;
    this.crowd = new CrowdMesh(420);
    scene.add(this.crowd.group);
    this.walkerTarget = 0;
    this.spawnWorkers(density);
    this.setDensity(density);
  }

  get count(): number {
    return this.peds.filter((p) => p.active).length;
  }

  /** Walkers kept around the player at ×1. */
  static readonly BASE = 90;

  setDensity(density: number): void {
    this.walkerTarget = Math.round(PedestrianSystem.BASE * Math.max(0.2, Math.min(1.8, density)));
    let walkers = this.peds.filter((p) => p.walker);
    while (walkers.length < this.walkerTarget) {
      const p = this.makePed(this.peds.length + 100, this.walkerRole(0, 0), true);
      this.peds.push(p);
      walkers.push(p);
      this.lastX = 1e9; // forces a scatter on the next update
    }
    if (walkers.length > this.walkerTarget) {
      const drop = new Set(walkers.slice(this.walkerTarget));
      for (let i = this.peds.length - 1; i >= 0; i--) if (drop.has(this.peds[i]!)) this.peds.splice(i, 1);
      walkers = walkers.slice(0, this.walkerTarget);
    }
  }

  private rand(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private walkerRole(x: number, z: number): NpcRole {
    const zone = this.zoneAt(x, z);
    const r = this.rand();
    if (zone === 'student') return r < 0.55 ? 'student' : 'pedestrian';
    if (zone === 'market') return r < 0.5 ? 'shopper' : 'pedestrian';
    if (zone === 'core' || zone === 'institutional') return r < 0.35 ? 'employee' : r < 0.45 ? 'tourist' : 'pedestrian';
    if (zone === 'airport') return r < 0.4 ? 'tourist' : r < 0.6 ? 'employee' : 'pedestrian';
    return r < 0.15 ? 'shopper' : r < 0.25 ? 'student' : 'pedestrian';
  }

  private makePed(seed: number, role: NpcRole, walker: boolean): Ped {
    const r = mulberry(seed * 31 + 5);
    let shirt = SHIRTS[Math.floor(r() * SHIRTS.length)]!;
    if (role === 'security') shirt = 0x1a237e;
    if (role === 'employee') shirt = 0x00897b;
    if (role === 'tourist') shirt = 0xff7043;
    const dress = role !== 'security' && r() < 0.28;
    const look: Look = {
      skin: new THREE.Color(SKIN_TONES[Math.floor(r() * SKIN_TONES.length)]!),
      shirt: new THREE.Color(dress ? PAGNE[Math.floor(r() * PAGNE.length)]! : shirt),
      pants: new THREE.Color(dress ? PAGNE[Math.floor(r() * PAGNE.length)]! : PANTS[Math.floor(r() * PANTS.length)]!),
      hair: new THREE.Color(0x1d1410),
      scale: 0.9 + r() * 0.18,
      hairH: 0.5 + r() * 0.35,
      bag: role === 'shopper' || role === 'student' ? r() < 0.7 : r() < 0.15,
    };
    const mesh = new THREE.Group();
    const name = pickNpcName(seed, role);
    mesh.name = `npc-${seed}`;
    mesh.userData = { npcName: name, npcRole: role, dress };
    return {
      mesh,
      name,
      role,
      paused: false,
      speed: walker ? 1.1 + r() * 0.45 : 0,
      phase: r() * 10,
      walker,
      axis: 'z',
      center: 0,
      side: 1,
      dir: 1,
      inset: 0,
      queue: [],
      post: null,
      active: true,
      crossing: false,
      waiting: false,
      look,
    };
  }

  /** Staff at shops and job sites, guards, a few vendors. They keep their post during opening hours. */
  private spawnWorkers(density: number): void {
    let id = 9000;
    for (const s of LIFE_SPOTS) {
      const staff = Math.max(1, Math.round((s.kind === 'job' ? 3 : 2) * Math.min(1.4, density)));
      for (let i = 0; i < staff; i++) {
        const ang = (i / staff) * Math.PI * 2 + 0.4;
        const x = s.x + Math.cos(ang) * 3.2;
        const z = s.z + Math.sin(ang) * 3.2;
        const role: NpcRole = s.kind === 'job' ? 'employee' : i === 0 ? 'employee' : 'shopper';
        const p = this.makePed(id++, role, false);
        const yaw = Math.atan2(s.x - x, s.z - z) + Math.PI;
        const food = s.kind === 'food';
        p.post = { x, z, yaw, from: food ? 6 : 7.5, to: food ? 23.5 : 20.5 };
        p.mesh.position.set(x, 0, z);
        p.mesh.rotation.y = yaw;
        p.paused = true;
        this.peds.push(p);
      }
      if (s.kind === 'job') {
        const p = this.makePed(id++, 'security', false);
        p.post = { x: s.x + 5, z: s.z - 4, yaw: 0, from: 0, to: 24 };
        p.mesh.position.set(s.x + 5, 0, s.z - 4);
        p.paused = true;
        this.peds.push(p);
      }
    }
  }

  /** Put a walker on a random open sidewalk leg at distance [rMin, rMax] from (px, pz). */
  private respawn(p: Ped, px: number, pz: number, rMin: number, rMax: number): boolean {
    for (let attempt = 0; attempt < 20; attempt++) {
      const axis: Axis = this.rand() < 0.5 ? 'x' : 'z';
      const ang = this.rand() * Math.PI * 2;
      const r = rMin + this.rand() * (rMax - rMin);
      const tx = px + Math.cos(ang) * r;
      const tz = pz + Math.sin(ang) * r;
      const center = Math.round((axis === 'z' ? tx : tz) / G) * G;
      if (Math.abs(center) > this.maxAxis) continue;
      const along = axis === 'z' ? tz : tx;
      if (Math.abs(along) > this.maxAxis - 20) continue;
      const local = along - Math.round(along / G) * G;
      if (Math.abs(local) < 18) continue;
      if (!spanOpen(axis, center, along - 6, along + 6)) continue;
      p.axis = axis;
      p.center = center;
      p.side = this.rand() < 0.5 ? 1 : -1;
      p.dir = this.rand() < 0.5 ? 1 : -1;
      p.inset = (this.rand() - 0.5) * 1.6;
      const lat = center + p.side * (walkLine(axis, center) + p.inset);
      if (axis === 'z') p.mesh.position.set(lat, 0, along);
      else p.mesh.position.set(along, 0, lat);
      p.queue.length = 0;
      p.crossing = false;
      this.planLeg(p);
      p.role = this.walkerRole(p.mesh.position.x, p.mesh.position.z);
      p.name = pickNpcName(Math.floor(this.rand() * 1e6), p.role);
      return true;
    }
    return false;
  }

  /** Queue the walk to the next corner of the current leg. */
  private planLeg(p: Ped): void {
    const pos = p.axis === 'z' ? p.mesh.position.z : p.mesh.position.x;
    const J = p.dir > 0 ? (Math.floor(pos / G + 1e-6) + 1) * G : (Math.ceil(pos / G - 1e-6) - 1) * G;
    const cross: Axis = p.axis === 'z' ? 'x' : 'z';
    const cw = walkLine(cross, J);
    const lat = p.center + p.side * (walkLine(p.axis, p.center) + p.inset);
    const cornerAlong = J - p.dir * cw;
    if (!spanOpen(p.axis, p.center, pos, cornerAlong) || Math.abs(J) > this.maxAxis) {
      // the sidewalk ends at a landmark: turn back
      p.dir = (-p.dir) as 1 | -1;
      p.queue.push(this.pt(p.axis, lat, pos - p.dir * 0.01));
      return;
    }
    p.queue.push({ ...this.pt(p.axis, lat, cornerAlong), corner: J });
  }

  private pt(axis: Axis, lat: number, along: number): Pt {
    return axis === 'z' ? { x: lat, z: along } : { x: along, z: lat };
  }

  /** At a corner: go straight over the zebra, turn the corner, or cross this road first. */
  private atCorner(p: Ped, J: number): void {
    const cross: Axis = p.axis === 'z' ? 'x' : 'z';
    const open = junctionOpen(p.axis === 'z' ? p.center : J, p.axis === 'z' ? J : p.center);
    const lat = p.center + p.side * (walkLine(p.axis, p.center) + p.inset);
    const cw = walkLine(cross, J);
    const gx = p.axis === 'z' ? p.center : J;
    const gz = p.axis === 'z' ? J : p.center;
    const straightOk = open && Math.abs(J + p.dir * G) <= this.maxAxis && spanOpen(p.axis, p.center, J + p.dir * cw, J + p.dir * G);
    const turnOk = spanOpen(cross, J, p.center + p.side * 4, p.center + p.side * G) && Math.abs(p.center + p.side * G) <= this.maxAxis;
    const r = this.rand();
    if (straightOk && (r < 0.5 || !turnOk)) {
      // over the crossing road: walking parallel to our road's traffic
      const pt = this.pt(p.axis, lat, J + p.dir * cw);
      if (hasSignal(gx, gz)) pt.cross = p.axis === 'z' ? 'ew' : 'ns';
      pt.gx = gx;
      pt.gz = gz;
      p.queue.push(pt);
      return;
    }
    if (turnOk && (r < 0.85 || !open)) {
      // round the corner onto the crossing road, away from our road
      const newSide = (-p.dir) as 1 | -1;
      const newDir = p.side;
      p.axis = cross;
      p.center = J;
      p.side = newSide;
      p.dir = newDir;
      this.planLeg(p);
      return;
    }
    if (open) {
      // cross our own road on its zebra, then carry on along the other sidewalk
      const zebra = J - p.dir * (asphaltHalf(J, isHighway(cross, J)) + 2.2);
      const otherLat = p.center - p.side * (walkLine(p.axis, p.center) + p.inset);
      const a = this.pt(p.axis, lat, zebra);
      const b = this.pt(p.axis, otherLat, zebra);
      if (hasSignal(gx, gz)) b.cross = p.axis === 'z' ? 'ns' : 'ew';
      b.gx = gx;
      b.gz = gz;
      p.queue.push(a, b);
      p.side = (-p.side) as 1 | -1;
      p.dir = (-p.dir) as 1 | -1;
      return;
    }
    p.dir = (-p.dir) as 1 | -1;
    this.planLeg(p);
  }

  private scatter(px: number, pz: number): void {
    for (const p of this.peds) if (p.walker) this.respawn(p, px, pz, 6, PedestrianSystem.SPAWN_MAX);
  }

  update(dt: number, playerX: number, playerZ: number, hour = this.hour): void {
    this.hour = hour;
    const cap = Math.min(dt, 0.05);
    if (Math.hypot(playerX - this.lastX, playerZ - this.lastZ) > 120) this.scatter(playerX, playerZ);
    this.lastX = playerX;
    this.lastZ = playerZ;

    // fewer people out late at night and before dawn
    const h = hour;
    const outShare = h >= 6 && h < 21 ? 1 : h >= 21 && h < 23 ? 0.55 : h >= 5 && h < 6 ? 0.45 : 0.22;
    const drawSq = PedestrianSystem.DRAW ** 2;
    const recycleSq = PedestrianSystem.RECYCLE ** 2;
    const nsState = signalState('ns');
    const ewState = signalState('ew');
    this.crossers.length = 0;

    this.crowd.begin();
    let wi = 0;
    for (const p of this.peds) {
      const m = p.mesh;
      if (p.walker) {
        p.active = wi++ < this.walkerTarget * outShare;
        if (!p.active) continue;
        const dx = m.position.x - playerX;
        const dz = m.position.z - playerZ;
        if (dx * dx + dz * dz > recycleSq) {
          this.respawn(p, playerX, playerZ, PedestrianSystem.SPAWN_MIN, PedestrianSystem.SPAWN_MAX);
          continue;
        }
        if (!p.paused) this.walk(p, cap, nsState, ewState);
      } else if (p.post) {
        const on = p.post.from <= p.post.to ? h >= p.post.from && h < p.post.to : h >= p.post.from || h < p.post.to;
        p.active = on;
        if (!on) continue;
      }

      const dx = m.position.x - playerX;
      const dz = m.position.z - playerZ;
      const d2 = dx * dx + dz * dz;
      if (d2 > drawSq) continue;
      const moving = p.walker && !p.paused && p.queue.length > 0 && !p.waiting;
      if (d2 < 70 * 70) p.phase += cap * (moving ? p.speed * 4.4 : 1.2);
      const swing = moving ? Math.sin(p.phase) * 0.55 : Math.sin(p.phase) * 0.08;
      this.crowd.add(m.position.x, m.position.z, m.rotation.y, p.look, swing, !moving, !!m.userData.dress);
    }
    this.crowd.end();
  }

  private walk(p: Ped, dt: number, ns: 0 | 1 | 2, ew: 0 | 1 | 2): void {
    const m = p.mesh;
    p.waiting = false;
    if (!p.queue.length) this.planLeg(p);
    const t = p.queue[0]!;
    const tx = t.x - m.position.x;
    const tz = t.z - m.position.z;
    const len = Math.hypot(tx, tz);
    if (t.cross && !p.crossing) {
      // wait at the kerb until the traffic we cross in front of has a red light
      const traffic = t.cross === 'ns' ? ns : ew;
      if (traffic !== 0) {
        p.waiting = true;
        return;
      }
      p.crossing = true;
    }
    if (p.crossing || t.gx !== undefined) this.crossers.push({ x: m.position.x, z: m.position.z, r: 0.4 });
    const step = p.speed * dt * (p.crossing ? 1.25 : 1);
    if (len <= step) {
      m.position.x = t.x;
      m.position.z = t.z;
      p.queue.shift();
      p.crossing = false;
      if (t.corner !== undefined) this.atCorner(p, t.corner);
      return;
    }
    m.position.x += (tx / len) * step;
    m.position.z += (tz / len) * step;
    const want = Math.atan2(tx, tz);
    let d = want - m.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    m.rotation.y += d * Math.min(1, dt * 8);
  }

  nearest(x: number, z: number, maxDist = 3.2): { mesh: THREE.Group; name: string; role: NpcRole } | null {
    let best: Ped | null = null;
    let bestD = maxDist;
    for (const p of this.peds) {
      if (!p.active) continue;
      const d = Math.hypot(p.mesh.position.x - x, p.mesh.position.z - z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best ? { mesh: best.mesh, name: best.name, role: best.role } : null;
  }

  setPaused(mesh: THREE.Group, paused: boolean): void {
    const p = this.peds.find((q) => q.mesh === mesh);
    if (!p) return;
    // workers stay at their post either way
    p.paused = p.walker ? paused : true;
    if (!paused && p.post) p.mesh.rotation.y = p.post.yaw;
  }

  get drawn(): number {
    return this.crowd.drawn;
  }
}
