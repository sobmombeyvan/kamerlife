export type PoiCategory =
  | 'landmark'
  | 'market'
  | 'mall'
  | 'shop'
  | 'transport'
  | 'education'
  | 'health'
  | 'government'
  | 'residence'
  | 'fuel'
  | 'park'
  | 'airport'
  | 'travel';

export type PoiDef = {
  id: string;
  name: string;
  category: PoiCategory;
  districtId: string;
  position: { x: number; z: number };
  geoStatus: 'provisional' | 'unverified' | 'verified';
  interactive?: boolean;
  notes?: string;
};

/** Aligned to landmark sites + provisional district centres. */
export const POIS: PoiDef[] = [
  { id: 'rond-point-centre', name: 'Rond-point Centre-ville', category: 'park', districtId: 'centre-ville', position: { x: 0, z: 0 }, geoStatus: 'provisional' },
  { id: 'poste-centrale', name: 'Poste centrale', category: 'landmark', districtId: 'poste-centrale', position: { x: 160, z: -120 }, geoStatus: 'unverified' },
  { id: 'avenue-kennedy', name: 'Avenue Kennedy · Boutiques téléphones', category: 'shop', districtId: 'avenue-kennedy', position: { x: 100, z: 216 }, geoStatus: 'unverified' },
  {
    id: 'mfoundi-mall',
    name: 'Mfoundi Mall',
    category: 'mall',
    districtId: 'mfoundi',
    position: { x: -108, z: 180 },
    geoStatus: 'provisional',
    notes: 'Dedicated exterior builder. Interiors not implemented.',
  },
  {
    id: 'santa-lucia',
    name: 'Santa Lucia Grand Supermarket',
    category: 'shop',
    districtId: 'centre-ville',
    position: { x: 36, z: 36 },
    geoStatus: 'provisional',
    notes: 'Real brand name; game-world placement — not a verified branch.',
  },
  {
    id: 'travelpoint-centre',
    name: 'TravelPoint Cameroon',
    category: 'travel',
    districtId: 'centre-ville',
    position: { x: -36, z: -36 },
    geoStatus: 'provisional',
    notes: 'Exterior only. Booking UI later.',
  },
  {
    id: 'nsimalen-airport',
    name: 'Aéroport International de Yaoundé-Nsimalen',
    category: 'airport',
    districtId: 'nsimalen',
    position: { x: 216, z: 1080 },
    geoStatus: 'provisional',
    notes: 'Southern outskirts game placement. Exterior only.',
  },
  { id: 'marche-mokolo', name: 'Marché Mokolo', category: 'market', districtId: 'mokolo', position: { x: -420, z: -140 }, geoStatus: 'unverified' },
  { id: 'dovv', name: 'DOVV', category: 'shop', districtId: 'nlongkak', position: { x: 250, z: 90 }, geoStatus: 'unverified' },
  { id: 'alpha-motors', name: 'Alpha Motors', category: 'shop', districtId: 'bastos', position: { x: 252, z: 324 }, geoStatus: 'provisional' },
  { id: 'mercedes', name: 'Mercedes-Benz', category: 'shop', districtId: 'bastos', position: { x: 468, z: 324 }, geoStatus: 'provisional' },
  { id: 'cami', name: 'Cami Auto', category: 'shop', districtId: 'nlongkak', position: { x: 180, z: 108 }, geoStatus: 'provisional' },
  { id: 'abn', name: 'ABN Motors', category: 'shop', districtId: 'nlongkak', position: { x: 396, z: 36 }, geoStatus: 'provisional' },
  { id: 'base-militaire', name: 'Base militaire BIR', category: 'government', districtId: 'emana', position: { x: -324, z: -828 }, geoStatus: 'provisional' },
  { id: 'uy1-ngoa', name: 'Université de Yaoundé I', category: 'education', districtId: 'ngoa-ekelle', position: { x: -160, z: -380 }, geoStatus: 'unverified' },
  {
    id: 'etoudi-palais',
    name: "Palais de l'Unité",
    category: 'government',
    districtId: 'etoudi',
    position: { x: 140, z: -655 },
    geoStatus: 'provisional',
    notes: 'Exterior palace + Cameroon flag + police. Game placement — not GPS.',
  },
  {
    id: 'agence-voyage-mvan',
    name: 'Agence de Voyage 237 · Gare Mvan',
    category: 'travel',
    districtId: 'mvan',
    position: { x: 400, z: -400 },
    geoStatus: 'provisional',
    notes: 'Travel agency + bus depot with multiple coaches. Tickets not playable yet.',
  },
  { id: 'mont-febe', name: 'Mont Fébé (silhouette)', category: 'landmark', districtId: 'bastos', position: { x: 420, z: 420 }, geoStatus: 'provisional' },
];
