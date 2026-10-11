import * as THREE from 'three';
import { mat } from '../world/materials';
import type { CollisionSystem } from '../world/CollisionSystem';
import { addLampPost, addTextSign } from './signage';
import { getLandmark } from './LandmarkSites';

/** Hôpital Central — respectful exterior landmark (no medical gameplay). */
export function buildHopitalCentralExterior(collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'landmark-hopital-central';
  const site = getLandmark('hopital-central');
  const cx = site.x;
  const cz = site.z;
  root.userData = {
    type: 'landmark',
    landmarkId: 'hopital-central',
    phase: 1,
    note: 'Repère inspiré — pas de soins médicaux simulés.',
  };

  const lot = new THREE.Mesh(new THREE.BoxGeometry(70, 0.08, 58), mat(0x6b7168));
  lot.position.set(cx, 0.04, cz);
  lot.receiveShadow = true;
  root.add(lot);

  // Main ward block
  const main = new THREE.Mesh(new THREE.BoxGeometry(42, 12, 22), mat(0xf0f4f7));
  main.position.set(cx, 6.1, cz - 2);
  main.castShadow = true;
  main.receiveShadow = true;
  root.add(main);

  // Red cross accent wing
  const wing = new THREE.Mesh(new THREE.BoxGeometry(16, 8, 18), mat(0xe8eef2));
  wing.position.set(cx + 22, 4.1, cz + 6);
  wing.castShadow = true;
  root.add(wing);

  // Emergency canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(14, 0.35, 8), mat(0xc62828));
  canopy.position.set(cx - 8, 4.2, cz - 14);
  root.add(canopy);
  for (const sx of [-5, 5]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 4.1, 6), mat(0x78909c));
    post.position.set(cx - 8 + sx, 2.05, cz - 14);
    root.add(post);
  }

  // Red cross emblem
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5.5, 0.25), mat(0xc62828));
  crossV.position.set(cx, 9.5, cz - 13.2);
  root.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.2, 0.25), mat(0xc62828));
  crossH.position.set(cx, 9.5, cz - 13.2);
  root.add(crossH);

  addTextSign(root, cx, 13.4, cz - 13.3, 30, 2.0, 'Hôpital Central', {
    subtitle: 'Yaoundé · Urgences',
    bg: 0xffffff,
    fg: 0xb71c1c,
  });

  // Windows grid
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 0.12), mat(0x81d4fa, 0.4));
      win.position.set(cx - 16 + col * 4.2, 3.2 + row * 3.2, cz - 13.05);
      root.add(win);
    }
  }

  // Ambulance bay
  const amb = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.2, 2.4), mat(0xffffff));
  amb.position.set(cx - 18, 1.2, cz - 16);
  root.add(amb);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.5, 0.15), mat(0xc62828));
  stripe.position.set(cx - 18, 1.5, cz - 17.25);
  root.add(stripe);

  // Parking
  for (let i = 0; i < 5; i++) {
    const car = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.8, 1.6), mat(i % 2 ? 0x455a64 : 0xffffff));
    car.position.set(cx + 10 + i * 4.5, 0.5, cz + 20);
    root.add(car);
  }

  addLampPost(root, cx - 28, cz + 22);
  addLampPost(root, cx + 28, cz + 22);
  addLampPost(root, cx, cz - 22);

  collisions.addBox(cx, 6.1, cz - 2, 22, 6.2, 12);
  collisions.addBox(cx + 22, 4.1, cz + 6, 9, 4.2, 10);

  return root;
}
