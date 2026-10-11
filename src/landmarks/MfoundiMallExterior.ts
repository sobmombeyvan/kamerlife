import * as THREE from 'three';
import { mat } from '../world/materials';
import type { CollisionSystem } from '../world/CollisionSystem';
import { addLampPost, addTextSign } from './signage';

/**
 * Mfoundi Mall — Phase 1 exterior only.
 * Modular wings + parking + entrance. Interiors / shopping gameplay = later.
 */
export function buildMfoundiMallExterior(collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'landmark-mfoundi-mall';
  root.userData = {
    type: 'landmark',
    landmarkId: 'mfoundi-mall',
    phase: 1,
    note: 'Exterior only — interiors not implemented.',
  };

  const cx = -108;
  const cz = 180;

  // Plaza asphalt / parking
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(72, 0.08, 78), mat(0x3a3f42));
  plaza.position.set(cx, 0.04, cz);
  plaza.receiveShadow = true;
  root.add(plaza);

  // Parking bay stripes
  for (let i = -4; i <= 4; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 4.5), mat(0xe8e8e8));
    line.position.set(cx - 28 + i * 3.2, 0.1, cz + 28);
    root.add(line);
  }

  // Main multi-floor wing (glass + concrete look)
  addWing(root, collisions, cx, cz - 8, 48, 18, 14, 0xb8c4c8, 'mall-main');
  // Glass facade strips
  for (let floor = 0; floor < 3; floor++) {
    const glass = new THREE.Mesh(new THREE.BoxGeometry(46, 2.8, 0.2), mat(0x7ec8e3, 0.35, 0.2));
    glass.position.set(cx, 3 + floor * 3.6, cz - 8 - 9.1);
    root.add(glass);
  }

  // East wing (shops modules)
  addWing(root, collisions, cx + 22, cz + 10, 20, 22, 10, 0xd4c4b0, 'mall-east');
  // West wing
  addWing(root, collisions, cx - 22, cz + 10, 20, 22, 10, 0xc9b8a4, 'mall-west');

  // Entrance canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(16, 0.35, 8), mat(0x2a3034));
  canopy.position.set(cx, 4.2, cz - 20);
  root.add(canopy);
  for (const sx of [-6, 6]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 4.2, 8), mat(0x555555));
    col.position.set(cx + sx, 2.1, cz - 20);
    root.add(col);
  }

  // Automatic-door portal (visual — no interior teleport yet)
  const doorL = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 0.15), mat(0x88c5d8, 0.4));
  doorL.position.set(cx - 1.3, 1.7, cz - 17.2);
  root.add(doorL);
  const doorR = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 0.15), mat(0x88c5d8, 0.4));
  doorR.position.set(cx + 1.3, 1.7, cz - 17.2);
  root.add(doorR);

  // Security checkpoint stubs
  for (const sx of [-5, 5]) {
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 0.8), mat(0x37474f));
    desk.position.set(cx + sx, 0.55, cz - 15);
    root.add(desk);
  }

  // Rooftop plant boxes
  for (const [px, pz] of [
    [cx - 18, cz - 4],
    [cx + 18, cz - 4],
    [cx, cz + 18],
  ] as const) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.7, 8), mat(0x5d4037));
    pot.position.set(px, 14.4, pz);
    root.add(pot);
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), mat(0x3d7a45));
    bush.position.set(px, 15.2, pz);
    root.add(bush);
  }

  addTextSign(root, cx, 12.5, cz - 17.5, 24, 2.4, 'Mfoundi Mall', {
    subtitle: 'Centre commercial',
    bg: 0x0d47a1,
    fg: 0xffc857,
  });

  const shops = [
    'Santa Lucia Grand',
    'Mfoundi Fashion',
    'Rich Telecom',
    'YK Store',
    'SmartTech',
    'Mboa Fashion',
    'Game Zone 237',
    'Cinema Mfoundi',
    'TravelPoint',
    'Food Court',
  ];
  shops.forEach((label, i) => {
    const sx = cx - 22 + (i % 5) * 11;
    const sz = cz + (i < 5 ? -16.5 : 20);
    const storefront = new THREE.Mesh(new THREE.BoxGeometry(9, 3.5, 0.25), mat(0xeceff1, 0.45));
    storefront.position.set(sx, 2.2, sz);
    root.add(storefront);
    addTextSign(root, sx, 4.4, sz + (i < 5 ? -0.2 : 0.2), 8.5, 0.95, label, {
      bg: 0x1565c0,
      fg: 0xffffff,
      yaw: i < 5 ? 0 : Math.PI,
    });
    storefront.userData = { shopLabel: label, displayName: label, interactive: false, phase: 1 };
  });

  // Taxi drop-off / parked cars
  for (let i = 0; i < 5; i++) {
    root.add(makeParkedVehicle(cx - 24 + i * 5.5, cz + 30, i % 2 === 0 ? 0xe9bf25 : 0x455a64, Math.PI));
  }
  for (let i = 0; i < 4; i++) {
    root.add(makeMoto(cx + 20 + i * 2.2, cz + 32, Math.PI * 0.1 * i));
  }

  for (let i = -3; i <= 3; i++) addLampPost(root, cx + i * 10, cz + 34);
  for (let i = -2; i <= 2; i++) addLampPost(root, cx + 34, cz + i * 12);

  // Interaction marker (entrance)
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.15, 12), mat(0xffc857, 0.6));
  marker.position.set(cx, 0.12, cz - 14);
  marker.userData = { interaction: 'mall-entrance', landmarkId: 'mfoundi-mall', ready: false };
  root.add(marker);

  collisions.addBox(cx, 7, cz - 8, 25, 7, 10);
  collisions.addBox(cx + 22, 5, cz + 10, 11, 5, 12);
  collisions.addBox(cx - 22, 5, cz + 10, 11, 5, 12);

  return root;
}

function addWing(
  root: THREE.Group,
  _collisions: CollisionSystem,
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  color: number,
  id: string,
): void {
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  body.position.set(x, h / 2, z);
  body.castShadow = true;
  body.receiveShadow = true;
  body.userData = { wingId: id };
  root.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.4, d + 0.8), mat(0x37474f));
  roof.position.set(x, h + 0.2, z);
  root.add(roof);
}

function makeParkedVehicle(x: number, z: number, color: number, yaw: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.9, 1.75), mat(color));
  body.position.y = 0.7;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 1.5), mat(0x78909c));
  cabin.position.set(-0.15, 1.35, 0);
  g.add(cabin);
  return g;
}

function makeMoto(x: number, z: number, yaw: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.45), mat(0xc62828));
  body.position.y = 0.55;
  g.add(body);
  return g;
}
