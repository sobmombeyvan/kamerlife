import * as THREE from 'three';
import { mat } from '../world/materials';
import type { CollisionSystem } from '../world/CollisionSystem';
import { addTextSign } from './signage';

/**
 * TravelPoint Cameroon — Centre-ville branch exterior (Phase 1).
 * Mall branch is a storefront label on Mfoundi Mall. Booking UI = later.
 */
export function buildTravelPointCentreExterior(collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'landmark-travelpoint-centre';
  root.userData = {
    type: 'landmark',
    landmarkId: 'travelpoint-centre',
    phase: 1,
    note: 'Exterior storefront. Booking interface not implemented yet.',
  };

  const cx = -36;
  const cz = -36;

  const body = new THREE.Mesh(new THREE.BoxGeometry(12, 5.5, 10), mat(0xe3f2fd));
  body.position.set(cx, 2.75, cz);
  body.castShadow = true;
  root.add(body);

  const glass = new THREE.Mesh(new THREE.BoxGeometry(10, 3.2, 0.15), mat(0x81d4fa, 0.45));
  glass.position.set(cx, 2.2, cz - 5.1);
  root.add(glass);

  addTextSign(root, cx, 5.8, cz - 5.2, 11, 1.5, 'TravelPoint', {
    subtitle: 'Cameroon',
    bg: 0x0d47a1,
    fg: 0xffffff,
  });

  const awning = new THREE.Mesh(new THREE.BoxGeometry(12.5, 0.2, 2.5), mat(0x1565c0));
  awning.position.set(cx, 3.8, cz - 6);
  root.add(awning);

  const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 10), mat(0x29b6f6, 0.6));
  marker.position.set(cx, 0.08, cz - 6.5);
  marker.userData = { interaction: 'travel-agency', landmarkId: 'travelpoint-centre', ready: false };
  root.add(marker);

  collisions.addBox(cx, 2.75, cz, 6.5, 3, 5.5);
  return root;
}
