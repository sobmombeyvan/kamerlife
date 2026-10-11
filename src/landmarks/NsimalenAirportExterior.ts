import * as THREE from 'three';
import { mat } from '../world/materials';
import type { CollisionSystem } from '../world/CollisionSystem';
import { addLampPost, addTextSign } from './signage';

/**
 * Yaoundé-Nsimalen International Airport — Phase 1 exterior complex.
 * Connected by road network (access strip). Interior halls / flights = later.
 * Fictional schedules only when flight UI is added.
 */
export function buildNsimalenAirportExterior(collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'landmark-nsimalen-airport';
  root.userData = {
    type: 'landmark',
    landmarkId: 'nsimalen-airport',
    phase: 1,
    note: 'Exterior terminal + runway props. Full ops not simulated.',
  };

  const cx = 216;
  const cz = 1080;

  // Airside tarmac
  const apron = new THREE.Mesh(new THREE.BoxGeometry(160, 0.06, 120), mat(0x4a4f52));
  apron.position.set(cx, 0.03, cz);
  apron.receiveShadow = true;
  root.add(apron);

  // Runway strip (visual)
  const runway = new THREE.Mesh(new THREE.BoxGeometry(28, 0.05, 180), mat(0x2e3235));
  runway.position.set(cx + 70, 0.04, cz + 20);
  root.add(runway);
  for (let i = -8; i <= 8; i++) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 6), mat(0xf5f5f5));
    dash.position.set(cx + 70, 0.08, cz + 20 + i * 10);
    root.add(dash);
  }

  // Terminal building
  const terminal = new THREE.Mesh(new THREE.BoxGeometry(70, 12, 28), mat(0xeceff1));
  terminal.position.set(cx - 20, 6, cz - 10);
  terminal.castShadow = true;
  terminal.receiveShadow = true;
  root.add(terminal);

  // Glass curtain wall
  const curtain = new THREE.Mesh(new THREE.BoxGeometry(66, 9, 0.25), mat(0x64b5f6, 0.4, 0.25));
  curtain.position.set(cx - 20, 5.5, cz - 10 - 14.2);
  root.add(curtain);

  // Control tower
  const tower = new THREE.Mesh(new THREE.BoxGeometry(6, 22, 6), mat(0xb0bec5));
  tower.position.set(cx + 30, 11, cz - 5);
  root.add(tower);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 8), mat(0x90caf9, 0.45));
  cab.position.set(cx + 30, 23, cz - 5);
  root.add(cab);

  addTextSign(root, cx - 20, 14.2, cz - 24.5, 48, 2.8, 'Aéroport', {
    subtitle: 'Yaoundé-Nsimalen',
    bg: 0x0d47a1,
    fg: 0xffffff,
  });

  // Drop-off canopy
  const dropCanopy = new THREE.Mesh(new THREE.BoxGeometry(50, 0.4, 10), mat(0x37474f));
  dropCanopy.position.set(cx - 20, 5, cz - 28);
  root.add(dropCanopy);
  for (let i = -3; i <= 3; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 5, 8), mat(0x546e7a));
    col.position.set(cx - 20 + i * 7, 2.5, cz - 28);
    root.add(col);
  }

  // Departures / arrivals lane markers
  for (let i = 0; i < 8; i++) {
    const bay = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.06, 0.25), mat(i < 4 ? 0xffeb3b : 0x4caf50));
    bay.position.set(cx - 40 + i * 6, 0.1, cz - 32);
    root.add(bay);
  }

  // Taxi queue + buses
  for (let i = 0; i < 6; i++) {
    const taxi = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.9, 1.7), mat(0xe9bf25));
    taxi.position.set(cx - 55, 0.55, cz - 40 + i * 5);
    root.add(taxi);
  }
  for (let i = 0; i < 2; i++) {
    const bus = new THREE.Mesh(new THREE.BoxGeometry(8, 2.6, 2.4), mat(0x1565c0));
    bus.position.set(cx + 10 + i * 12, 1.4, cz - 36);
    root.add(bus);
  }

  // Parking lot cars
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 6; c++) {
      const car = new THREE.Mesh(
        new THREE.BoxGeometry(3.5, 0.8, 1.6),
        mat([0x455a64, 0xc62828, 0xffffff, 0x1b5e20][(r + c) % 4]!),
      );
      car.position.set(cx - 55 + c * 5, 0.5, cz + 15 + r * 6);
      root.add(car);
    }
  }

  // Perimeter fence
  for (let i = -8; i <= 8; i++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.4, 0.15), mat(0x757575));
    post.position.set(cx - 80 + i * 10, 1.2, cz + 55);
    root.add(post);
    if (i < 8) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(10, 0.08, 0.08), mat(0x9e9e9e));
      rail.position.set(cx - 75 + i * 10, 2, cz + 55);
      root.add(rail);
    }
  }

  // Aircraft proxies (static)
  root.add(makeAircraft(cx + 55, cz + 35, -0.4));
  root.add(makeAircraft(cx + 85, cz - 10, 0.2));

  // Ground service
  for (let i = 0; i < 4; i++) {
    const tug = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 1.2), mat(0xff9800));
    tug.position.set(cx + 40 + i * 4, 0.6, cz + 25);
    root.add(tug);
  }

  for (let i = -4; i <= 4; i++) addLampPost(root, cx - 20 + i * 12, cz - 40);

  const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.14, 14), mat(0x42a5f5, 0.65));
  marker.position.set(cx - 20, 0.12, cz - 26);
  marker.userData = { interaction: 'airport-entrance', landmarkId: 'nsimalen-airport', ready: false };
  root.add(marker);

  collisions.addBox(cx - 20, 6, cz - 10, 36, 6.5, 15);
  collisions.addBox(cx + 30, 11, cz - 5, 4, 12, 4);

  return root;
}

function makeAircraft(x: number, z: number, yaw: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(1.4, 14, 6, 10), mat(0xeceff1));
  fuselage.rotation.z = Math.PI / 2;
  fuselage.position.y = 2.2;
  g.add(fuselage);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(16, 0.25, 3.2), mat(0xb0bec5));
  wing.position.y = 2.1;
  g.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.5, 2.2), mat(0x1565c0));
  tail.position.set(-7.5, 3.5, 0);
  g.add(tail);
  return g;
}
