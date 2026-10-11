import * as THREE from 'three';
import { createNpcAvatar, type NpcRole } from './NpcAvatar';
import { WorldConfig } from '../config/WorldConfig';
import {
  HIGHWAY_EW_Z,
  HIGHWAY_NS_X,
  ROAD_GRID,
  gridAxes,
  sidewalkOffsetForX,
  sidewalkOffsetForZ,
} from '../roads/CityRoadPlan';
import { LIFE_SPOTS } from '../sim/LifeSpots';

type Ped = {
  mesh: THREE.Group;
  path: Array<{ x: number; z: number }>;
  waypoint: number;
  speed: number;
  phase: number;
  name: string;
  role: NpcRole;
  paused: boolean;
};

/**
 * NPCs walk ONLY on sidewalks. Culled + sparsely animated for performance.
 */
export class PedestrianSystem {
  private readonly root = new THREE.Group();
  private readonly peds: Ped[] = [];
  private readonly density: number;
  private tick = 0;

  constructor(
    scene: THREE.Scene,
    landmarkAnchors: Array<{ x: number; z: number; landmarkId: string }> = [],
    density = 0.55,
  ) {
    this.density = Math.max(0.35, Math.min(1.8, density));
    this.root.name = 'pedestrians';
    scene.add(this.root);
    this.spawnSidewalkTraffic();
    this.spawnLandmarkSidewalks(landmarkAnchors);
    this.spawnLifeWorkers();
  }

  update(dt: number, playerX: number, playerZ: number): void {
    this.tick += 1;
    const nearDist = WorldConfig.lodFar;
    const nearDistSq = (nearDist + 30) * (nearDist + 30);
    const animDistSq = 55 * 55;

    for (let i = 0; i < this.peds.length; i++) {
      const ped = this.peds[i]!;
      // Stagger far visibility checks across frames
      if ((i + this.tick) % 3 !== 0 && !ped.mesh.visible) continue;

      const dx = ped.mesh.position.x - playerX;
      const dz = ped.mesh.position.z - playerZ;
      const distSq = dx * dx + dz * dz;
      const visible = distSq < nearDistSq;
      ped.mesh.visible = visible;
      if (!visible) continue;

      if (!ped.paused) {
        const target = ped.path[ped.waypoint]!;
        const tx = target.x - ped.mesh.position.x;
        const tz = target.z - ped.mesh.position.z;
        const len = Math.hypot(tx, tz);
        if (len < 0.35) {
          ped.waypoint = (ped.waypoint + 1) % ped.path.length;
        } else {
          const nx = tx / len;
          const nz = tz / len;
          ped.mesh.position.x += nx * ped.speed * dt;
          ped.mesh.position.z += nz * ped.speed * dt;
          ped.mesh.rotation.y = Math.atan2(nx, nz);
        }
      }

      if (distSq > animDistSq) continue;
      ped.phase += dt * (ped.paused ? 1.2 : ped.speed * 2.2);
      const swing = ped.paused ? Math.sin(ped.phase) * 0.08 : Math.sin(ped.phase) * 0.55;
      const legL = ped.mesh.userData.legL as THREE.Group | undefined;
      const legR = ped.mesh.userData.legR as THREE.Group | undefined;
      const armL = ped.mesh.userData.armL as THREE.Group | undefined;
      const armR = ped.mesh.userData.armR as THREE.Group | undefined;
      if (legL) legL.rotation.x = swing;
      if (legR) legR.rotation.x = -swing;
      if (armL) armL.rotation.x = ped.paused ? -0.4 + swing : -swing * 0.6;
      if (armR) armR.rotation.x = ped.paused ? -0.35 - swing : swing * 0.6;
    }
  }

  get count(): number {
    return this.peds.length;
  }

  nearest(
    x: number,
    z: number,
    maxDist = 3.2,
  ): { mesh: THREE.Group; name: string; role: NpcRole } | null {
    let best: Ped | null = null;
    let bestD = maxDist;
    for (const ped of this.peds) {
      if (!ped.mesh.visible) continue;
      const d = Math.hypot(ped.mesh.position.x - x, ped.mesh.position.z - z);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    if (!best) return null;
    return { mesh: best.mesh, name: best.name, role: best.role };
  }

  setPaused(mesh: THREE.Group, paused: boolean): void {
    const ped = this.peds.find((p) => p.mesh === mesh);
    if (ped) ped.paused = paused;
  }

  private spawnSidewalkTraffic(): void {
    let id = 0;
    const axes = gridAxes().filter((a) => Math.abs(a) <= 500);
    const important = axes.filter(
      (a) =>
        a === HIGHWAY_NS_X ||
        a === HIGHWAY_EW_Z ||
        Math.abs(a) % (ROAD_GRID * 2) === 0 ||
        Math.abs(a) <= ROAD_GRID * 2,
    );

    for (const gx of important) {
      const off = sidewalkOffsetForX(gx);
      for (const side of [-1, 1] as const) {
        const x = gx + side * off;
        const count =
          gx === HIGHWAY_NS_X ? Math.floor(12 * this.density) : Math.floor(4.5 * this.density);
        for (let i = 0; i < count; i++) {
          const z0 = -420 + ((id * 73) % 840);
          const z1 = z0 + 60 + (i % 4) * 20;
          const role: NpcRole =
            i % 7 === 0 ? 'shopper' : i % 5 === 0 ? 'employee' : 'pedestrian';
          this.addPed(id++, [{ x, z: z0 }, { x, z: z1 }, { x, z: z0 + 120 }, { x, z: z0 }], role);
        }
      }
    }

    for (const gz of important) {
      const off = sidewalkOffsetForZ(gz);
      for (const side of [-1, 1] as const) {
        const z = gz + side * off;
        const count =
          gz === HIGHWAY_EW_Z ? Math.floor(12 * this.density) : Math.floor(4.5 * this.density);
        for (let i = 0; i < count; i++) {
          const x0 = -420 + ((id * 89) % 840);
          const x1 = x0 + 60 + (i % 4) * 20;
          const role: NpcRole =
            i % 5 === 0 ? 'student' : i % 8 === 0 ? 'tourist' : 'pedestrian';
          this.addPed(id++, [{ x: x0, z }, { x: x1, z }, { x: x0 + 120, z }, { x: x0, z }], role);
        }
      }
    }

    const squares: Array<Array<{ x: number; z: number }>> = [
      [
        { x: 20, z: 20 },
        { x: 36, z: 20 },
        { x: 36, z: 36 },
        { x: 20, z: 36 },
      ],
      [
        { x: -20, z: 20 },
        { x: -36, z: 20 },
        { x: -36, z: 36 },
        { x: -20, z: 36 },
      ],
      [
        { x: 20, z: -20 },
        { x: 36, z: -20 },
        { x: 36, z: -36 },
        { x: 20, z: -36 },
      ],
      [
        { x: -20, z: -20 },
        { x: -36, z: -20 },
        { x: -36, z: -36 },
        { x: -20, z: -36 },
      ],
    ];
    for (let i = 0; i < Math.floor(28 * this.density); i++) {
      this.addPed(id++, squares[i % squares.length]!, i % 3 === 0 ? 'tourist' : 'pedestrian');
    }
  }

  private spawnLandmarkSidewalks(anchors: Array<{ x: number; z: number; landmarkId: string }>): void {
    let id = 5000;
    const maxAnchors = 72;
    const list =
      anchors.length > maxAnchors
        ? anchors.filter((_, i) => i % Math.ceil(anchors.length / maxAnchors) === 0)
        : anchors;

    for (const a of list) {
      const gx = Math.round(a.x / ROAD_GRID) * ROAD_GRID;
      const off = sidewalkOffsetForX(gx);
      const x = gx + (a.x >= gx ? off : -off);
      const hot =
        a.landmarkId === 'nsimalen-airport' ||
        a.landmarkId === 'santa-lucia' ||
        a.landmarkId === 'mfoundi-mall' ||
        a.landmarkId === 'marche-mokolo' ||
        a.landmarkId === 'hopital-central' ||
        a.landmarkId === 'agence-voyage-mvan';
      const roles: NpcRole[] =
        a.landmarkId === 'nsimalen-airport'
          ? ['tourist', 'employee', 'security']
          : hot
            ? ['shopper', 'employee', 'pedestrian', 'tourist']
            : ['pedestrian', 'student'];

      const n = Math.floor((hot ? 5.5 : 3.2) * this.density);
      for (let i = 0; i < n; i++) {
        const z0 = a.z - 8 + i * 4;
        this.addPed(id++, [{ x, z: z0 }, { x, z: z0 + 22 }, { x, z: z0 + 6 }], roles[i % roles.length]!);
      }
    }
  }

  /** Merchants, cashiers, job-site workers around life spots. */
  private spawnLifeWorkers(): void {
    let id = 9000;
    for (const s of LIFE_SPOTS) {
      const standing =
        s.kind === 'job' ? Math.floor(4 * this.density) : Math.floor(3 * this.density);
      const walkers = Math.floor(2.5 * this.density);
      const role: NpcRole =
        s.kind === 'job' ? 'employee' : s.kind === 'shop' ? 'shopper' : s.kind === 'food' ? 'employee' : 'employee';

      for (let i = 0; i < standing; i++) {
        const ang = (i / Math.max(1, standing)) * Math.PI * 2;
        const px = s.x + Math.cos(ang) * 3.2;
        const pz = s.z + Math.sin(ang) * 3.2;
        this.addPed(
          id++,
          [
            { x: px, z: pz },
            { x: px + 0.4, z: pz + 0.3 },
            { x: px, z: pz },
          ],
          role,
          true,
        );
      }
      for (let i = 0; i < walkers; i++) {
        const x0 = s.x - 6 + (i % 3) * 4;
        const z0 = s.z - 5;
        this.addPed(
          id++,
          [
            { x: x0, z: z0 },
            { x: x0 + 8, z: z0 + 4 },
            { x: x0 + 2, z: z0 + 10 },
            { x: x0, z: z0 },
          ],
          i % 2 === 0 ? 'shopper' : role,
          false,
        );
      }
      // Security at jobs
      if (s.kind === 'job') {
        this.addPed(
          id++,
          [
            { x: s.x + 5, z: s.z - 4 },
            { x: s.x + 5, z: s.z + 4 },
            { x: s.x + 5, z: s.z - 4 },
          ],
          'security',
          false,
        );
      }
    }
  }

  private addPed(
    seed: number,
    path: Array<{ x: number; z: number }>,
    role: NpcRole,
    paused = false,
  ): void {
    if (path.length < 2) return;
    if (this.peds.length >= 320) return;
    const mesh = createNpcAvatar(seed, role);
    const start = path[0]!;
    mesh.position.set(start.x, 0, start.z);
    const name = pickNpcName(seed, role);
    mesh.userData.npcName = name;
    mesh.userData.npcRole = role;
    this.root.add(mesh);
    this.peds.push({
      mesh,
      path,
      waypoint: 1,
      speed: paused ? 0.4 : 1.05 + (seed % 5) * 0.12,
      phase: seed * 0.3,
      name,
      role,
      paused,
    });
  }
}

const FIRST = ['Amina', 'Jean', 'Paul', 'Marie', 'Eric', 'Fatou', 'Serge', 'Claire', 'Boris', 'Nadine', 'Yves', 'Sandra'];
const LAST = ['Ngono', 'Kamga', 'Mvondo', 'Atangana', 'Fouda', 'Biya', 'Owona', 'Essomba', 'Talla', 'Mbarga'];

function pickNpcName(seed: number, role: NpcRole): string {
  const f = FIRST[seed % FIRST.length]!;
  const l = LAST[(seed * 7) % LAST.length]!;
  if (role === 'security') return `Agent ${l}`;
  if (role === 'employee') return `${f} · employé(e)`;
  if (role === 'student') return `${f} · étudiant(e)`;
  if (role === 'tourist') return `${f} · visiteur`;
  if (role === 'shopper') return `${f} ${l}`;
  return `${f} ${l}`;
}
