import * as THREE from 'three';
import { mat } from '../world/materials';
import { createCarMesh } from './VehicleFactory';
import {
  buildTaxiDestinations,
  buildTaxiStands,
  estimateFare,
  type TaxiDestination,
  type TaxiStand,
} from './TaxiDestinations';
import { ROAD_GRID } from '../roads/CityRoadPlan';

export type TaxiRideState =
  | { phase: 'idle' }
  | { phase: 'menu'; stand: TaxiStand }
  | {
      phase: 'pickup' | 'boarding' | 'driving' | 'dropoff';
      t: number;
      fare: number;
      to: TaxiDestination;
      path: Array<{ x: number; z: number }>;
      seg: number;
      segT: number;
      /** Seconds to cross current segment. */
      segDur: number;
      boardT: number;
      speed: number;
    };

export type TaxiUpdateResult = {
  riding: boolean;
  status?: string;
  arrived?: { x: number; z: number; fare: number; name: string };
  follow?: THREE.Object3D;
};

const PICKUP_SPEED = 28;
const CRUISE_SPEED = 42;
const BOARD_SEC = 0.85;
const DROPOFF_SEC = 0.7;

/**
 * Yango stands + animated ride: taxi pulls up, player boards, drives path, exits.
 */
export class TaxiSystem {
  private readonly root = new THREE.Group();
  readonly stands: TaxiStand[];
  readonly destinations: TaxiDestination[];
  private state: TaxiRideState = { phase: 'idle' };
  private readonly standMeshes = new Map<string, THREE.Group>();
  private rideCar: THREE.Group | null = null;
  private readonly wheels: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene) {
    this.root.name = 'taxi-stands';
    scene.add(this.root);
    this.stands = buildTaxiStands();
    this.destinations = buildTaxiDestinations();
    for (const s of this.stands) this.placeStand(s);
  }

  getState(): TaxiRideState {
    return this.state;
  }

  /** True while a pickup / ride / dropoff is in progress. */
  isRiding(): boolean {
    const p = this.state.phase;
    return p === 'pickup' || p === 'boarding' || p === 'driving' || p === 'dropoff';
  }

  nearestStand(x: number, z: number, maxDist = 8): TaxiStand | null {
    let best: TaxiStand | null = null;
    let bestD = maxDist;
    for (const s of this.stands) {
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  openMenu(stand: TaxiStand): void {
    if (this.state.phase !== 'idle' && this.state.phase !== 'menu') return;
    this.state = { phase: 'menu', stand };
  }

  closeMenu(): void {
    if (this.state.phase === 'menu') this.state = { phase: 'idle' };
  }

  startRide(fromX: number, fromZ: number, dest: TaxiDestination): number {
    const fare = estimateFare(fromX, fromZ, dest);
    this.clearRideCar();

    // Spawn taxi a short distance away for pickup approach
    const approach = spawnOffset(fromX, fromZ, 38);
    const car = createCarMesh(11, true);
    car.name = 'yango-ride';
    car.position.set(approach.x, 0, approach.z);
    car.rotation.y = Math.atan2(fromX - approach.x, fromZ - approach.z);
    this.root.add(car);
    this.rideCar = car;
    this.wheels.length = 0;
    car.traverse((o) => {
      if (o.userData.spinWheel) this.wheels.push(o);
    });

    const pickupPath = [{ x: approach.x, z: approach.z }, { x: fromX, z: fromZ }];
    const firstDur = Math.max(0.8, pathLength(pickupPath) / PICKUP_SPEED);

    this.state = {
      phase: 'pickup',
      t: 0,
      fare,
      to: dest,
      path: pickupPath,
      seg: 0,
      segT: 0,
      segDur: firstDur,
      boardT: 0,
      speed: PICKUP_SPEED,
    };
    return fare;
  }

  /**
   * Animate taxi ride. Camera should follow `follow` while riding.
   */
  update(dt: number, player: THREE.Object3D): TaxiUpdateResult {
    if (
      this.state.phase !== 'pickup' &&
      this.state.phase !== 'boarding' &&
      this.state.phase !== 'driving' &&
      this.state.phase !== 'dropoff'
    ) {
      return { riding: false };
    }

    const car = this.rideCar;
    if (!car) {
      this.state = { phase: 'idle' };
      return { riding: false };
    }

    const cap = Math.min(dt, 0.05);
    this.state.t += cap;

    if (this.state.phase === 'pickup') {
      const done = this.advanceAlongPath(car, cap);
      this.spinWheels(cap * 14);
      // Keep player waiting at pickup
      player.visible = true;
      if (done) {
        this.state.phase = 'boarding';
        this.state.boardT = 0;
        return { riding: true, status: 'Montée à bord…', follow: car };
      }
      return { riding: true, status: 'Yango arrive…', follow: car };
    }

    if (this.state.phase === 'boarding') {
      this.state.boardT += cap;
      const u = Math.min(1, this.state.boardT / BOARD_SEC);
      // Ease player toward taxi door then hide
      player.position.x = THREE.MathUtils.lerp(player.position.x, car.position.x + 1.2, u);
      player.position.z = THREE.MathUtils.lerp(player.position.z, car.position.z, u);
      player.position.y = 0;
      player.rotation.y = car.rotation.y;
      if (u >= 1) {
        player.visible = false;
        // Build city path to destination
        const drivePath = buildDrivePath(car.position.x, car.position.z, this.state.to.x, this.state.to.z);
        this.state.phase = 'driving';
        this.state.path = drivePath;
        this.state.seg = 0;
        this.state.segT = 0;
        this.state.speed = CRUISE_SPEED;
        this.state.segDur = segmentDuration(drivePath, 0, CRUISE_SPEED);
        return { riding: true, status: `En route · ${this.state.to.name}`, follow: car };
      }
      return { riding: true, status: 'Montée à bord…', follow: car };
    }

    if (this.state.phase === 'driving') {
      const done = this.advanceAlongPath(car, cap);
      this.spinWheels(cap * 18);
      // Seat player inside (invisible)
      player.position.set(car.position.x, 0, car.position.z);
      player.rotation.y = car.rotation.y;
      player.visible = false;
      if (done) {
        this.state.phase = 'dropoff';
        this.state.boardT = 0;
        return { riding: true, status: 'Arrivée…', follow: car };
      }
      const pct = Math.round(this.progress01() * 100);
      return {
        riding: true,
        status: `Yango · ${this.state.to.name} · ${pct}%`,
        follow: car,
      };
    }

    // dropoff
    this.state.boardT += cap;
    const u = Math.min(1, this.state.boardT / DROPOFF_SEC);
    player.visible = true;
    const exitX = car.position.x + Math.cos(car.rotation.y) * 2.2;
    const exitZ = car.position.z + Math.sin(car.rotation.y) * 2.2;
    // exit to the side
    const sideX = car.position.x + Math.cos(car.rotation.y - Math.PI / 2) * 2.4;
    const sideZ = car.position.z + Math.sin(car.rotation.y - Math.PI / 2) * 2.4;
    void exitX;
    void exitZ;
    player.position.x = THREE.MathUtils.lerp(car.position.x, sideX, u);
    player.position.z = THREE.MathUtils.lerp(car.position.z, sideZ, u);
    player.position.y = 0;

    if (u >= 1) {
      const arrived = {
        x: sideX,
        z: sideZ,
        fare: this.state.fare,
        name: this.state.to.name,
      };
      player.position.set(sideX, 0, sideZ);
      player.visible = true;
      // Taxi drives away briefly then despawns
      this.departAndClear(car);
      this.state = { phase: 'idle' };
      return { riding: false, arrived };
    }
    return { riding: true, status: 'Descente…', follow: car };
  }

  private advanceAlongPath(car: THREE.Group, dt: number): boolean {
    if (this.state.phase !== 'pickup' && this.state.phase !== 'driving') return true;
    const path = this.state.path;
    if (this.state.seg >= path.length - 1) return true;

    this.state.segT += dt;
    let u = Math.min(1, this.state.segT / Math.max(0.05, this.state.segDur));
    // Smoothstep
    u = u * u * (3 - 2 * u);

    const a = path[this.state.seg]!;
    const b = path[this.state.seg + 1]!;
    car.position.x = a.x + (b.x - a.x) * u;
    car.position.z = a.z + (b.z - a.z) * u;
    car.position.y = 0;

    const dx = b.x - a.x;
    const dz = b.z - a.z;
    if (dx * dx + dz * dz > 0.01) {
      const targetYaw = Math.atan2(dx, dz);
      car.rotation.y = dampAngle(car.rotation.y, targetYaw, dt * 8);
    }

    // Subtle suspension bob
    car.position.y = Math.sin(this.state.t * 14) * 0.03;

    if (this.state.segT >= this.state.segDur) {
      this.state.seg += 1;
      this.state.segT = 0;
      if (this.state.seg >= path.length - 1) {
        car.position.set(b.x, 0, b.z);
        return true;
      }
      this.state.segDur = segmentDuration(path, this.state.seg, this.state.speed);
    }
    return false;
  }

  private progress01(): number {
    if (this.state.phase !== 'driving') return 0;
    const path = this.state.path;
    let done = 0;
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const len = Math.hypot(path[i + 1]!.x - path[i]!.x, path[i + 1]!.z - path[i]!.z);
      total += len;
      if (i < this.state.seg) done += len;
      else if (i === this.state.seg) {
        done += len * Math.min(1, this.state.segT / Math.max(0.05, this.state.segDur));
      }
    }
    return total > 0 ? done / total : 1;
  }

  private spinWheels(amount: number): void {
    for (const w of this.wheels) {
      w.rotation.x += amount;
    }
  }

  private departAndClear(car: THREE.Group): void {
    // Quick drive-away tween via short timeout path
    const yaw = car.rotation.y;
    const start = { x: car.position.x, z: car.position.z };
    const end = {
      x: start.x + Math.sin(yaw) * 40,
      z: start.z + Math.cos(yaw) * 40,
    };
    const startT = performance.now();
    const dur = 900;
    const wheels = [...this.wheels];
    const tick = (now: number) => {
      const u = Math.min(1, (now - startT) / dur);
      const e = u * u * (3 - 2 * u);
      car.position.x = start.x + (end.x - start.x) * e;
      car.position.z = start.z + (end.z - start.z) * e;
      for (const w of wheels) w.rotation.x += 0.4;
      if (u < 1) requestAnimationFrame(tick);
      else {
        this.root.remove(car);
        if (this.rideCar === car) this.rideCar = null;
      }
    };
    requestAnimationFrame(tick);
  }

  private clearRideCar(): void {
    if (this.rideCar) {
      this.root.remove(this.rideCar);
      this.rideCar = null;
    }
    this.wheels.length = 0;
  }

  private placeStand(s: TaxiStand): void {
    const g = new THREE.Group();
    g.position.set(s.x, 0, s.z);
    g.userData = { taxiStandId: s.id };

    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.12, 16), mat(0xffffff));
    pad.position.y = 0.06;
    g.add(pad);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.35, 0.08, 16), mat(0xe30613));
    ring.position.y = 0.04;
    g.add(ring);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.6, 6), mat(0x333333));
    pole.position.y = 1.8;
    g.add(pole);

    const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.12), mat(0xe30613));
    board.position.set(0, 3.4, 0);
    g.add(board);

    const taxi = createCarMesh(7, true);
    taxi.position.set(3.2, 0, 0);
    taxi.rotation.y = -0.4;
    g.add(taxi);

    this.root.add(g);
    this.standMeshes.set(s.id, g);
  }
}

function spawnOffset(x: number, z: number, dist: number): { x: number; z: number } {
  // Approach along nearest grid road axis
  const toNS = Math.abs(((x % ROAD_GRID) + ROAD_GRID) % ROAD_GRID - ROAD_GRID / 2);
  const toEW = Math.abs(((z % ROAD_GRID) + ROAD_GRID) % ROAD_GRID - ROAD_GRID / 2);
  if (toNS < toEW) {
    return { x, z: z - dist };
  }
  return { x: x - dist, z };
}

/** Manhattan path through a corner — reads like city blocks. */
function buildDrivePath(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): Array<{ x: number; z: number }> {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const dist = Math.hypot(dx, dz);

  const corners: Array<{ x: number; z: number }> = [{ x: fromX, z: fromZ }];

  if (dist < 25) {
    corners.push({ x: toX, z: toZ });
    return corners;
  }

  const midX = fromX + dx * 0.5;
  const midZ = fromZ + dz * 0.5;
  const gx = Math.round(midX / ROAD_GRID) * ROAD_GRID;
  const gz = Math.round(midZ / ROAD_GRID) * ROAD_GRID;

  const cornerA = { x: toX, z: fromZ };
  const cornerB = { x: fromX, z: toZ };
  const scoreA = Math.min(Math.abs(fromZ - gz), Math.abs(toX - gx));
  const scoreB = Math.min(Math.abs(fromX - gx), Math.abs(toZ - gz));
  const via = scoreA <= scoreB ? cornerA : cornerB;

  if (Math.hypot(via.x - fromX, via.z - fromZ) > 8) corners.push(via);
  corners.push({ x: toX, z: toZ });

  // Subdivide long legs for smoother motion / wheel spin
  const refined: Array<{ x: number; z: number }> = [corners[0]!];
  for (let i = 0; i < corners.length - 1; i++) {
    const a = corners[i]!;
    const b = corners[i + 1]!;
    refined.push(...subdivide(a, b, 80));
    refined.push(b);
  }
  return dedupePath(refined);
}

function subdivide(
  a: { x: number; z: number },
  b: { x: number; z: number },
  step: number,
): Array<{ x: number; z: number }> {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.floor(len / step);
  const out: Array<{ x: number; z: number }> = [];
  for (let i = 1; i <= n; i++) {
    const u = i / (n + 1);
    out.push({ x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u });
  }
  return out;
}

function dedupePath(path: Array<{ x: number; z: number }>): Array<{ x: number; z: number }> {
  const out: Array<{ x: number; z: number }> = [];
  for (const p of path) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.z - last.z) > 2) out.push(p);
  }
  return out.length >= 2 ? out : path;
}

function pathLength(path: Array<{ x: number; z: number }>): number {
  let s = 0;
  for (let i = 0; i < path.length - 1; i++) {
    s += Math.hypot(path[i + 1]!.x - path[i]!.x, path[i + 1]!.z - path[i]!.z);
  }
  return s;
}

function segmentDuration(
  path: Array<{ x: number; z: number }>,
  seg: number,
  speed: number,
): number {
  const a = path[seg];
  const b = path[seg + 1];
  if (!a || !b) return 0.5;
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  return Math.max(0.35, len / speed);
}

function dampAngle(current: number, target: number, lambda: number): number {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return current + d * Math.min(1, lambda);
}
