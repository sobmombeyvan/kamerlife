import * as THREE from 'three';
import type { CollisionSystem } from '../world/CollisionSystem';
import { addLampPost, addTextSign } from './signage';
import { createNpcAvatar } from '../pedestrians/NpcAvatar';
import { addWalkableShell, kitBox } from './interiorKit';
import { VENUES } from '../sim/VenueSpots';

function shell(id: string, wall: number, floor: number, roof: number) {
  const v = VENUES.find((x) => x.id === id)!;
  return {
    id: v.id,
    cx: v.cx,
    cz: v.cz,
    halfW: v.halfW,
    halfD: v.halfD,
    wallH: v.wallH,
    roofY: v.roofY,
    doorHalfW: v.doorHalfW,
    wall,
    floor,
    roof,
  };
}

function buildClub(
  collisions: CollisionSystem,
  id: 'club-bastos' | 'club-hippo',
  title: string,
  subtitle: string,
  accent: number,
): THREE.Group {
  const v = VENUES.find((x) => x.id === id)!;
  const root = new THREE.Group();
  root.name = v.rootName;
  root.userData = { type: 'landmark', landmarkId: id };
  const { cx, cz } = v;
  kitBox(root, cx, 0.04, cz + 1, 34, 0.08, 28, 0x1a1a1e);
  addWalkableShell(root, collisions, shell(id, 0x2a2430, 0x1c1a22, 0x111014));
  addTextSign(root, cx, v.roofY + 0.95, cz - v.halfD - 0.45, 12, 1.35, title, {
    subtitle,
    bg: accent,
    fg: 0xffffff,
  });
  kitBox(root, cx, 0.08, cz - 2, 8.5, 0.06, 6.5, 0x4a148c);
  kitBox(root, cx, 0.55, cz + 4.2, 8.2, 1.05, 1.8, 0x3e2723, true, collisions);
  kitBox(root, cx, 1.12, cz + 4.2, 8.4, 0.08, 1.9, 0x212121);
  for (const sx of [-2.4, 0, 2.4]) kitBox(root, cx + sx, 1.28, cz + 4.15, 0.14, 0.22, 0.14, 0xffecb3);
  const dj = createNpcAvatar(id === 'club-bastos' ? 830 : 831, 'employee');
  dj.position.set(cx, 0, cz + 5.1);
  dj.rotation.y = Math.PI;
  root.add(dj);
  addLampPost(root, cx - 10, cz - v.halfD - 3);
  return root;
}

function buildResto(
  collisions: CollisionSystem,
  id: 'resto-ndole' | 'resto-bastos',
  title: string,
  subtitle: string,
  accent: number,
): THREE.Group {
  const v = VENUES.find((x) => x.id === id)!;
  const root = new THREE.Group();
  root.name = v.rootName;
  root.userData = { type: 'landmark', landmarkId: id };
  const { cx, cz } = v;
  kitBox(root, cx, 0.04, cz + 1, 30, 0.08, 26, 0x5d4e37);
  addWalkableShell(root, collisions, shell(id, 0xf3e5d8, 0x8d6e63, 0x5d4037));
  addTextSign(root, cx, v.roofY + 0.9, cz - v.halfD - 0.45, 11, 1.2, title, {
    subtitle,
    bg: accent,
    fg: 0xfff8e1,
  });
  for (const [tx, tz] of [
    [-3.2, -1.4],
    [3.2, -1.4],
    [-3.2, 2.2],
    [3.2, 2.2],
  ] as const) {
    kitBox(root, cx + tx, 0.42, cz + tz, 1.35, 0.08, 1.35, 0x4e342e);
    kitBox(root, cx + tx, 0.22, cz + tz, 0.12, 0.4, 0.12, 0x3e2723);
  }
  kitBox(root, cx, 0.7, cz + 4.4, 6.4, 1.3, 1.4, 0x6d4c41, true, collisions);
  const cook = createNpcAvatar(id === 'resto-ndole' ? 840 : 841, 'employee');
  cook.position.set(cx, 0, cz + 3.4);
  cook.rotation.y = Math.PI;
  root.add(cook);
  addLampPost(root, cx - 9, cz - v.halfD - 3);
  return root;
}

export function buildClubBastos(collisions: CollisionSystem): THREE.Group {
  return buildClub(collisions, 'club-bastos', 'CLUB 237', 'Bastos · nuit', 0x6a1b9a);
}

export function buildClubPrivilege(collisions: CollisionSystem): THREE.Group {
  return buildClub(collisions, 'club-hippo', 'LE PRIVILEGE', 'Boîte de nuit', 0xad1457);
}

export function buildRestoNdole(collisions: CollisionSystem): THREE.Group {
  return buildResto(collisions, 'resto-ndole', 'MAMAN NDOLÉ', 'Cuisine du pays', 0xbf360c);
}

export function buildRestoBastos(collisions: CollisionSystem): THREE.Group {
  return buildResto(collisions, 'resto-bastos', 'VILLA BASTOS', 'Restaurant', 0x4e342e);
}
