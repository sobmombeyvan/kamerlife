import type { DistrictDef } from './districts';
import type { BuildingKind } from '../buildings/BuildingFactory';

/**
 * Per-district urban character for logical, distinct neighbourhoods.
 * Game-world interpretation inspired by Yaoundé — not GPS-accurate.
 */
export type DistrictCharacter =
  | 'commercial_core'
  | 'market'
  | 'premium'
  | 'student'
  | 'residential_dense'
  | 'residential_family'
  | 'logistics'
  | 'periurban'
  | 'institutional'
  | 'airport';

export type DistrictProfile = {
  character: DistrictCharacter;
  /** Facade colours typical of the quartier */
  palette: number[];
  /** Relative weights — need not sum to 1 */
  mix: Partial<Record<BuildingKind, number>>;
  height: { min: number; max: number };
  /** How aggressively lots fill (0.5–1) */
  fill: number;
  /** Accent for district sign / ground tint */
  accent: number;
  blurb: string;
};

const CORE: DistrictProfile = {
  character: 'commercial_core',
  palette: [0xcfd8dc, 0xb0bec5, 0xeceff1, 0x90a4ae, 0xd7ccc8, 0xfff8e1],
  mix: { flat: 0.45, office: 0.25, shop: 0.25, landmark: 0.05 },
  height: { min: 10, max: 28 },
  fill: 1,
  accent: 0x5c6bc0,
  blurb: 'Tours, bureaux, commerces',
};

const MARKET: DistrictProfile = {
  character: 'market',
  palette: [0xd7a44d, 0xc34d38, 0xe4bb4e, 0x8d6e63, 0xbcaaa4, 0xff8a65],
  mix: { market: 0.35, shop: 0.35, flat: 0.2, house: 0.1 },
  height: { min: 3.5, max: 12 },
  fill: 1,
  accent: 0xff8f00,
  blurb: 'Marchés, étals, boutiques',
};

const PREMIUM: DistrictProfile = {
  character: 'premium',
  palette: [0xf5f5f5, 0xe8eaf6, 0xdce775, 0xb39ddb, 0xffecb3, 0x80cbc4],
  mix: { villa: 0.5, house: 0.2, flat: 0.15, shop: 0.15 },
  height: { min: 4, max: 9 },
  fill: 0.88,
  accent: 0x8e24aa,
  blurb: 'Villas, résidences, embassades',
};

const STUDENT: DistrictProfile = {
  character: 'student',
  palette: [0xe3f2fd, 0xfff3e0, 0xc8e6c9, 0xb0bec5, 0xffccbc],
  mix: { landmark: 0.25, flat: 0.3, shop: 0.25, house: 0.2 },
  height: { min: 4, max: 14 },
  fill: 0.9,
  accent: 0xe53935,
  blurb: 'Campus, cités, snacks',
};

const RES_DENSE: DistrictProfile = {
  character: 'residential_dense',
  palette: [0xd9b18b, 0xc98558, 0xe6d6b6, 0xa9b8b2, 0xb96e50, 0xc4a882],
  mix: { flat: 0.4, house: 0.3, shop: 0.25, market: 0.05 },
  height: { min: 5, max: 16 },
  fill: 0.95,
  accent: 0xfb8c00,
  blurb: 'Immeubles et commerces de quartier',
};

const RES_FAMILY: DistrictProfile = {
  character: 'residential_family',
  palette: [0xe1c7a0, 0xd6a56b, 0xf0e0c8, 0x8e9b8b, 0xc18b63, 0xd9d9cb],
  mix: { house: 0.5, flat: 0.2, shop: 0.25, villa: 0.05 },
  height: { min: 3.5, max: 10 },
  fill: 0.9,
  accent: 0x43a047,
  blurb: 'Maisons, écoles, épiciers',
};

const LOGISTICS: DistrictProfile = {
  character: 'logistics',
  palette: [0x78909c, 0x546e7a, 0xb0bec5, 0xffc107, 0x6d4c41],
  mix: { warehouse: 0.4, shop: 0.2, flat: 0.15, fuel: 0.1, house: 0.15 },
  height: { min: 4, max: 11 },
  fill: 0.85,
  accent: 0x5e35b1,
  blurb: 'Entrepôts, garages, transport',
};

const PERI: DistrictProfile = {
  character: 'periurban',
  palette: [0xc4a882, 0xb08968, 0xd7ccc8, 0xa1887f, 0x8d6e63],
  mix: { house: 0.5, shop: 0.25, flat: 0.15, villa: 0.05, market: 0.05 },
  height: { min: 3.2, max: 9 },
  fill: 0.92,
  accent: 0x7cb342,
  blurb: 'Lotissements, écoles, commerces',
};

const INSTITUTIONAL: DistrictProfile = {
  character: 'institutional',
  palette: [0xeceff1, 0xcfd8dc, 0xffffff, 0xa5d6a7, 0xffecb3],
  mix: { landmark: 0.35, office: 0.25, villa: 0.2, flat: 0.1, shop: 0.1 },
  height: { min: 5, max: 16 },
  fill: 0.7,
  accent: 0x43a047,
  blurb: 'Institutions, espaces verts',
};

const AIRPORT: DistrictProfile = {
  character: 'airport',
  palette: [0xeceff1, 0x90caf9, 0xb0bec5, 0xfff59d],
  mix: { landmark: 0.25, warehouse: 0.35, office: 0.2, shop: 0.2 },
  height: { min: 4, max: 12 },
  fill: 0.7,
  accent: 0x1565c0,
  blurb: 'Zone aéroportuaire',
};

/** Overrides by district id — every playable quartier gets a clear identity. */
export const DISTRICT_PROFILES: Record<string, DistrictProfile> = {
  'centre-ville': CORE,
  'poste-centrale': { ...CORE, blurb: 'Administratif & commerces', mix: { office: 0.35, flat: 0.3, shop: 0.3, landmark: 0.05 } },
  'avenue-kennedy': {
    ...CORE,
    height: { min: 6, max: 14 },
    fill: 0.95,
    mix: { shop: 0.7, office: 0.15, flat: 0.1, landmark: 0.05 },
    accent: 0xffc107,
    blurb: 'Avenue Kennedy — boutiques téléphones & GSM',
  },
  mfoundi: MARKET,
  mokolo: { ...MARKET, accent: 0x00897b, blurb: 'Grand marché & textiles' },
  briqueterie: { ...RES_DENSE, mix: { flat: 0.35, shop: 0.3, market: 0.2, house: 0.15 }, blurb: 'Dense, commerces populaires' },
  'cite-verte': RES_FAMILY,
  melen: { ...RES_DENSE, blurb: 'Étudiants & habitat dense' },
  mendong: { ...RES_FAMILY, fill: 0.95, mix: { house: 0.65, flat: 0.15, shop: 0.2 }, blurb: 'Habitations familiales' },
  'biyem-assi': {
    ...RES_DENSE,
    accent: 0xfb8c00,
    mix: { flat: 0.5, house: 0.2, shop: 0.15, landmark: 0.1, market: 0.05 },
    height: { min: 6, max: 18 },
    blurb: 'Grands immeubles & écoles',
  },
  simbock: PERI,
  nkolbisson: { ...PERI, mix: { house: 0.5, market: 0.15, shop: 0.2, flat: 0.15 }, blurb: 'Périurbain & stalls' },
  bastos: PREMIUM,
  nlongkak: { ...CORE, height: { min: 7, max: 18 }, fill: 0.95, blurb: 'Mix bureaux / habitat' },
  nsam: LOGISTICS,
  essos: {
    ...RES_FAMILY,
    accent: 0x039be5,
    fill: 0.95,
    mix: { house: 0.45, flat: 0.4, shop: 0.15 },
    height: { min: 4, max: 12 },
    blurb: 'Habitations Essos',
  },
  ngousso: { ...RES_FAMILY, mix: { house: 0.4, clinic: 0.08, shop: 0.27, flat: 0.25 }, blurb: 'Résidentiel & cliniques' },
  messassi: PERI,
  awae: { ...PERI, fill: 0.75, blurb: 'Lotissements verts' },
  obili: RES_FAMILY,
  'ngoa-ekelle': STUDENT,
  'mvog-ada': MARKET,
  mvan: LOGISTICS,
  ekounou: { ...RES_DENSE, mix: { shop: 0.3, flat: 0.3, house: 0.25, market: 0.15 } },
  mimboman: PERI,
  etoudi: INSTITUTIONAL,
  emana: PERI,
  olembe: { ...PERI, mix: { landmark: 0.15, house: 0.4, shop: 0.25, flat: 0.2 }, blurb: 'Stade & périphérie' },
  odza: {
    ...PREMIUM,
    fill: 0.85,
    mix: { villa: 0.55, house: 0.25, shop: 0.1, flat: 0.1 },
    height: { min: 5, max: 12 },
    blurb: 'Palais & grandes villas',
  },
  ahala: RES_FAMILY,
  nsimalen: AIRPORT,
};

export function profileFor(district: DistrictDef | null, x = 0, z = 0): DistrictProfile {
  if (district && DISTRICT_PROFILES[district.id]) return DISTRICT_PROFILES[district.id]!;
  const dist = Math.hypot(x, z);
  if (dist < 350) return CORE;
  if (dist < 700) return RES_DENSE;
  return PERI;
}

export type PickedBuilding = {
  kind: BuildingKind;
  w: number;
  d: number;
  h: number;
  color: number;
};

export function pickDistrictBuilding(
  profile: DistrictProfile,
  rand: () => number,
  maxHalf: number,
): PickedBuilding | null {
  // Sparse skip for low-fill districts (gardens / empty lots)
  if (rand() > profile.fill) return null;

  const kind = weightedKind(profile.mix, rand);
  const color = profile.palette[Math.floor(rand() * profile.palette.length)]!;

  let w = Math.min(maxHalf * 1.88, 6.5 + rand() * 7);
  let d = Math.min(maxHalf * 1.88, 6 + rand() * 6);
  let h = profile.height.min + rand() * (profile.height.max - profile.height.min);

  if (kind === 'villa') {
    w = Math.min(maxHalf * 1.6, 9 + rand() * 5);
    d = Math.min(maxHalf * 1.6, 8 + rand() * 4);
    h = Math.min(h, 7.5);
  } else if (kind === 'house') {
    w = Math.min(maxHalf * 1.7, 7 + rand() * 4);
    d = Math.min(maxHalf * 1.7, 6.5 + rand() * 3.5);
  } else if (kind === 'market') {
    w = Math.min(maxHalf * 1.9, 8 + rand() * 6);
    d = Math.min(maxHalf * 1.5, 5 + rand() * 4);
    h = Math.min(h, 5.5);
  } else if (kind === 'warehouse') {
    w = Math.min(maxHalf * 1.95, 12 + rand() * 6);
    d = Math.min(maxHalf * 1.9, 10 + rand() * 6);
    h = 4.5 + rand() * 4;
  } else if (kind === 'office') {
    w = Math.min(maxHalf * 1.85, 10 + rand() * 6);
    d = Math.min(maxHalf * 1.7, 8 + rand() * 5);
    h = Math.max(h, 12);
  } else if (kind === 'shop') {
    h = Math.min(Math.max(h, 4.5), 9);
  } else if (kind === 'fuel') {
    w = Math.min(maxHalf * 1.5, 10);
    d = Math.min(maxHalf * 1.4, 8);
    h = 4;
  } else if (kind === 'clinic') {
    w = Math.min(maxHalf * 1.7, 12);
    d = Math.min(maxHalf * 1.5, 10);
    h = 5 + rand() * 3;
  } else if (kind === 'landmark') {
    w = Math.min(maxHalf * 1.9, 14 + rand() * 4);
    d = Math.min(maxHalf * 1.8, 11 + rand() * 4);
  } else if (kind === 'flat') {
    h = Math.max(h, 8);
  }

  return { kind, w, d, h, color };
}

function weightedKind(mix: Partial<Record<BuildingKind, number>>, rand: () => number): BuildingKind {
  const entries = Object.entries(mix) as Array<[BuildingKind, number]>;
  if (entries.length === 0) return 'house';
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[0]![0];
}
