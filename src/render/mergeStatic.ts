import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { retileGeometry } from './surfaces';

/**
 * Bake direct child meshes into one mesh per material.
 * Nested groups (signs, vehicles, doors) are left untouched.
 */
export function bakeAndMerge(group: THREE.Object3D): void {
  const meshes = group.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
  if (meshes.length < 2) {
    for (const mesh of meshes) prepareMesh(mesh);
    return;
  }

  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const flags = new Map<THREE.Material, { cast: boolean; receive: boolean; name: string }>();

  for (const mesh of meshes) {
    if (Array.isArray(mesh.material) || mesh.userData.noMerge) {
      prepareMesh(mesh);
      continue;
    }
    const baked = bakeGeometry(mesh);
    const material = mesh.material;
    const list = buckets.get(material);
    if (list) list.push(baked);
    else buckets.set(material, [baked]);
    const prev = flags.get(material);
    flags.set(material, {
      cast: (prev?.cast ?? false) || mesh.castShadow,
      receive: (prev?.receive ?? false) || mesh.receiveShadow,
      name: prev?.name || mesh.name,
    });
    group.remove(mesh);
  }

  for (const [material, geos] of buckets) {
    const flag = flags.get(material)!;
    let geometry: THREE.BufferGeometry | null = null;
    if (geos.length === 1) {
      geometry = geos[0] ?? null;
    } else {
      geometry = mergeGeometries(geos, false);
      if (geometry) {
        for (const geo of geos) geo.dispose();
      }
    }
    if (!geometry) {
      for (const geo of geos) {
        const fallback = new THREE.Mesh(geo, material);
        fallback.castShadow = flag.cast;
        fallback.receiveShadow = flag.receive;
        group.add(fallback);
      }
      continue;
    }
    const merged = new THREE.Mesh(geometry, material);
    merged.name = flag.name;
    merged.castShadow = flag.cast;
    merged.receiveShadow = flag.receive;
    group.add(merged);
  }
}

function prepareMesh(mesh: THREE.Mesh): void {
  const tile = tileOf(mesh.material);
  if (tile) {
    const geo = mesh.geometry.userData.shared ? mesh.geometry.clone() : mesh.geometry;
    if (geo !== mesh.geometry) mesh.geometry = geo;
    const [sx, sy, sz] = scaledExtents(mesh);
    retileGeometry(geo, sx, sy, sz, tile);
  }
}

function bakeGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  const geo = mesh.geometry.clone();
  const tile = tileOf(mesh.material);
  if (tile) {
    const [sx, sy, sz] = scaledExtents(mesh);
    retileGeometry(geo, sx, sy, sz, tile);
  }
  mesh.updateMatrix();
  geo.applyMatrix4(mesh.matrix);
  return geo;
}

function tileOf(material: THREE.Material | THREE.Material[]): number | null {
  if (Array.isArray(material)) return null;
  const tile = material.userData?.tileMeters;
  return typeof tile === 'number' ? tile : null;
}

function scaledExtents(mesh: THREE.Mesh): [number, number, number] {
  const p = (mesh.geometry as THREE.BufferGeometry & {
    parameters?: {
      width?: number;
      height?: number;
      depth?: number;
      radius?: number;
      radiusTop?: number;
      radiusBottom?: number;
    };
  }).parameters;
  const sx = Math.abs(mesh.scale.x);
  const sy = Math.abs(mesh.scale.y);
  const sz = Math.abs(mesh.scale.z);
  if (!p) return [sx, sy, sz];
  if (mesh.geometry.type === 'BoxGeometry') {
    return [(p.width ?? 1) * sx, (p.height ?? 1) * sy, (p.depth ?? 1) * sz];
  }
  if (mesh.geometry.type === 'SphereGeometry') {
    const d = (p.radius ?? 1) * 2;
    return [d * sx, d * sy, d * sz];
  }
  const radius = Math.max(p.radiusBottom ?? 0, p.radiusTop ?? 0, p.radius ?? 1);
  const height = p.height ?? radius * 2;
  return [radius * 2 * sx, height * sy, radius * 2 * sz];
}
