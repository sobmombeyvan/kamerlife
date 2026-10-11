import * as THREE from 'three';
import { mat } from '../world/materials';

/** Static police officer (gendarme / police) — dark blue uniform, white cap. */
export function createPoliceOfficer(seed = 0): THREE.Group {
  const root = new THREE.Group();
  root.name = `police-${seed}`;
  root.userData = { role: 'police', landmark: 'palais-etoudi' };

  const skin = mat([0x5c3a24, 0x70452f, 0x8d5a3a][seed % 3]!);
  const uniform = mat(0x0d1b4c);
  const pants = mat(0x0a1440);
  const white = mat(0xf5f5f5);
  const shoe = mat(0x1a1a1a);
  const gold = mat(0xffc107, 0.5, 0.4);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.55, 4, 8), uniform);
  torso.position.y = 1.2;
  root.add(torso);

  // Chest badge
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.06), gold);
  badge.position.set(0.18, 1.35, 0.26);
  root.add(badge);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skin);
  head.position.y = 1.95;
  root.add(head);

  // White police cap
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.22, 12), white);
  cap.position.y = 2.2;
  root.add(cap);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.05, 12), mat(0x222222));
  brim.position.y = 2.1;
  root.add(brim);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.08, 12), mat(0xce1126));
  band.position.y = 2.14;
  root.add(band);

  for (const side of [-1, 1] as const) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.35, 3, 6), uniform);
    arm.position.set(side * 0.4, 1.3, 0);
    root.add(arm);

    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.42, 3, 6), pants);
    leg.position.set(side * 0.16, 0.5, 0);
    root.add(leg);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.36), shoe);
    boot.position.set(side * 0.16, 0.1, 0.06);
    root.add(boot);
  }

  return root;
}
