import { LANDMARK_FOOTPRINTS } from '../landmarks/LandmarkSites';
import { DISTRICTS } from '../data/districts';

export type TaxiDestination = {
  id: string;
  name: string;
  x: number;
  z: number;
  /** Estimated fare in FCFA (game currency). */
  fareFcfa: number;
};

export type TaxiStand = {
  id: string;
  name: string;
  x: number;
  z: number;
};

/** Drop-off points slightly off the plaza so player is not inside buildings. */
export function buildTaxiDestinations(): TaxiDestination[] {
  const dests: TaxiDestination[] = [
    { id: 'centre', name: 'Centre-ville (place)', x: 22, z: 28, fareFcfa: 500 },
    { id: 'home', name: 'Maison du Joueur', x: 36, z: 120, fareFcfa: 500 },
  ];

  for (const f of LANDMARK_FOOTPRINTS) {
    dests.push({
      id: f.id,
      name: f.name,
      x: f.x,
      z: f.z + f.halfD + 6,
      fareFcfa: Math.max(800, Math.round(Math.hypot(f.x, f.z) * 4)),
    });
  }

  // Major districts as taxi destinations
  const keyDistricts = [
    'mokolo',
    'bastos',
    'biyem-assi',
    'mendong',
    'essos',
    'ngoa-ekelle',
    'etoudi',
    'odza',
    'mvan',
  ];
  for (const id of keyDistricts) {
    const d = DISTRICTS.find((x) => x.id === id);
    if (!d) continue;
    dests.push({
      id: `dist-${d.id}`,
      name: d.name,
      x: d.center.x + 14,
      z: d.center.z + 14,
      fareFcfa: Math.max(1000, Math.round(Math.hypot(d.center.x, d.center.z) * 3.5)),
    });
  }

  return dests;
}

export function buildTaxiStands(): TaxiStand[] {
  const stands: TaxiStand[] = [
    { id: 'stand-centre', name: 'Yango · Centre', x: 20, z: 32 },
    { id: 'stand-rondpoint', name: 'Yango · Place centrale', x: -20, z: 32 },
  ];
  for (const f of LANDMARK_FOOTPRINTS) {
    stands.push({
      id: `stand-${f.id}`,
      name: `Yango · ${f.name}`,
      x: f.x + Math.min(20, f.halfW - 4),
      z: f.z + f.halfD + 4,
    });
  }
  // District hubs
  for (const id of ['mokolo', 'bastos', 'biyem-assi', 'essos', 'ngoa-ekelle']) {
    const d = DISTRICTS.find((x) => x.id === id);
    if (!d) continue;
    stands.push({
      id: `stand-${d.id}`,
      name: `Yango · ${d.name}`,
      x: d.center.x + 10,
      z: d.center.z - 8,
    });
  }
  return stands;
}

export function estimateFare(fromX: number, fromZ: number, dest: TaxiDestination): number {
  const dist = Math.hypot(dest.x - fromX, dest.z - fromZ);
  return Math.max(500, Math.round(400 + dist * 3.2));
}
