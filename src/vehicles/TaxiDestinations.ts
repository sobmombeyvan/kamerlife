import { LANDMARK_FOOTPRINTS } from '../landmarks/LandmarkSites';
import { DISTRICTS } from '../data/districts';
import { POIS } from '../data/pois';
import { LIFE_SPOTS } from '../sim/LifeSpots';
import { VENUES } from '../sim/VenueSpots';

export type TaxiDestination = {
  id: string;
  name: string;
  x: number;
  z: number;
  /** Estimated fare in FCFA (game currency). */
  fareFcfa: number;
  group?: 'maison' | 'quartier' | 'lieu' | 'sortie';
};

export type TaxiStand = {
  id: string;
  name: string;
  x: number;
  z: number;
};

const NEAR = 14;

function fareAt(x: number, z: number): number {
  return Math.max(800, Math.round(Math.hypot(x, z) * 3.8));
}

function normName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function addDest(
  dests: TaxiDestination[],
  dest: TaxiDestination,
  ids: Set<string>,
): void {
  if (ids.has(dest.id)) return;
  const n = normName(dest.name);
  for (const d of dests) {
    if (Math.hypot(d.x - dest.x, d.z - dest.z) < NEAR) return;
    if (normName(d.name) === n) return;
  }
  ids.add(dest.id);
  dests.push(dest);
}

/** Every quartier, landmark, venue and city spot — searchable in Yango / GPS. */
export function buildTaxiDestinations(): TaxiDestination[] {
  const dests: TaxiDestination[] = [];
  const ids = new Set<string>();

  addDest(dests, { id: 'home', name: 'Maison du Joueur', x: 31, z: 128, fareFcfa: 500, group: 'maison' }, ids);
  addDest(dests, { id: 'centre', name: 'Centre-ville (place)', x: 22, z: 28, fareFcfa: 500, group: 'quartier' }, ids);

  for (const f of LANDMARK_FOOTPRINTS) {
    const z = f.id === 'palais-etoudi' ? f.z + f.halfD + 18 : f.z + f.halfD + 6;
    addDest(
      dests,
      { id: f.id, name: f.name, x: f.x, z, fareFcfa: fareAt(f.x, f.z), group: 'lieu' },
      ids,
    );
  }

  for (const v of VENUES) {
    const z = v.restricted ? v.cz + v.halfD + 62 : v.cz + v.halfD + 5;
    addDest(
      dests,
      { id: `venue-${v.id}`, name: v.name, x: v.cx, z, fareFcfa: fareAt(v.cx, v.cz), group: 'lieu' },
      ids,
    );
  }

  for (const p of POIS) {
    addDest(
      dests,
      {
        id: `poi-${p.id}`,
        name: p.name,
        x: p.position.x,
        z: p.position.z + 8,
        fareFcfa: fareAt(p.position.x, p.position.z),
        group: 'lieu',
      },
      ids,
    );
  }

  for (const d of DISTRICTS) {
    addDest(
      dests,
      {
        id: `dist-${d.id}`,
        name: d.name,
        x: d.center.x + 12,
        z: d.center.z + 12,
        fareFcfa: Math.max(1000, fareAt(d.center.x, d.center.z)),
        group: 'quartier',
      },
      ids,
    );
  }

  for (const s of LIFE_SPOTS) {
    addDest(
      dests,
      { id: `spot-${s.id}`, name: s.name, x: s.x, z: s.z, fareFcfa: fareAt(s.x, s.z), group: 'sortie' },
      ids,
    );
  }

  dests.sort((a, b) => {
    const rank = (g?: string) => (g === 'maison' ? 0 : g === 'lieu' ? 1 : g === 'quartier' ? 2 : 3);
    const dr = rank(a.group) - rank(b.group);
    return dr !== 0 ? dr : a.name.localeCompare(b.name, 'fr');
  });
  return dests;
}

export function buildTaxiStands(): TaxiStand[] {
  const stands: TaxiStand[] = [
    { id: 'stand-centre', name: 'Yango · Centre', x: 20, z: 32 },
    { id: 'stand-rondpoint', name: 'Yango · Place centrale', x: -20, z: 32 },
  ];
  for (const f of LANDMARK_FOOTPRINTS) {
    if (f.id === 'palais-etoudi' || f.id.startsWith('hub-')) continue;
    stands.push({
      id: `stand-${f.id}`,
      name: `Yango · ${f.name}`,
      x: f.x + Math.min(20, f.halfW - 4),
      z: f.z + f.halfD + 4,
    });
  }
  for (const id of ['mokolo', 'bastos', 'biyem-assi', 'essos', 'ngoa-ekelle', 'mvan', 'odza']) {
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

export function filterDestinations(dests: TaxiDestination[], query: string): TaxiDestination[] {
  const q = query.trim().toLowerCase();
  if (!q) return dests;
  return dests.filter((d) => d.name.toLowerCase().includes(q) || (d.group ?? '').includes(q));
}
