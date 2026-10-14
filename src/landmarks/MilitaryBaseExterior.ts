import * as THREE from 'three';
import type { CollisionSystem } from '../world/CollisionSystem';
import { addGroundFlagPole } from './CameroonFlag';
import { createMilitaryGuard } from './PoliceOfficer';
import { addLampPost, addTextSign } from './signage';
import { kitBox } from './interiorKit';
import { createArmyTruck, createHelicopter, createTank } from '../vehicles/MilitaryVehicles';

export const BASE_MILITAIRE = {
  id: 'base-militaire',
  x: -324,
  z: -828,
} as const;

export function buildMilitaryBase(collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'landmark-base-militaire';
  root.userData = {
    type: 'landmark',
    landmarkId: BASE_MILITAIRE.id,
    notes: 'Camp militaire — chars, hélicos, troupes.',
  };

  const cx = BASE_MILITAIRE.x;
  const cz = BASE_MILITAIRE.z;
  const rotors: THREE.Object3D[] = [];

  kitBox(root, cx, 0.03, cz, 196, 0.06, 168, 0x4a5340);
  kitBox(root, cx, 0.05, cz + 8, 28, 0.04, 96, 0x5c6164);

  const wallH = 3.6;
  for (const [wx, wz, ww, wd] of [
    [cx - 96, cz, 2.4, 164],
    [cx + 96, cz, 2.4, 164],
    [cx, cz - 82, 194, 2.4],
  ] as const) {
    kitBox(root, wx, wallH / 2, wz, ww, wallH, wd, 0x5d5648, true, collisions);
  }
  const gap = 4.2;
  const gateInner = 96 - gap;
  const gateCenter = (96 + gap) / 2;
  for (const side of [-1, 1] as const) {
    kitBox(root, cx + side * gateCenter, wallH / 2, cz + 82, gateInner, wallH, 2.4, 0x5d5648, true, collisions);
    kitBox(root, cx + side * (gap + 1.1), 2.8, cz + 82, 1.8, 5.6, 1.8, 0x3e2723, true, collisions);
  }
  for (const side of [-1, 1] as const) {
    kitBox(root, cx + side * 22, 1.5, cz + 84, 4.6, 3.0, 3.4, 0x4a5c32, true, collisions);
  }

  kitBox(root, cx - 52, 6.2, cz - 28, 48, 12.4, 36, 0x6d6758, true, collisions);
  kitBox(root, cx - 52, 7.4, cz - 10.2, 40, 2.2, 0.2, 0x3e4a2c);
  kitBox(root, cx + 50, 5.4, cz - 18, 42, 10.8, 52, 0xcfc7b8, true, collisions);
  for (let fl = 0; fl < 3; fl++) {
    for (let i = -3; i <= 3; i++) {
      kitBox(root, cx + 50 + i * 4.4, 2.6 + fl * 3.1, cz + 7.9, 2.4, 1.8, 0.12, 0x90a4ae);
    }
  }
  kitBox(root, cx + 8, 4.4, cz - 48, 22, 8.8, 28, 0x5a584c, true, collisions);

  addTextSign(root, cx, 5.4, cz + 84.6, 22, 2.0, 'BASE MILITAIRE', {
    subtitle: 'BIR · Camp de Yaoundé',
    bg: 0x3e4a2c,
    fg: 0xffc107,
  });
  addTextSign(root, cx - 52, 13.2, cz - 10, 18, 1.8, 'HANGARS', {
    subtitle: 'Aviation légère',
    bg: 0x2e3d22,
    fg: 0xdce775,
  });

  addGroundFlagPole(root, cx - 10, cz + 70, 16, 0.1);
  addGroundFlagPole(root, cx + 10, cz + 70, 16, -0.1);

  const tanks = [
    [cx - 18, cz + 28, 0.2],
    [cx - 6, cz + 26, 0],
    [cx + 6, cz + 26, 0],
    [cx + 18, cz + 28, -0.2],
    [cx - 22, cz + 4, 0.4],
    [cx + 22, cz + 4, -0.4],
  ] as const;
  for (const [x, z, yaw] of tanks) {
    const tank = createTank(Math.round(x + z));
    tank.position.set(x, 0, z);
    tank.rotation.y = yaw;
    root.add(tank);
    collisions.addBox(x, 1.1, z, 1.9, 1.1, 3.7);
  }

  const trucks = [
    [cx + 38, cz + 36, Math.PI],
    [cx + 46, cz + 36, Math.PI],
    [cx + 54, cz + 36, Math.PI],
    [cx - 40, cz + 40, 0.1],
  ] as const;
  for (const [x, z, yaw] of trucks) {
    const truck = createArmyTruck(Math.round(x));
    truck.position.set(x, 0, z);
    truck.rotation.y = yaw;
    root.add(truck);
    collisions.addBox(x, 1.1, z, 1.3, 1.1, 3.8);
  }

  const pads: [number, number][] = [
    [cx - 62, cz + 8],
    [cx - 42, cz + 8],
    [cx - 62, cz - 14],
    [cx - 42, cz - 14],
  ];
  pads.forEach(([x, z], i) => {
    kitBox(root, x, 0.06, z, 16, 0.08, 16, 0x4e5558);
    const heli = createHelicopter(40 + i);
    heli.position.set(x, 0.08, z);
    heli.rotation.y = i % 2 ? 0.4 : -0.2;
    root.add(heli);
    const extra = (heli.userData.rotors as THREE.Object3D[]) ?? [];
    rotors.push(...extra);
    collisions.addBox(x, 0.5, z, 2.2, 0.5, 4.2);
  });

  const posts: [number, number, number][] = [
    [cx - 5, cz + 85, Math.PI],
    [cx + 5, cz + 85, Math.PI],
    [cx - 16, cz + 83, Math.PI + 0.2],
    [cx + 16, cz + 83, Math.PI - 0.2],
    [cx - 28, cz + 70, Math.PI],
    [cx + 28, cz + 70, Math.PI],
    [cx - 90, cz + 20, -Math.PI / 2],
    [cx + 90, cz + 20, Math.PI / 2],
    [cx - 90, cz - 20, -Math.PI / 2],
    [cx + 90, cz - 20, Math.PI / 2],
    [cx - 20, cz + 40, Math.PI],
    [cx + 20, cz + 40, Math.PI],
    [cx - 8, cz + 12, 0.3],
    [cx + 8, cz + 12, -0.3],
    [cx - 50, cz + 50, Math.PI],
    [cx + 40, cz + 50, Math.PI],
  ];
  posts.forEach(([x, z, rotY], i) => {
    const g = createMilitaryGuard(400 + i * 19);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    root.add(g);
  });

  for (let i = -5; i <= 5; i++) {
    if (Math.abs(i) < 2) continue;
    addLampPost(root, cx + i * 14, cz + 74);
  }
  addLampPost(root, cx - 70, cz + 8);
  addLampPost(root, cx - 34, cz + 8);

  root.userData.rotors = rotors;
  return root;
}
