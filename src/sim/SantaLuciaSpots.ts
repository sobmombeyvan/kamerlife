import type { ShopOffer } from './LifeSpots';

export const SANTA_LUCIA = {
  id: 'santa-lucia',
  name: 'Santa Lucia',
  cx: 108,
  cz: 108,
  halfW: 17.5,
  halfD: 11,
  wallH: 4.7,
  floor2Y: 4.7,
  roofY: 8.8,
  doorHalfW: 3.4,
} as const;

export type SantaSpot = {
  id: string;
  kind: 'shop' | 'food';
  name: string;
  x: number;
  z: number;
  radius: number;
  blurb: string;
  offers: ShopOffer[];
  floor?: 0 | 1;
};

const { cx, cz } = SANTA_LUCIA;

export const BAKERY_OFFERS: ShopOffer[] = [
  { id: 'sl-baguette', label: 'Baguette', price: 250, item: 'snack' },
  { id: 'sl-pain', label: 'Pain de mie', price: 450, item: 'snack' },
  { id: 'sl-beignet', label: 'Beignets (6)', price: 500, item: 'snack' },
  { id: 'sl-croissant', label: 'Croissant', price: 400, item: 'snack' },
  { id: 'sl-gateau', label: 'Part de gâteau', price: 800, item: 'snack' },
  { id: 'sl-pain-choc', label: 'Pain au chocolat', price: 450, item: 'snack' },
  { id: 'sl-cafe-pain', label: 'Café + pain', price: 700, item: 'coffee' },
];

export const GROCERY_OFFERS: ShopOffer[] = [
  { id: 'sl-riz', label: 'Riz 5 kg', price: 3600, item: 'meal' },
  { id: 'sl-huile', label: 'Huile 1 L', price: 1300, item: 'meal' },
  { id: 'sl-tomate', label: 'Tomates + oignons', price: 900, item: 'snack' },
  { id: 'sl-lait', label: 'Lait + céréales', price: 1800, item: 'snack' },
  { id: 'sl-poulet', label: 'Poulet congelé', price: 4500, item: 'meal' },
  { id: 'sl-savon', label: 'Savon + lessive', price: 2200, boost: { hygiene: 16 } },
  { id: 'sl-pack', label: 'Courses du jour', price: 5500, item: 'meal' },
];

export const HOME_OFFERS: ShopOffer[] = [
  { id: 'sl-lessive', label: 'Lessive', price: 2800, boost: { hygiene: 14 } },
  { id: 'sl-savon2', label: 'Savon + éponge', price: 1500, boost: { hygiene: 12 } },
  { id: 'sl-balai', label: 'Balai + seau', price: 3500, boost: { hygiene: 8 } },
  { id: 'sl-drap', label: 'Drap', price: 6000, boost: { fun: 6 } },
  { id: 'sl-ampoule', label: 'Ampoules (4)', price: 2200, boost: { fun: 4 } },
];

export const TEXTILE_OFFERS: ShopOffer[] = [
  { id: 'sl-tee', label: 'T-shirt', price: 3500, boost: { fun: 8, social: 4 } },
  { id: 'sl-pagne', label: 'Pagne', price: 8000, boost: { fun: 12, social: 8 } },
  { id: 'sl-serviette', label: 'Serviettes', price: 2500, boost: { hygiene: 8 } },
  { id: 'sl-chaussures', label: 'Sandales', price: 4500, boost: { fun: 8 } },
];

export const FRIDGE_OFFERS: ShopOffer[] = [
  { id: 'sl-eau', label: 'Pack d’eau', price: 1500, item: 'drink' },
  { id: 'sl-jus', label: 'Jus de fruit', price: 800, item: 'drink' },
  { id: 'sl-yaourt', label: 'Yaourt', price: 600, item: 'snack' },
  { id: 'sl-soda', label: 'Soda froid', price: 500, item: 'drink' },
  { id: 'sl-glace', label: 'Glace', price: 700, item: 'snack' },
];

export const SANTA_SPOTS: SantaSpot[] = [
  {
    id: 'sl-bakery',
    kind: 'food',
    name: 'Boulangerie Santa Lucia',
    x: cx + 11.2,
    z: cz + 0.4,
    radius: 3.6,
    blurb: 'Pain chaud, beignets, gâteaux',
    offers: BAKERY_OFFERS,
    floor: 0,
  },
  {
    id: 'sl-grocery',
    kind: 'shop',
    name: 'Rayons supermarché',
    x: cx - 5.2,
    z: cz + 1.5,
    radius: 4.4,
    blurb: 'Riz, huile, légumes sur les rayons',
    offers: GROCERY_OFFERS,
    floor: 0,
  },
  {
    id: 'sl-fridge',
    kind: 'shop',
    name: 'Frais & boissons',
    x: cx - 6.5,
    z: cz - 5.2,
    radius: 3.2,
    blurb: 'Eau, jus, yaourt, glaces',
    offers: FRIDGE_OFFERS,
    floor: 0,
  },
  {
    id: 'sl-home',
    kind: 'shop',
    name: 'Maison & ménage',
    x: cx - 6,
    z: cz + 1,
    radius: 4.2,
    blurb: 'Lessive, savon, draps — étage',
    offers: HOME_OFFERS,
    floor: 1,
  },
  {
    id: 'sl-textile',
    kind: 'shop',
    name: 'Textile',
    x: cx + 8,
    z: cz + 1,
    radius: 4.0,
    blurb: 'T-shirts, pagnes, serviettes — étage',
    offers: TEXTILE_OFFERS,
    floor: 1,
  },
];

export function santaFloorAt(y: number): 0 | 1 {
  return y >= SANTA_LUCIA.floor2Y - 0.65 ? 1 : 0;
}

export function isInsideSantaLucia(x: number, z: number): boolean {
  return Math.abs(x - SANTA_LUCIA.cx) < SANTA_LUCIA.halfW - 0.4 && Math.abs(z - SANTA_LUCIA.cz) < SANTA_LUCIA.halfD - 0.4;
}

export function nearestSantaSpot(x: number, z: number, y = 0, maxExtra = 0): SantaSpot | null {
  if (!isInsideSantaLucia(x, z) && Math.hypot(x - SANTA_LUCIA.cx, z - SANTA_LUCIA.cz) > 28) return null;
  const floor = santaFloorAt(y);
  let best: SantaSpot | null = null;
  let bestD = Infinity;
  for (const s of SANTA_SPOTS) {
    if ((s.floor ?? 0) !== floor) continue;
    const d = Math.hypot(s.x - x, s.z - z);
    if (d <= s.radius + maxExtra && d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}
