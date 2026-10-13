import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ROAD_GRID, carLaneOffsets, gridAxes, isHighwayAxisX, isHighwayAxisZ, roadHalfAtX, roadHalfAtZ } from '../roads/CityRoadPlan';
import { landmarkGapsForRoad } from '../roads/RoadGaps';
import { asphaltHalf } from '../city/StreetKit';
import { hasSignal, signalState } from '../city/signals';
import { poolMaterial } from '../city/kitMaterials';
import { CityUniforms } from '../render/nightState';
import { createBrandVehicle, createBusMesh, createMotoMesh, pickParkedBrand } from './VehicleFactory';

type Axis = 'x' | 'z';
type Kind = 'car' | 'taxi' | 'bus' | 'moto';

type Turn = { axis: Axis; center: number; laneAbs: number; dir: 1 | -1; at: number; speed: number };

type Vehicle = {
  mesh: THREE.Object3D;
  kind: Kind;
  axis: Axis;
  /** Road centreline (x for axis z, z for axis x). */
  center: number;
  /** |lane offset| from the centreline; the side follows from dir (right-hand traffic). */
  laneAbs: number;
  dir: 1 | -1;
  pos: number;
  speed: number;
  cruise: number;
  halfLen: number;
  halfW: number;
  /** Along-coordinate of the junction ahead. */
  nextJ: number;
  /** Turn decided for nextJ (null = straight); undefined = not decided yet. */
  plan: Turn | null | undefined;
  /** Remaining stop-sign wait at nextJ (−1 = not applicable / done). */
  stopWait: number;
  yaw: number;
  /** Lateral world coordinate of the lane (x for axis z, z for axis x). */
  lat: number;
  visible: boolean;
};

const G = ROAD_GRID;
const ACCEL = 2.6;
const BRAKE = 7;
const MAX_LIGHTS = 4;

function laneLat(axis: Axis, center: number, laneAbs: number, dir: 1 | -1): number {
  // right of travel: heading +z → −x side; heading +x → +z side
  return axis === 'z' ? center - dir * laneAbs : center + dir * laneAbs;
}

function isHighway(axis: Axis, center: number): boolean {
  return axis === 'z' ? isHighwayAxisX(center) : isHighwayAxisZ(center);
}

function lanesAbs(axis: Axis, center: number): number[] {
  const half = axis === 'z' ? roadHalfAtX(center) : roadHalfAtZ(center);
  return [...new Set(carLaneOffsets(half).map(Math.abs))].sort((a, b) => a - b);
}

function spanOpen(axis: Axis, center: number, a: number, b: number): boolean {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  for (const g of landmarkGapsForRoad(axis, center)) if (g.b >= lo && g.a <= hi) return false;
  return true;
}

function nextJunction(pos: number, dir: 1 | -1): number {
  return dir > 0 ? (Math.floor(pos / G + 1e-6) + 1) * G : (Math.ceil(pos / G - 1e-6) - 1) * G;
}

/**
 * Lane-graph traffic. Vehicles keep to the right, choose a turn at every junction, stop at the
 * shared signal clock (city/signals) and at stop signs, keep a following distance from the car
 * ahead and from the player, and switch on headlights at night.
 * Simulation is local: vehicles that drift far from the player respawn on a random open road
 * segment around them, so the whole network is used without simulating the whole city.
 */
export class TrafficSystem {
  private readonly root = new THREE.Group();
  private readonly vehicles: Vehicle[] = [];
  private readonly maxAxis: number;
  private readonly lenses: THREE.InstancedMesh;
  private readonly beams: THREE.InstancedMesh;
  private readonly lensMat: THREE.MeshBasicMaterial;
  private seed = 1;
  private readonly tmpM = new THREE.Matrix4();
  private readonly tmpQ = new THREE.Quaternion();
  private readonly tmpP = new THREE.Vector3();
  private readonly tmpS = new THREE.Vector3(1, 1, 1);
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly buckets = new Map<string, Vehicle[]>();
  private obstacles: Array<{ x: number; z: number; r: number }> = [];
  private lastX = 0;
  private lastZ = 0;

  constructor(scene: THREE.Scene, count = 42) {
    this.root.name = 'traffic';
    scene.add(this.root);
    const axes = gridAxes();
    this.maxAxis = axes[axes.length - 1]!;

    const cap = 160;
    this.lensMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.lensMat.onBeforeCompile = (shader) => {
      shader.uniforms.uNight = CityUniforms.uNight;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uNight;')
        .replace('#include <opaque_fragment>', 'outgoingLight *= 0.45 + uNight * 1.9;\n#include <opaque_fragment>');
    };
    this.lensMat.customProgramCacheKey = () => 'traffic-lens-v1';
    this.lenses = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), this.lensMat, cap * MAX_LIGHTS);
    this.lenses.name = 'traffic-lights';
    this.lenses.frustumCulled = false;
    this.lenses.setColorAt(0, new THREE.Color(0xffffff));
    this.lenses.count = 0;
    this.root.add(this.lenses);

    const beamGeo = new THREE.PlaneGeometry(5, 11);
    beamGeo.rotateX(-Math.PI / 2);
    const n = beamGeo.attributes.position!.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([0.62, 0.56, 0.42], i * 3);
    beamGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.beams = new THREE.InstancedMesh(beamGeo, poolMaterial(), cap);
    this.beams.name = 'traffic-beams';
    this.beams.frustumCulled = false;
    this.beams.count = 0;
    this.root.add(this.beams);

    this.setCount(count, 0, 0, true);
  }

  get count(): number {
    return this.vehicles.length;
  }

  /** Vehicles inside the draw range this frame. */
  get drawn(): number {
    let n = 0;
    for (const v of this.vehicles) if (v.visible) n++;
    return n;
  }

  /** Grow or shrink the fleet at runtime (traffic-density setting). */
  setCount(count: number, px: number, pz: number, initial = false): void {
    count = Math.max(0, Math.min(150, Math.round(count)));
    while (this.vehicles.length > count) {
      const v = this.vehicles.pop()!;
      this.root.remove(v.mesh);
    }
    while (this.vehicles.length < count) {
      const i = this.vehicles.length;
      const v = this.create(i);
      this.vehicles.push(v);
      this.root.add(v.mesh);
      this.respawn(v, px, pz, initial ? 18 : TrafficSystem.CULL, TrafficSystem.SPAWN_MAX);
    }
  }

  /** Redistribute every vehicle around (px, pz), e.g. after loading a save or teleporting. */
  scatter(px: number, pz: number): void {
    for (const v of this.vehicles) this.respawn(v, px, pz, 18, TrafficSystem.SPAWN_MAX);
  }

  static readonly CULL = 235;
  static readonly SPAWN_MAX = 290;
  static readonly RECYCLE = 320;

  /** Points traffic must not drive through (player on foot, the car the player drives). */
  setObstacles(obstacles: Array<{ x: number; z: number; r: number }>): void {
    this.obstacles = obstacles;
  }

  private rand(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private create(i: number): Vehicle {
    const roll = i % 14;
    const kind: Kind = roll === 0 ? 'bus' : roll <= 3 ? 'taxi' : roll === 4 || roll === 9 ? 'moto' : 'car';
    let mesh: THREE.Group;
    if (kind === 'bus') mesh = createBusMesh();
    else if (kind === 'moto') mesh = createMotoMesh(i);
    else if (kind === 'taxi') mesh = createBrandVehicle(i, 'taxi');
    else {
      const brand = pickParkedBrand(i * 7 + 3);
      mesh = createBrandVehicle(i, brand === 'taxi' ? 'car' : brand);
    }
    const halfLen = (mesh.userData.halfLength as number | undefined) ?? (kind === 'bus' ? 3.8 : kind === 'moto' ? 0.8 : 2);
    const halfW = (mesh.userData.halfWidth as number | undefined) ?? (kind === 'bus' ? 1.15 : kind === 'moto' ? 0.3 : 0.9);
    const flat = flatten(mesh);
    flat.name = `traffic-${kind}`;
    const cruise = (kind === 'bus' ? 9 : kind === 'moto' ? 13 : kind === 'taxi' ? 12 : 11) + (i % 4) * 0.6;
    return {
      mesh: flat,
      kind,
      axis: 'z',
      center: 0,
      laneAbs: 2.8,
      dir: 1,
      pos: 0,
      speed: 0,
      cruise,
      halfLen,
      halfW,
      nextJ: 0,
      plan: undefined,
      stopWait: -1,
      yaw: 0,
      lat: 0,
      visible: true,
    };
  }

  /** Put the vehicle on a random open lane segment at distance [rMin, rMax] from (px, pz). */
  private respawn(v: Vehicle, px: number, pz: number, rMin: number, rMax: number): void {
    for (let attempt = 0; attempt < 24; attempt++) {
      const axis: Axis = this.rand() < 0.5 ? 'x' : 'z';
      const ang = this.rand() * Math.PI * 2;
      const r = rMin + this.rand() * (rMax - rMin);
      const tx = px + Math.cos(ang) * r;
      const tz = pz + Math.sin(ang) * r;
      const center = Math.round((axis === 'z' ? tx : tz) / G) * G;
      if (Math.abs(center) > this.maxAxis) continue;
      const along = axis === 'z' ? tz : tx;
      if (Math.abs(along) > this.maxAxis - 20) continue;
      // keep clear of the junction boxes
      const local = along - Math.round(along / G) * G;
      if (Math.abs(local) < 20) continue;
      if (!spanOpen(axis, center, along - 12, along + 12)) continue;
      const dir: 1 | -1 = this.rand() < 0.5 ? 1 : -1;
      const lanes = lanesAbs(axis, center);
      const laneAbs = v.kind === 'bus' || v.kind === 'moto' ? lanes[lanes.length - 1]! : lanes[Math.floor(this.rand() * lanes.length)]!;
      const lat = laneLat(axis, center, laneAbs, dir);
      if (this.occupied(axis, lat, along, 14, v)) continue;
      this.place(v, axis, center, laneAbs, dir, along);
      v.speed = v.cruise * 0.6;
      return;
    }
  }

  private occupied(axis: Axis, lat: number, along: number, gap: number, self: Vehicle): boolean {
    for (const o of this.vehicles) {
      if (o === self || o.axis !== axis || Math.abs(o.lat - lat) > 0.5) continue;
      if (Math.abs(o.pos - along) < gap) return true;
    }
    return false;
  }

  private place(v: Vehicle, axis: Axis, center: number, laneAbs: number, dir: 1 | -1, pos: number): void {
    v.axis = axis;
    v.center = center;
    v.laneAbs = laneAbs;
    v.dir = dir;
    v.pos = pos;
    v.lat = laneLat(axis, center, laneAbs, dir);
    v.nextJ = nextJunction(pos, dir);
    v.plan = undefined;
    v.stopWait = -1;
    v.yaw = axis === 'z' ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  /** Pick straight / right / left at the junction ahead, honouring road ends and landmark gaps. */
  private decide(v: Vehicle): Turn | null {
    const J = v.nextJ;
    const cross: Axis = v.axis === 'z' ? 'x' : 'z';
    const options: Array<{ t: Turn | null; w: number }> = [];
    const crossOpenHere = spanOpen(cross, J, v.center - 2, v.center + 2);
    const straightOk = Math.abs(J) < this.maxAxis && spanOpen(v.axis, v.center, J, J + v.dir * G);
    const hw = isHighway(v.axis, v.center);
    if (straightOk) options.push({ t: null, w: hw ? 0.8 : 0.55 });
    if (crossOpenHere) {
      for (const side of [1, -1] as const) {
        // side 1 = right turn
        const newDir = (v.axis === 'z' ? -v.dir * side : v.dir * side) as 1 | -1;
        if (Math.abs(v.center + newDir * G) > this.maxAxis) continue;
        if (!spanOpen(cross, J, v.center, v.center + newDir * G)) continue;
        const lanes = lanesAbs(cross, J);
        const laneAbs = side === 1 ? lanes[lanes.length - 1]! : lanes[0]!;
        const at = laneLat(cross, J, laneAbs, newDir);
        options.push({
          t: { axis: cross, center: J, laneAbs, dir: newDir, at, speed: side === 1 ? 5.5 : 7 },
          w: side === 1 ? 0.27 : 0.18,
        });
      }
    }
    if (!options.length) {
      // dead end: U-turn on the spot before the junction
      const lanes = lanesAbs(v.axis, v.center);
      return {
        axis: v.axis,
        center: v.center,
        laneAbs: lanes[0]!,
        dir: (-v.dir) as 1 | -1,
        at: J - v.dir * 16,
        speed: 3,
      };
    }
    let sum = 0;
    for (const o of options) sum += o.w;
    let r = this.rand() * sum;
    for (const o of options) {
      r -= o.w;
      if (r <= 0) return o.t;
    }
    return options[options.length - 1]!.t;
  }

  update(dt: number, playerX: number, playerZ: number): void {
    const cap = Math.min(dt, 0.05);
    // teleport, taxi ride or aerial jump: rebuild the local fleet instead of trickling it in
    if (Math.hypot(playerX - this.lastX, playerZ - this.lastZ) > 150) this.scatter(playerX, playerZ);
    this.lastX = playerX;
    this.lastZ = playerZ;
    const recycleSq = TrafficSystem.RECYCLE ** 2;
    const cullSq = TrafficSystem.CULL ** 2;
    const nsState = signalState('ns');
    const ewState = signalState('ew');

    // lane buckets for car-following
    this.buckets.clear();
    for (const v of this.vehicles) {
      const key = `${v.axis}${Math.round(v.lat * 4)}`;
      let b = this.buckets.get(key);
      if (!b) this.buckets.set(key, (b = []));
      b.push(v);
    }
    for (const b of this.buckets.values()) b.sort((a, c) => a.pos * a.dir - c.pos * c.dir);

    for (const b of this.buckets.values()) {
      for (let i = 0; i < b.length; i++) {
        const v = b[i]!;
        const x = v.axis === 'z' ? v.lat : v.pos;
        const z = v.axis === 'z' ? v.pos : v.lat;
        const dx = x - playerX;
        const dz = z - playerZ;
        const d2 = dx * dx + dz * dz;
        if (d2 > recycleSq) {
          this.respawn(v, playerX, playerZ, TrafficSystem.CULL, TrafficSystem.SPAWN_MAX);
          continue;
        }
        v.visible = d2 < cullSq;

        if (v.plan === undefined && (v.nextJ - v.pos) * v.dir < 45) v.plan = this.decide(v);

        // free distance ahead (front bumper to obstacle)
        let free = 200;
        const leader = b[i + 1];
        if (leader && leader.dir === v.dir) free = Math.min(free, (leader.pos - v.pos) * v.dir - leader.halfLen - v.halfLen - 2.2);

        const J = v.nextJ;
        const toJ = (J - v.pos) * v.dir;
        const crossHalf = asphaltHalf(J, isHighway(v.axis === 'z' ? 'x' : 'z', J));
        const stopLine = toJ - crossHalf - 5.2 - v.halfLen;
        const gx = v.axis === 'z' ? v.center : J;
        const gz = v.axis === 'z' ? J : v.center;
        const junctionOpen = spanOpen(v.axis === 'z' ? 'x' : 'z', J, v.center - 1, v.center + 1);
        const uTurn = !!v.plan && v.plan.axis === v.axis;
        if (stopLine > -0.5 && junctionOpen && !uTurn) {
          if (hasSignal(gx, gz)) {
            const s = v.axis === 'z' ? nsState : ewState;
            if (s === 0 || (s === 1 && stopLine > 8)) free = Math.min(free, stopLine);
          } else if (v.axis === 'z' && !isHighway('z', v.center) && !isHighway('x', J)) {
            // stop sign on the N–S street: halt, wait, then go
            if (v.stopWait < 0 && stopLine < 30) v.stopWait = 1.1;
            if (v.stopWait > 0) {
              free = Math.min(free, stopLine);
              if (stopLine < 1.2 && v.speed < 0.6) v.stopWait = Math.max(0, v.stopWait - cap);
            }
          }
        }
        // player / driven car in our lane
        for (const o of this.obstacles) {
          const ol = v.axis === 'z' ? o.x : o.z;
          const oa = v.axis === 'z' ? o.z : o.x;
          if (Math.abs(ol - v.lat) > v.halfW + o.r + 0.6) continue;
          const ahead = (oa - v.pos) * v.dir - v.halfLen - o.r;
          if (ahead > -1 && ahead < 25) free = Math.min(free, ahead - 1.5);
        }

        let target = v.cruise * (isHighway(v.axis, v.center) ? 1.35 : 1);
        if (v.plan && (v.plan.at - v.pos) * v.dir < 22) target = Math.min(target, v.plan.speed);
        target = Math.min(target, Math.sqrt(Math.max(0, 2 * BRAKE * 0.6 * Math.max(0, free))));
        if (free < 0.3) target = 0;
        v.speed = v.speed < target ? Math.min(target, v.speed + ACCEL * cap) : Math.max(target, v.speed - BRAKE * cap);

        const step = v.speed * cap;
        if (v.plan && (v.plan.at - v.pos) * v.dir <= step) {
          const t = v.plan;
          if (t.axis !== v.axis) {
            const from = v.center;
            this.place(v, t.axis, t.center, t.laneAbs, t.dir, v.lat);
            // a left turn starts on the near side of the old road: the next junction is the one beyond it
            v.nextJ = from + t.dir * G;
          } else {
            this.place(v, t.axis, t.center, t.laneAbs, t.dir, v.pos);
            v.speed = Math.min(v.speed, 2);
          }
        } else {
          v.pos += step * v.dir;
          if ((v.pos - v.nextJ) * v.dir > 0) {
            v.nextJ = nextJunction(v.pos, v.dir);
            v.plan = undefined;
            v.stopWait = -1;
          }
        }
      }
    }

    this.writeMeshes(cap);
  }

  private yawFor(v: Vehicle): number {
    return v.axis === 'z' ? (v.dir > 0 ? 0 : Math.PI) : v.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  private writeMeshes(dt: number): void {
    const night = CityUniforms.uNight.value;
    let li = 0;
    let bi = 0;
    const white = new THREE.Color(0xfff2d0);
    const red = new THREE.Color(0xff2a18);
    const amber = new THREE.Color(0xffa000);
    for (const v of this.vehicles) {
      const m = v.mesh;
      m.visible = v.visible;
      if (!v.visible) continue;
      const x = v.axis === 'z' ? v.lat : v.pos;
      const z = v.axis === 'z' ? v.pos : v.lat;
      const want = this.yawFor(v);
      let d = want - m.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      m.rotation.y += d * Math.min(1, dt * 7);
      m.position.set(x, 0, z);
      m.updateMatrix();

      const yaw = m.rotation.y;
      const s = Math.sin(yaw);
      const c = Math.cos(yaw);
      const braking = v.speed < v.cruise * 0.5;
      const lens = (lx: number, ly: number, lz: number, col: THREE.Color) => {
        if (li >= this.lenses.instanceMatrix.count) return;
        this.tmpP.set(x + lx * c + lz * s, ly, z - lx * s + lz * c);
        this.tmpQ.setFromAxisAngle(this.up, yaw);
        this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
        this.lenses.setMatrixAt(li, this.tmpM);
        this.lenses.setColorAt(li, col);
        li++;
      };
      const hl = v.halfLen + 0.02;
      const y = v.kind === 'bus' ? 0.9 : 0.72;
      if (v.kind === 'moto') {
        lens(0, 0.85, hl, white);
        lens(0, 0.75, -hl, braking ? amber : red);
      } else {
        const hx = v.halfW - 0.28;
        lens(hx, y, hl, white);
        lens(-hx, y, hl, white);
        lens(hx, y, -hl, red);
        lens(-hx, y, -hl, red);
      }
      if (night > 0.25 && bi < this.beams.instanceMatrix.count) {
        this.tmpP.set(x + (hl + 5.6) * s, 0.075, z + (hl + 5.6) * c);
        this.tmpQ.setFromAxisAngle(this.up, yaw);
        this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
        this.beams.setMatrixAt(bi++, this.tmpM);
      }
    }
    this.lenses.count = li;
    this.lenses.instanceMatrix.needsUpdate = true;
    if (this.lenses.instanceColor) this.lenses.instanceColor.needsUpdate = true;
    this.beams.count = bi;
    this.beams.instanceMatrix.needsUpdate = true;
  }
}

/**
 * Bake a vehicle group into one mesh per material: traffic is drawn every frame, and the
 * factory builds cars from 8–14 boxes.
 */
function flatten(g: THREE.Group): THREE.Object3D {
  g.updateMatrixWorld(true);
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  g.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    let geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    if (geo.index) geo = geo.toNonIndexed();
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
    let list = byMat.get(mesh.material);
    if (!list) byMat.set(mesh.material, (list = []));
    list.push(geo);
  });
  const out = new THREE.Group();
  out.matrixAutoUpdate = false;
  for (const [material, geos] of byMat) {
    const merged = mergeGeometries(geos, false);
    for (const geo of geos) geo.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    mesh.matrixAutoUpdate = false;
    out.add(mesh);
  }
  out.userData = { ...g.userData, driveable: false };
  return out;
}
