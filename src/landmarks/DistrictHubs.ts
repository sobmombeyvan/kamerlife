import * as THREE from 'three';
import { DISTRICTS, type DistrictDef } from '../data/districts';
import { profileFor, type DistrictCharacter } from '../data/districtProfiles';
import { createBuilding } from '../buildings/BuildingFactory';
import { mat } from '../world/materials';
import { overlapsRoad } from '../world/RoadClearance';
import type { CollisionSystem } from '../world/CollisionSystem';
import { addLampPost, addTextSign } from './signage';
import { createPalmTree } from '../vegetation/TreeFactory';
import { cellInterior } from './LandmarkSites';

/** Districts that already have a dedicated landmark exterior. */
const HAS_HERO = new Set([
  'centre-ville',
  'mfoundi',
  'nsimalen',
  'etoudi',
  'mvan',
  'ngoa-ekelle',
  'mokolo',
  'essos',
  'mendong',
  'odza',
  'biyem-assi',
  'avenue-kennedy',
]);

/**
 * Fills every remaining quartier with a readable infrastructure hub
 * (école, marché, poste, entrepôts, etc.) so the city feels occupied.
 */
export function buildAllDistrictHubs(root: THREE.Group, collisions: CollisionSystem): void {
  for (const d of DISTRICTS) {
    if (HAS_HERO.has(d.id)) continue;
    root.add(buildDistrictHub(d, collisions));
  }
}

export function buildDistrictHub(d: DistrictDef, collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = `hub-${d.id}`;
  const snapped = cellInterior(d.center.x, d.center.z);
  const cx = snapped.x;
  const cz = snapped.z;
  const profile = profileFor(d, cx, cz);
  const hubId = `hub-${d.id}`;
  root.userData = { landmarkId: hubId, districtId: d.id };

  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(62, 0.08, 48),
    mat(padColor(profile.character)),
  );
  pad.position.set(cx, 0.04, cz);
  root.add(pad);

  placeByCharacter(root, d, profile.character, collisions);

  addTextSign(root, cx, 6.8, cz + 22, 18, 1.7, d.name, {
    subtitle: 'Quartier',
    bg: profile.accent,
    fg: 0xffffff,
    yaw: Math.PI,
  });
  for (let i = -2; i <= 2; i++) {
    if (!overlapsRoad(cx + i * 10, cz + 20, 0.5, 0.5)) addLampPost(root, cx + i * 10, cz + 20);
  }
  if (profile.character === 'premium' || profile.character === 'institutional') {
    root.add(createPalmTree(cx - 16, cz + 10, 0.85, undefined));
    root.add(createPalmTree(cx + 14, cz - 8, 0.8, undefined));
  }

  return root;
}

function padColor(c: DistrictCharacter): number {
  switch (c) {
    case 'market':
      return 0x8d6e63;
    case 'premium':
    case 'institutional':
      return 0x5a8a4e;
    case 'logistics':
    case 'airport':
      return 0x78909c;
    case 'student':
      return 0x6b8f5e;
    default:
      return 0x7a7164;
  }
}

function placeByCharacter(
  root: THREE.Group,
  d: DistrictDef,
  character: DistrictCharacter,
  collisions: CollisionSystem,
): void {
  const cx = d.center.x;
  const cz = d.center.z;
  const id = d.id;

  switch (character) {
    case 'commercial_core':
      addOfficeBlock(root, id, cx, cz, collisions);
      addShopRow(root, id, cx, cz + 14, 5, collisions);
      addPolicePost(root, id, cx - 18, cz - 12, collisions);
      break;
    case 'market':
      addMarketHall(root, id, cx, cz, collisions);
      addStallGrid(root, id, cx, cz, 16, collisions);
      addClinicSmall(root, id, cx + 20, cz - 14, collisions);
      break;
    case 'premium':
      addVillaCluster(root, id, cx, cz, 5, collisions);
      addShopRow(root, id, cx, cz + 16, 3, collisions);
      break;
    case 'student':
      addSchool(root, id, cx, cz - 4, 'Campus / lycée', collisions);
      addFlatRow(root, id, cx, cz + 12, 4, collisions);
      addShopRow(root, id, cx - 16, cz + 4, 3, collisions);
      break;
    case 'residential_dense':
      addFlatRow(root, id, cx, cz - 8, 6, collisions);
      addSchool(root, id, cx + 8, cz + 14, `École ${d.name}`, collisions);
      addShopRow(root, id, cx - 14, cz + 14, 4, collisions);
      addChurch(root, id, cx - 20, cz - 14, collisions);
      break;
    case 'residential_family':
      addHouseGrid(root, id, cx, cz, 10, collisions);
      addSchool(root, id, cx + 10, cz + 14, `École ${d.name}`, collisions);
      addShopRow(root, id, cx - 16, cz + 12, 3, collisions);
      addChurch(root, id, cx - 18, cz - 12, collisions);
      break;
    case 'logistics':
      addWarehouseRow(root, id, cx, cz, 4, collisions);
      addFuelPad(root, id, cx + 18, cz + 12, collisions);
      addShopRow(root, id, cx - 14, cz + 14, 3, collisions);
      break;
    case 'periurban':
      addHouseGrid(root, id, cx, cz, 12, collisions);
      addWaterTower(root, id, cx + 16, cz - 10);
      addShopRow(root, id, cx - 12, cz + 14, 3, collisions);
      addSchool(root, id, cx + 6, cz + 16, `École ${d.name}`, collisions);
      break;
    case 'institutional':
      addLandmarkBlock(root, id, cx, cz, `Services ${d.name}`, collisions);
      addVillaCluster(root, id, cx, cz + 8, 3, collisions);
      break;
    case 'airport':
      addWarehouseRow(root, id, cx, cz, 3, collisions);
      addLandmarkBlock(root, id, cx, cz - 10, 'Zone aéroport', collisions);
      break;
    default:
      addHouseGrid(root, id, cx, cz, 8, collisions);
      addShopRow(root, id, cx, cz + 14, 3, collisions);
  }

  addBusShelter(root, id, cx + 22, cz + 18, collisions);
}

function addBuilding(
  root: THREE.Group,
  collisions: CollisionSystem,
  spec: Parameters<typeof createBuilding>[0],
): void {
  if (overlapsRoad(spec.x, spec.z, spec.width / 2, spec.depth / 2)) return;
  root.add(createBuilding(spec, collisions));
}

function addOfficeBlock(
  root: THREE.Group,
  id: string,
  cx: number,
  cz: number,
  collisions: CollisionSystem,
): void {
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    addBuilding(root, collisions, {
      id: `${id}-office-${i}`,
      name: 'Immeuble administratif',
      x: cx - 12 + col * 22,
      z: cz - 12 + row * 16,
      width: 16,
      depth: 12,
      height: 14 + i * 3,
      color: [0xcfd8dc, 0xb0bec5, 0xeceff1, 0x90a4ae][i]!,
      kind: 'office',
      districtId: id,
      collide: true,
    });
  }
}

function addShopRow(
  root: THREE.Group,
  id: string,
  cx: number,
  cz: number,
  count: number,
  collisions: CollisionSystem,
): void {
  const colors = [0xd7a44d, 0xc34d38, 0x42876c, 0x477d9d, 0xff8a65];
  for (let i = 0; i < count; i++) {
    addBuilding(root, collisions, {
      id: `${id}-shop-${i}-${Math.round(cz)}`,
      name: 'Commerce de quartier',
      x: cx - ((count - 1) * 7) / 2 + i * 7,
      z: cz,
      width: 6,
      depth: 5.5,
      height: 4.2 + (i % 2),
      color: colors[i % colors.length]!,
      kind: 'shop',
      districtId: id,
      collide: true,
    });
  }
}

function addPolicePost(
  root: THREE.Group,
  id: string,
  x: number,
  z: number,
  collisions: CollisionSystem,
): void {
  addBuilding(root, collisions, {
    id: `${id}-police`,
    name: 'Poste de police',
    x,
    z,
    width: 12,
    depth: 9,
    height: 5.5,
    color: 0x37474f,
    kind: 'landmark',
    districtId: id,
    collide: true,
  });
}

function addMarketHall(
  root: THREE.Group,
  id: string,
  cx: number,
  cz: number,
  collisions: CollisionSystem,
): void {
  for (let row = 0; row < 2; row++) {
    const hall = new THREE.Mesh(new THREE.BoxGeometry(40, 4, 9), mat(0xd7a44d));
    hall.position.set(cx, 2, cz - 10 + row * 12);
    if (!overlapsRoad(cx, cz - 10 + row * 12, 20, 4.5)) {
      hall.castShadow = true;
      root.add(hall);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(42, 0.3, 11), mat(0xc34d38));
      roof.position.set(cx, 4.3, cz - 10 + row * 12);
      root.add(roof);
    }
  }
  addBuilding(root, collisions, {
    id: `${id}-marche-admin`,
    name: 'Hall du marché',
    x: cx,
    z: cz + 10,
    width: 18,
    depth: 10,
    height: 6,
    color: 0xe4bb4e,
    kind: 'market',
    districtId: id,
    collide: true,
  });
}

function addStallGrid(
  root: THREE.Group,
  id: string,
  cx: number,
  cz: number,
  count: number,
  collisions: CollisionSystem,
): void {
  const colors = [0xc34d38, 0xe4bb4e, 0x42876c, 0x477d9d, 0xff8a65, 0x8e24aa];
  for (let i = 0; i < count; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    addBuilding(root, collisions, {
      id: `${id}-stall-${i}`,
      name: 'Étal',
      x: cx - 14 + col * 9,
      z: cz - 6 + row * 8,
      width: 5,
      depth: 4,
      height: 2.8,
      color: colors[i % colors.length]!,
      kind: 'market',
      districtId: id,
      collide: true,
    });
  }
}

function addVillaCluster(
  root: THREE.Group,
  id: string,
  cx: number,
  cz: number,
  count: number,
  collisions: CollisionSystem,
): void {
  const colors = [0xf5f5f5, 0xffecb3, 0xe8eaf6, 0xdce775, 0xb39ddb];
  for (let i = 0; i < count; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    addBuilding(root, collisions, {
      id: `${id}-villa-${i}`,
      name: 'Villa',
      x: cx - 16 + col * 16,
      z: cz - 10 + row * 14,
      width: 12,
      depth: 10,
      height: 5.5 + (i % 2),
      color: colors[i % colors.length]!,
      kind: 'villa',
      districtId: id,
      collide: true,
    });
  }
}

function addSchool(
  root: THREE.Group,
  id: string,
  x: number,
  z: number,
  name: string,
  collisions: CollisionSystem,
): void {
  addBuilding(root, collisions, {
    id: `${id}-ecole`,
    name,
    x,
    z,
    width: 22,
    depth: 12,
    height: 6,
    color: 0xfff8e1,
    kind: 'landmark',
    districtId: id,
    collide: true,
  });
  const yard = new THREE.Mesh(new THREE.BoxGeometry(14, 0.06, 8), mat(0xb0bec5));
  yard.position.set(x, 0.08, z + 10);
  if (!overlapsRoad(x, z + 10, 7, 4)) root.add(yard);
}

function addFlatRow(
  root: THREE.Group,
  id: string,
  cx: number,
  cz: number,
  count: number,
  collisions: CollisionSystem,
): void {
  const colors = [0xd9b18b, 0xc98558, 0xa9b8b2, 0xb96e50, 0xc4a882];
  for (let i = 0; i < count; i++) {
    addBuilding(root, collisions, {
      id: `${id}-flat-${i}`,
      name: 'Immeuble',
      x: cx - ((count - 1) * 12) / 2 + i * 12,
      z: cz,
      width: 10,
      depth: 9,
      height: 10 + (i % 4) * 2,
      color: colors[i % colors.length]!,
      kind: 'flat',
      districtId: id,
      collide: true,
    });
  }
}

function addHouseGrid(
  root: THREE.Group,
  id: string,
  cx: number,
  cz: number,
  count: number,
  collisions: CollisionSystem,
): void {
  const colors = [0xe1c7a0, 0xd6a56b, 0xf0e0c8, 0xc18b63, 0xd9d9cb];
  for (let i = 0; i < count; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    addBuilding(root, collisions, {
      id: `${id}-house-${i}`,
      name: 'Maison',
      x: cx - 18 + col * 12,
      z: cz - 14 + row * 11,
      width: 8,
      depth: 7,
      height: 3.8 + (i % 3),
      color: colors[i % colors.length]!,
      kind: 'house',
      districtId: id,
      collide: true,
    });
  }
}

function addChurch(
  root: THREE.Group,
  id: string,
  x: number,
  z: number,
  collisions: CollisionSystem,
): void {
  addBuilding(root, collisions, {
    id: `${id}-eglise`,
    name: 'Église / temple',
    x,
    z,
    width: 14,
    depth: 10,
    height: 8,
    color: 0xfafafa,
    kind: 'landmark',
    districtId: id,
    collide: true,
  });
  const steeple = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3.5, 4), mat(0xc62828));
  steeple.position.set(x, 10.5, z);
  if (!overlapsRoad(x, z, 7, 5)) root.add(steeple);
}

function addWarehouseRow(
  root: THREE.Group,
  id: string,
  cx: number,
  cz: number,
  count: number,
  collisions: CollisionSystem,
): void {
  for (let i = 0; i < count; i++) {
    addBuilding(root, collisions, {
      id: `${id}-wh-${i}`,
      name: 'Entrepôt',
      x: cx - 16 + i * 14,
      z: cz - 6,
      width: 12,
      depth: 14,
      height: 6 + (i % 2),
      color: [0x78909c, 0x546e7a, 0xb0bec5, 0x6d4c41][i % 4]!,
      kind: 'warehouse',
      districtId: id,
      collide: true,
    });
  }
}

function addFuelPad(
  root: THREE.Group,
  id: string,
  x: number,
  z: number,
  collisions: CollisionSystem,
): void {
  addBuilding(root, collisions, {
    id: `${id}-fuel-hub`,
    name: 'Station-service',
    x,
    z,
    width: 10,
    depth: 8,
    height: 4,
    color: 0xffffff,
    kind: 'fuel',
    districtId: id,
    collide: true,
  });
}

function addClinicSmall(
  root: THREE.Group,
  id: string,
  x: number,
  z: number,
  collisions: CollisionSystem,
): void {
  addBuilding(root, collisions, {
    id: `${id}-clinic-hub`,
    name: 'Centre de santé',
    x,
    z,
    width: 12,
    depth: 9,
    height: 5,
    color: 0xf5f5f5,
    kind: 'clinic',
    districtId: id,
    collide: true,
  });
}

function addLandmarkBlock(
  root: THREE.Group,
  id: string,
  cx: number,
  cz: number,
  name: string,
  collisions: CollisionSystem,
): void {
  addBuilding(root, collisions, {
    id: `${id}-equip`,
    name,
    x: cx,
    z: cz,
    width: 24,
    depth: 16,
    height: 10,
    color: 0xeceff1,
    kind: 'landmark',
    districtId: id,
    collide: true,
  });
}

function addWaterTower(root: THREE.Group, id: string, x: number, z: number): void {
  if (overlapsRoad(x, z, 3, 3)) return;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 14, 8), mat(0x90a4ae));
  pole.position.set(x, 7, z);
  root.add(pole);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 3.5, 12), mat(0xb0bec5));
  tank.position.set(x, 15.5, z);
  root.add(tank);
  tank.userData = { landmarkId: `hub-${id}` };
}

function addBusShelter(
  root: THREE.Group,
  id: string,
  x: number,
  z: number,
  collisions: CollisionSystem,
): void {
  if (overlapsRoad(x, z, 3, 2)) return;
  const pad = new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, 3.5), mat(0x546e7a));
  pad.position.set(x, 0.05, z);
  root.add(pad);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.15, 3), mat(0xffc107));
  roof.position.set(x, 2.6, z);
  root.add(roof);
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.5, 0.15), mat(0x333333));
  postL.position.set(x - 2.4, 1.25, z);
  root.add(postL);
  const postR = postL.clone();
  postR.position.set(x + 2.4, 1.25, z);
  root.add(postR);
  // Tiny marker building for collision / name
  addBuilding(root, collisions, {
    id: `${id}-bus`,
    name: 'Arrêt de bus',
    x: x,
    z: z - 4,
    width: 3,
    depth: 2.5,
    height: 2.8,
    color: 0xffc107,
    kind: 'shop',
    districtId: id,
    collide: false,
  });
}
