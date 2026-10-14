import type { LifeSpot, ShopOffer } from './LifeSpots';
import { DRINK_OFFERS, FOOD_OFFERS } from './LifeSpots';

export const MFOUNDI_MALL = {
  id: 'mfoundi-mall',
  name: 'Mfoundi Mall',
  cx: -108,
  cz: 180,
  halfW: 24,
  halfD: 16.5,
  /** Ground-floor storey height (= walkable floor 2). */
  wallH: 4.9,
  floor2Y: 4.9,
  roofY: 9.6,
  /** South facade; walk in from the plaza. */
  doorZ: 180 - 16.5,
  doorHalfW: 3.2,
};

export type MallSpot = LifeSpot & {
  blurb: string;
  offers?: ShopOffer[];
  /** 0 = RDC, 1 = étage. */
  floor?: 0 | 1;
};

const CX = MFOUNDI_MALL.cx;
const CZ = MFOUNDI_MALL.cz;

const APPLE_OFFERS: ShopOffer[] = [
  { id: 'iphone-13', label: 'iPhone 13', price: 280000, boost: { fun: 18, social: 10 } },
  { id: 'iphone-15', label: 'iPhone 15', price: 620000, boost: { fun: 22, social: 14 } },
  { id: 'mac-air', label: 'MacBook Air', price: 750000, boost: { fun: 20, social: 8 } },
  { id: 'mac-pro', label: 'MacBook Pro', price: 980000, boost: { fun: 24, social: 10 } },
];

function taggedApple(prefix: string): ShopOffer[] {
  return APPLE_OFFERS.map((o) => ({ ...o, id: `${prefix}-${o.id}` }));
}

/** Comptoirs — RDC + étage. Pas de kiosque dehors. */
export const MALL_SPOTS: MallSpot[] = [
  {
    id: 'mall-free-deal',
    kind: 'shop',
    name: 'FREE DEAL',
    x: CX - 14.5,
    z: CZ - 8,
    radius: 3.2,
    floor: 0,
    blurb: 'Destockage · iPhone & MacBook au comptoir',
    offers: [
      { id: 'fd-tee', label: 'T-shirt promo', price: 3500, boost: { fun: 8, social: 4 } },
      { id: 'fd-jean', label: 'Jean destock', price: 8000, boost: { fun: 10, social: 6 } },
      { id: 'fd-basket', label: 'Baskets', price: 12000, boost: { fun: 12, social: 8 } },
      { id: 'fd-sac', label: 'Sac cabas', price: 2500, boost: { fun: 6 } },
      ...taggedApple('fd'),
    ],
  },
  {
    id: 'mall-pirate',
    kind: 'shop',
    name: 'Pirate Soldeur',
    x: CX - 14.5,
    z: CZ + 2,
    radius: 3.2,
    floor: 0,
    blurb: 'High-tech · iPhone & MacBook destock',
    offers: [
      { id: 'ps-buds', label: 'Écouteurs', price: 4500, boost: { fun: 14 } },
      { id: 'ps-power', label: 'Power bank', price: 7000, boost: { fun: 10 } },
      { id: 'ps-phone', label: 'Smartphone destock', price: 55000, boost: { fun: 22, social: 10 } },
      { id: 'ps-sd', label: 'Carte mémoire', price: 3000, boost: { fun: 6 } },
      ...taggedApple('ps'),
    ],
  },
  {
    id: 'mall-amani',
    kind: 'shop',
    name: 'Amani',
    x: CX - 14.5,
    z: CZ + 12,
    radius: 3.2,
    floor: 0,
    blurb: 'Mode, beauté · iPhone & MacBook',
    offers: [
      { id: 'am-parfum', label: 'Parfum', price: 15000, boost: { fun: 12, hygiene: 10, social: 8 } },
      { id: 'am-lips', label: 'Rouge à lèvres', price: 4500, boost: { fun: 8, hygiene: 6 } },
      { id: 'am-wax', label: 'Pagne wax', price: 18000, boost: { fun: 14, social: 10 } },
      { id: 'am-creme', label: 'Crème visage', price: 6000, boost: { hygiene: 16, fun: 6 } },
      ...taggedApple('am'),
    ],
  },
  {
    id: 'mall-smile',
    kind: 'shop',
    name: 'Smile Market',
    x: CX + 14.5,
    z: CZ - 8,
    radius: 3.2,
    floor: 0,
    blurb: 'Courses · iPhone & MacBook au rayon',
    offers: [
      ...FOOD_OFFERS,
      { id: 'sm-eau', label: 'Pack d’eau', price: 1500, item: 'drink' },
      { id: 'sm-riz', label: 'Riz 5 kg', price: 4500, item: 'meal' },
      { id: 'sm-lait', label: 'Lait + pain', price: 1800, item: 'snack' },
      ...taggedApple('sm'),
    ],
  },
  {
    id: 'mall-jm',
    kind: 'shop',
    name: 'JM Store',
    x: CX + 14.5,
    z: CZ + 2,
    radius: 3.2,
    floor: 0,
    blurb: 'Maison & kids · iPhone & MacBook',
    offers: [
      { id: 'jm-drap', label: 'Drap + oreiller', price: 8000, boost: { fun: 8 } },
      { id: 'jm-casserole', label: 'Casserole', price: 4500, boost: { fun: 6 } },
      { id: 'jm-jouet', label: 'Jouet', price: 3500, boost: { fun: 12, social: 6 } },
      { id: 'jm-lampe', label: 'Lampe de chevet', price: 5000, boost: { fun: 8 } },
      ...taggedApple('jm'),
    ],
  },
  {
    id: 'mall-food',
    kind: 'food',
    name: 'Food Court',
    x: CX + 14.5,
    z: CZ + 12,
    radius: 3.4,
    floor: 0,
    blurb: 'Ndolé, brochettes, jus',
    offers: [...FOOD_OFFERS, ...DRINK_OFFERS],
  },
  {
    id: 'job-mfoundi-staff',
    kind: 'job',
    name: 'Job · Magasinier Mfoundi',
    x: CX,
    z: CZ + 13.5,
    radius: 3.4,
    floor: 0,
    blurb: 'Accueil, rayons, caisse',
  },
  {
    id: 'mall-pharma',
    kind: 'shop',
    name: 'Pharmacie Bénédicte',
    x: CX - 14.5,
    z: CZ - 8,
    radius: 3.2,
    floor: 1,
    blurb: 'Médicaments, savon, vitamine',
    offers: [
      { id: 'ph-para', label: 'Paracétamol', price: 1500, boost: { hygiene: 8 } },
      { id: 'ph-savon', label: 'Savon + gel', price: 2500, boost: { hygiene: 18 } },
      { id: 'ph-vit', label: 'Vitamine C', price: 3500, boost: { hygiene: 10, fun: 4 } },
      { id: 'ph-kit', label: 'Kit premiers soins', price: 8000, boost: { hygiene: 14 } },
    ],
  },
  {
    id: 'mall-librairie',
    kind: 'shop',
    name: 'Librairie Papeterie',
    x: CX - 14.5,
    z: CZ + 2,
    radius: 3.2,
    floor: 1,
    blurb: 'Cahiers, stylos, romans',
    offers: [
      { id: 'lb-cahier', label: 'Cahiers + stylos', price: 2500, boost: { fun: 8 } },
      { id: 'lb-roman', label: 'Roman', price: 6000, boost: { fun: 14 } },
      { id: 'lb-dico', label: 'Dictionnaire', price: 4500, boost: { fun: 8 } },
      { id: 'lb-cartable', label: 'Cartable', price: 12000, boost: { fun: 10, social: 4 } },
    ],
  },
  {
    id: 'mall-bijoux',
    kind: 'shop',
    name: 'Or & Bijoux',
    x: CX - 14.5,
    z: CZ + 12,
    radius: 3.2,
    floor: 1,
    blurb: 'Or, montres, alliances',
    offers: [
      { id: 'bj-chaine', label: 'Chaîne', price: 25000, boost: { fun: 12, social: 10 } },
      { id: 'bj-montre', label: 'Montre', price: 45000, boost: { fun: 16, social: 12 } },
      { id: 'bj-bague', label: 'Bague', price: 18000, boost: { fun: 10, social: 8 } },
      { id: 'bj-boucles', label: 'Boucles d’oreilles', price: 8000, boost: { fun: 10, social: 6 } },
    ],
  },
  {
    id: 'mall-shoes',
    kind: 'shop',
    name: 'Chaussures Elite',
    x: CX + 14.5,
    z: CZ - 8,
    radius: 3.2,
    floor: 1,
    blurb: 'Cuir, sandales, baskets',
    offers: [
      { id: 'ch-cuir', label: 'Chaussures cuir', price: 28000, boost: { fun: 12, social: 8 } },
      { id: 'ch-sandale', label: 'Sandales', price: 8000, boost: { fun: 8 } },
      { id: 'ch-basket', label: 'Baskets', price: 22000, boost: { fun: 14, social: 6 } },
      { id: 'ch-cirage', label: 'Cirage', price: 1500, boost: { hygiene: 6 } },
    ],
  },
  {
    id: 'mall-sport',
    kind: 'shop',
    name: 'Sport 237',
    x: CX + 14.5,
    z: CZ + 2,
    radius: 3.2,
    floor: 1,
    blurb: 'Maillots Lions, ballons',
    offers: [
      { id: 'sp-maillot', label: 'Maillot Lions', price: 18000, boost: { fun: 16, social: 10 } },
      { id: 'sp-ballon', label: 'Ballon', price: 7000, boost: { fun: 14 } },
      { id: 'sp-casquette', label: 'Casquette', price: 4500, boost: { fun: 8, social: 4 } },
      { id: 'sp-chaussure', label: 'Crampons', price: 25000, boost: { fun: 14, social: 6 } },
    ],
  },
  {
    id: 'mall-opticien',
    kind: 'shop',
    name: 'Opticien Crystal',
    x: CX + 14.5,
    z: CZ + 12,
    radius: 3.2,
    floor: 1,
    blurb: 'Lunettes, verres, étuis',
    offers: [
      { id: 'op-vue', label: 'Lunettes de vue', price: 35000, boost: { fun: 10, social: 6 } },
      { id: 'op-soleil', label: 'Lunettes soleil', price: 12000, boost: { fun: 12, social: 8 } },
      { id: 'op-etui', label: 'Étui + chiffon', price: 3000, boost: { fun: 4 } },
      { id: 'op-lentilles', label: 'Lentilles', price: 18000, boost: { hygiene: 8, fun: 6 } },
    ],
  },
];

export function mallFloorAt(y: number): 0 | 1 {
  return y >= MFOUNDI_MALL.floor2Y - 0.65 ? 1 : 0;
}

export function isInsideMfoundiMall(x: number, z: number): boolean {
  return (
    Math.abs(x - MFOUNDI_MALL.cx) < MFOUNDI_MALL.halfW - 0.35 &&
    Math.abs(z - MFOUNDI_MALL.cz) < MFOUNDI_MALL.halfD - 0.35
  );
}

export function nearestMallSpot(x: number, z: number, y = 0, maxExtra = 0): MallSpot | null {
  if (!isInsideMfoundiMall(x, z) && Math.hypot(x - MFOUNDI_MALL.cx, z - MFOUNDI_MALL.cz) > 40) {
    return null;
  }
  const floor = mallFloorAt(y);
  let best: MallSpot | null = null;
  let bestD = Infinity;
  for (const s of MALL_SPOTS) {
    if ((s.floor ?? 0) !== floor) continue;
    const d = Math.hypot(s.x - x, s.z - z);
    if (d <= s.radius + maxExtra && d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}
