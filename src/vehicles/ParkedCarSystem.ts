import * as THREE from 'three';
import { WorldConfig } from '../config/WorldConfig';
import {
  HIGHWAY_EW_Z,
  HIGHWAY_NS_X,
  ROAD_GRID,
  gridAxes,
  sidewalkOffsetForX,
  sidewalkOffsetForZ,
} from '../roads/CityRoadPlan';
import { overlapsRoad } from '../world/RoadClearance';
import type { CollisionSystem } from '../world/CollisionSystem';
import type { Input } from '../core/Input';
import { createBrandVehicle, pickParkedBrand } from './VehicleFactory';
import { vehicleBlockedByPlayerHouse } from '../landmarks/PlayerHouse';
import { CityUniforms } from '../render/nightState';

export type ParkedCar = {
  mesh: THREE.Group;
  occupied: boolean;
};

/**
 * Parked cars the player can enter (E) and drive (WASD). Exit with E again.
 */
export class ParkedCarSystem {
  private readonly root = new THREE.Group();
  private readonly cars: ParkedCar[] = [];
  private active: ParkedCar | null = null;
  private speed = 0;
  private prevSpeed = 0;
  private blinkT = 0;
  private readonly maxSpeed = 28;
  private readonly maxReverse = 10;

  constructor(
    scene: THREE.Scene,
    private readonly collisions: CollisionSystem,
  ) {
    this.root.name = 'parked-cars';
    scene.add(this.root);
    this.spawnAlongSidewalks();
  }

  get driving(): boolean {
    return this.active !== null;
  }

  get activeMesh(): THREE.Group | null {
    return this.active?.mesh ?? null;
  }

  get currentSpeed(): number {
    return this.speed;
  }

  /** Register an existing mesh (e.g. district parked taxi) as driveable. */
  register(mesh: THREE.Group): void {
    mesh.userData.driveable = true;
    this.enableMotion(mesh);
    this.cars.push({ mesh, occupied: false });
  }

  /** Collect any driveable meshes already in the city graph. */
  collectFrom(root: THREE.Object3D): void {
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Group)) return;
      const sale = !!obj.userData.forSale;
      const drive = !!obj.userData.driveable;
      if ((!drive && !sale) || this.cars.some((c) => c.mesh === obj)) return;
      this.enableMotion(obj);
      this.cars.push({ mesh: obj, occupied: false });
    });
  }

  /** Unfreeze matrices so parked cars from the city graph can move. */
  private enableMotion(mesh: THREE.Object3D): void {
    mesh.traverse((o) => {
      o.matrixAutoUpdate = true;
    });
  }

  nearest(x: number, z: number, maxDist = 5.5): ParkedCar | null {
    let best: ParkedCar | null = null;
    let bestD = maxDist;
    for (const c of this.cars) {
      if (c.occupied) continue;
      if (c.mesh.userData.forSale && !c.mesh.userData.owned) continue;
      const d = Math.hypot(c.mesh.position.x - x, c.mesh.position.z - z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  nearestForSale(x: number, z: number, maxDist = 5.2): ParkedCar | null {
    let best: ParkedCar | null = null;
    let bestD = maxDist;
    for (const c of this.cars) {
      if (!c.mesh.userData.forSale || c.mesh.userData.owned) continue;
      const d = Math.hypot(c.mesh.position.x - x, c.mesh.position.z - z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  serializeOwned(): { sku: string; x: number; z: number; yaw: number }[] {
    const out: { sku: string; x: number; z: number; yaw: number }[] = [];
    for (const c of this.cars) {
      const sku = c.mesh.userData.sku as string | undefined;
      if (!sku || !c.mesh.userData.owned) continue;
      out.push({
        sku,
        x: c.mesh.position.x,
        z: c.mesh.position.z,
        yaw: c.mesh.rotation.y,
      });
    }
    return out;
  }

  applyOwned(list: { sku: string; x: number; z: number; yaw: number }[] | undefined): void {
    if (!list?.length) return;
    for (const s of list) {
      const car = this.cars.find((c) => c.mesh.userData.sku === s.sku);
      if (!car) continue;
      car.mesh.userData.owned = true;
      car.mesh.userData.driveable = true;
      car.mesh.position.set(s.x, 0, s.z);
      car.mesh.rotation.y = s.yaw;
    }
  }

  tryEnter(player: THREE.Object3D): boolean {
    if (this.active) return false;
    const car = this.nearest(player.position.x, player.position.z, 5.5);
    if (!car) return false;
    if (car.mesh.userData.forSale && !car.mesh.userData.owned) return false;
    this.active = car;
    car.occupied = true;
    this.speed = 0;
    this.prevSpeed = 0;
    player.visible = false;
    player.position.copy(car.mesh.position);
    return true;
  }

  exit(player: THREE.Object3D): boolean {
    if (!this.active) return false;
    const car = this.active;
    const yaw = car.mesh.rotation.y;
    // Step out to the left of the car
    const sideX = Math.cos(yaw) * 2.4;
    const sideZ = -Math.sin(yaw) * 2.4;
    player.position.set(car.mesh.position.x + sideX, 0, car.mesh.position.z + sideZ);
    player.rotation.y = yaw;
    player.visible = true;
    car.occupied = false;
    this.resetMotion(car.mesh);
    this.active = null;
    this.speed = 0;
    this.prevSpeed = 0;
    return true;
  }

  /**
   * Drive the occupied car. Returns the follow target (car mesh) when driving.
   */
  update(dt: number, input: Input, player: THREE.Object3D): THREE.Object3D | null {
    if (!this.active) return null;
    const car = this.active.mesh;
    const axes = input.getMoveAxes();
    const cap = Math.min(dt, 0.05);

    const throttle = -axes.z;
    const steerInput = axes.x;

    if (throttle > 0.05) {
      this.speed += throttle * 20 * cap;
    } else if (throttle < -0.05) {
      this.speed += throttle * 16 * cap;
    } else {
      this.speed *= 1 - 2.2 * cap;
      if (Math.abs(this.speed) < 0.15) this.speed = 0;
    }

    this.speed = THREE.MathUtils.clamp(this.speed, -this.maxReverse, this.maxSpeed);
    if (input.isRunning()) {
      this.speed = THREE.MathUtils.clamp(this.speed, -this.maxReverse, this.maxSpeed + 4);
      if (throttle > 0.05) this.speed += 8 * cap;
    }

    if (Math.abs(this.speed) > 0.4) {
      const steer = steerInput * 1.7 * (1 - Math.min(0.65, Math.abs(this.speed) / this.maxSpeed));
      car.rotation.y -= steer * Math.sign(this.speed) * cap;
    }

    const halfL = (car.userData.halfLength as number | undefined) ?? 2.05;
    const halfW = (car.userData.halfWidth as number | undefined) ?? 1.05;
    const bound = WorldConfig.worldHalfSize - 25;

    // Sub-steps stop tunneling through thin walls at speed
    const dist = Math.abs(this.speed) * cap;
    const steps = Math.max(1, Math.min(8, Math.ceil(dist / 0.55)));
    const stepDt = cap / steps;

    for (let s = 0; s < steps; s++) {
      const yaw = car.rotation.y;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const prevX = car.position.x;
      const prevZ = car.position.z;
      const nx = prevX + fx * this.speed * stepDt;
      const nz = prevZ + fz * this.speed * stepDt;

      // Maisons : pas d'entrée dans l'intérieur (allée OK)
      let rx = nx;
      let rz = nz;
      if (vehicleBlockedByPlayerHouse(nx, nz)) {
        if (!vehicleBlockedByPlayerHouse(prevX, nz)) rx = prevX;
        else if (!vehicleBlockedByPlayerHouse(nx, prevZ)) rz = prevZ;
        else {
          car.position.x = prevX;
          car.position.z = prevZ;
          this.speed = 0;
          break;
        }
        this.speed *= 0.2;
      }

      const resolved = this.collisions.resolveVehicle(rx, rz, yaw, halfL, halfW, 0, 1.8);
      if (vehicleBlockedByPlayerHouse(resolved.x, resolved.z)) {
        car.position.x = prevX;
        car.position.z = prevZ;
        this.speed = 0;
        break;
      }
      car.position.x = THREE.MathUtils.clamp(resolved.x, -bound, bound);
      car.position.z = THREE.MathUtils.clamp(resolved.z, -bound, bound);

      if (resolved.hit) {
        const slid = Math.hypot(car.position.x - nx, car.position.z - nz);
        // Blocked forward: kill speed; if still overlapping, snap back
        if (slid > 0.02) this.speed *= 0.25;
        else this.speed = 0;

        const check = this.collisions.resolveVehicle(
          car.position.x,
          car.position.z,
          yaw,
          halfL,
          halfW,
          0,
          1.8,
        );
        if (check.hit && Math.hypot(check.x - prevX, check.z - prevZ) > Math.hypot(car.position.x - prevX, car.position.z - prevZ) + 0.01) {
          // prefer previous free pose if push got worse
        }
        // If we barely moved toward intent, revert step
        const intent = Math.hypot(nx - prevX, nz - prevZ);
        const actual = Math.hypot(car.position.x - prevX, car.position.z - prevZ);
        if (intent > 0.01 && actual < intent * 0.15) {
          car.position.x = prevX;
          car.position.z = prevZ;
          this.speed = 0;
          break;
        }
      }
    }

    player.position.set(car.position.x, 0, car.position.z);
    player.rotation.y = car.rotation.y;

    this.blinkT += cap;
    this.animateDrive(car, cap, throttle, steerInput);
    this.prevSpeed = this.speed;

    return car;
  }

  private resetMotion(car: THREE.Group): void {
    const chassis = car.userData.chassis as THREE.Group | undefined;
    if (chassis) chassis.rotation.x = 0;
    const steers = car.userData.steerWheels as THREE.Group[] | undefined;
    if (steers) for (const s of steers) s.rotation.y = 0;
    const brake = car.userData.brakeMat as THREE.MeshStandardMaterial | undefined;
    if (brake) brake.emissiveIntensity = 0.22;
    const rev = car.userData.reverseMat as THREE.MeshStandardMaterial | undefined;
    if (rev) rev.emissiveIntensity = 0.08;
  }

  private animateDrive(
    car: THREE.Group,
    dt: number,
    throttle: number,
    steerInput: number,
  ): void {
    const radius = (car.userData.wheelRadius as number | undefined) ?? 0.32;
    const ang = (this.speed * dt) / Math.max(0.12, radius);
    const spins = car.userData.spinWheels as THREE.Group[] | undefined;
    if (spins) for (const w of spins) w.rotation.x += ang;

    const steers = car.userData.steerWheels as THREE.Group[] | undefined;
    const steerAng = THREE.MathUtils.clamp(-steerInput * 0.42, -0.5, 0.5);
    if (steers) for (const s of steers) s.rotation.y = steerAng;

    const chassis = car.userData.chassis as THREE.Group | undefined;
    if (chassis) {
      const pitch = THREE.MathUtils.clamp(-throttle * 0.035, -0.05, 0.05);
      chassis.rotation.x = THREE.MathUtils.lerp(chassis.rotation.x, pitch, Math.min(1, dt * 8));
    }

    const braking =
      throttle < -0.12 || (this.speed > 1.5 && throttle < 0.04 && this.speed < this.prevSpeed);
    const reversing = this.speed < -0.4;
    const night = CityUniforms.uNight.value;
    const head = car.userData.headMat as THREE.MeshStandardMaterial | undefined;
    if (head) head.emissiveIntensity = 0.28 + night * 2.15;
    const brake = car.userData.brakeMat as THREE.MeshStandardMaterial | undefined;
    if (brake) brake.emissiveIntensity = braking ? 2.6 : 0.22;
    const rev = car.userData.reverseMat as THREE.MeshStandardMaterial | undefined;
    if (rev) rev.emissiveIntensity = reversing ? 1.8 : 0.08;
    const ind = car.userData.indicatorMat as THREE.MeshStandardMaterial | undefined;
    if (ind) {
      ind.emissiveIntensity =
        Math.abs(steerInput) > 0.45 ? (Math.sin(this.blinkT * 10) > 0 ? 2.2 : 0.1) : 0.12;
    }
  }

  /** Solid bodies so the walker cannot step through parked or driven cars. */
  syncPlayerBlockers(): void {
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i]!;
      const id = `parked-${i}`;
      if (c === this.active || !c.mesh.visible) {
        this.collisions.clearDynamicBox(id);
        continue;
      }
      const m = c.mesh;
      const halfL = (m.userData.halfLength as number | undefined) ?? 2.05;
      const halfW = (m.userData.halfWidth as number | undefined) ?? 1.05;
      this.collisions.setVehicleBox(id, m.position.x, m.position.z, m.rotation.y, halfL, halfW);
    }
  }

  private spawnAlongSidewalks(): void {
    let id = 0;
    const axes = gridAxes().filter((a) => Math.abs(a) <= 720);

    // Park along N–S roads (cars face along the road / parallel to sidewalk)
    for (const gx of axes) {
      if (Math.abs(gx) % (ROAD_GRID * 2) !== 0 && gx !== HIGHWAY_NS_X) continue;
      const off = sidewalkOffsetForX(gx) + 2.2;
      for (const side of [-1, 1] as const) {
        for (let z = -600; z <= 600; z += 90 + (id % 3) * 12) {
          if (Math.abs(z) < 50) continue;
          const x = gx + side * off;
          if (overlapsRoad(x, z, 1.2, 2.2)) continue;
          // Face along ±Z (road direction)
          const yaw = z > 0 ? 0 : Math.PI;
          this.addCar(id++, x, z, yaw);
        }
      }
    }

    // Park along E–W roads
    for (const gz of axes) {
      if (Math.abs(gz) % (ROAD_GRID * 2) !== 0 && gz !== HIGHWAY_EW_Z) continue;
      const off = sidewalkOffsetForZ(gz) + 2.2;
      for (const side of [-1, 1] as const) {
        for (let x = -600; x <= 600; x += 96 + (id % 4) * 10) {
          if (Math.abs(x) < 50) continue;
          const z = gz + side * off;
          if (overlapsRoad(x, z, 2.2, 1.2)) continue;
          const yaw = x > 0 ? -Math.PI / 2 : Math.PI / 2;
          this.addCar(id++, x, z, yaw);
        }
      }
    }
  }

  private addCar(seed: number, x: number, z: number, yaw: number): void {
    if (this.cars.length >= 70) return;
    if (vehicleBlockedByPlayerHouse(x, z, 2.5)) return;
    const brand = pickParkedBrand(seed);
    const mesh = createBrandVehicle(seed, brand);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
    mesh.userData.driveable = true;
    mesh.userData.parkedCar = true;
    this.root.add(mesh);
    this.cars.push({ mesh, occupied: false });
  }
}
