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
import { pickupStop, taxiRoute, type RoadPoint } from './RoadRoute';

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
      /** Metres travelled along the current segment. */
      segT: number;
      boardT: number;
      /** Cruise speed for the current phase. */
      speed: number;
      /** Current speed. */
      v: number;
      /** Pavement point where the passenger steps out. */
      exit: { x: number; z: number } | null;
    };

export type TaxiUpdateResult = {
  riding: boolean;
  status?: string;
  arrived?: { x: number; z: number; fare: number; name: string };
  follow?: THREE.Object3D;
};

const PICKUP_SPEED = 14;
const CRUISE_SPEED = 30;
const CORNER_SPEED = 9;
const ACCEL = 9;
const BRAKE = 8;
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
  private pickRoad: RoadPoint | null = null;
  private readonly wheels: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene) {
    this.root.name = 'taxi-stands';
    scene.add(this.root);
    this.stands = buildTaxiStands();
    this.destinations = buildTaxiDestinations();
    for (const s of this.stands) this.placeStand(s);
  }

  /** Hide stands far from the viewer (each stand is a car, a shelter and a sign). */
  cull(x: number, z: number, range = 240): void {
    const r2 = range * range;
    for (const s of this.stands) {
      const m = this.standMeshes.get(s.id);
      if (m) m.visible = (s.x - x) ** 2 + (s.z - z) ** 2 < r2;
    }
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

    // The taxi comes up the nearest road in the kerb lane and stops level with the passenger
    const pick = pickupStop(fromX, fromZ);
    this.pickRoad = pick?.road ?? null;
    const approach = pick?.approach ?? { x: fromX, z: fromZ - 30 };
    const stop = pick?.stop ?? { x: fromX, z: fromZ };
    const car = createCarMesh(11, true);
    car.name = 'yango-ride';
    car.position.set(approach.x, 0, approach.z);
    car.rotation.y = Math.atan2(stop.x - approach.x, stop.z - approach.z);
    this.root.add(car);
    this.rideCar = car;
    this.wheels.length = 0;
    car.traverse((o) => {
      if (o.userData.spinWheel) this.wheels.push(o);
    });

    this.state = {
      phase: 'pickup',
      t: 0,
      fare,
      to: dest,
      path: [approach, stop],
      seg: 0,
      segT: 0,
      boardT: 0,
      speed: PICKUP_SPEED,
      v: PICKUP_SPEED * 0.6,
      exit: null,
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
      player.position.x = THREE.MathUtils.lerp(player.position.x, car.position.x, u);
      player.position.z = THREE.MathUtils.lerp(player.position.z, car.position.z, u);
      player.position.y = 0;
      player.rotation.y = car.rotation.y;
      if (u >= 1) {
        player.visible = false;
        const route = this.pickRoad ? taxiRoute(this.pickRoad, this.state.to.x, this.state.to.z) : null;
        this.state.phase = 'driving';
        this.state.path = route?.path ?? [
          { x: car.position.x, z: car.position.z },
          { x: this.state.to.x, z: this.state.to.z },
        ];
        this.state.exit = route?.exit ?? null;
        this.state.seg = 0;
        this.state.segT = 0;
        this.state.speed = CRUISE_SPEED;
        this.state.v = 0;
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
    // step out onto the pavement on the kerb side
    const sideX = this.state.exit?.x ?? car.position.x - Math.cos(car.rotation.y) * 2.4;
    const sideZ = this.state.exit?.z ?? car.position.z + Math.sin(car.rotation.y) * 2.4;
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
    const s = this.state;
    const path = s.path;
    if (s.seg >= path.length - 1) return true;

    // speed limit: brake for the stop at the end and for each bend ahead
    let limit = s.speed;
    let ahead = segLen(path, s.seg) - s.segT;
    for (let i = s.seg + 1; i < path.length - 1 && ahead < 140; i++) {
      if (turnAngle(path, i) > 0.2) limit = Math.min(limit, Math.sqrt(CORNER_SPEED * CORNER_SPEED + 2 * BRAKE * ahead));
      ahead += segLen(path, i);
    }
    const toEnd = totalFrom(path, s.seg) - s.segT;
    limit = Math.min(limit, Math.sqrt(2 * BRAKE * Math.max(0, toEnd)) + 0.8);
    s.v = s.v < limit ? Math.min(limit, s.v + ACCEL * dt) : Math.max(limit, s.v - BRAKE * 1.6 * dt);

    let step = s.v * dt;
    while (step > 0 && s.seg < path.length - 1) {
      const left = segLen(path, s.seg) - s.segT;
      if (step < left) {
        s.segT += step;
        step = 0;
      } else {
        step -= left;
        s.seg += 1;
        s.segT = 0;
      }
    }
    if (s.seg >= path.length - 1) {
      const end = path[path.length - 1]!;
      car.position.set(end.x, 0, end.z);
      return true;
    }
    const a = path[s.seg]!;
    const b = path[s.seg + 1]!;
    const u = s.segT / Math.max(0.01, segLen(path, s.seg));
    car.position.x = a.x + (b.x - a.x) * u;
    car.position.z = a.z + (b.z - a.z) * u;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    if (dx * dx + dz * dz > 0.01) car.rotation.y = dampAngle(car.rotation.y, Math.atan2(dx, dz), dt * 9);
    // Subtle suspension bob
    car.position.y = Math.sin(s.t * 14) * 0.03;
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
      else if (i === this.state.seg) done += Math.min(len, this.state.segT);
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

type P = { x: number; z: number };

function segLen(path: P[], i: number): number {
  const a = path[i]!;
  const b = path[i + 1]!;
  return Math.hypot(b.x - a.x, b.z - a.z);
}

function totalFrom(path: P[], seg: number): number {
  let s = 0;
  for (let i = seg; i < path.length - 1; i++) s += segLen(path, i);
  return s;
}

/** Heading change at vertex i, radians. */
function turnAngle(path: P[], i: number): number {
  const a = path[i - 1]!;
  const b = path[i]!;
  const c = path[i + 1]!;
  const h1 = Math.atan2(b.x - a.x, b.z - a.z);
  const h2 = Math.atan2(c.x - b.x, c.z - b.z);
  let d = h2 - h1;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

function dampAngle(current: number, target: number, lambda: number): number {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return current + d * Math.min(1, lambda);
}
