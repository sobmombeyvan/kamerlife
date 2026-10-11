import * as THREE from 'three';
import { homeMat, homeWallMat, makeTiledFloorMaterial, HOME_WALL_YELLOW, HOME_FLOOR_BROWN } from './homeMaterials';
import { buildDefaultDecorFurniture } from './buildHomeInterior';
import {
  createBed,
  createCoffeeTable,
  createPlant,
  createRug,
  createSofa,
  createTv,
  place,
} from './LowPolyFurniture';

export type DecorSlot = 'sofa' | 'tv' | 'table' | 'rug' | 'plant' | 'lamp' | 'art' | 'bed';

export type DecorItem = {
  id: string;
  name: string;
  price: number;
  slot: DecorSlot;
  color: number;
  accent?: number;
};

export const DECOR_CATALOG: DecorItem[] = [
  { id: 'sofa-blue', name: 'Canapé bleu', price: 45000, slot: 'sofa', color: 0x1565c0, accent: 0x0d47a1 },
  { id: 'sofa-green', name: 'Canapé vert', price: 52000, slot: 'sofa', color: 0x2e7d32, accent: 0x1b5e20 },
  { id: 'sofa-cream', name: 'Canapé crème', price: 68000, slot: 'sofa', color: 0xfff3e0, accent: 0xd7ccc8 },
  { id: 'tv-basic', name: 'TV 40"', price: 35000, slot: 'tv', color: 0x111111, accent: 0x1565c0 },
  { id: 'tv-oled', name: 'TV OLED', price: 120000, slot: 'tv', color: 0x0a0a0a, accent: 0x00bcd4 },
  { id: 'table-wood', name: 'Table basse bois', price: 18000, slot: 'table', color: 0x6d4c41 },
  { id: 'table-glass', name: 'Table verre', price: 32000, slot: 'table', color: 0x90caf9, accent: 0x37474f },
  { id: 'rug-red', name: 'Tapis rouge', price: 12000, slot: 'rug', color: 0xc62828 },
  { id: 'rug-geo', name: 'Tapis géométrique', price: 22000, slot: 'rug', color: 0xffc857 },
  { id: 'plant-palm', name: 'Palmier intérieur', price: 8000, slot: 'plant', color: 0x2e7d32 },
  { id: 'plant-big', name: 'Grande plante', price: 15000, slot: 'plant', color: 0x1b5e20 },
  { id: 'lamp-warm', name: 'Lampe salon', price: 10000, slot: 'lamp', color: 0xfff8e1 },
  { id: 'lamp-design', name: 'Lampe design', price: 28000, slot: 'lamp', color: 0xffecb3 },
  { id: 'art-abstract', name: 'Tableau abstrait', price: 25000, slot: 'art', color: 0xe91e63 },
  { id: 'art-yaounde', name: 'Toile Yaoundé', price: 40000, slot: 'art', color: 0xff9800 },
  { id: 'bed-blue', name: 'Lit bleu', price: 55000, slot: 'bed', color: 0x5c6bc0 },
  { id: 'bed-king', name: 'Lit king', price: 95000, slot: 'bed', color: 0x4a148c },
];

const STORAGE_KEY = 'lifecity-home-decor-v2';

export type HomeDecorState = {
  owned: string[];
  equipped: Partial<Record<DecorSlot, string>>;
  wallColor: number;
  floorColor: number;
};

const DEFAULT_STATE: HomeDecorState = {
  owned: ['sofa-blue', 'tv-basic', 'table-wood', 'rug-red', 'bed-blue', 'lamp-warm', 'plant-palm'],
  equipped: {
    sofa: 'sofa-blue',
    tv: 'tv-basic',
    table: 'table-wood',
    rug: 'rug-red',
    bed: 'bed-blue',
    lamp: 'lamp-warm',
    plant: 'plant-palm',
  },
  wallColor: HOME_WALL_YELLOW,
  floorColor: HOME_FLOOR_BROWN,
};

export const WALL_PAINTS: Array<{ id: string; name: string; price: number; color: number }> = [
  { id: 'wall-yellow', name: 'Mur jaune chaud', price: 5000, color: HOME_WALL_YELLOW },
  { id: 'wall-cream', name: 'Mur crème', price: 8000, color: 0xf5f0e6 },
  { id: 'wall-mint', name: 'Mur menthe', price: 12000, color: 0xe0f2f1 },
  { id: 'wall-sand', name: 'Mur sable', price: 12000, color: 0xffecb3 },
  { id: 'wall-blush', name: 'Mur rose', price: 18000, color: 0xfce4ec },
];

export const FLOOR_PAINTS: Array<{ id: string; name: string; price: number; color: number }> = [
  { id: 'floor-brown', name: 'Carrelage brun', price: 8000, color: HOME_FLOOR_BROWN },
  { id: 'floor-tile', name: 'Carrelage clair', price: 12000, color: 0xd7ccc8 },
  { id: 'floor-wood', name: 'Parquet', price: 25000, color: 0xa1887f },
  { id: 'floor-dark', name: 'Parquet foncé', price: 35000, color: 0x5d4037 },
  { id: 'floor-marble', name: 'Marbre', price: 45000, color: 0xfafafa },
];

export function loadHomeDecor(): HomeDecorState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw) as HomeDecorState;
    return {
      owned: parsed.owned?.length ? parsed.owned : [...DEFAULT_STATE.owned],
      equipped: { ...DEFAULT_STATE.equipped, ...parsed.equipped },
      wallColor: parsed.wallColor ?? DEFAULT_STATE.wallColor,
      floorColor: parsed.floorColor ?? DEFAULT_STATE.floorColor,
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

export function saveHomeDecor(state: HomeDecorState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export type BuyResult = { ok: true; state: HomeDecorState; spent: number } | { ok: false; reason: string };

export function purchaseDecorItem(state: HomeDecorState, itemId: string, money: number): BuyResult {
  const item = DECOR_CATALOG.find((d) => d.id === itemId);
  if (!item) return { ok: false, reason: 'Article inconnu' };
  const owned = state.owned.includes(itemId);
  if (!owned && money < item.price) {
    return { ok: false, reason: `Pas assez (${item.price.toLocaleString('fr-FR')} FCFA)` };
  }
  const next: HomeDecorState = {
    ...state,
    owned: owned ? state.owned : [...state.owned, itemId],
    equipped: { ...state.equipped, [item.slot]: itemId },
  };
  saveHomeDecor(next);
  return { ok: true, state: next, spent: owned ? 0 : item.price };
}

export function purchaseWallPaint(state: HomeDecorState, paintId: string, money: number): BuyResult {
  const paint = WALL_PAINTS.find((p) => p.id === paintId);
  if (!paint) return { ok: false, reason: 'Teinte inconnue' };
  if (state.wallColor === paint.color) return { ok: true, state, spent: 0 };
  if (money < paint.price) {
    return { ok: false, reason: `Pas assez (${paint.price.toLocaleString('fr-FR')} FCFA)` };
  }
  const next = { ...state, wallColor: paint.color };
  saveHomeDecor(next);
  return { ok: true, state: next, spent: paint.price };
}

export function purchaseFloorPaint(state: HomeDecorState, paintId: string, money: number): BuyResult {
  const paint = FLOOR_PAINTS.find((p) => p.id === paintId);
  if (!paint) return { ok: false, reason: 'Sol inconnu' };
  if (state.floorColor === paint.color) return { ok: true, state, spent: 0 };
  if (money < paint.price) {
    return { ok: false, reason: `Pas assez (${paint.price.toLocaleString('fr-FR')} FCFA)` };
  }
  const next = { ...state, floorColor: paint.color };
  saveHomeDecor(next);
  return { ok: true, state: next, spent: paint.price };
}

/**
 * Rebuilds shop-slot furniture with low-poly meshes; applies wall/floor tints.
 */
export function applyHomeDecor(houseRoot: THREE.Group, state: HomeDecorState): void {
  let layer = houseRoot.getObjectByName('home-decor-layer') as THREE.Group | undefined;
  if (layer) {
    houseRoot.remove(layer);
    layer.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry?.dispose?.();
    });
  }
  layer = new THREE.Group();
  layer.name = 'home-decor-layer';
  houseRoot.add(layer);

  const floor = houseRoot.getObjectByName('home-floor') as THREE.Mesh | undefined;
  const cx = floor?.position.x ?? 64;
  const cz = floor?.position.z ?? 108;
  const floorY = 0.12;

  if (floor) {
    if (state.floorColor === HOME_FLOOR_BROWN) {
      floor.material = makeTiledFloorMaterial(5, 4.5);
    } else {
      floor.material = homeMat(state.floorColor, { flat: false, roughness: 0.88 });
    }
  }

  houseRoot.traverse((o) => {
    if (o.name === 'homeWall' && o instanceof THREE.Mesh) {
      o.material = homeWallMat(state.wallColor);
    }
  });

  const eq = state.equipped;
  const item = (slot: DecorSlot) => DECOR_CATALOG.find((d) => d.id === eq[slot]);

  const sofa = item('sofa');
  const table = item('table');
  const rug = item('rug');
  const tv = item('tv');
  const plant = item('plant');
  const bed = item('bed');
  const lamp = item('lamp');
  const art = item('art');

  // First paint uses full kit; collisions already registered for default footprints at build
  if (sofa && table && rug && tv && bed) {
    buildDefaultDecorFurniture(layer, undefined, cx, cz, floorY, {
      bed: bed.color,
      sofa: sofa.color,
      sofaAccent: sofa.accent ?? sofa.color,
      table: table.color,
      rug: rug.color,
      tv: tv.color,
      tvGlow: tv.accent ?? 0x1565c0,
      plant: plant?.color ?? 0x2e7d32,
    });
  } else {
    if (bed) place(layer, createBed(bed.color), cx - 5.2, floorY, cz - 0.8, 0);
    if (sofa) place(layer, createSofa(sofa.color, sofa.accent ?? sofa.color), cx + 4.0, floorY, cz + 4.2, Math.PI);
    if (table) place(layer, createCoffeeTable(table.color), cx + 4.0, floorY, cz + 2.2, 0);
    if (rug) place(layer, createRug(rug.color), cx + 4.0, floorY, cz + 2.8, 0);
    if (tv) place(layer, createTv(tv.color, tv.accent ?? 0x1565c0), cx + 4.0, floorY, cz - 1.4, 0);
    if (plant) place(layer, createPlant(plant.color), cx + 0.5, floorY, cz + 5.5, 0);
  }

  if (lamp) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.08, 1.35, 6),
      homeMat(0x424242),
    );
    pole.position.set(cx + 6.2, floorY + 0.75, cz + 4.0);
    pole.castShadow = true;
    layer.add(pole);
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 0.38, 8),
      homeMat(lamp.color, { roughness: 0.55 }),
    );
    shade.position.set(cx + 6.2, floorY + 1.55, cz + 4.0);
    layer.add(shade);
  }

  if (art) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.05, 0.06), homeMat(0x3e2723));
    frame.position.set(cx + 4.0, floorY + 2.15, cz - 6.7);
    layer.add(frame);
    const canvas = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.85, 0.04), homeMat(art.color));
    canvas.position.set(cx + 4.0, floorY + 2.15, cz - 6.65);
    layer.add(canvas);
  }
}
