import * as THREE from 'three';
import { mat } from '../world/materials';
import type { CollisionSystem } from '../world/CollisionSystem';

export type ShellSpec = {
  id: string;
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  wallH: number;
  roofY: number;
  doorHalfW: number;
  wall: number;
  floor: number;
  roof: number;
  /** -1 = porte au z min (défaut), +1 = porte vers +Z (ville). */
  doorFace?: 1 | -1;
};

const T = 0.42;

export function kitBox(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: number,
  collide = false,
  collisions?: CollisionSystem,
  tag?: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = h > 0.25;
  mesh.receiveShadow = true;
  parent.add(mesh);
  if (collide && collisions) collisions.addBox(x, y, z, w / 2, h / 2, d / 2, tag);
  return mesh;
}

export function setNamedRoofVisible(root: THREE.Object3D, on: boolean): void {
  root.traverse((o) => {
    if (o.name.includes('-roof')) o.visible = on;
  });
}

/** South-facing door gap, walkable floor, hideable roof. */
export function addWalkableShell(
  root: THREE.Group,
  collisions: CollisionSystem,
  spec: ShellSpec,
): void {
  const { cx, cz, halfW, halfD, wallH, roofY, doorHalfW, wall, floor, roof } = spec;
  const face = spec.doorFace ?? -1;
  const x0 = cx - halfW;
  const x1 = cx + halfW;
  const z0 = cz - halfD;
  const z1 = cz + halfD;
  const doorZ = face < 0 ? z0 : z1;
  const closedZ = face < 0 ? z1 : z0;

  kitBox(root, cx, 0.04, cz, halfW * 2 - 0.35, 0.08, halfD * 2 - 0.35, floor);

  wallX(root, collisions, x0, cx - doorHalfW, doorZ, T, 0, wallH, wall);
  wallX(root, collisions, cx + doorHalfW, x1, doorZ, T, 0, wallH, wall);
  wallX(root, collisions, x0, x1, closedZ, T, 0, wallH, wall);
  wallZ(root, collisions, x0, z0, z1, T, 0, wallH, wall);
  wallZ(root, collisions, x1, z0, z1, T, 0, wallH, wall);

  if (roofY > wallH + 0.3) {
    wallX(root, collisions, x0, x1, z0, T, wallH, roofY - wallH, wall);
    wallX(root, collisions, x0, x1, z1, T, wallH, roofY - wallH, wall);
    wallZ(root, collisions, x0, z0, z1, T, wallH, roofY - wallH, wall);
    wallZ(root, collisions, x1, z0, z1, T, wallH, roofY - wallH, wall);
  }

  addGlassDoor(root, cx - doorHalfW * 0.52, doorZ + face * 0.08);
  addGlassDoor(root, cx + doorHalfW * 0.52, doorZ + face * 0.08);

  const cap = kitBox(root, cx, roofY, cz, halfW * 2 - 0.2, 0.22, halfD * 2 - 0.2, roof);
  cap.name = `${spec.id}-roof`;
}

function addGlassDoor(root: THREE.Group, x: number, z: number): void {
  const door = kitBox(root, x, 1.7, z, 1.45, 3.3, 0.05, 0x81d4fa);
  door.material = mat(0x90caf9, 0.18, 0.06);
  kitBox(root, x, 1.7, z, 0.06, 3.3, 0.08, 0x37474f);
}

function wallX(
  root: THREE.Group,
  collisions: CollisionSystem,
  x0: number,
  x1: number,
  z: number,
  thick: number,
  y0: number,
  height: number,
  color: number,
): void {
  const w = Math.abs(x1 - x0);
  if (w < 0.2 || height < 0.2) return;
  kitBox(root, (x0 + x1) / 2, y0 + height / 2, z, w, height, thick, color, true, collisions);
}

function wallZ(
  root: THREE.Group,
  collisions: CollisionSystem,
  x: number,
  z0: number,
  z1: number,
  thick: number,
  y0: number,
  height: number,
  color: number,
): void {
  const d = Math.abs(z1 - z0);
  if (d < 0.2 || height < 0.2) return;
  kitBox(root, x, y0 + height / 2, (z0 + z1) / 2, thick, height, d, color, true, collisions);
}
