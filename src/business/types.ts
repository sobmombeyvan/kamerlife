/**
 * Business system schema (Phase 1 = data + map placement).
 * Interiors, payments, NPCs = later phases — not claimed as working yet.
 */

export type BusinessCategory =
  | 'supermarket'
  | 'grocery'
  | 'restaurant'
  | 'fastfood'
  | 'cafe'
  | 'bakery'
  | 'electronics'
  | 'fashion'
  | 'bank'
  | 'pharmacy'
  | 'clinic'
  | 'hospital'
  | 'emergency'
  | 'education'
  | 'fuel'
  | 'garage'
  | 'hotel'
  | 'nightlife'
  | 'market'
  | 'furniture'
  | 'logistics'
  | 'admin'
  | 'other';

export type ProductDef = {
  id: string;
  name: string;
  priceFcfa: number;
  category: string;
};

export type BusinessHours = {
  open: string;
  close: string;
  /** 0=Sun … 6=Sat */
  days: number[];
};

export type Business = {
  id: string;
  name: string;
  category: BusinessCategory;
  districtId: string;
  x: number;
  z: number;
  /** Fictional brand unless landmarkReal is true. */
  fictional: boolean;
  landmarkReal?: boolean;
  signColor: string;
  hours: BusinessHours;
  products: ProductDef[];
  /** Phase 1: interaction is data-only; 3D menus come later. */
  interaction: 'menu' | 'interior' | 'counter' | 'atm' | 'stall';
  notes?: string;
};

export type BusinessDatabase = {
  version: 1;
  currency: 'FCFA';
  note: string;
  businesses: Business[];
};

export const BUSINESS_CATEGORY_LABELS: Record<BusinessCategory, string> = {
  supermarket: 'Supermarché',
  grocery: 'Épicerie',
  restaurant: 'Restaurant',
  fastfood: 'Fast-food',
  cafe: 'Café',
  bakery: 'Boulangerie',
  electronics: 'Électronique',
  fashion: 'Mode',
  bank: 'Banque',
  pharmacy: 'Pharmacie',
  clinic: 'Clinique',
  hospital: 'Hôpital',
  emergency: 'Urgences',
  education: 'Éducation',
  fuel: 'Station-service',
  garage: 'Garage',
  hotel: 'Hôtel',
  nightlife: 'Loisirs',
  market: 'Marché',
  furniture: 'Meubles',
  logistics: 'Livraison',
  admin: 'Administration',
  other: 'Autre',
};
