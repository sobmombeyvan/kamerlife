import { DISTRICTS } from '../data/districts';
import { ROAD_GRID } from '../roads/CityRoadPlan';

/**
 * Major landmark sites for 3D (exteriors + NPC anchors).
 * Game-world positions — not verified GPS.
 * Centers sit in cell interiors so roads can gap around them.
 */

export type LandmarkFootprint = {
  id: string;
  name: string;
  x: number;
  z: number;
  halfW: number;
  halfD: number;
  districtId: string;
};

/** Nearest grid-cell centre (away from road axes). */
export function cellInterior(x: number, z: number): { x: number; z: number } {
  const gx = Math.floor(x / ROAD_GRID) * ROAD_GRID;
  const gz = Math.floor(z / ROAD_GRID) * ROAD_GRID;
  return { x: gx + ROAD_GRID / 2, z: gz + ROAD_GRID / 2 };
}

/** Districts with dedicated hero exteriors (hubs skipped). */
const HERO_DISTRICTS = new Set([
  'centre-ville',
  'mfoundi',
  'nsimalen',
  'etoudi',
  'mvan',
  'ngoa-ekelle',
  'mokolo',
  'essos',
  'mendong',
  'odza',
  'biyem-assi',
  'nlongkak', // player house sits near this band
  'avenue-kennedy',
]);

const HERO_FOOTPRINTS: LandmarkFootprint[] = [
  {
    id: 'mfoundi-mall',
    name: 'Mfoundi Mall',
    x: -108,
    z: 180,
    halfW: 38,
    halfD: 42,
    districtId: 'mfoundi',
  },
  {
    id: 'santa-lucia',
    name: 'Santa Lucia Grand Supermarket',
    x: 108,
    z: 108,
    halfW: 28,
    halfD: 24,
    districtId: 'centre-ville',
  },
  {
    id: 'nsimalen-airport',
    name: 'Aéroport International de Yaoundé-Nsimalen',
    x: 216,
    z: 1080,
    halfW: 90,
    halfD: 70,
    districtId: 'nsimalen',
  },
  {
    id: 'travelpoint-centre',
    name: 'TravelPoint Cameroon (Centre-ville)',
    x: -36,
    z: -36,
    halfW: 10,
    halfD: 10,
    districtId: 'centre-ville',
  },
  {
    id: 'palais-etoudi',
    name: "Palais de l'Unité (Etoudi)",
    x: 140,
    z: -655,
    halfW: 48,
    halfD: 42,
    districtId: 'etoudi',
  },
  {
    id: 'agence-voyage-mvan',
    name: 'Agence de Voyage 237 · Gare Mvan',
    x: 400,
    z: -400,
    halfW: 42,
    halfD: 32,
    districtId: 'mvan',
  },
  {
    id: 'universite-ngoa-ekelle',
    name: 'Université de Yaoundé I (Ngoa-Ekellé)',
    x: -160,
    z: -400,
    halfW: 40,
    halfD: 32,
    districtId: 'ngoa-ekelle',
  },
  {
    id: 'marche-mokolo',
    name: 'Marché Mokolo',
    x: -420,
    z: -150,
    halfW: 40,
    halfD: 32,
    districtId: 'mokolo',
  },
  {
    id: 'habitations-essos',
    name: 'Cité Essos',
    x: 460,
    z: -80,
    halfW: 38,
    halfD: 30,
    districtId: 'essos',
  },
  {
    id: 'habitations-mendong',
    name: 'Lotissement Mendong',
    x: -520,
    z: 480,
    halfW: 38,
    halfD: 30,
    districtId: 'mendong',
  },
  {
    id: 'palais-odza',
    name: 'Palais & villas Odza',
    x: 620,
    z: 460,
    halfW: 44,
    halfD: 34,
    districtId: 'odza',
  },
  {
    id: 'biyem-assi-cite-ecole',
    name: 'Biyem-Assi · Cité & École',
    x: -380,
    z: 620,
    halfW: 42,
    halfD: 34,
    districtId: 'biyem-assi',
  },
  {
    id: 'player-house',
    name: 'Maison du Joueur',
    x: 36,
    z: 108,
    halfW: 18,
    halfD: 28,
    districtId: 'nlongkak',
  },
  {
    id: 'hopital-central',
    name: 'Hôpital Central de Yaoundé',
    x: -252,
    z: -180,
    halfW: 30,
    halfD: 26,
    districtId: 'centre-ville',
  },
  {
    id: 'eglise-cathedrale',
    name: 'Cathédrale / Église',
    x: 180,
    z: -108,
    halfW: 24,
    halfD: 22,
    districtId: 'essos',
  },
  {
    id: 'mosquee-centrale',
    name: 'Mosquée',
    x: -252,
    z: 36,
    halfW: 26,
    halfD: 24,
    districtId: 'mokolo',
  },
  {
    id: 'avenue-kennedy-phones',
    name: 'Avenue Kennedy · Téléphones',
    x: 100,
    z: 198,
    halfW: 80,
    halfD: 14,
    districtId: 'avenue-kennedy',
  },
  {
    id: 'avenue-kennedy-phones-n',
    name: 'Avenue Kennedy · Boutiques N',
    x: 100,
    z: 234,
    halfW: 76,
    halfD: 12,
    districtId: 'avenue-kennedy',
  },
];

/** Hub pads for every other quartier — snapped off road axes. */
const HUB_FOOTPRINTS: LandmarkFootprint[] = DISTRICTS.filter((d) => !HERO_DISTRICTS.has(d.id)).map(
  (d) => {
    const c = cellInterior(d.center.x, d.center.z);
    return {
      id: `hub-${d.id}`,
      name: `${d.name} · infrastructures`,
      x: c.x,
      z: c.z,
      halfW: 30,
      halfD: 26,
      districtId: d.id,
    };
  },
);

export const LANDMARK_FOOTPRINTS: LandmarkFootprint[] = [...HERO_FOOTPRINTS, ...HUB_FOOTPRINTS];

export function getLandmark(id: string): LandmarkFootprint {
  const f = LANDMARK_FOOTPRINTS.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown landmark: ${id}`);
  return f;
}

export function overlapsLandmarkFootprint(x: number, z: number, halfW: number, halfD: number): boolean {
  for (const f of LANDMARK_FOOTPRINTS) {
    if (Math.abs(x - f.x) < f.halfW + halfW && Math.abs(z - f.z) < f.halfD + halfD) {
      return true;
    }
  }
  return false;
}

export function nearestLandmark(x: number, z: number, maxDist = 55): LandmarkFootprint | null {
  let best: LandmarkFootprint | null = null;
  let bestD = maxDist;
  for (const f of LANDMARK_FOOTPRINTS) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}
