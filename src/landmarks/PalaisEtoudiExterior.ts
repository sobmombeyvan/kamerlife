import * as THREE from 'three';
import { mat } from '../world/materials';
import type { CollisionSystem } from '../world/CollisionSystem';
import { addGroundFlagPole } from './CameroonFlag';
import { createMilitaryGuard } from './PoliceOfficer';
import { addLampPost, addTextSign } from './signage';
import { addWalkableShell, kitBox } from './interiorKit';
import { VENUES } from '../sim/VenueSpots';
import { PALACE, PALACE_GUARDS } from '../sim/PalaceSecurity';

export const PALAIS_ETOUDI = {
  id: 'palais-etoudi',
  x: 140,
  z: -655,
} as const;

export function buildPalaisEtoudiExterior(collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'landmark-palais-etoudi';
  root.userData = {
    type: 'landmark',
    landmarkId: PALAIS_ETOUDI.id,
    landmarkReal: true,
    notes: 'Palais de l’Unité — périmètre militaire, accès interdit.',
  };

  const cx = PALAIS_ETOUDI.x;
  const cz = PALAIS_ETOUDI.z;
  const hall = VENUES.find((x) => x.id === 'palais')!;

  kitBox(root, cx, 0.04, cz + 4, 148, 0.08, 118, 0x4a7a42);
  kitBox(root, cx, 0.08, cz + 36, 14, 0.1, 52, 0x5c6164);
  kitBox(root, cx, 0.09, cz + 8, 22, 0.08, 28, 0xd7ccc8);

  addWalkableShell(root, collisions, {
    id: hall.id,
    cx,
    cz,
    halfW: hall.halfW,
    halfD: hall.halfD,
    wallH: hall.wallH,
    roofY: hall.roofY,
    doorHalfW: hall.doorHalfW,
    doorFace: 1,
    wall: 0xfff8e7,
    floor: 0xb71c1c,
    roof: 0xd4af37,
  });

  for (const sx of [-8, -4, 0, 4, 8]) {
    kitBox(root, cx + sx, 3.4, cz + hall.halfD + 3.2, 0.7, 6.6, 0.7, 0xf5f5f5, true, collisions);
    kitBox(root, cx + sx, 6.85, cz + hall.halfD + 3.2, 1.05, 0.28, 1.05, 0xd4af37);
  }
  kitBox(root, cx, 7.4, cz + hall.halfD + 2.4, 20, 0.35, 6.5, 0xfff8e7);

  const dome = new THREE.Mesh(new THREE.SphereGeometry(7.2, 18, 14), mat(0xd4af37, 0.4, 0.4));
  dome.name = 'palais-roof-dome';
  dome.position.set(cx, 16.8, cz);
  dome.scale.y = 0.62;
  root.add(dome);
  kitBox(root, cx, 21.2, cz, 0.35, 2.4, 0.35, 0xd4af37);

  for (const side of [-1, 1] as const) {
    kitBox(root, cx + side * 38, 6.2, cz + 2, 22, 12.2, 26, 0xefebe0, true, collisions);
    for (let fl = 0; fl < 3; fl++) {
      for (let i = -2; i <= 2; i++) {
        kitBox(root, cx + side * 38 + i * 3.4, 3.2 + fl * 3.2, cz + 15.1, 2.1, 2.3, 0.14, 0x64b5f6);
      }
    }
  }

  kitBox(root, cx, 0.08, cz, 4.2, 0.05, hall.halfD * 2 - 2, 0xffc857);
  for (const sx of [-6, 6]) {
    kitBox(root, cx + sx, 2.6, cz - 2, 0.45, 5.1, 0.45, 0xfafafa);
  }
  kitBox(root, cx, 6.4, cz, 5.5, 0.2, 5.5, 0xfff8e7);

  const wallH = 3.4;
  for (const [wx, wz, ww, wd] of [
    [cx - 68, cz + 2, 2.2, 108],
    [cx + 68, cz + 2, 2.2, 108],
    [cx, cz - 52, 138, 2.2],
  ] as const) {
    kitBox(root, wx, wallH / 2, wz, ww, wallH, wd, 0xd7ccc8, true, collisions);
  }
  // Narrow the north gate: ~3.2 m pedestrian gap so forcing in is possible but tight.
  const gap = PALACE.gapHalf;
  const gateInner = 68 - gap;
  const gateCenter = (68 + gap) / 2;
  for (const side of [-1, 1] as const) {
    kitBox(root, cx + side * gateCenter, wallH / 2, cz + 56, gateInner, wallH, 2.2, 0xd7ccc8, true, collisions);
  }
  for (const side of [-1, 1] as const) {
    kitBox(root, cx + side * (gap + 0.7), 2.6, cz + 56, 1.4, 5.2, 1.6, 0xfafafa, true, collisions);
    kitBox(root, cx + side * (gap + 0.7), 5.4, cz + 56, 1.9, 0.4, 2.1, 0xd4af37);
  }
  for (const side of [-1, 1] as const) {
    kitBox(root, cx + side * 4.6, 1.55, cz + 56, 5.4, 3.1, 0.16, 0x2b2b2b, true, collisions);
  }

  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 0.7, 20), mat(0x90caf9));
  fountain.position.set(cx, 0.4, cz + 32);
  root.add(fountain);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.2, 20), mat(0x4fc3f7, 0.45));
  water.position.set(cx, 0.78, cz + 32);
  root.add(water);

  addGroundFlagPole(root, cx - 14, cz + 48, 18, 0.15);
  addGroundFlagPole(root, cx + 14, cz + 48, 18, -0.15);
  addGroundFlagPole(root, cx, cz + hall.halfD + 6, 14, 0);

  addTextSign(root, cx, 9.4, cz + hall.halfD + 4.2, 26, 2.2, "Palais de l'Unité", {
    subtitle: 'Etoudi · Yaoundé',
    bg: 0x0d47a1,
    fg: 0xffc857,
  });
  addTextSign(root, cx, 4.6, cz + 58.8, 11, 1.7, 'ZONE MILITAIRE', {
    subtitle: 'ACCÈS INTERDIT',
    bg: 0x3d1f00,
    fg: 0xffc107,
  });
  for (const side of [-1, 1] as const) {
    addTextSign(root, cx + side * 22, 3.4, cz + 57.4, 7.2, 1.3, 'HALTE', {
      subtitle: 'Tirs à vue',
      bg: 0x4a1515,
      fg: 0xffe082,
    });
  }

  PALACE_GUARDS.forEach((post, i) => {
    const guard = createMilitaryGuard(900 + i * 17);
    guard.position.set(post.x, 0, post.z);
    guard.rotation.y = post.rotY;
    root.add(guard);
  });

  for (const side of [-1, 1] as const) {
    kitBox(root, cx + side * 16, 1.4, cz + 58, 3.6, 2.8, 3.1, 0x5c6b3a, true, collisions);
  }
  for (let i = 0; i < 4; i++) {
    kitBox(root, cx - 28 + i * 5.5, 0.55, cz + 40, 1.9, 0.95, 4.4, i === 0 ? 0x111111 : 0x1a237e);
  }
  for (let i = -4; i <= 4; i++) {
    if (Math.abs(i) < 2) continue;
    addLampPost(root, cx + i * 10, cz + 50);
  }
  return root;
}
