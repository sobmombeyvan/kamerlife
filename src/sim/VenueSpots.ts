import type { ShopOffer } from './LifeSpots';

export type VenueKind = 'shop' | 'food' | 'job' | 'ritual';

export type VenueSpot = {
  id: string;
  venueId: string;
  kind: VenueKind;
  name: string;
  x: number;
  z: number;
  radius: number;
  blurb: string;
  offers?: ShopOffer[];
  boost?: { fun?: number; hygiene?: number; social?: number };
  price?: number;
};

export type VenueDef = {
  id: string;
  name: string;
  enterTip: string;
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  wallH: number;
  roofY: number;
  doorHalfW: number;
  hideRoof: boolean;
  rootName: string;
  /** Trespass / military site — no friendly visit. */
  restricted?: boolean;
};

const RESTO: ShopOffer[] = [
  { id: 'ndole-plat', label: 'Ndolé + plantain', price: 3500, item: 'meal' },
  { id: 'poulet-dg', label: 'Poulet DG', price: 4500, item: 'meal' },
  { id: 'poisson-braise', label: 'Poisson braisé', price: 4000, item: 'meal' },
  { id: 'jus-bissap', label: 'Jus bissap', price: 800, item: 'drink' },
  { id: 'koki', label: 'Koki + baton', price: 2500, item: 'meal' },
];

const CLUB: ShopOffer[] = [
  { id: 'castel', label: 'Castel', price: 1500, item: 'drink', boost: { fun: 10, social: 6 } },
  { id: 'cocktail', label: 'Cocktail', price: 3500, item: 'drink', boost: { fun: 14, social: 8 } },
  { id: 'eau-club', label: 'Eau', price: 500, item: 'drink' },
  { id: 'table', label: 'Table VIP', price: 15000, boost: { fun: 20, social: 16 } },
];

const STADIUM_FOOD: ShopOffer[] = [
  { id: 'brochette-stade', label: 'Brochettes', price: 1500, item: 'snack' },
  { id: 'eau-stade', label: 'Eau', price: 400, item: 'drink' },
  { id: 'soda-stade', label: 'Soda', price: 600, item: 'drink' },
];

export const VENUES: VenueDef[] = [
  {
    id: 'police',
    name: 'Commissariat central',
    enterTip: 'Accueil · cellules · E pour un job',
    cx: 36,
    cz: -108,
    halfW: 18,
    halfD: 14,
    wallH: 4.4,
    roofY: 8.4,
    doorHalfW: 3.2,
    hideRoof: true,
    rootName: 'landmark-police-centrale',
  },
  {
    id: 'gendarmerie',
    name: 'Gendarmerie nationale',
    enterTip: 'Brigade · E pour un job',
    cx: 252,
    cz: 108,
    halfW: 17,
    halfD: 13,
    wallH: 4.4,
    roofY: 8.2,
    doorHalfW: 3.0,
    hideRoof: true,
    rootName: 'landmark-gendarmerie',
  },
  {
    id: 'sed',
    name: 'SED',
    enterTip: 'Secrétariat d’État à la Défense',
    cx: 252,
    cz: -580,
    halfW: 20,
    halfD: 16,
    wallH: 4.8,
    roofY: 9.2,
    doorHalfW: 3.2,
    hideRoof: true,
    rootName: 'landmark-sed',
  },
  {
    id: 'olembe',
    name: 'Stade Olembé',
    enterTip: 'Pelouse · tribunes · buvettes',
    cx: 60,
    cz: -860,
    halfW: 62,
    halfD: 52,
    wallH: 0,
    roofY: 0,
    doorHalfW: 8,
    hideRoof: false,
    rootName: 'landmark-stade-olembe',
  },
  {
    id: 'eglise',
    name: 'Cathédrale',
    enterTip: 'Nef · autel · E pour prier',
    cx: 180,
    cz: -108,
    halfW: 14,
    halfD: 16,
    wallH: 6.2,
    roofY: 10.4,
    doorHalfW: 2.8,
    hideRoof: true,
    rootName: 'landmark-eglise-cathedrale',
  },
  {
    id: 'mosquee',
    name: 'Mosquée',
    enterTip: 'Salle de prière · E pour prier',
    cx: -252,
    cz: 36,
    halfW: 15,
    halfD: 13,
    wallH: 5.4,
    roofY: 9.2,
    doorHalfW: 3.4,
    hideRoof: true,
    rootName: 'landmark-mosquee',
  },
  {
    id: 'palais',
    name: "Palais de l'Unité",
    enterTip: 'ZONE MILITAIRE · accès interdit — on tire si tu forces',
    cx: 140,
    cz: -655,
    halfW: 22,
    halfD: 16,
    wallH: 6.4,
    roofY: 12.2,
    doorHalfW: 3.6,
    hideRoof: true,
    rootName: 'landmark-palais-etoudi',
    restricted: true,
  },
  {
    id: 'club-bastos',
    name: 'Club 237 · Bastos',
    enterTip: 'Piste · bar · E pour danser',
    cx: 396,
    cz: 252,
    halfW: 13,
    halfD: 11,
    wallH: 4.2,
    roofY: 6.8,
    doorHalfW: 2.6,
    hideRoof: true,
    rootName: 'landmark-club-bastos',
  },
  {
    id: 'club-hippo',
    name: 'Le Privilege',
    enterTip: 'Nuit · DJ · cocktails',
    cx: -144,
    cz: -36,
    halfW: 12,
    halfD: 10,
    wallH: 4.2,
    roofY: 6.6,
    doorHalfW: 2.4,
    hideRoof: true,
    rootName: 'landmark-club-hippo',
  },
  {
    id: 'resto-ndole',
    name: 'Chez Maman Ndolé',
    enterTip: 'Tables · cuisine · E pour manger',
    cx: 36,
    cz: 36,
    halfW: 11,
    halfD: 9,
    wallH: 3.8,
    roofY: 5.6,
    doorHalfW: 2.2,
    hideRoof: true,
    rootName: 'landmark-resto-ndole',
  },
  {
    id: 'resto-bastos',
    name: 'Villa Bastos',
    enterTip: 'Terrasse · plats du jour',
    cx: 396,
    cz: 324,
    halfW: 12,
    halfD: 10,
    wallH: 3.8,
    roofY: 5.8,
    doorHalfW: 2.2,
    hideRoof: true,
    rootName: 'landmark-resto-bastos',
  },
];

function v(id: string): VenueDef {
  return VENUES.find((x) => x.id === id)!;
}

export const VENUE_SPOTS: VenueSpot[] = [
  {
    id: 'pol-accueil',
    venueId: 'police',
    kind: 'job',
    name: 'Accueil commissariat',
    x: v('police').cx,
    z: v('police').cz + 2,
    radius: 3.8,
    blurb: 'Job · agent d’accueil',
  },
  {
    id: 'gen-accueil',
    venueId: 'gendarmerie',
    kind: 'job',
    name: 'Brigade',
    x: v('gendarmerie').cx,
    z: v('gendarmerie').cz + 1,
    radius: 3.6,
    blurb: 'Job · gendarme de brigade',
  },
  {
    id: 'sed-accueil',
    venueId: 'sed',
    kind: 'job',
    name: 'Accueil SED',
    x: v('sed').cx,
    z: v('sed').cz + 2,
    radius: 3.6,
    blurb: 'Job · sécurité',
  },
  {
    id: 'ole-match',
    venueId: 'olembe',
    kind: 'ritual',
    name: 'Tribune Olembé',
    x: v('olembe').cx + 18,
    z: v('olembe').cz + 8,
    radius: 8,
    blurb: 'Regarder le match',
    boost: { fun: 22, social: 12 },
    price: 2000,
  },
  {
    id: 'ole-food',
    venueId: 'olembe',
    kind: 'food',
    name: 'Buvette Olembé',
    x: v('olembe').cx - 22,
    z: v('olembe').cz + 28,
    radius: 5,
    blurb: 'Brochettes et soda',
    offers: STADIUM_FOOD,
  },
  {
    id: 'egl-prier',
    venueId: 'eglise',
    kind: 'ritual',
    name: 'Autel',
    x: v('eglise').cx,
    z: v('eglise').cz - 8,
    radius: 3.4,
    blurb: 'Un moment de prière',
    boost: { fun: 10, social: 8 },
  },
  {
    id: 'mos-prier',
    venueId: 'mosquee',
    kind: 'ritual',
    name: 'Salle de prière',
    x: v('mosquee').cx,
    z: v('mosquee').cz - 4,
    radius: 4.2,
    blurb: 'Prière',
    boost: { fun: 10, social: 8 },
  },
  {
    id: 'pal-hall',
    venueId: 'palais',
    kind: 'ritual',
    name: 'Hall d’honneur',
    x: v('palais').cx,
    z: v('palais').cz,
    radius: 4.5,
    blurb: 'Périmètre militaire — recule',
    boost: { fun: 8, social: 6 },
  },
  {
    id: 'clb-bar',
    venueId: 'club-bastos',
    kind: 'shop',
    name: 'Bar Club 237',
    x: v('club-bastos').cx,
    z: v('club-bastos').cz + 4,
    radius: 3.4,
    blurb: 'Boissons et table VIP',
    offers: CLUB,
  },
  {
    id: 'clb-dance',
    venueId: 'club-bastos',
    kind: 'ritual',
    name: 'Piste',
    x: v('club-bastos').cx,
    z: v('club-bastos').cz - 2,
    radius: 3.2,
    blurb: 'Danser',
    boost: { fun: 16, social: 14 },
    price: 1000,
  },
  {
    id: 'clh-bar',
    venueId: 'club-hippo',
    kind: 'shop',
    name: 'Bar Le Privilege',
    x: v('club-hippo').cx,
    z: v('club-hippo').cz + 3.2,
    radius: 3.2,
    blurb: 'Cocktails',
    offers: CLUB,
  },
  {
    id: 'clh-dance',
    venueId: 'club-hippo',
    kind: 'ritual',
    name: 'Piste Privilege',
    x: v('club-hippo').cx,
    z: v('club-hippo').cz - 2,
    radius: 3,
    blurb: 'Danser',
    boost: { fun: 16, social: 14 },
    price: 1000,
  },
  {
    id: 'rst-ndole',
    venueId: 'resto-ndole',
    kind: 'food',
    name: 'Chez Maman Ndolé',
    x: v('resto-ndole').cx,
    z: v('resto-ndole').cz,
    radius: 4,
    blurb: 'Cuisine camerounaise',
    offers: RESTO,
  },
  {
    id: 'rst-bastos',
    venueId: 'resto-bastos',
    kind: 'food',
    name: 'Villa Bastos',
    x: v('resto-bastos').cx,
    z: v('resto-bastos').cz,
    radius: 4,
    blurb: 'Poulet DG et poisson',
    offers: RESTO,
  },
];

export function venueAt(x: number, z: number): VenueDef | null {
  for (const v of VENUES) {
    if (Math.abs(x - v.cx) < v.halfW - 0.35 && Math.abs(z - v.cz) < v.halfD - 0.35) return v;
  }
  return null;
}

export function nearestVenueSpot(x: number, z: number, maxExtra = 0): VenueSpot | null {
  const inside = venueAt(x, z);
  if (!inside) return null;
  let best: VenueSpot | null = null;
  let bestD = Infinity;
  for (const s of VENUE_SPOTS) {
    if (s.venueId !== inside.id) continue;
    const d = Math.hypot(s.x - x, s.z - z);
    if (d <= s.radius + maxExtra && d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}
