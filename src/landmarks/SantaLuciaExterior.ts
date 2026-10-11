import * as THREE from 'three';
import { mat } from '../world/materials';
import type { CollisionSystem } from '../world/CollisionSystem';
import { addLampPost, addTextSign } from './signage';
import { getLandmark } from './LandmarkSites';

/**
 * Santa Lucia Grand Supermarket — Phase 1 exterior.
 * Real-world brand name used respectfully; placement is a game-world interpretation
 * (not a verified real branch location). Interior aisles / checkout = later phase.
 */
export function buildSantaLuciaExterior(collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'landmark-santa-lucia';
  root.userData = {
    type: 'landmark',
    landmarkId: 'santa-lucia',
    brand: 'Santa Lucia',
    fictionalPlacement: true,
    phase: 1,
    note: 'Exterior only. Not a verified real-world branch.',
  };

  const site = getLandmark('santa-lucia');
  const cx = site.x;
  const cz = site.z;

  const lot = new THREE.Mesh(new THREE.BoxGeometry(52, 0.08, 44), mat(0x42484c));
  lot.position.set(cx, 0.04, cz);
  lot.receiveShadow = true;
  root.add(lot);

  // Main supermarket box
  const hall = new THREE.Mesh(new THREE.BoxGeometry(36, 8.5, 22), mat(0xf5f5f5));
  hall.position.set(cx, 4.25, cz - 2);
  hall.castShadow = true;
  hall.receiveShadow = true;
  root.add(hall);

  // Green brand stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(36.2, 1.8, 0.25), mat(0x2e7d32));
  stripe.position.set(cx, 7.2, cz - 2 - 11.15);
  root.add(stripe);

  addTextSign(root, cx, 9.8, cz - 13.3, 28, 2.2, 'Santa Lucia', {
    subtitle: 'Grand Supermarket',
    bg: 0x1b5e20,
    fg: 0xffffff,
  });
  addTextSign(root, cx, 7.6, cz - 13.2, 20, 1.2, 'Ouvert 7j/7', {
    bg: 0xffffff,
    fg: 0x1b5e20,
  });

  // Glass entrance
  const glass = new THREE.Mesh(new THREE.BoxGeometry(10, 3.8, 0.2), mat(0x81d4fa, 0.4));
  glass.position.set(cx, 2.1, cz - 13.1);
  root.add(glass);
  for (const sx of [-3.2, 3.2]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.4, 0.12), mat(0x4fc3f7, 0.45));
    door.position.set(cx + sx, 1.9, cz - 13);
    root.add(door);
  }

  // Cart corral
  const corral = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 4), mat(0x90a4ae));
  corral.position.set(cx - 14, 0.6, cz - 14);
  root.add(corral);
  for (let i = 0; i < 6; i++) {
    const cart = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.9), mat(0xb0bec5));
    cart.position.set(cx - 16 + i * 1.1, 0.45, cz - 14);
    root.add(cart);
  }

  // Loading dock / delivery
  const dock = new THREE.Mesh(new THREE.BoxGeometry(10, 3.5, 8), mat(0xe0e0e0));
  dock.position.set(cx + 20, 1.75, cz + 6);
  root.add(dock);
  const truck = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.4, 2.2), mat(0x1565c0));
  truck.position.set(cx + 20, 1.3, cz + 14);
  root.add(truck);

  // Side windows
  for (let i = 0; i < 5; i++) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.2, 2.8), mat(0x81d4fa, 0.35));
    win.position.set(cx - 18.1, 3.5, cz - 8 + i * 3.5);
    root.add(win);
  }

  // Parking + taxis + motos
  for (let i = 0; i < 4; i++) {
    const car = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.85, 1.7), mat(i % 2 ? 0xe9bf25 : 0x607d8b));
    car.position.set(cx - 18 + i * 5, 0.55, cz + 14);
    root.add(car);
  }
  for (let i = 0; i < 3; i++) {
    const moto = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.4), mat(0xc62828));
    moto.position.set(cx + 8 + i * 2, 0.4, cz + 15);
    root.add(moto);
  }

  addLampPost(root, cx - 20, cz + 16);
  addLampPost(root, cx + 20, cz + 16);
  addLampPost(root, cx, cz - 18);

  const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 12), mat(0x66bb6a, 0.65));
  marker.position.set(cx, 0.1, cz - 11);
  marker.userData = { interaction: 'supermarket-entrance', landmarkId: 'santa-lucia', ready: false };
  root.add(marker);

  collisions.addBox(cx, 4.25, cz - 2, 19, 4.5, 12);
  collisions.addBox(cx + 20, 1.75, cz + 6, 5.5, 2, 4.5);

  return root;
}
