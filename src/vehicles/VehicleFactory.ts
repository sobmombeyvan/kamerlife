import * as THREE from 'three';
import { mat } from '../world/materials';
import type { VehicleId } from './catalog';
import { createCatalogVehicle } from './buildVehicle';
import { addMesh, boxGeo, carPaint, cylGeo, kitMats } from './CarKit';

export type VehicleBrand = 'taxi' | 'yellow-taxi' | 'car' | 'jetour' | 'prado' | 'tesla' | 'mercedes';

export type { VehicleId };

const STREET_IDS: VehicleId[] = [
  'vitz',
  'starlet',
  'corolla',
  'rav4',
  'coolray',
  'gx3',
  'cs55',
  'cityray',
  'sedan',
];

export function brandToVehicleId(seed: number, brand: VehicleBrand): VehicleId {
  switch (brand) {
    case 'taxi':
      return 'yango';
    case 'yellow-taxi':
      return 'yellow-taxi';
    case 'jetour':
      return seed % 2 ? 'cs55' : 'coolray';
    case 'prado':
      return seed % 3 === 0 ? 'fortuner' : 'prado';
    case 'tesla':
      return 'mg7';
    case 'mercedes':
      return seed % 2 ? 's450' : 's580';
    default:
      return STREET_IDS[seed % STREET_IDS.length]!;
  }
}

/** Vehicles face local +Z (forward). */
export function createCarMesh(seed: number, taxi = false): THREE.Group {
  return createBrandVehicle(seed, taxi ? 'taxi' : 'car');
}

export function createBrandVehicle(seed: number, brand: VehicleBrand): THREE.Group {
  return createCatalogVehicle(brandToVehicleId(seed, brand), seed, 'street');
}

export function pickParkedBrand(seed: number): VehicleBrand {
  const r = seed % 12;
  if (r === 0) return 'taxi';
  if (r === 1 || r === 2) return 'yellow-taxi';
  if (r === 3 || r === 4) return 'jetour';
  if (r === 5 || r === 6 || r === 7) return 'prado';
  if (r === 8 || r === 9) return 'tesla';
  return 'car';
}

export function createBusMesh(): THREE.Group {
  return createCatalogVehicle('coaster', 4, 'street');
}

const motoWheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.14, 10);
const RIDER_SHIRTS = [0xf9a825, 0x1565c0, 0x2e7d32, 0xd84315, 0x6a1b9a];

/** Bend-skin moto-taxi with rider. */
export function createMotoMesh(seed: number): THREE.Group {
  const g = new THREE.Group();
  const red = seed % 2 ? 0xc62828 : 0x212121;
  const paint = carPaint(red, { street: true });
  addMesh(g, boxGeo(0.38, 0.42, 1.15), paint, 0, 0.62, 0);
  addMesh(g, boxGeo(0.32, 0.22, 0.45), paint, 0, 0.88, -0.15);
  addMesh(g, boxGeo(0.08, 0.55, 0.08), kitMats.chrome(), 0, 0.72, 0.52);
  addMesh(g, boxGeo(0.72, 0.05, 0.05), kitMats.chrome(), 0, 1.02, 0.55);
  const rubber = kitMats.rubber();
  const rim = kitMats.rim();
  for (const z of [-0.62, 0.68]) {
    const w = new THREE.Group();
    w.position.set(0, 0.32, z);
    const t = new THREE.Mesh(motoWheelGeo, rubber);
    t.rotation.z = Math.PI / 2;
    const r = new THREE.Mesh(cylGeo(0.16, 0.08, 8), rim);
    r.rotation.z = Math.PI / 2;
    w.add(t, r);
    g.add(w);
  }
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.58, 0.24),
    carPaint(RIDER_SHIRTS[seed % RIDER_SHIRTS.length]!, { street: true }),
  );
  torso.position.set(0, 1.2, -0.04);
  torso.rotation.x = 0.22;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mat(0x4a2c1d));
  head.position.set(0, 1.62, 0.05);
  g.add(head);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
    kitMats.darkTrim(),
  );
  helmet.position.set(0, 1.64, 0.05);
  g.add(helmet);
  for (const x of [-0.12, 0.12]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.12), kitMats.plastic());
    leg.position.set(x, 0.8, 0.08);
    leg.rotation.x = -0.85;
    g.add(leg);
  }
  g.userData.halfLength = 0.95;
  g.userData.halfWidth = 0.38;
  return g;
}
