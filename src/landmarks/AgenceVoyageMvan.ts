import * as THREE from 'three';
import { mat } from '../world/materials';
import type { CollisionSystem } from '../world/CollisionSystem';
import { addLampPost, addTextSign } from './signage';
import { createNpcAvatar } from '../pedestrians/NpcAvatar';

export const AGENCE_MVAN = {
  id: 'agence-voyage-mvan',
  x: 400,
  z: -400,
} as const;

const BUS_COLORS = [0x1565c0, 0xc62828, 0x2e7d32, 0xf9a825, 0x6a1b9a, 0x00838f, 0xe65100, 0x37474f];

/**
 * Agence de voyage + gare routière à Mvan — plusieurs bus stationnés.
 * Tickets / booking UI = later (exterior + props only).
 */
export function buildAgenceVoyageMvan(collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'landmark-agence-voyage-mvan';
  root.userData = {
    type: 'landmark',
    landmarkId: AGENCE_MVAN.id,
    phase: 1,
    note: 'Gare routière / agence — extérieur. Billets fictifs pas encore jouables.',
  };

  const cx = AGENCE_MVAN.x;
  const cz = AGENCE_MVAN.z;

  // Yard asphalt
  const yard = new THREE.Mesh(new THREE.BoxGeometry(78, 0.08, 58), mat(0x3a3f42));
  yard.position.set(cx, 0.04, cz);
  yard.receiveShadow = true;
  root.add(yard);

  // Agency building
  const agency = new THREE.Mesh(new THREE.BoxGeometry(22, 6.5, 14), mat(0xe3f2fd));
  agency.position.set(cx - 22, 3.25, cz - 14);
  agency.castShadow = true;
  root.add(agency);

  const glass = new THREE.Mesh(new THREE.BoxGeometry(18, 3.5, 0.2), mat(0x81d4fa, 0.45));
  glass.position.set(cx - 22, 2.4, cz - 14 - 7.15);
  root.add(glass);

  addTextSign(root, cx - 22, 7.0, cz - 21.3, 18, 1.8, 'Agence 237', {
    subtitle: 'Gare Mvan',
    bg: 0x0d47a1,
    fg: 0xffc857,
  });

  // Ticket counters awning
  const awning = new THREE.Mesh(new THREE.BoxGeometry(20, 0.25, 4), mat(0x1565c0));
  awning.position.set(cx - 22, 4.2, cz - 22);
  root.add(awning);

  // Waiting hall / hangar
  const hangar = new THREE.Mesh(new THREE.BoxGeometry(28, 7, 16), mat(0xb0bec5));
  hangar.position.set(cx + 18, 3.5, cz - 12);
  hangar.castShadow = true;
  root.add(hangar);
  const hangarRoof = new THREE.Mesh(new THREE.BoxGeometry(30, 0.35, 18), mat(0x546e7a));
  hangarRoof.position.set(cx + 18, 7.2, cz - 12);
  root.add(hangarRoof);

  // Destination boards (visual)
  for (let i = 0; i < 4; i++) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(5, 1.2, 0.12), mat(0x212121));
    board.position.set(cx - 30 + i * 5.5, 3.8, cz - 21.5);
    root.add(board);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.7, 0.08), mat(0x00e676));
    strip.position.set(cx - 30 + i * 5.5, 3.8, cz - 21.4);
    root.add(strip);
  }

  // Bus bays — several coaches parked
  const busCount = 8;
  for (let i = 0; i < busCount; i++) {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const bx = cx - 18 + col * 14;
    const bz = cz + 6 + row * 14;
    const bus = createCoachBus(BUS_COLORS[i % BUS_COLORS.length]!, i);
    bus.position.set(bx, 0, bz);
    bus.rotation.y = Math.PI / 2; // face along bay
    root.add(bus);

    // Bay number marker
    const pad = new THREE.Mesh(new THREE.BoxGeometry(3, 0.06, 1.2), mat(0xffeb3b));
    pad.position.set(bx, 0.1, bz - 5);
    root.add(pad);
  }

  // Minibuses / cars for hire
  for (let i = 0; i < 3; i++) {
    const mini = createCoachBus(0xe9bf25, 20 + i, true);
    mini.position.set(cx + 28, 0, cz + 8 + i * 6);
    mini.rotation.y = -0.3;
    mini.scale.set(0.75, 0.85, 0.7);
    root.add(mini);
  }

  // Staff + travelers (static)
  const staff = createNpcAvatar(801, 'employee');
  staff.position.set(cx - 22, 0, cz - 23);
  staff.rotation.y = Math.PI;
  root.add(staff);

  for (let i = 0; i < 5; i++) {
    const pax = createNpcAvatar(810 + i, i % 2 ? 'tourist' : 'pedestrian');
    pax.position.set(cx - 28 + i * 3, 0, cz - 24);
    pax.rotation.y = Math.PI + (i - 2) * 0.1;
    root.add(pax);
  }

  // Benches
  for (let i = 0; i < 4; i++) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 0.6), mat(0x5d4037));
    bench.position.set(cx - 32 + i * 4, 0.35, cz - 26);
    root.add(bench);
  }

  for (let i = -2; i <= 2; i++) {
    addLampPost(root, cx + i * 14, cz + 22);
    addLampPost(root, cx + i * 14, cz - 26);
  }

  const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 12), mat(0x29b6f6, 0.65));
  marker.position.set(cx - 22, 0.1, cz - 24);
  marker.userData = {
    interaction: 'travel-agency',
    landmarkId: AGENCE_MVAN.id,
    ready: false,
    note: 'Agence + gare routière — billets pas encore jouables.',
  };
  root.add(marker);

  collisions.addBox(cx - 22, 3.25, cz - 14, 12, 3.5, 8);
  collisions.addBox(cx + 18, 3.5, cz - 12, 15, 4, 9);

  return root;
}

function createCoachBus(color: number, seed: number, mini = false): THREE.Group {
  const g = new THREE.Group();
  g.name = `bus-mvan-${seed}`;
  const len = mini ? 5.5 : 9.2;
  const h = mini ? 2.2 : 2.8;
  const w = mini ? 2.0 : 2.5;

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, len), mat(color));
  body.position.y = h / 2 + 0.15;
  body.castShadow = true;
  g.add(body);

  const windows = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, h * 0.35, len * 0.85), mat(0x81d4fa, 0.4));
  windows.position.y = h * 0.65;
  g.add(windows);

  // Stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.25, len * 0.95), mat(0xffffff));
  stripe.position.y = h * 0.35;
  g.add(stripe);

  // Wheels
  for (const wz of [-len * 0.32, len * 0.32] as const) {
    for (const wx of [-w * 0.45, w * 0.45] as const) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.28, 10), mat(0x222426));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.4, wz);
      g.add(wheel);
    }
  }

  // Destination plate on front
  const plate = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.45, 0.1), mat(0x212121));
  plate.position.set(0, h * 0.85, -len / 2 - 0.05);
  g.add(plate);

  return g;
}
