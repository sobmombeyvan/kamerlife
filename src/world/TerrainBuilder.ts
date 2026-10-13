import * as THREE from 'three';
import { WorldConfig } from '../config/WorldConfig';
import { retileMeshInPlace, surfaceMat } from '../render/surfaces';

/**
 * Laterite ground under the whole map. Block surfaces, parks, pitches and yards are drawn by
 * the city chunks; the surrounding hills are the camera-following HorizonHills ring.
 */
export function buildTerrain(root: THREE.Group): void {
  const half = WorldConfig.worldHalfSize;
  const size = half * 2 + 240;
  const terrain = new THREE.Group();
  terrain.name = 'terrain';

  const earth = new THREE.Mesh(new THREE.BoxGeometry(size + 1600, 0.9, size + 1600), surfaceMat('earth', 0x7d6a50));
  earth.position.y = -0.5;
  earth.receiveShadow = true;
  retileMeshInPlace(earth, 4.2);
  terrain.add(earth);

  const urban = new THREE.Mesh(new THREE.BoxGeometry(size - 80, 0.08, size - 80), surfaceMat('earth', 0x7b6650));
  urban.position.y = -0.02;
  urban.receiveShadow = true;
  retileMeshInPlace(urban, 3.6);
  terrain.add(urban);

  root.add(terrain);
}
