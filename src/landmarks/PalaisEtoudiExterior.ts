import * as THREE from 'three';
import { mat } from '../world/materials';
import type { CollisionSystem } from '../world/CollisionSystem';
import { addGroundFlagPole } from './CameroonFlag';
import { createPoliceOfficer } from './PoliceOfficer';
import { addLampPost, addTextSign } from './signage';

/** Game-world placement at Etoudi (not GPS-accurate). */
export const PALAIS_ETOUDI = {
  id: 'palais-etoudi',
  x: 140,
  z: -655,
} as const;

/**
 * Palais présidentiel (Palais de l'Unité) — exterior only.
 * Represented respectfully: palace, Cameroon flag, police at the gate.
 */
export function buildPalaisEtoudiExterior(collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'landmark-palais-etoudi';
  root.userData = {
    type: 'landmark',
    landmarkId: PALAIS_ETOUDI.id,
    landmarkReal: true,
    notes: 'Repère inspiré du Palais de l’Unité — placement de jeu, extérieur seulement.',
  };

  const cx = PALAIS_ETOUDI.x;
  const cz = PALAIS_ETOUDI.z;

  // Grounds
  const lawn = new THREE.Mesh(new THREE.BoxGeometry(90, 0.08, 70), mat(0x4a7a42));
  lawn.position.set(cx, 0.04, cz);
  lawn.receiveShadow = true;
  root.add(lawn);

  // Driveway from south (city side)
  const drive = new THREE.Mesh(new THREE.BoxGeometry(10, 0.1, 36), mat(0x4a4f52));
  drive.position.set(cx, 0.08, cz + 28);
  root.add(drive);

  // Main palace body
  const main = new THREE.Mesh(new THREE.BoxGeometry(48, 14, 28), mat(0xf5f0e6));
  main.position.set(cx, 7, cz - 4);
  main.castShadow = true;
  main.receiveShadow = true;
  root.add(main);

  // Central portico
  const portico = new THREE.Mesh(new THREE.BoxGeometry(18, 10, 8), mat(0xfff8e7));
  portico.position.set(cx, 5, cz + 12);
  root.add(portico);

  // Columns
  for (const sx of [-6, -2, 2, 6]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 9, 10), mat(0xeeeeee));
    col.position.set(cx + sx, 4.5, cz + 15);
    root.add(col);
  }

  // Dome / cupola
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5.5, 16, 12), mat(0xd4af37, 0.45, 0.35));
  dome.position.set(cx, 16.5, cz - 4);
  dome.scale.y = 0.65;
  root.add(dome);

  // Side wings
  for (const side of [-1, 1] as const) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(16, 10, 20), mat(0xefebe0));
    wing.position.set(cx + side * 30, 5, cz - 2);
    wing.castShadow = true;
    root.add(wing);
  }

  // Windows
  for (let floor = 0; floor < 3; floor++) {
    for (let i = -4; i <= 4; i++) {
      if (Math.abs(i) < 2) continue;
      const win = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 0.15), mat(0x64b5f6, 0.4, 0.2));
      win.position.set(cx + i * 4.5, 3.5 + floor * 3.5, cz + 10.1);
      root.add(win);
    }
  }

  // Perimeter wall + gate (south entrance)
  const wallH = 3.2;
  for (const [wx, wz, ww, wd] of [
    [cx - 42, cz, 2, 68],
    [cx + 42, cz, 2, 68],
    [cx, cz - 34, 86, 2],
  ] as const) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(ww, wallH, wd), mat(0xd7ccc8));
    wall.position.set(wx, wallH / 2, wz);
    root.add(wall);
  }
  // Front wall with gate opening
  for (const side of [-1, 1] as const) {
    const front = new THREE.Mesh(new THREE.BoxGeometry(34, wallH, 2), mat(0xd7ccc8));
    front.position.set(cx + side * 26, wallH / 2, cz + 34);
    root.add(front);
  }

  // Gate pillars + barrier
  for (const side of [-1, 1] as const) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4.5, 1.4), mat(0xeeeeee));
    pillar.position.set(cx + side * 6, 2.25, cz + 34);
    root.add(pillar);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 1.8), mat(0xd4af37));
    cap.position.set(cx + side * 6, 4.6, cz + 34);
    root.add(cap);
  }
  const gate = new THREE.Mesh(new THREE.BoxGeometry(10, 3.2, 0.25), mat(0x37474f));
  gate.position.set(cx, 1.7, cz + 34.2);
  root.add(gate);

  // Cameroon flags — main pole at entrance + two on palace roof
  addGroundFlagPole(root, cx - 10, cz + 30, 16, 0.15);
  addGroundFlagPole(root, cx + 10, cz + 30, 16, -0.15);
  addGroundFlagPole(root, cx, cz + 18, 12, 0);

  addTextSign(root, cx, 8.2, cz + 16.2, 22, 2.0, "Palais de l'Unité", {
    subtitle: 'Etoudi',
    bg: 0x0d47a1,
    fg: 0xffc857,
  });

  // Police officers in front of the gate
  const policeSpots: Array<[number, number, number]> = [
    [cx - 4.5, cz + 37, 0],
    [cx + 4.5, cz + 37, 0],
    [cx - 8, cz + 36, 0.2],
    [cx + 8, cz + 36, -0.2],
    [cx - 14, cz + 35, 0.4],
    [cx + 14, cz + 35, -0.4],
  ];
  policeSpots.forEach(([px, pz, yaw], i) => {
    const cop = createPoliceOfficer(i);
    cop.position.set(px, 0, pz);
    cop.rotation.y = Math.PI + yaw; // face south toward visitors
    root.add(cop);
  });

  // Guard booths
  for (const side of [-1, 1] as const) {
    const booth = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.8, 3), mat(0xffffff));
    booth.position.set(cx + side * 12, 1.4, cz + 36);
    root.add(booth);
  }

  // Parked official cars
  for (let i = 0; i < 3; i++) {
    const car = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 4.2), mat(i === 0 ? 0x111111 : 0x1a237e));
    car.position.set(cx - 18 + i * 5, 0.55, cz + 24);
    root.add(car);
  }

  for (let i = -3; i <= 3; i++) {
    if (Math.abs(i) < 2) continue;
    addLampPost(root, cx + i * 8, cz + 32);
  }

  // Interaction marker at gate
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.12, 14), mat(0xd4af37, 0.65));
  marker.position.set(cx, 0.1, cz + 38);
  marker.userData = {
    interaction: 'palais-gate',
    landmarkId: PALAIS_ETOUDI.id,
    ready: false,
    note: 'Extérieur seulement — pas d’entrée intérieure.',
  };
  root.add(marker);

  collisions.addBox(cx, 7, cz - 4, 26, 8, 16);
  collisions.addBox(cx - 30, 5, cz - 2, 9, 6, 11);
  collisions.addBox(cx + 30, 5, cz - 2, 9, 6, 11);
  collisions.addBox(cx, wallH / 2, cz + 34, 40, wallH / 2 + 0.5, 1.2);

  return root;
}
