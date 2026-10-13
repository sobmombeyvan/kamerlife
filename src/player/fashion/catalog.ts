import type { ClothId, Sex } from '../PlayerLook';

export type AccessorySlot = 'hat' | 'glasses' | 'bag' | 'watch' | 'neck' | 'ears';

export type AttachBone = 'head' | 'spine_03' | 'spine_02' | 'hand_r' | 'lowerarm_l';

export type AccessoryDef = {
  id: string;
  name: string;
  detail: string;
  slot: AccessorySlot;
  bone: AttachBone;
  /** FCFA. Starter items cost nothing and are always owned. */
  price: number;
  starter: boolean;
  /** Color applied when the look keeps "origine". */
  baseColor: ClothId;
  recolor: boolean;
  /** Headwear that covers the hair hides the hair meshes under it. */
  coversHair?: boolean;
  sexes: Sex[];
};

const BOTH: Sex[] = ['femme', 'homme'];

/** Every entry here has procedural 3D geometry in accessories.ts, attached to a rig bone. */
export const ACCESSORIES: AccessoryDef[] = [
  { id: 'casquette', name: 'Casquette', detail: 'Visière courbée', slot: 'hat', bone: 'head', price: 0, starter: true, baseColor: 'noir', recolor: true, sexes: BOTH },
  { id: 'bonnet', name: 'Bonnet', detail: 'Maille côtelée', slot: 'hat', bone: 'head', price: 0, starter: true, baseColor: 'bordeaux', recolor: true, sexes: BOTH },
  { id: 'bob', name: 'Bob', detail: 'Bord tombant', slot: 'hat', bone: 'head', price: 3500, starter: false, baseColor: 'kaki', recolor: true, sexes: BOTH },
  { id: 'beret', name: 'Béret', detail: 'Feutre incliné', slot: 'hat', bone: 'head', price: 4000, starter: false, baseColor: 'rouge', recolor: true, sexes: BOTH },
  { id: 'paille', name: 'Chapeau de paille', detail: 'Large bord', slot: 'hat', bone: 'head', price: 6500, starter: false, baseColor: 'sable', recolor: true, sexes: BOTH },
  { id: 'foulard', name: 'Foulard wax', detail: 'Attaché devant', slot: 'hat', bone: 'head', price: 5000, starter: false, baseColor: 'terre', recolor: true, coversHair: true, sexes: BOTH },
  { id: 'soleil', name: 'Lunettes de soleil', detail: 'Verres fumés', slot: 'glasses', bone: 'head', price: 4500, starter: false, baseColor: 'noir', recolor: true, sexes: BOTH },
  { id: 'rondes', name: 'Lunettes rondes', detail: 'Monture dorée', slot: 'glasses', bone: 'head', price: 6000, starter: false, baseColor: 'dore', recolor: false, sexes: BOTH },
  { id: 'sac-dos', name: 'Sac à dos', detail: 'Bretelles réglables', slot: 'bag', bone: 'spine_03', price: 0, starter: true, baseColor: 'marine', recolor: true, sexes: BOTH },
  { id: 'bandouliere', name: 'Sacoche', detail: 'Bandoulière', slot: 'bag', bone: 'spine_02', price: 8000, starter: false, baseColor: 'noir', recolor: true, sexes: BOTH },
  { id: 'sac-main', name: 'Sac à main', detail: 'Porté à la main', slot: 'bag', bone: 'hand_r', price: 15000, starter: false, baseColor: 'bordeaux', recolor: true, sexes: BOTH },
  { id: 'montre', name: 'Montre', detail: 'Bracelet cuir', slot: 'watch', bone: 'lowerarm_l', price: 12000, starter: false, baseColor: 'noir', recolor: true, sexes: BOTH },
  { id: 'chaine-or', name: 'Chaîne dorée', detail: 'Pendentif rond', slot: 'neck', bone: 'spine_03', price: 25000, starter: false, baseColor: 'dore', recolor: false, sexes: BOTH },
  { id: 'chaine-argent', name: 'Chaîne argent', detail: 'Maille fine', slot: 'neck', bone: 'spine_03', price: 18000, starter: false, baseColor: 'blanc', recolor: false, sexes: BOTH },
  { id: 'creoles', name: 'Créoles', detail: 'Anneaux dorés', slot: 'ears', bone: 'head', price: 7500, starter: false, baseColor: 'dore', recolor: false, sexes: BOTH },
];

export const SLOT_LABEL: Record<AccessorySlot, string> = {
  hat: 'Chapeaux',
  glasses: 'Lunettes',
  bag: 'Sacs',
  watch: 'Montres',
  neck: 'Colliers',
  ears: 'Boucles',
};

export type BuiltHairId =
  | 'afro-court'
  | 'afro'
  | 'twists'
  | 'locs'
  | 'locs-longues'
  | 'locs-attachees'
  | 'box-braids'
  | 'cornrows'
  | 'puff'
  | 'chignon';

/** Hair generated around the measured skull and attached to the head bone. */
export const BUILT_HAIR: { id: BuiltHairId; name: string; detail: string; group: string }[] = [
  { id: 'afro-court', name: 'Afro court', detail: 'Texture naturelle', group: 'Afro et naturels' },
  { id: 'afro', name: 'Afro', detail: 'Volume rond', group: 'Afro et naturels' },
  { id: 'twists', name: 'Twists', detail: 'Vanilles courtes', group: 'Afro et naturels' },
  { id: 'puff', name: 'Puff', detail: 'Chignon naturel haut', group: 'Afro et naturels' },
  { id: 'locs', name: 'Locs', detail: 'Mi-longues', group: 'Locs' },
  { id: 'locs-longues', name: 'Locs longues', detail: 'Dans le dos', group: 'Locs' },
  { id: 'locs-attachees', name: 'Locs attachées', detail: 'Queue basse', group: 'Locs' },
  { id: 'box-braids', name: 'Box braids', detail: 'Tresses longues', group: 'Tresses' },
  { id: 'cornrows', name: 'Nattes collées', detail: 'Cornrows droites', group: 'Tresses' },
  { id: 'chignon', name: 'Chignon', detail: 'Tresses relevées', group: 'Tresses' },
];

export type BeardId = 'aucune' | 'trois-jours' | 'courte' | 'pleine' | 'bouc' | 'moustache';

export const BEARDS: { id: BeardId; name: string; detail: string }[] = [
  { id: 'aucune', name: 'Rasé', detail: 'Peau nette' },
  { id: 'trois-jours', name: 'Trois jours', detail: 'Barbe naissante' },
  { id: 'courte', name: 'Barbe courte', detail: 'Taillée' },
  { id: 'pleine', name: 'Barbe pleine', detail: 'Volume au menton' },
  { id: 'bouc', name: 'Bouc', detail: 'Menton et moustache' },
  { id: 'moustache', name: 'Moustache', detail: 'Lèvre supérieure' },
];

export type LipId = 'aucun' | 'nude' | 'rose' | 'rouge' | 'bordeaux' | 'prune' | 'gloss';
export type BlushId = 'aucun' | 'peche' | 'rose' | 'bronze';
export type ShadowId = 'aucun' | 'brun' | 'or' | 'prune' | 'bleu';

export const LIPS: { id: LipId; name: string; color: number }[] = [
  { id: 'aucun', name: 'Aucun', color: 0x000000 },
  { id: 'nude', name: 'Nude', color: 0xa86a52 },
  { id: 'rose', name: 'Rose', color: 0xc45b7a },
  { id: 'rouge', name: 'Rouge', color: 0xb3172b },
  { id: 'bordeaux', name: 'Bordeaux', color: 0x5e1023 },
  { id: 'prune', name: 'Prune', color: 0x4b1f3a },
  { id: 'gloss', name: 'Gloss', color: 0xd99a8c },
];

export const BLUSHES: { id: BlushId; name: string; color: number }[] = [
  { id: 'aucun', name: 'Aucun', color: 0x000000 },
  { id: 'peche', name: 'Pêche', color: 0xe08a62 },
  { id: 'rose', name: 'Rose', color: 0xd0607e },
  { id: 'bronze', name: 'Bronze', color: 0x9a5530 },
];

export const SHADOWS: { id: ShadowId; name: string; color: number }[] = [
  { id: 'aucun', name: 'Aucun', color: 0x000000 },
  { id: 'brun', name: 'Brun', color: 0x4a2a18 },
  { id: 'or', name: 'Or', color: 0xc99a3a },
  { id: 'prune', name: 'Prune', color: 0x5a2a5a },
  { id: 'bleu', name: 'Bleu nuit', color: 0x1f3566 },
];

export function accessoryById(id: string | null | undefined): AccessoryDef | undefined {
  return ACCESSORIES.find((item) => item.id === id);
}

export function accessoriesFor(slot: AccessorySlot): AccessoryDef[] {
  return ACCESSORIES.filter((item) => item.slot === slot);
}

/**
 * Requested looks with no mesh in the project yet. Listed so the gap is explicit;
 * none of these appear as equipable cards.
 */
export const MISSING_ASSETS: string[] = [
  'Hauts séparés (t-shirts, chemises, hoodies, vestes, blazers)',
  'Bas séparés (jeans, cargos, jupes, shorts)',
  'Robes, boubous, combinaisons et tenues de cérémonie',
  'Chaussures de formes différentes (talons, bottes, sandales)',
  'Coupes dégradées (fades) et coupes lisses longues',
];
