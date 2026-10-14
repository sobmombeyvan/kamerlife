import * as THREE from 'three';
import { mat } from '../world/materials';
import type { CollisionSystem } from '../world/CollisionSystem';
import { addLampPost, addTextSign } from './signage';
import { addWalkableShell, kitBox } from './interiorKit';
import { VENUES } from '../sim/VenueSpots';

export function buildEgliseCathedraleExterior(collisions: CollisionSystem): THREE.Group {
  const v = VENUES.find((x) => x.id === 'eglise')!;
  const root = new THREE.Group();
  root.name = v.rootName;
  const { cx, cz } = v;
  root.userData = { type: 'landmark', landmarkId: 'eglise-cathedrale', phase: 1 };

  kitBox(root, cx, 0.03, cz + 2, 52, 0.06, 48, 0x6b8f5e);
  kitBox(root, cx, 0.06, cz - v.halfD - 8, 4, 0.07, 14, 0xbcaaa4);
  addWalkableShell(root, collisions, {
    id: v.id,
    cx,
    cz,
    halfW: v.halfW,
    halfD: v.halfD,
    wallH: v.wallH,
    roofY: v.roofY,
    doorHalfW: v.doorHalfW,
    wall: 0xf5f0e6,
    floor: 0xc4b8a8,
    roof: 0x5d4037,
  });

  kitBox(root, cx - 16, 9.1, cz + 10, 6, 18, 6, 0xefebe9, true, collisions);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(3.2, 7, 4), mat(0x8d6e63));
  spire.rotation.y = Math.PI / 4;
  spire.position.set(cx - 16, 21.5, cz + 10);
  root.add(spire);
  kitBox(root, cx - 16, 25.8, cz + 10, 0.35, 2.8, 0.35, 0xffc857);
  kitBox(root, cx - 16, 25.2, cz + 10, 1.6, 0.35, 0.35, 0xffc857);

  const rose = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.18, 16), mat(0x5c6bc0, 0.5));
  rose.rotation.x = Math.PI / 2;
  rose.position.set(cx, 7.2, cz - v.halfD - 0.15);
  root.add(rose);

  for (let i = 0; i < 5; i++) {
    const z = cz + 6 - i * 2.4;
    kitBox(root, cx - 4.2, 0.42, z, 3.4, 0.55, 0.85, 0x4e342e, true, collisions);
    kitBox(root, cx + 4.2, 0.42, z, 3.4, 0.55, 0.85, 0x4e342e, true, collisions);
  }
  kitBox(root, cx, 0.55, cz - 9.2, 4.6, 1.05, 1.5, 0x5d4037, true, collisions);
  kitBox(root, cx, 1.55, cz - 9.2, 0.25, 1.1, 0.25, 0xffc857);

  addTextSign(root, cx, v.roofY + 1.2, cz - v.halfD - 0.45, 16, 1.4, 'Cathédrale', {
    subtitle: 'Paroisse de Yaoundé',
    bg: 0x3e2723,
    fg: 0xffecb3,
    yaw: Math.PI,
  });
  addLampPost(root, cx - 14, cz + 20);
  addLampPost(root, cx + 14, cz + 20);
  return root;
}
