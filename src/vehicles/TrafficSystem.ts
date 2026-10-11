import * as THREE from 'three';
import { WorldConfig } from '../config/WorldConfig';
import {
  HIGHWAY_HALF,
  ROAD_GRID,
  carLaneOffsets,
  gridAxes,
  roadHalfAtX,
  roadHalfAtZ,
} from '../roads/CityRoadPlan';
import { createBusMesh, createCarMesh, createMotoMesh } from './VehicleFactory';
import { skipRoadGap } from '../roads/RoadGaps';

type Vehicle = {
  mesh: THREE.Group;
  axis: 'x' | 'z';
  lane: number;
  /** Road centreline used for landmark gap checks. */
  roadCenter: number;
  pos: number;
  speed: number;
  dir: 1 | -1;
  kind: 'car' | 'taxi' | 'bus' | 'moto';
  highway: boolean;
};

/**
 * Cars drive on asphalt, facing travel direction. Right-hand traffic.
 * Slow briefly near the centre highway cross to reduce clipping.
 */
export class TrafficSystem {
  private readonly root = new THREE.Group();
  private readonly vehicles: Vehicle[] = [];

  constructor(scene: THREE.Scene, count = 42) {
    this.root.name = 'traffic';
    scene.add(this.root);
    this.spawn(count);
  }

  get count(): number {
    return this.vehicles.length;
  }

  update(dt: number, playerX: number, playerZ: number): void {
    const half = WorldConfig.worldHalfSize - 30;
    const cull = WorldConfig.lodFar + 80;
    const cullSq = cull * cull;
    const cap = Math.min(dt, 0.05);

    for (const v of this.vehicles) {
      const px = v.axis === 'z' ? v.lane : v.pos;
      const pz = v.axis === 'z' ? v.pos : v.lane;
      const dx = px - playerX;
      const dz = pz - playerZ;
      const distSq = dx * dx + dz * dz;
      const visible = distSq < cullSq;
      v.mesh.visible = visible;

      // Far cars: coarse teleport step every few frames feel, skip fine update
      if (!visible) {
        v.pos += v.speed * v.dir * cap * 0.35;
        if (v.pos > half) v.pos = -half;
        if (v.pos < -half) v.pos = half;
        continue;
      }

      let speed = v.speed;
      if (v.axis === 'z' && Math.abs(v.pos) < 22) speed *= 0.35;
      if (v.axis === 'x' && Math.abs(v.pos) < 22) speed *= 0.35;

      v.pos += speed * v.dir * cap;
      // Don't drive through landmark footprints — jump the road gap
      v.pos = skipRoadGap(v.axis, v.roadCenter, v.pos, v.dir);
      if (v.pos > half) v.pos = -half;
      if (v.pos < -half) v.pos = half;

      if (v.axis === 'z') {
        v.mesh.position.set(v.lane, 0, v.pos);
        v.mesh.rotation.y = v.dir > 0 ? 0 : Math.PI;
      } else {
        v.mesh.position.set(v.pos, 0, v.lane);
        v.mesh.rotation.y = v.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
    }
  }

  private spawn(count: number): void {
    type LaneDef = { axis: 'x' | 'z'; center: number; offset: number; highway: boolean };
    const lanes: LaneDef[] = [];

    for (const gx of gridAxes()) {
      if (Math.abs(gx) > WorldConfig.worldHalfSize - 40) continue;
      // Skip every other local street to reduce density / overlap
      if (!this.useRoad(gx)) continue;
      const halfW = roadHalfAtX(gx);
      for (const off of carLaneOffsets(halfW)) {
        lanes.push({ axis: 'z', center: gx, offset: off, highway: halfW >= HIGHWAY_HALF - 0.5 });
      }
    }
    for (const gz of gridAxes()) {
      if (Math.abs(gz) > WorldConfig.worldHalfSize - 40) continue;
      if (!this.useRoad(gz)) continue;
      const halfW = roadHalfAtZ(gz);
      for (const off of carLaneOffsets(halfW)) {
        lanes.push({ axis: 'x', center: gz, offset: off, highway: halfW >= HIGHWAY_HALF - 0.5 });
      }
    }

    const hwyLanes = lanes.filter((l) => l.highway);
    const cityLanes = lanes.filter((l) => !l.highway);

    for (let i = 0; i < count; i++) {
      const pool = i < count * 0.45 && hwyLanes.length ? hwyLanes : cityLanes.length ? cityLanes : lanes;
      if (!pool.length) break;
      const lane = pool[i % pool.length]!;

      const kindRoll = i % 12;
      const kind: Vehicle['kind'] =
        kindRoll === 0 ? 'bus' : kindRoll <= 2 ? 'taxi' : kindRoll === 3 ? 'moto' : 'car';

      let mesh: THREE.Group;
      if (kind === 'bus') mesh = createBusMesh();
      else if (kind === 'moto') mesh = createMotoMesh(i);
      else mesh = createCarMesh(i, kind === 'taxi');

      // Right-hand traffic:
      // NS (axis z): +Z on +X side; EW (axis x): +X on -Z side
      let dir: 1 | -1;
      if (lane.axis === 'z') dir = lane.offset >= 0 ? 1 : -1;
      else dir = lane.offset >= 0 ? -1 : 1;

      const baseSpeed = lane.highway ? 16 : 10;
      const speed =
        kind === 'bus' ? baseSpeed - 3 : kind === 'moto' ? baseSpeed + 3 : kind === 'taxi' ? baseSpeed + 1 : baseSpeed + (i % 3) * 0.5;

      // Stagger so cars don't stack at same pos on a lane
      const worldHalf = WorldConfig.worldHalfSize;
      const pos = -worldHalf + 40 + ((i * 47 + lane.offset * 13) % (worldHalf * 2 - 80));

      this.root.add(mesh);
      this.vehicles.push({
        mesh,
        axis: lane.axis,
        lane: lane.center + lane.offset,
        roadCenter: lane.center,
        pos,
        speed,
        dir,
        kind,
        highway: lane.highway,
      });
    }
  }

  private useRoad(axisValue: number): boolean {
    if (Math.abs(axisValue) < 0.5) return true; // highway
    if (Math.abs(axisValue) % (ROAD_GRID * 2) === 0) return true; // avenue
    // denser local streets across the city band
    return Math.abs(axisValue) <= ROAD_GRID * 8;
  }
}
