/**
 * City life-sim spots: street food, shops, and job sites (Sims loop outside home).
 */

export type LifeSpotKind = 'food' | 'drink' | 'shop' | 'job' | 'phone';

export type LifeSpot = {
  id: string;
  kind: LifeSpotKind;
  name: string;
  x: number;
  z: number;
  radius: number;
};

export type ShopOffer = {
  id: string;
  label: string;
  price: number;
  /** Food/drink restore; omit for phone/accessory purchases. */
  item?: 'meal' | 'snack' | 'drink' | 'coffee';
};

export const FOOD_OFFERS: ShopOffer[] = [
  { id: 'ndole', label: 'Ndolé + plantain', price: 2500, item: 'meal' },
  { id: 'brochettes', label: 'Brochettes', price: 1500, item: 'snack' },
  { id: 'riz', label: 'Riz sauce', price: 1800, item: 'meal' },
];

export const DRINK_OFFERS: ShopOffer[] = [
  { id: 'eau', label: 'Eau fraîche', price: 300, item: 'drink' },
  { id: 'jus', label: 'Jus de fruit', price: 800, item: 'drink' },
  { id: 'cafe', label: 'Café', price: 600, item: 'coffee' },
];

export const SHOP_OFFERS: ShopOffer[] = [
  ...FOOD_OFFERS,
  ...DRINK_OFFERS,
  { id: 'snack-pack', label: 'Snack pack', price: 1200, item: 'snack' },
];

/** Avenue Kennedy — phone retail. */
export const PHONE_OFFERS: ShopOffer[] = [
  { id: 'tecno-spark', label: 'Tecno Spark', price: 85000 },
  { id: 'infinix-hot', label: 'Infinix Hot', price: 95000 },
  { id: 'samsung-a', label: 'Samsung Galaxy A', price: 145000 },
  { id: 'iphone-rc', label: 'iPhone recond.', price: 220000 },
  { id: 'coque', label: 'Coque + verre', price: 3500 },
  { id: 'chargeur', label: 'Chargeur rapide', price: 4500 },
  { id: 'écouteurs', label: 'Écouteurs Bluetooth', price: 12000 },
  { id: 'carte-sim', label: 'Carte SIM + crédit', price: 2000 },
];

/** Job sites near major landmarks — timed work for FCFA. */
export const LIFE_SPOTS: LifeSpot[] = [
  // Near player house / Nlongkak
  { id: 'kiosk-home', kind: 'food', name: 'Kiosque Nlongkak', x: 24, z: 131, radius: 4.5 },
  { id: 'drink-home', kind: 'drink', name: 'Boissons du coin', x: 60, z: 116, radius: 4.5 },
  // Santa Lucia
  { id: 'shop-santa', kind: 'shop', name: 'Santa Lucia · Courses', x: 108, z: 120, radius: 8 },
  // Mokolo market vibe
  { id: 'food-mokolo', kind: 'food', name: 'Street food Mokolo', x: -420, z: -130, radius: 8 },
  // Centre
  { id: 'cafe-centre', kind: 'drink', name: 'Café Centre', x: 28, z: -20, radius: 6 },
  { id: 'shop-centre', kind: 'shop', name: 'Épicerie Centre', x: -40, z: 40, radius: 7 },
  // Avenue Kennedy — phone shops (both sidewalks)
  { id: 'phone-mtn', kind: 'phone', name: 'MTN Mobile Shop', x: 30, z: 204, radius: 5.5 },
  { id: 'phone-orange', kind: 'phone', name: 'Orange Boutique', x: 48, z: 204, radius: 5.5 },
  { id: 'phone-tecno', kind: 'phone', name: 'Tecno Store', x: 96, z: 204, radius: 5.5 },
  { id: 'phone-infinix', kind: 'phone', name: 'Infinix Corner', x: 112, z: 204, radius: 5.5 },
  { id: 'phone-samsung', kind: 'phone', name: 'Samsung Partner', x: 128, z: 204, radius: 5.5 },
  { id: 'phone-ibox', kind: 'phone', name: 'iBox Kennedy', x: 160, z: 204, radius: 5.5 },
  { id: 'phone-access', kind: 'phone', name: 'Accessoires 237', x: 176, z: 204, radius: 5.5 },
  { id: 'phone-camtel', kind: 'phone', name: 'Camtel Point', x: 36, z: 228, radius: 5.5 },
  { id: 'phone-city', kind: 'phone', name: 'Phone City', x: 100, z: 228, radius: 5.5 },
  { id: 'phone-gsm', kind: 'phone', name: 'GSM Express', x: 118, z: 228, radius: 5.5 },
  { id: 'phone-plus', kind: 'phone', name: 'Mobile Plus', x: 168, z: 228, radius: 5.5 },
  // Jobs
  { id: 'job-mall', kind: 'job', name: 'Job · Mfoundi Mall', x: -108, z: 200, radius: 10 },
  { id: 'job-airport', kind: 'job', name: 'Job · Aéroport', x: 216, z: 1040, radius: 12 },
  { id: 'job-mvan', kind: 'job', name: 'Job · Gare Mvan', x: 400, z: -380, radius: 10 },
  { id: 'job-hospital', kind: 'job', name: 'Job · Hôpital (accueil)', x: -252, z: -160, radius: 9 },
  { id: 'job-travel', kind: 'job', name: 'Job · TravelPoint', x: -36, z: -50, radius: 7 },
];

export function nearestLifeSpot(x: number, z: number, maxExtra = 0): LifeSpot | null {
  let best: LifeSpot | null = null;
  let bestD = Infinity;
  for (const s of LIFE_SPOTS) {
    const d = Math.hypot(s.x - x, s.z - z);
    if (d <= s.radius + maxExtra && d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

export function offersFor(spot: LifeSpot): ShopOffer[] {
  if (spot.kind === 'food') return FOOD_OFFERS;
  if (spot.kind === 'drink') return DRINK_OFFERS;
  if (spot.kind === 'shop') return SHOP_OFFERS;
  if (spot.kind === 'phone') return PHONE_OFFERS;
  return [];
}

export function jobPay(spot: LifeSpot): number {
  if (spot.id.includes('airport')) return 18000;
  if (spot.id.includes('mall')) return 12000;
  if (spot.id.includes('mvan')) return 10000;
  if (spot.id.includes('hospital')) return 9000;
  return 7500;
}
