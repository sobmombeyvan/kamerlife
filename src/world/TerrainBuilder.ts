import * as THREE from 'three';
import { WorldConfig } from '../config/WorldConfig';
import { ROAD_GRID } from './RoadClearance';
import { DISTRICTS } from '../data/districts';
import { retileMeshInPlace, surfaceMat } from '../render/surfaces';
import { bakeAndMerge } from '../render/mergeStatic';

/**
 * Urban ground (less grass) + surrounding / in-city hills.
 */
export function buildTerrain(root: THREE.Group): void {
  const half = WorldConfig.worldHalfSize;
  const size = half * 2 + 240;
  const terrain = new THREE.Group();
  terrain.name = 'terrain';

  // Base laterite / urban dirt — NOT a big green lawn
  const earth = new THREE.Mesh(new THREE.BoxGeometry(size, 0.9, size), surfaceMat('earth', 0x8a7358));
  earth.position.y = -0.5;
  earth.receiveShadow = true;
  retileMeshInPlace(earth, 4.2);
  terrain.add(earth);

  // Compacted urban fill over the city footprint
  const urban = new THREE.Mesh(new THREE.BoxGeometry(size - 80, 0.08, size - 80), surfaceMat('earth', 0x6f675c));
  urban.position.y = -0.02;
  urban.receiveShadow = true;
  retileMeshInPlace(urban, 3.6);
  terrain.add(urban);

  // Courtyard / plot fills inside each road block (reduces "empty green")
  const plotMat = surfaceMat('earth', 0x7a7164);
  const concreteMat = surfaceMat('concrete', 0x8e8880);
  const plots = new THREE.Group();
  plots.name = 'terrain-plots';
  for (let gx = -half; gx < half; gx += ROAD_GRID) {
    for (let gz = -half; gz < half; gz += ROAD_GRID) {
      // Only near districts to save draw calls
      let near = false;
      for (const d of DISTRICTS) {
        if (Math.hypot(gx + ROAD_GRID / 2 - d.center.x, gz + ROAD_GRID / 2 - d.center.z) < d.radius + 40) {
          near = true;
          break;
        }
      }
      if (!near) continue;
      const inset = 13;
      const plot = new THREE.Mesh(
        new THREE.BoxGeometry(ROAD_GRID - inset * 2, 0.05, ROAD_GRID - inset * 2),
        (gx + gz) % (ROAD_GRID * 2) === 0 ? concreteMat : plotMat,
      );
      plot.position.set(gx + ROAD_GRID / 2, 0.01, gz + ROAD_GRID / 2);
      plot.receiveShadow = true;
      plots.add(plot);
    }
  }
  bakeAndMerge(plots);
  terrain.add(plots);

  // Sparse park patches only (not the whole map)
  for (const d of DISTRICTS) {
    if (d.density !== 'villa' && d.density !== 'campus' && d.id !== 'centre-ville') continue;
    const park = new THREE.Mesh(new THREE.CylinderGeometry(28, 32, 0.06, 12), surfaceMat('grass', 0x5f8a52));
    park.position.set(d.center.x + 25, 0.04, d.center.z - 20);
    retileMeshInPlace(park, 2.4);
    terrain.add(park);
  }

  addHills(terrain, half);
  root.add(terrain);
}

function addHills(root: THREE.Group, half: number): void {
  // Outer ring of large hills
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = half * 0.88 + (i % 5) * 35;
    const hill = new THREE.Mesh(
      new THREE.SphereGeometry(1, 10, 8),
      surfaceMat('grass', i % 3 === 0 ? 0x4d7048 : i % 3 === 1 ? 0x5a7d52 : 0x6a8b5e),
    );
    hill.position.set(Math.cos(a) * r, 14 + (i % 4) * 7, Math.sin(a) * r);
    hill.scale.set(48 + (i % 6) * 12, 20 + (i % 4) * 10, 44 + (i % 5) * 10);
    retileMeshInPlace(hill, 8);
    root.add(hill);
  }

  // Inner ridges / neighbourhood hills (Yaoundé relief)
  const ridges: Array<[number, number, number, number, number]> = [
    [420, 420, 95, 48, 85], // Mont Fébé area
    [-500, -380, 70, 32, 60],
    [700, -200, 55, 28, 50],
    [-200, 650, 60, 30, 55],
    [900, 500, 50, 26, 48],
    [-800, 200, 65, 34, 58],
    [300, -700, 58, 30, 52],
    [-600, 700, 52, 27, 48],
    [1100, -100, 45, 22, 40],
    [-100, -900, 48, 24, 42],
  ];
  for (const [x, z, sx, sy, sz] of ridges) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), surfaceMat('grass', 0x5c7f54));
    hill.position.set(x, sy * 0.45, z);
    hill.scale.set(sx, sy, sz);
    retileMeshInPlace(hill, 7);
    root.add(hill);
    // Secondary bump
    const bump = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), surfaceMat('earth', 0x6b8f60));
    bump.position.set(x + sx * 0.35, sy * 0.25, z - sz * 0.2);
    bump.scale.set(sx * 0.45, sy * 0.55, sz * 0.4);
    retileMeshInPlace(bump, 6);
    root.add(bump);
  }
}
