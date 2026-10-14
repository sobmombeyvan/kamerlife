import * as THREE from 'three';
import { mat } from '../world/materials';
import type { CollisionSystem } from '../world/CollisionSystem';
import { addLampPost, addTextSign } from './signage';
import { addWalkableShell, kitBox } from './interiorKit';
import { VENUES } from '../sim/VenueSpots';

export function buildMosqueeExterieur(collisions: CollisionSystem): THREE.Group {
  const v = VENUES.find((x) => x.id === 'mosquee')!;
  const root = new THREE.Group();
  root.name = v.rootName;
  const { cx, cz } = v;
  root.userData = { type: 'landmark', landmarkId: 'mosquee-centrale', phase: 1 };

  kitBox(root, cx, 0.04, cz + 2, 54, 0.07, 48, 0xd7ccc8);
  addWalkableShell(root, collisions, {
    id: v.id,
    cx,
    cz,
    halfW: v.halfW,
    halfD: v.halfD,
    wallH: v.wallH,
    roofY: v.roofY,
    doorHalfW: v.doorHalfW,
    wall: 0xfafafa,
    floor: 0xc8e6c9,
    roof: 0xfff8e1,
  });

  const dome = new THREE.Mesh(new THREE.SphereGeometry(7.2, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xfff8e1));
  dome.position.set(cx, v.roofY + 0.1, cz);
  dome.name = 'mosquee-roof-dome';
  root.add(dome);
  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.1, 8), mat(0xffc857));
  finial.position.set(cx, v.roofY + 7.6, cz);
  root.add(finial);

  const minaret = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 22, 10), mat(0xf5f5f5));
  minaret.position.set(cx - 20, 11.1, cz + 10);
  minaret.castShadow = true;
  root.add(minaret);
  collisions.addBox(cx - 20, 11.1, cz + 10, 2.8, 11.5, 2.8);
  kitBox(root, cx - 20, 18.5, cz + 10, 6.4, 0.5, 6.4, 0x2e7d32);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(2.8, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffecb3));
  cap.position.set(cx - 20, 19.2, cz + 10);
  root.add(cap);

  for (let r = 0; r < 4; r++) {
    for (let c = -2; c <= 2; c++) {
      kitBox(root, cx + c * 2.4, 0.06, cz + 4 - r * 2.3, 2.2, 0.04, 2.0, r % 2 ? 0x2e7d32 : 0x81c784);
    }
  }
  kitBox(root, cx, 1.35, cz - 8.8, 3.6, 2.6, 0.28, 0x1b5e20, true, collisions);

  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, 0.55, 16), mat(0x90caf9));
  fountain.position.set(cx + 16, 0.4, cz + 16);
  root.add(fountain);

  addTextSign(root, cx, v.roofY + 1.1, cz + v.halfD + 0.4, 16, 1.4, 'Mosquée', {
    subtitle: 'Communauté de Yaoundé',
    bg: 0x1b5e20,
    fg: 0xffecb3,
  });
  addLampPost(root, cx - 18, cz + 20);
  addLampPost(root, cx + 18, cz + 20);
  return root;
}
