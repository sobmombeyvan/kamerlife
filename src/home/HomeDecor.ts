import * as THREE from 'three';
import type { CollisionSystem } from '../world/CollisionSystem';
import {
  HOME_FLOOR_BEIGE,
  HOME_FLOOR_BROWN,
  HOME_WALL_WARM_WHITE,
  HOME_WALL_YELLOW,
  homeWallMat,
  makeFloorMaterial,
  makeWallpaperMaterial,
  type FloorKind,
  type WallPattern,
} from './homeMaterials';
import { syncFurnitureCollisions, tagMovable } from './furnitureLayout';
import { HOME_FLOOR_TOP, HOME_SHELL } from './homeLayout';
import {
  createStarterArt,
  createStarterBed,
  createStarterCoffeeTable,
  createStarterDining,
  createStarterFloorLamp,
  createStarterPlant,
  createStarterRug,
  createStarterSofa,
  createStarterTv,
} from './StarterFurniture';
import { buildBathroom, buildCurtains, buildKitchen } from './HomeFixtures';

export type DecorSlot =
  | 'sofa'
  | 'tv'
  | 'table'
  | 'rug'
  | 'plant'
  | 'lamp'
  | 'art'
  | 'bed'
  | 'dining'
  | 'curtain'
  | 'light'
  | 'kitchen'
  | 'bath'
  | 'facade'
  | 'gate'
  | 'garden';

export type DecorGroup = 'furniture' | 'finish' | 'exterior';

export type DecorItem = {
  id: string;
  name: string;
  price: number;
  slot: DecorSlot;
  color: number;
  accent?: number;
  /** Variant flag (big TV, glass table, design lamp, tall plant, Yaoundé canvas…). */
  variant?: string;
};

const SLOT_GROUP: Record<DecorSlot, DecorGroup> = {
  sofa: 'furniture',
  tv: 'furniture',
  table: 'furniture',
  rug: 'furniture',
  plant: 'furniture',
  lamp: 'furniture',
  art: 'furniture',
  bed: 'furniture',
  dining: 'furniture',
  curtain: 'finish',
  light: 'finish',
  kitchen: 'finish',
  bath: 'finish',
  facade: 'exterior',
  gate: 'exterior',
  garden: 'exterior',
};

export function decorGroup(item: DecorItem): DecorGroup {
  return SLOT_GROUP[item.slot];
}

export const DECOR_CATALOG: DecorItem[] = [
  { id: 'sofa-sand', name: 'Canapé lin sable', price: 48000, slot: 'sofa', color: 0xcdbfa8, accent: 0xb8643c },
  { id: 'sofa-blue', name: 'Canapé bleu nuit', price: 45000, slot: 'sofa', color: 0x34506e, accent: 0xd9a441 },
  { id: 'sofa-green', name: 'Canapé vert forêt', price: 52000, slot: 'sofa', color: 0x5f7356, accent: 0xe0c9a6 },
  { id: 'sofa-cream', name: 'Canapé crème', price: 68000, slot: 'sofa', color: 0xece4d6, accent: 0x7a5a3a },
  { id: 'tv-basic', name: 'TV 50"', price: 35000, slot: 'tv', color: 0x111111, accent: 0x3a6ea5 },
  { id: 'tv-oled', name: 'TV OLED 65"', price: 120000, slot: 'tv', color: 0x0a0a0a, accent: 0x00bcd4, variant: 'big' },
  { id: 'table-wood', name: 'Table basse bois', price: 18000, slot: 'table', color: 0x9a6b44 },
  { id: 'table-glass', name: 'Table basse verre', price: 32000, slot: 'table', color: 0xb08458, variant: 'glass' },
  { id: 'rug-berber', name: 'Tapis berbère', price: 15000, slot: 'rug', color: 0xe9e1d0, accent: 0x5b4632 },
  { id: 'rug-red', name: 'Tapis terre rouge', price: 12000, slot: 'rug', color: 0xa8442e, accent: 0xe0b070 },
  { id: 'rug-geo', name: 'Tapis géométrique', price: 22000, slot: 'rug', color: 0xe0b070, accent: 0x2f4858 },
  { id: 'plant-palm', name: 'Monstera', price: 8000, slot: 'plant', color: 0x3f7a3a },
  { id: 'plant-big', name: 'Grand ficus lyre', price: 15000, slot: 'plant', color: 0x2f6a2f, variant: 'tall' },
  { id: 'lamp-warm', name: 'Lampadaire lin', price: 10000, slot: 'lamp', color: 0xf3e6cf },
  { id: 'lamp-design', name: 'Lampadaire trépied', price: 28000, slot: 'lamp', color: 0xe8d7b8, variant: 'design' },
  { id: 'art-abstract', name: 'Tableau abstrait', price: 25000, slot: 'art', color: 0xc77d4a },
  { id: 'art-yaounde', name: 'Toile « 7 collines »', price: 40000, slot: 'art', color: 0x3f6b8a, variant: 'yaounde' },
  { id: 'bed-linen', name: 'Lit double lin', price: 50000, slot: 'bed', color: 0xe9e3d8, accent: 0x6f8a7a },
  { id: 'bed-blue', name: 'Lit double bleu', price: 55000, slot: 'bed', color: 0x3f5873, accent: 0xd9c7a6 },
  { id: 'bed-king', name: 'Lit king bordeaux', price: 95000, slot: 'bed', color: 0x6b2f3a, accent: 0xe0b070 },
  { id: 'dining-oak', name: 'Table à manger chêne', price: 30000, slot: 'dining', color: 0xb08458, accent: 0x8a9a7b },
  { id: 'dining-dark', name: 'Table à manger noyer', price: 46000, slot: 'dining', color: 0x5b3a29, accent: 0xd9c7a6 },
  { id: 'curtain-linen', name: 'Rideaux lin', price: 9000, slot: 'curtain', color: 0xe7dccb },
  { id: 'curtain-terracotta', name: 'Rideaux terracotta', price: 14000, slot: 'curtain', color: 0xb8643c },
  { id: 'curtain-navy', name: 'Rideaux bleu nuit', price: 14000, slot: 'curtain', color: 0x2f3f5a },
  { id: 'curtain-wax', name: 'Rideaux pagne wax', price: 22000, slot: 'curtain', color: 0xd9822b },
  { id: 'light-warm', name: 'Éclairage chaud', price: 6000, slot: 'light', color: 0xffd8ae, accent: 100 },
  { id: 'light-neutral', name: 'Éclairage neutre', price: 12000, slot: 'light', color: 0xfff1e2, accent: 115 },
  { id: 'light-cozy', name: 'Ambiance tamisée', price: 12000, slot: 'light', color: 0xffb877, accent: 70 },
  { id: 'kitchen-white', name: 'Cuisine blanche', price: 60000, slot: 'kitchen', color: 0xf2efe9 },
  { id: 'kitchen-wood', name: 'Cuisine bois', price: 85000, slot: 'kitchen', color: 0xa5794f },
  { id: 'kitchen-sage', name: 'Cuisine vert sauge', price: 85000, slot: 'kitchen', color: 0x8fa58c },
  { id: 'bath-white', name: 'Faïence blanche', price: 25000, slot: 'bath', color: 0xeef0ee },
  { id: 'bath-sand', name: 'Faïence sable', price: 38000, slot: 'bath', color: 0xd8c7a8 },
  { id: 'bath-blue', name: 'Faïence bleu lagon', price: 38000, slot: 'bath', color: 0x8fb3c4 },
  { id: 'facade-white', name: 'Façade blanc cassé', price: 40000, slot: 'facade', color: 0xf1ece2, accent: 0xb9b3a8 },
  { id: 'facade-beige', name: 'Façade beige', price: 55000, slot: 'facade', color: 0xe2cfae, accent: 0x9c8466 },
  { id: 'facade-gray', name: 'Façade gris clair', price: 55000, slot: 'facade', color: 0xd3d2cc, accent: 0x6e7276 },
  { id: 'gate-black', name: 'Portail acier noir', price: 45000, slot: 'gate', color: 0x2b2d30 },
  { id: 'gate-green', name: 'Portail vert bouteille', price: 60000, slot: 'gate', color: 0x2f5d46 },
  { id: 'gate-wood', name: 'Portail lames bois', price: 90000, slot: 'gate', color: 0x7a5232, variant: 'wood' },
  { id: 'garden-basic', name: 'Jardin simple', price: 20000, slot: 'garden', color: 0x6f8a4f },
  { id: 'garden-flowers', name: 'Jardin fleuri', price: 35000, slot: 'garden', color: 0x6f8a4f, variant: 'flowers' },
  { id: 'garden-terrace', name: 'Jardin + terrasse', price: 90000, slot: 'garden', color: 0x6f8a4f, variant: 'terrace' },
];

const STORAGE_KEY = 'lifecity-home-decor-v2';
const STATE_VERSION = 3;

export type FurnPose = { x: number; z: number; yaw: number };

export type HomeDecorState = {
  owned: string[];
  equipped: Partial<Record<DecorSlot, string>>;
  wallColor: number;
  wallPattern?: WallPattern;
  floorColor: number;
  /** World position of movable pieces. Missing ids keep the default spot. */
  layout: Record<string, FurnPose>;
  /** Pieces put away in build mode. */
  stored: string[];
  version?: number;
};

const DEFAULT_EQUIPPED: Record<DecorSlot, string> = {
  sofa: 'sofa-sand',
  tv: 'tv-basic',
  table: 'table-wood',
  rug: 'rug-berber',
  bed: 'bed-linen',
  lamp: 'lamp-warm',
  plant: 'plant-palm',
  art: 'art-abstract',
  dining: 'dining-oak',
  curtain: 'curtain-linen',
  light: 'light-warm',
  kitchen: 'kitchen-white',
  bath: 'bath-white',
  facade: 'facade-white',
  gate: 'gate-black',
  garden: 'garden-basic',
};

const DEFAULT_STATE: HomeDecorState = {
  owned: Object.values(DEFAULT_EQUIPPED),
  equipped: { ...DEFAULT_EQUIPPED },
  wallColor: HOME_WALL_WARM_WHITE,
  floorColor: HOME_FLOOR_BEIGE,
  layout: {},
  stored: [],
  version: STATE_VERSION,
};

type WallFinish = { id: string; name: string; price: number; color: number; pattern?: WallPattern };
type FloorFinish = { id: string; name: string; price: number; color: number; kind: FloorKind };

export const WALL_PAINTS: WallFinish[] = [
  { id: 'wall-warmwhite', name: 'Blanc chaud', price: 5000, color: HOME_WALL_WARM_WHITE },
  { id: 'wall-yellow', name: 'Mur jaune chaud', price: 5000, color: HOME_WALL_YELLOW },
  { id: 'wall-cream', name: 'Mur crème', price: 8000, color: 0xf5f0e6 },
  { id: 'wall-greige', name: 'Mur grège', price: 10000, color: 0xd8cfc2 },
  { id: 'wall-mint', name: 'Mur menthe', price: 12000, color: 0xe0f2f1 },
  { id: 'wall-sand', name: 'Mur sable', price: 12000, color: 0xffecb3 },
  { id: 'wall-blush', name: 'Mur rose', price: 18000, color: 0xfce4ec },
  { id: 'paper-stripes', name: 'Papier peint rayé', price: 24000, color: 0xe9e0d0, pattern: 'stripes' },
  { id: 'paper-wax', name: 'Papier peint motif wax', price: 32000, color: 0xf3ead9, pattern: 'wax' },
];

export const FLOOR_PAINTS: FloorFinish[] = [
  { id: 'floor-beige', name: 'Carrelage beige 60×60', price: 10000, color: HOME_FLOOR_BEIGE, kind: 'tile60' },
  { id: 'floor-brown', name: 'Carrelage brun', price: 8000, color: HOME_FLOOR_BROWN, kind: 'tile30' },
  { id: 'floor-tile', name: 'Carrelage gris clair', price: 12000, color: 0xd7ccc8, kind: 'tile60' },
  { id: 'floor-wood', name: 'Parquet chêne', price: 25000, color: 0xb88e62, kind: 'wood' },
  { id: 'floor-dark', name: 'Parquet foncé', price: 35000, color: 0x6d4c3a, kind: 'wood' },
  { id: 'floor-marble', name: 'Marbre', price: 45000, color: 0xf3f1ec, kind: 'marble' },
];

/** Old saves stored the parquet colours from the first release. */
const LEGACY_FLOOR_KIND: Record<number, FloorKind> = { 0xa1887f: 'wood', 0x5d4037: 'wood', 0xfafafa: 'marble' };

export function loadHomeDecor(): HomeDecorState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw) as Partial<HomeDecorState>;
    const legacy = (parsed.version ?? 0) < STATE_VERSION;
    // Before the remodel the yellow walls / brown tiles were simply the free defaults.
    let wallColor = parsed.wallColor ?? DEFAULT_STATE.wallColor;
    let floorColor = parsed.floorColor ?? DEFAULT_STATE.floorColor;
    if (legacy && wallColor === HOME_WALL_YELLOW) wallColor = HOME_WALL_WARM_WHITE;
    if (legacy && floorColor === HOME_FLOOR_BROWN) floorColor = HOME_FLOOR_BEIGE;
    const owned = new Set(parsed.owned?.length ? parsed.owned : DEFAULT_STATE.owned);
    for (const id of Object.values(DEFAULT_EQUIPPED)) owned.add(id);
    return {
      owned: [...owned],
      equipped: { ...DEFAULT_EQUIPPED, ...parsed.equipped },
      wallColor,
      wallPattern: parsed.wallPattern,
      floorColor,
      layout: parsed.layout ?? {},
      stored: Array.isArray(parsed.stored) ? parsed.stored : [],
      version: STATE_VERSION,
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

export function saveHomeDecor(state: HomeDecorState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: STATE_VERSION }));
}

export type BuyResult = { ok: true; state: HomeDecorState; spent: number } | { ok: false; reason: string };

export function purchaseDecorItem(state: HomeDecorState, itemId: string, money: number): BuyResult {
  const item = DECOR_CATALOG.find((d) => d.id === itemId);
  if (!item) return { ok: false, reason: 'Article inconnu' };
  const owned = state.owned.includes(itemId);
  if (!owned && money < item.price) {
    return { ok: false, reason: `Pas assez (${item.price.toLocaleString('fr-FR')} FCFA)` };
  }
  const furnId = SLOT_FURN[item.slot];
  const next: HomeDecorState = {
    ...state,
    owned: owned ? state.owned : [...state.owned, itemId],
    equipped: { ...state.equipped, [item.slot]: itemId },
    stored: furnId ? state.stored.filter((s) => s !== furnId) : state.stored,
  };
  saveHomeDecor(next);
  return { ok: true, state: next, spent: owned ? 0 : item.price };
}

function paintKey(color: number, pattern?: WallPattern): string {
  return `${color}:${pattern ?? ''}`;
}

export function activeWallFinish(state: HomeDecorState): string | null {
  const key = paintKey(state.wallColor, state.wallPattern);
  return WALL_PAINTS.find((p) => paintKey(p.color, p.pattern) === key)?.id ?? null;
}

export function purchaseWallPaint(state: HomeDecorState, paintId: string, money: number): BuyResult {
  const paint = WALL_PAINTS.find((p) => p.id === paintId);
  if (!paint) return { ok: false, reason: 'Teinte inconnue' };
  if (activeWallFinish(state) === paint.id) return { ok: true, state, spent: 0 };
  if (money < paint.price) {
    return { ok: false, reason: `Pas assez (${paint.price.toLocaleString('fr-FR')} FCFA)` };
  }
  const next = { ...state, wallColor: paint.color, wallPattern: paint.pattern };
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

/** Movable piece id for each furniture slot (the second plant has no slot of its own). */
const SLOT_FURN: Partial<Record<DecorSlot, string>> = {
  sofa: 'sofa',
  tv: 'tv',
  table: 'table',
  rug: 'rug',
  plant: 'plant',
  lamp: 'lamp',
  art: 'art',
  bed: 'bed',
  dining: 'dining',
};

export const FURN_LABELS: Record<string, string> = {
  sofa: 'Canapé',
  tv: 'Meuble TV',
  table: 'Table basse',
  rug: 'Tapis',
  plant: 'Plante',
  plant2: 'Plante (fenêtre)',
  lamp: 'Lampadaire',
  art: 'Tableau',
  bed: 'Lit',
  dining: 'Table à manger',
};

export function storeFurniture(state: HomeDecorState, id: string): HomeDecorState {
  if (state.stored.includes(id)) return state;
  const next = { ...state, stored: [...state.stored, id] };
  saveHomeDecor(next);
  return next;
}

/** Brings a stored piece back to its default spot (always clear of walls and doors). */
export function restoreFurniture(state: HomeDecorState, id: string): HomeDecorState {
  const layout = { ...state.layout };
  delete layout[id];
  const next = { ...state, stored: state.stored.filter((s) => s !== id), layout };
  saveHomeDecor(next);
  return next;
}

/** Every piece back to its default spot; purchases and finishes are kept. */
export function resetFurnitureLayout(state: HomeDecorState): HomeDecorState {
  const next = { ...state, layout: {}, stored: [] };
  saveHomeDecor(next);
  return next;
}

/** Default spots in house-local metres. */
const DEFAULT_POSES: Record<string, [number, number, number]> = {
  bed: [-6.73, -3.4, Math.PI / 2],
  sofa: [4.2, 3.9, Math.PI / 2],
  table: [5.7, 3.9, Math.PI / 2],
  rug: [5.45, 3.9, Math.PI / 2],
  tv: [7.6, 3.9, -Math.PI / 2],
  plant: [7.35, 6.35, 0],
  plant2: [7.35, 1.85, 0.6],
  lamp: [4.15, 5.65, 0],
  art: [-2.13, 2.9, Math.PI / 2],
  dining: [-0.7, -4.3, 0],
};

function lightingOf(state: HomeDecorState): DecorItem {
  return DECOR_CATALOG.find((d) => d.id === state.equipped.light) ?? DECOR_CATALOG.find((d) => d.id === 'light-warm')!;
}

function applyLighting(houseRoot: THREE.Object3D, state: HomeDecorState): void {
  const mood = lightingOf(state);
  const k = (mood.accent ?? 100) / 100;
  const lights = houseRoot.getObjectByName('home-lights');
  lights?.traverse((o) => {
    if (o instanceof THREE.PointLight) {
      o.color.setHex(mood.color);
      o.intensity = ((o.userData.base as number | undefined) ?? o.intensity) * k;
    }
  });
}

function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry?.dispose?.();
    if (o.name === 'tv-screen') (o.material as THREE.Material).dispose();
  });
}

/**
 * Rebuilds the decor layer (movable furniture + finish-dependent fixtures),
 * applies wall / floor / lighting finishes and refreshes the façade, gate and garden.
 */
export function applyHomeDecor(houseRoot: THREE.Group, state: HomeDecorState, collisions?: CollisionSystem): void {
  let layer = houseRoot.getObjectByName('home-decor-layer') as THREE.Group | undefined;
  if (layer) {
    houseRoot.remove(layer);
    disposeTree(layer);
  }
  layer = new THREE.Group();
  layer.name = 'home-decor-layer';
  houseRoot.add(layer);

  const floor = houseRoot.getObjectByName('home-floor') as THREE.Mesh | undefined;
  const cx = floor?.position.x ?? 36;
  const cz = floor?.position.z ?? 108;

  if (floor) {
    const finish = FLOOR_PAINTS.find((p) => p.color === state.floorColor);
    const kind = finish?.kind ?? LEGACY_FLOOR_KIND[state.floorColor] ?? 'tile60';
    floor.material = makeFloorMaterial(kind, state.floorColor);
  }
  const wallMat = state.wallPattern ? makeWallpaperMaterial(state.wallPattern, state.wallColor) : homeWallMat(state.wallColor);
  houseRoot.traverse((o) => {
    if (o.name === 'homeWall' && o instanceof THREE.Mesh) o.material = wallMat;
  });

  const item = (slot: DecorSlot): DecorItem | undefined => {
    const id = state.equipped[slot] ?? DEFAULT_EQUIPPED[slot];
    return DECOR_CATALOG.find((d) => d.id === id) ?? DECOR_CATALOG.find((d) => d.id === DEFAULT_EQUIPPED[slot]);
  };
  const stored = new Set(state.stored);
  const put = (id: string, piece: THREE.Group) => {
    if (stored.has(id)) return;
    const [x, z, yaw] = DEFAULT_POSES[id]!;
    piece.position.set(cx + x, HOME_FLOOR_TOP, cz + z);
    piece.rotation.y = yaw;
    tagMovable(piece, id, state, cx, cz);
    layer!.add(piece);
  };

  const bed = item('bed')!;
  put('bed', createStarterBed(bed.color, bed.accent ?? bed.color));
  const sofa = item('sofa')!;
  put('sofa', createStarterSofa(sofa.color, sofa.accent ?? sofa.color));
  const table = item('table')!;
  put('table', createStarterCoffeeTable(table.color, table.variant === 'glass'));
  const rug = item('rug')!;
  put('rug', createStarterRug(rug.color, rug.accent ?? 0xe0b070));
  const tv = item('tv')!;
  put('tv', createStarterTv(tv.color, tv.accent ?? 0x3a6ea5, tv.variant === 'big'));
  const plant = item('plant')!;
  put('plant', createStarterPlant(plant.color, plant.variant === 'tall'));
  put('plant2', createStarterPlant(0x47803c, true));
  const lamp = item('lamp')!;
  put('lamp', createStarterFloorLamp(lamp.color, lamp.variant === 'design'));
  const art = item('art')!;
  put('art', createStarterArt(art.color, art.variant === 'yaounde'));
  const dining = item('dining')!;
  put('dining', createStarterDining(dining.color, dining.accent ?? 0x8a9a7b));

  layer.add(buildKitchen(item('kitchen')!.color, cx, cz));
  layer.add(buildBathroom(item('bath')!.color, cx, cz));
  layer.add(buildCurtains(item('curtain')!.color, cx, cz));

  applyLighting(houseRoot, state);

  const rebuildExterior = houseRoot.userData.rebuildExterior as ((s: HomeDecorState) => void) | undefined;
  rebuildExterior?.(state);

  if (collisions) syncFurnitureCollisions(houseRoot, collisions, HOME_SHELL.floorY);
}

export function equippedItem(state: HomeDecorState, slot: DecorSlot): DecorItem {
  const id = state.equipped[slot] ?? DEFAULT_EQUIPPED[slot];
  return DECOR_CATALOG.find((d) => d.id === id) ?? DECOR_CATALOG.find((d) => d.id === DEFAULT_EQUIPPED[slot])!;
}
