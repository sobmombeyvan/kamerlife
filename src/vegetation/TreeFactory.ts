import * as THREE from 'three';
import { surfaceMat, retileMeshInPlace } from '../render/surfaces';
import type { CollisionSystem } from '../world/CollisionSystem';

const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 3.6, 6);
trunkGeo.userData.shared = true;
const leafGeo = new THREE.SphereGeometry(0.9, 6, 5);
leafGeo.userData.shared = true;
const crownGeo = new THREE.SphereGeometry(0.55, 6, 5);
crownGeo.userData.shared = true;

export function createPalmTree(x: number, z: number, scale = 1, collisions?: CollisionSystem): THREE.Group {
  const g = new THREE.Group();
  g.name = `tree-${x}-${z}`;
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  g.userData = { type: 'vegetation', procedural: true, species: 'palm-proxy' };

  const trunk = new THREE.Mesh(trunkGeo, surfaceMat('wood', 0x6b4a2e));
  trunk.position.y = 1.8;
  retileMeshInPlace(trunk, 0.8);
  g.add(trunk);

  // 3 leaves instead of 6 — same silhouette, half the draw calls
  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.Mesh(leafGeo, surfaceMat('grass', i % 2 ? 0x367747 : 0x4f9652));
    const a = (i / 3) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.1, 3.7, Math.sin(a) * 1.1);
    leaf.scale.set(1.4, 0.25, 0.55);
    retileMeshInPlace(leaf, 0.7);
    g.add(leaf);
  }
  const crown = new THREE.Mesh(crownGeo, surfaceMat('grass', 0x2c6e3e));
  crown.position.y = 3.7;
  retileMeshInPlace(crown, 0.6);
  g.add(crown);

  if (collisions) collisions.addBox(x, 1.2, z, 0.35, 1.2, 0.35);
  return g;
}
