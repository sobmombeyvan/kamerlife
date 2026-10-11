import * as THREE from 'three';

const cache = new Map<string, THREE.MeshStandardMaterial>();

export function mat(color: number, roughness = 0.85, metalness = 0): THREE.MeshStandardMaterial {
  const key = `${color}_${roughness}_${metalness}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  cache.set(key, m);
  return m;
}
