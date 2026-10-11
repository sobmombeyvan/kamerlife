import * as THREE from 'three';
import { mat } from '../world/materials';
import type { CollisionSystem } from '../world/CollisionSystem';
import { addTextSign, addLampPost } from './signage';
import { createPalmTree } from '../vegetation/TreeFactory';
import { createBrandVehicle } from '../vehicles/VehicleFactory';
import { applyHomeDecor, loadHomeDecor } from '../home/HomeDecor';
import { buildHomeInteriorShell, HOME_SHELL } from '../home/buildHomeInterior';
import { applyIndoorAtmosphere, restoreOutdoorAtmosphere } from '../render/atmosphere';
import { retileMeshInPlace, surfaceMat } from '../render/surfaces';

/** Player home — start here, walk in/out through the front door. */
export const PLAYER_HOUSE = {
  id: 'player-house',
  name: 'Maison du Joueur',
  cx: 36,
  cz: 108,
  /** Living room spawn. */
  spawn: { x: 38, y: 0, z: 108 },
  /** Outside the front door. */
  doorOutside: { x: 36, z: 118.5 },
  halfW: 15,
  halfD: 16,
  interiorHalfW: 8.2,
  interiorHalfD: 7.2,
} as const;

/**
 * Residential house with walkable low-poly interior.
 * Home mode: isometric view, city hidden, warm indoor lighting.
 */
export function buildPlayerHouse(collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'landmark-player-house';
  const { cx, cz } = PLAYER_HOUSE;
  root.userData = {
    type: 'landmark',
    landmarkId: PLAYER_HOUSE.id,
    displayName: PLAYER_HOUSE.name,
    homeMode: false,
  };

  const exterior = new THREE.Group();
  exterior.name = 'player-house-exterior';
  const interior = new THREE.Group();
  interior.name = 'player-house-interior';
  root.add(exterior);
  root.add(interior);

  // —— Yard ——
  const yard = new THREE.Mesh(new THREE.BoxGeometry(30, 0.06, 32), surfaceMat('grass', 0x6b8f5e));
  yard.position.set(cx, 0.03, cz + 1);
  yard.receiveShadow = true;
  retileMeshInPlace(yard, 1.8);
  exterior.add(yard);

  const path = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 8), surfaceMat('sidewalk', 0xb0a896));
  path.position.set(cx, 0.06, cz + 11);
  retileMeshInPlace(path, 1.2);
  exterior.add(path);

  const drive = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.07, 10), surfaceMat('asphalt', 0x5a5a5a));
  drive.position.set(cx + 10, 0.05, cz + 10);
  retileMeshInPlace(drive, 1.6);
  exterior.add(drive);

  const car = createBrandVehicle(3, 'jetour');
  car.position.set(cx + 10, 0, cz + 11);
  car.rotation.y = Math.PI;
  car.userData.driveable = true;
  car.userData.parkedCar = true;
  car.userData.owner = 'player';
  exterior.add(car);

  const { wallH, innerW, innerD, floorY } = HOME_SHELL;
  const frontZ = cz + innerD / 2;

  buildHomeInteriorShell(interior, collisions, cx, cz);

  // Roof (exterior only)
  const roof = new THREE.Group();
  roof.name = 'player-house-roof';
  const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(innerW + 1.2, 0.25, innerD + 1.2), surfaceMat('roof', 0x6d4c41, 0.7, 0.12));
  roofSlab.position.set(cx, floorY + wallH + 0.2, cz);
  retileMeshInPlace(roofSlab, 1.1);
  roof.add(roofSlab);
  const ridge = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(innerW, innerD) * 0.55, 1.4, 4),
    surfaceMat('roof', 0x5d4037, 0.7, 0.12),
  );
  ridge.rotation.y = Math.PI / 4;
  ridge.position.set(cx, floorY + wallH + 1.0, cz);
  retileMeshInPlace(ridge, 1.1);
  roof.add(ridge);
  exterior.add(roof);
  root.userData.roof = roof;

  for (const [wx, wz] of [
    [cx - 3.5, cz - innerD / 2 - 0.2],
    [cx + 3.5, cz - innerD / 2 - 0.2],
    [cx - innerW / 2 - 0.2, cz],
    [cx + innerW / 2 + 0.2, cz],
  ] as const) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 0.12), mat(0x81d4fa, 0.45));
    win.position.set(wx, floorY + 1.8, wz);
    exterior.add(win);
  }

  addTextSign(exterior, cx, floorY + wallH + 0.15, frontZ + 0.2, 8, 0.9, 'Maison du Joueur', {
    subtitle: 'Ta résidence',
    bg: 0x37474f,
    fg: 0xffc857,
  });

  exterior.add(createPalmTree(cx - 11, cz + 8, 0.9, undefined));
  exterior.add(createPalmTree(cx + 12, cz - 6, 0.8, undefined));
  addLampPost(exterior, cx - 3, cz + 14);
  addLampPost(exterior, cx + 3, cz + 14);

  for (const [fx, fz, fw, fd] of [
    [cx, cz - 14.5, 28, 0.2],
    [cx - 14, cz, 0.2, 24],
    [cx + 14, cz - 2, 0.2, 20],
  ] as const) {
    const fence = new THREE.Mesh(new THREE.BoxGeometry(fw, 1.1, fd), surfaceMat('concrete', 0xa89888));
    fence.position.set(fx, 0.55, fz);
    retileMeshInPlace(fence, 1.4);
    exterior.add(fence);
    collisions.addBox(fx, 0.55, fz, fw / 2 + 0.1, 0.55, fd / 2 + 0.1);
  }

  root.userData.insideZone = {
    minX: cx - innerW / 2 + 0.4,
    maxX: cx + innerW / 2 - 0.4,
    minZ: cz - innerD / 2 + 0.4,
    maxZ: cz + innerD / 2 - 0.2,
  };
  root.userData.exterior = exterior;
  root.userData.interior = interior;

  applyHomeDecor(root, loadHomeDecor());

  return root;
}

export function isInsidePlayerHouse(x: number, z: number): boolean {
  const { cx, cz, interiorHalfW, interiorHalfD } = PLAYER_HOUSE;
  return Math.abs(x - cx) < interiorHalfW - 0.35 && Math.abs(z - cz) < interiorHalfD - 0.35;
}

export function vehicleBlockedByPlayerHouse(x: number, z: number, pad = 1.1): boolean {
  const { cx, cz, interiorHalfW, interiorHalfD } = PLAYER_HOUSE;
  return Math.abs(x - cx) < interiorHalfW + pad && Math.abs(z - cz) < interiorHalfD + pad;
}

/**
 * Home mode: hide city + façade/ceiling; warm isometric-friendly lighting.
 */
export function setHomeInteriorMode(
  houseRoot: THREE.Object3D,
  cityRoot: THREE.Object3D,
  scene: THREE.Scene,
  enabled: boolean,
): void {
  const house =
    houseRoot.name === 'landmark-player-house'
      ? (houseRoot as THREE.Group)
      : (houseRoot.getObjectByName('landmark-player-house') as THREE.Group | null);
  if (!house) return;

  const was = !!house.userData.homeMode;
  if (was === enabled) return;
  house.userData.homeMode = enabled;

  const exterior = house.userData.exterior as THREE.Object3D | undefined;
  const roof = house.userData.roof as THREE.Object3D | undefined;
  const ceiling = house.getObjectByName('home-ceiling');
  if (exterior) exterior.visible = !enabled;
  if (roof) roof.visible = !enabled;
  if (ceiling) ceiling.visible = !enabled;

  for (const name of ['parked-cars', 'traffic', 'pedestrians', 'taxi-stands']) {
    const g = scene.getObjectByName(name);
    if (g) g.visible = !enabled;
  }

  if (enabled) {
    if (house.parent !== scene) {
      house.userData.prevParent = house.parent;
      scene.attach(house);
    }
    cityRoot.visible = false;
    // Soft warm void around the open room (isometric cutaway)
    applyIndoorAtmosphere(scene);
    // Dim city sun influence — room has its own lights
    const sun = scene.children.find((c) => c instanceof THREE.DirectionalLight) as
      | THREE.DirectionalLight
      | undefined;
    if (sun) {
      house.userData.prevSunIntensity = sun.intensity;
      sun.intensity = 0.55;
      sun.color.setHex(0xffe0b2);
    }
  } else {
    cityRoot.visible = true;
    const prev = house.userData.prevParent as THREE.Object3D | undefined;
    if (prev) prev.attach(house);
    house.userData.prevParent = undefined;
    restoreOutdoorAtmosphere(scene);
    const sun = scene.children.find((c) => c instanceof THREE.DirectionalLight) as
      | THREE.DirectionalLight
      | undefined;
    if (sun && house.userData.prevSunIntensity != null) {
      sun.intensity = house.userData.prevSunIntensity as number;
      sun.color.setHex(0xffe0ac);
    }
  }
}

export function updatePlayerHouseInterior(root: THREE.Object3D, playerX: number, playerZ: number): void {
  const house = root.getObjectByName('landmark-player-house') as THREE.Group | undefined;
  if (!house || house.userData.homeMode) return;
  const roof = house.userData.roof as THREE.Object3D | undefined;
  if (roof) roof.visible = !isInsidePlayerHouse(playerX, playerZ);
}
