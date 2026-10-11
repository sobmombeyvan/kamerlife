import type * as THREE from 'three';
import type { CollisionSystem } from './CollisionSystem';
import { generateLargeCity } from './CityGenerator';

/**
 * Entry point for the playable world.
 * Returns city root (includes `userData.landmarkAnchors` for NPC spawn).
 */
export function buildBootstrapWorld(scene: THREE.Scene, collisions: CollisionSystem): THREE.Group {
  return generateLargeCity(scene, collisions);
}
