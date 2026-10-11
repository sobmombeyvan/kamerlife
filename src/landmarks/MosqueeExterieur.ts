import * as THREE from 'three';
import { mat } from '../world/materials';
import type { CollisionSystem } from '../world/CollisionSystem';
import { addLampPost, addTextSign } from './signage';
import { getLandmark } from './LandmarkSites';

/** Mosquée — landmark religieux respectueux. */
export function buildMosqueeExterieur(collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'landmark-mosquee';
  const site = getLandmark('mosquee-centrale');
  const cx = site.x;
  const cz = site.z;
  root.userData = {
    type: 'landmark',
    landmarkId: 'mosquee-centrale',
    phase: 1,
  };

  const court = new THREE.Mesh(new THREE.BoxGeometry(52, 0.07, 46), mat(0xd7ccc8));
  court.position.set(cx, 0.04, cz);
  court.receiveShadow = true;
  root.add(court);

  // Prayer hall
  const hall = new THREE.Mesh(new THREE.BoxGeometry(28, 8, 22), mat(0xfafafa));
  hall.position.set(cx + 2, 4.1, cz - 2);
  hall.castShadow = true;
  hall.receiveShadow = true;
  root.add(hall);

  // Green band
  const band = new THREE.Mesh(new THREE.BoxGeometry(28.2, 1.4, 0.2), mat(0x2e7d32));
  band.position.set(cx + 2, 7.2, cz + 9.05);
  root.add(band);

  // Central dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(7.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xfff8e1));
  dome.position.set(cx + 2, 8.2, cz - 2);
  root.add(dome);
  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.2, 8), mat(0xffc857));
  finial.position.set(cx + 2, 16.2, cz - 2);
  root.add(finial);

  // Minaret
  const minaret = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 22, 10), mat(0xf5f5f5));
  minaret.position.set(cx - 16, 11.1, cz + 8);
  minaret.castShadow = true;
  root.add(minaret);
  const balcony = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.5, 10), mat(0x2e7d32));
  balcony.position.set(cx - 16, 18.5, cz + 8);
  root.add(balcony);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(2.8, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffecb3));
  cap.position.set(cx - 16, 19.2, cz + 8);
  root.add(cap);
  const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.12, 6, 16, Math.PI * 1.4), mat(0xffc857));
  crescent.position.set(cx - 16, 22.4, cz + 8);
  crescent.rotation.z = 0.4;
  root.add(crescent);

  // Arcade entrance
  for (const ox of [-6, 0, 6]) {
    const arch = new THREE.Mesh(new THREE.BoxGeometry(4.5, 5.5, 0.35), mat(0xe8f5e9));
    arch.position.set(cx + 2 + ox, 2.9, cz + 9.1);
    root.add(arch);
    const opening = new THREE.Mesh(new THREE.BoxGeometry(2.8, 4.2, 0.4), mat(0x1b5e20, 0.35));
    opening.position.set(cx + 2 + ox, 2.4, cz + 9.15);
    root.add(opening);
  }

  addTextSign(root, cx + 2, 9.0, cz + 9.4, 18, 1.5, 'Mosquée', {
    subtitle: 'Communauté de Yaoundé',
    bg: 0x1b5e20,
    fg: 0xffecb3,
  });

  // Ablution fountain
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.8, 0.6, 16), mat(0x90caf9));
  fountain.position.set(cx + 14, 0.4, cz + 14);
  root.add(fountain);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.2, 16), mat(0x4fc3f7, 0.55));
  water.position.set(cx + 14, 0.75, cz + 14);
  root.add(water);

  // Courtyard trees as cylinders
  for (const [tx, tz] of [
    [cx - 20, cz - 14],
    [cx + 18, cz - 16],
  ] as const) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 3.5, 6), mat(0x5d4037));
    trunk.position.set(tx, 1.8, tz);
    root.add(trunk);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), mat(0x2e7d32));
    leaves.position.set(tx, 4.2, tz);
    root.add(leaves);
  }

  addLampPost(root, cx - 20, cz + 18);
  addLampPost(root, cx + 18, cz + 18);

  collisions.addBox(cx + 2, 4.1, cz - 2, 15, 4.5, 12);
  collisions.addBox(cx - 16, 11.1, cz + 8, 2.8, 11.5, 2.8);

  return root;
}
