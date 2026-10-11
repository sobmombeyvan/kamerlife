import * as THREE from 'three';
import type { CollisionSystem } from '../world/CollisionSystem';
import {
  HOME_FLOOR_BROWN,
  homeMat,
  homeWallMat,
  makeTiledFloorMaterial,
} from './homeMaterials';
import { retileMeshInPlace, surfaceMat } from '../render/surfaces';
import { HOME_SHELL } from './homeLayout';
import {
  createBed,
  createBookshelf,
  createChair,
  createCoffeeTable,
  createDesk,
  createFridge,
  createKitchenCounter,
  createNightstand,
  createPlant,
  createRug,
  createShower,
  createSofa,
  createTv,
  createWallLamp,
  createWardrobe,
  createWindow,
  place,
} from './LowPolyFurniture';
import { createHomeDoor, getHomeSpots } from './HomeInteract';

export { HOME_SHELL };

/**
 * Builds the playable low-poly interior shell (floor, walls, door, bathroom, fixtures).
 */
export function buildHomeInteriorShell(
  interior: THREE.Group,
  collisions: CollisionSystem,
  cx: number,
  cz: number,
): void {
  const { wallH, wallT, innerW, innerD, floorY } = HOME_SHELL;

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(innerW, 0.14, innerD),
    makeTiledFloorMaterial(7, 6),
  );
  floor.name = 'home-floor';
  floor.position.set(cx, floorY, cz);
  floor.receiveShadow = true;
  floor.userData.defaultFloor = HOME_FLOOR_BROWN;
  interior.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(innerW - 0.05, 0.08, innerD - 0.05),
    homeWallMat(0xfff3e0),
  );
  ceiling.name = 'home-ceiling';
  ceiling.position.set(cx, floorY + wallH - 0.04, cz);
  retileMeshInPlace(ceiling, 1.6);
  interior.add(ceiling);

  const doorHalf = 1.15;
  const frontZ = cz + innerD / 2;
  const segW = (innerW - doorHalf * 2) / 2;

  addWall(interior, collisions, cx, cz - innerD / 2, innerW, wallT, wallH, floorY);
  addWall(interior, collisions, cx - innerW / 2, cz, wallT, innerD, wallH, floorY);
  addWall(interior, collisions, cx + innerW / 2, cz, wallT, innerD, wallH, floorY);
  addWall(interior, collisions, cx - doorHalf - segW / 2, frontZ, segW, wallT, wallH, floorY);
  addWall(interior, collisions, cx + doorHalf + segW / 2, frontZ, segW, wallT, wallH, floorY);

  const frameMat = surfaceMat('wood', 0x6d4c41);
  for (const ox of [-doorHalf, doorHalf]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.14, wallH, 0.18), frameMat);
    f.position.set(cx + ox, floorY + wallH / 2, frontZ);
    retileMeshInPlace(f, 0.8);
    interior.add(f);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorHalf * 2 + 0.28, 0.18, 0.2), frameMat);
  lintel.position.set(cx, floorY + wallH - 0.1, frontZ);
  retileMeshInPlace(lintel, 0.8);
  interior.add(lintel);

  // Swinging door (closed = blocked)
  createHomeDoor(interior, collisions, cx, cz, floorY, wallH);

  for (const [bx, bz, bw, bd] of [
    [cx, cz - innerD / 2 + 0.05, innerW - 0.2, 0.08],
    [cx - innerW / 2 + 0.05, cz, 0.08, innerD - 0.2],
    [cx + innerW / 2 - 0.05, cz, 0.08, innerD - 0.2],
  ] as const) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.12, bd), homeMat(0x8d6e63));
    board.position.set(bx, floorY + 0.12, bz);
    interior.add(board);
  }

  // Windows
  place(interior, createWindow(2.0, 1.2), cx - 4.5, floorY + 1.9, cz - innerD / 2 + 0.22, 0);
  place(interior, createWindow(2.0, 1.2), cx + 1.5, floorY + 1.9, cz - innerD / 2 + 0.22, 0);
  place(interior, createWindow(1.6, 1.15), cx - innerW / 2 + 0.22, floorY + 1.9, cz + 1.5, Math.PI / 2);
  place(interior, createWindow(1.6, 1.15), cx + innerW / 2 - 0.22, floorY + 1.9, cz + 1.0, -Math.PI / 2);

  place(interior, createWallLamp(), cx - 5.5, floorY + 2.4, cz - innerD / 2 + 0.24, 0);
  place(interior, createWallLamp(), cx + 2.5, floorY + 2.4, cz - innerD / 2 + 0.24, 0);
  place(interior, createWallLamp(), cx - innerW / 2 + 0.24, floorY + 2.4, cz - 2.0, Math.PI / 2);

  // Bedroom / living partition (opening in middle)
  addWall(interior, collisions, cx - 2.2, cz - 2.5, wallT, 6.5, wallH - 0.1, floorY);
  // Kitchen half-wall
  addWall(interior, collisions, cx + 2.0, cz - 4.0, 6.5, wallT, 1.1, floorY);
  // Bathroom (front-left) — opening toward living room
  addWall(interior, collisions, cx - 5.8, cz + 4.2, 2.8, wallT, wallH - 0.1, floorY);
  addWall(interior, collisions, cx - 2.4, cz + 4.2, 2.0, wallT, wallH - 0.1, floorY);
  addWall(interior, collisions, cx - 7.2, cz + 5.6, wallT, 3.0, wallH - 0.1, floorY);

  // Kitchen
  place(
    interior,
    createKitchenCounter(),
    cx + 3.2,
    floorY,
    cz - 5.6,
    0,
    { fn: collisions.addBox.bind(collisions), hx: 1.25, hy: 0.5, hz: 0.4, cy: floorY + 0.5 },
  );
  place(
    interior,
    createFridge(),
    cx + 6.2,
    floorY,
    cz - 5.6,
    0,
    { fn: collisions.addBox.bind(collisions), hx: 0.45, hy: 0.95, hz: 0.4, cy: floorY + 0.95 },
  );

  // Bedroom furniture
  place(
    interior,
    createWardrobe(),
    cx - 6.5,
    floorY,
    cz - 4.8,
    0,
    { fn: collisions.addBox.bind(collisions), hx: 0.7, hy: 1.1, hz: 0.35, cy: floorY + 1.1 },
  );
  place(
    interior,
    createNightstand(),
    cx - 3.4,
    floorY,
    cz - 2.0,
    0,
    { fn: collisions.addBox.bind(collisions), hx: 0.3, hy: 0.35, hz: 0.25, cy: floorY + 0.35 },
  );
  place(
    interior,
    createBookshelf(),
    cx - 7.0,
    floorY,
    cz + 0.5,
    Math.PI / 2,
    { fn: collisions.addBox.bind(collisions), hx: 0.25, hy: 0.7, hz: 0.5, cy: floorY + 0.75 },
  );
  place(
    interior,
    createDesk(),
    cx - 6.2,
    floorY,
    cz + 2.4,
    Math.PI / 2,
    { fn: collisions.addBox.bind(collisions), hx: 0.45, hy: 0.45, hz: 0.85, cy: floorY + 0.5 },
  );
  place(interior, createChair(0x795548, 0x1565c0), cx - 5.2, floorY, cz + 2.4, -Math.PI / 2);
  place(interior, createChair(0x795548, 0xc62828), cx + 6.0, floorY, cz + 2.0, -Math.PI / 2);

  // Bathroom shower
  place(
    interior,
    createShower(),
    cx - 5.8,
    floorY,
    cz + 5.2,
    0,
    { fn: collisions.addBox.bind(collisions), hx: 0.65, hy: 1.0, hz: 0.65, cy: floorY + 1.0 },
  );
  // Sink vanity
  const sink = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.5), homeMat(0xeceff1));
  sink.position.set(cx - 3.6, floorY + 0.45, cz + 5.5);
  sink.castShadow = true;
  interior.add(sink);
  collisions.addBox(cx - 3.6, floorY + 0.45, cz + 5.5, 0.5, 0.4, 0.3);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.12, 10), homeMat(0xb3e5fc));
  basin.position.set(cx - 3.6, floorY + 0.85, cz + 5.5);
  interior.add(basin);

  // Lights
  const warm = new THREE.PointLight(0xffcc80, 1.35, 20, 2);
  warm.name = 'home-point-light';
  warm.position.set(cx, floorY + 2.5, cz);
  warm.castShadow = true;
  warm.shadow.mapSize.set(512, 512);
  interior.add(warm);

  const lampL = new THREE.PointLight(0xffe082, 0.5, 7, 2);
  lampL.position.set(cx - 5, floorY + 2.2, cz - 4);
  interior.add(lampL);
  const lampR = new THREE.PointLight(0xffe082, 0.5, 7, 2);
  lampR.position.set(cx + 4, floorY + 2.2, cz - 4);
  interior.add(lampR);
  const bathLight = new THREE.PointLight(0xb3e5fc, 0.4, 5, 2);
  bathLight.position.set(cx - 5.5, floorY + 2.3, cz + 5);
  interior.add(bathLight);

  const hemi = new THREE.HemisphereLight(0xfff0c8, 0x8d6e63, 0.55);
  hemi.name = 'home-hemi';
  hemi.position.set(cx, floorY + 2, cz);
  interior.add(hemi);

  registerDecorSlotCollisions(collisions, cx, cz, floorY);

  interior.userData.homeSpots = getHomeSpots(cx, cz);
}

export function registerDecorSlotCollisions(
  collisions: CollisionSystem,
  cx: number,
  cz: number,
  floorY: number,
): void {
  collisions.addBox(cx - 5.2, floorY + 0.4, cz - 0.8, 1.05, 0.35, 1.25); // bed
  collisions.addBox(cx + 4.0, floorY + 0.4, cz + 4.2, 1.35, 0.4, 0.55); // sofa
  collisions.addBox(cx + 4.0, floorY + 0.28, cz + 2.2, 0.6, 0.25, 0.35); // table
  collisions.addBox(cx + 4.0, floorY + 0.4, cz - 1.4, 0.9, 0.5, 0.3); // tv
}

export function buildDefaultDecorFurniture(
  layer: THREE.Group,
  collisions: CollisionSystem | undefined,
  cx: number,
  cz: number,
  floorY: number,
  colors: {
    bed: number;
    sofa: number;
    sofaAccent: number;
    table: number;
    rug: number;
    tv: number;
    tvGlow: number;
    plant: number;
  },
): void {
  place(layer, createBed(colors.bed), cx - 5.2, floorY, cz - 0.8, 0);
  if (collisions) {
    collisions.addBox(cx - 5.2, floorY + 0.4, cz - 0.8, 1.05, 0.35, 1.25);
  }

  place(layer, createSofa(colors.sofa, colors.sofaAccent), cx + 4.0, floorY, cz + 4.2, Math.PI);
  if (collisions) {
    collisions.addBox(cx + 4.0, floorY + 0.4, cz + 4.2, 1.35, 0.4, 0.55);
  }

  place(layer, createCoffeeTable(colors.table), cx + 4.0, floorY, cz + 2.2, 0);
  place(layer, createRug(colors.rug), cx + 4.0, floorY, cz + 2.8, 0);
  place(layer, createTv(colors.tv, colors.tvGlow), cx + 4.0, floorY, cz - 1.4, 0);
  if (collisions) {
    collisions.addBox(cx + 4.0, floorY + 0.4, cz - 1.4, 0.9, 0.5, 0.3);
  }

  place(layer, createPlant(colors.plant), cx + 0.5, floorY, cz + 5.5, 0);
  place(layer, createPlant(0x1b5e20), cx + 6.5, floorY, cz + 5.0, 0);
}

function addWall(
  root: THREE.Group,
  collisions: CollisionSystem,
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  floorY: number,
): void {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), homeWallMat(0xf2d06b));
  wall.name = 'homeWall';
  wall.userData.homeWall = true;
  wall.position.set(x, floorY + h / 2, z);
  retileMeshInPlace(wall, 1.8);
  wall.castShadow = true;
  wall.receiveShadow = true;
  root.add(wall);
  collisions.addBox(x, floorY + h / 2, z, w / 2 + 0.05, h / 2, d / 2 + 0.05);
}
