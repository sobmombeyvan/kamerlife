import * as THREE from 'three';
import type { CollisionSystem } from '../world/CollisionSystem';
import { addLampPost, addTextSign } from './signage';
import { createNpcAvatar } from '../pedestrians/NpcAvatar';
import { createPoliceOfficer } from './PoliceOfficer';
import { addWalkableShell, kitBox } from './interiorKit';
import { VENUES } from '../sim/VenueSpots';

function spec(id: string) {
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
    wall: 0xd8d4cc,
    floor: 0x8a8e86,
    roof: 0x5c6160,
  };
}

export function buildPoliceCentrale(collisions: CollisionSystem): THREE.Group {
  const v = VENUES.find((x) => x.id === 'police')!;
  const root = new THREE.Group();
  root.name = v.rootName;
  root.userData = { type: 'landmark', landmarkId: 'police-centrale' };
  const { cx, cz } = v;
  kitBox(root, cx, 0.04, cz + 2, 48, 0.08, 40, 0x3d4248);
  addWalkableShell(root, collisions, { ...spec('police'), wall: 0xeceff1, floor: 0x6d7470, roof: 0x1565c0 });
  addTextSign(root, cx, v.roofY + 1.1, cz - v.halfD - 0.5, 16, 1.6, 'POLICE', {
    subtitle: 'Commissariat central',
    bg: 0x0d47a1,
    fg: 0xffffff,
  });
  kitBox(root, cx, 6.4, cz - v.halfD - 0.12, v.halfW * 2 + 0.4, 1.1, 0.22, 0x0d47a1);
  for (let i = 0; i < 3; i++) {
    kitBox(root, cx - 8, 0.85, cz - 4 + i * 3.2, 4.2, 1.6, 2.4, 0x455a64, true, collisions);
    kitBox(root, cx - 6.1, 1.05, cz - 4 + i * 3.2, 0.08, 1.1, 2.1, 0x90caf9);
  }
  kitBox(root, cx + 6, 0.55, cz + 3, 6.4, 1.05, 2.2, 0x37474f, true, collisions);
  kitBox(root, cx + 6, 1.12, cz + 3, 6.6, 0.08, 2.3, 0x90a4ae);
  for (const [px, pz, yaw] of [
    [cx - 3, cz - v.halfD - 3, 0],
    [cx + 3, cz - v.halfD - 3, 0],
    [cx + 6, cz + 4.4, Math.PI],
  ] as const) {
    const cop = createPoliceOfficer(800 + px);
    cop.position.set(px, 0, pz);
    cop.rotation.y = yaw;
    root.add(cop);
  }
  addLampPost(root, cx - 16, cz - v.halfD - 5);
  addLampPost(root, cx + 16, cz - v.halfD - 5);
  return root;
}

export function buildGendarmerie(collisions: CollisionSystem): THREE.Group {
  const v = VENUES.find((x) => x.id === 'gendarmerie')!;
  const root = new THREE.Group();
  root.name = v.rootName;
  root.userData = { type: 'landmark', landmarkId: 'gendarmerie' };
  const { cx, cz } = v;
  kitBox(root, cx, 0.04, cz + 1, 44, 0.08, 36, 0x4a5344);
  addWalkableShell(root, collisions, { ...spec('gendarmerie'), wall: 0xe8e6dc, floor: 0x7a7e72, roof: 0x33691e });
  addTextSign(root, cx, v.roofY + 1.05, cz - v.halfD - 0.5, 17, 1.5, 'GENDARMERIE', {
    subtitle: 'Brigade de Yaoundé',
    bg: 0x33691e,
    fg: 0xffc857,
  });
  kitBox(root, cx + 5, 0.55, cz + 2, 5.8, 1.05, 2.0, 0x5d4037, true, collisions);
  for (let i = 0; i < 2; i++) kitBox(root, cx - 7, 0.7, cz - 3 + i * 3.4, 3.6, 1.3, 2.2, 0x6d4c41, true, collisions);
  const clerk = createNpcAvatar(810, 'employee');
  clerk.position.set(cx + 4.4, 0, cz + 3.2);
  clerk.rotation.y = Math.PI;
  root.add(clerk);
  const cop = createPoliceOfficer(811);
  cop.position.set(cx, 0, cz - v.halfD - 2.8);
  root.add(cop);
  addLampPost(root, cx - 14, cz - v.halfD - 4);
  return root;
}

export function buildSedExterior(collisions: CollisionSystem): THREE.Group {
  const v = VENUES.find((x) => x.id === 'sed')!;
  const root = new THREE.Group();
  root.name = v.rootName;
  root.userData = { type: 'landmark', landmarkId: 'sed' };
  const { cx, cz } = v;
  kitBox(root, cx, 0.04, cz + 2, 52, 0.08, 44, 0x3e4438);
  addWalkableShell(root, collisions, { ...spec('sed'), wall: 0xcfd8dc, floor: 0x5c6158, roof: 0x1b5e20 });
  addTextSign(root, cx, v.roofY + 1.2, cz - v.halfD - 0.55, 14, 1.7, 'SED', {
    subtitle: 'Secrétariat d’État à la Défense',
    bg: 0x1b5e20,
    fg: 0xffc857,
  });
  kitBox(root, cx, 7.2, cz - v.halfD - 0.14, v.halfW * 2, 1.4, 0.24, 0x1b5e20);
  for (const sx of [-8, 8]) kitBox(root, cx + sx, 1.15, cz + 4, 5.2, 2.2, 2.4, 0x455a64, true, collisions);
  kitBox(root, cx, 0.5, cz - 6, 8, 0.95, 3.2, 0x37474f, true, collisions);
  for (const [px, pz] of [
    [cx - 4, cz - v.halfD - 3.2],
    [cx + 4, cz - v.halfD - 3.2],
  ] as const) {
    const cop = createPoliceOfficer(820 + px);
    cop.position.set(px, 0, pz);
    root.add(cop);
  }
  const staff = createNpcAvatar(822, 'employee');
  staff.position.set(cx, 0, cz - 4.5);
  staff.rotation.y = Math.PI;
  root.add(staff);
  addLampPost(root, cx - 18, cz - v.halfD - 5);
  addLampPost(root, cx + 18, cz - v.halfD - 5);
  return root;
}
