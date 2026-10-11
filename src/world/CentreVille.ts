import * as THREE from 'three';
import { mat } from './materials';
import { createBuilding } from '../buildings/BuildingFactory';
import type { CollisionSystem } from './CollisionSystem';
import { HIGHWAY_HALF } from '../roads/CityRoadPlan';
import { overlapsRoad } from './RoadClearance';

/**
 * Centre-ville without roundabout: highway cross stays clear,
 * four corner plazas + office towers + shop arcades.
 */
export function buildCentreVille(root: THREE.Group, collisions: CollisionSystem): number {
  let n = 0;

  // Four rectangular plazas in the quadrants (no circular island / rond-point)
  const plazas: Array<[number, number]> = [
    [28, 28],
    [-28, 28],
    [28, -28],
    [-28, -28],
  ];
  for (const [px, pz] of plazas) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(22, 0.1, 22), mat(0x9e9e9e));
    slab.position.set(px, 0.05, pz);
    slab.receiveShadow = true;
    root.add(slab);
    // Small tree / planter — not a roundabout
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.7, 10), mat(0x6d4c41));
    pot.position.set(px, 0.4, pz);
    root.add(pot);
    const bush = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), mat(0x4e7a45));
    bush.position.set(px, 1.5, pz);
    root.add(bush);
  }

  // Benches on plaza corners only
  for (const [px, pz] of plazas) {
    for (const [dx, dz] of [
      [6, 6],
      [-6, 6],
    ] as const) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 0.55), mat(0x5d4037));
      bench.position.set(px + dx, 0.35, pz + dz);
      root.add(bench);
    }
  }

  // Four landmark office towers
  const towers: Array<{ x: number; z: number; yaw: number; h: number; color: number }> = [
    { x: 48, z: 48, yaw: -Math.PI / 4, h: 26, color: 0xcfd8dc },
    { x: -48, z: 48, yaw: Math.PI / 4, h: 22, color: 0xeceff1 },
    { x: 48, z: -48, yaw: Math.PI / 4, h: 24, color: 0xb0bec5 },
    { x: -48, z: -48, yaw: -Math.PI / 4, h: 20, color: 0xd7ccc8 },
  ];

  for (const t of towers) {
    if (overlapsRoad(t.x, t.z, 10, 10)) continue;
    root.add(
      createBuilding(
        {
          id: `cv-tower-${t.x}-${t.z}`,
          name: 'Tour Centre-ville',
          x: t.x,
          z: t.z,
          width: 16,
          depth: 14,
          height: t.h,
          color: t.color,
          kind: 'office',
          districtId: 'centre-ville',
          yaw: t.yaw,
          collide: true,
        },
        collisions,
      ),
    );
    n += 1;
  }

  // Shop arcades along sidewalks (off asphalt)
  const arcadeZ = HIGHWAY_HALF + 18;
  for (const side of [-1, 1] as const) {
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const x = i * 22;
      const z = side * arcadeZ;
      if (overlapsRoad(x, z, 6, 5)) continue;
      root.add(
        createBuilding(
          {
            id: `cv-arcade-${side}-${i}`,
            name: 'Galerie Centre',
            x,
            z,
            width: 12,
            depth: 9,
            height: 8 + (i % 2) * 3,
            color: [0xfff8e1, 0xeceff1, 0xd7ccc8][Math.abs(i) % 3]!,
            kind: 'shop',
            districtId: 'centre-ville',
            yaw: side > 0 ? Math.PI : 0,
            collide: true,
          },
          collisions,
        ),
      );
      n += 1;
    }
  }

  return n;
}
