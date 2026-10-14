import * as THREE from 'three';
import {
  ACCESSORIES,
  BEARDS,
  BLUSHES,
  BUILT_HAIR,
  LIPS,
  SHADOWS,
  accessoryById,
  type AccessorySlot,
  type BeardId,
  type BlushId,
  type BuiltHairId,
  type LipId,
  type ShadowId,
} from './fashion/catalog';
import { isOwned, ownedItems } from './fashion/inventory';
import { DRESSES, dressById } from './fashion/dresses';

export type Sex = 'femme' | 'homme';
export type CharacterId = 'harper' | 'maya' | 'sam';
export type SkinId =
  | 'claire'
  | 'porcelaine'
  | 'doree'
  | 'miel'
  | 'ambree'
  | 'cuivre'
  | 'brune'
  | 'cacao'
  | 'ebene'
  | 'nuit';
export type EyeId = 'brun' | 'noisette' | 'miel' | 'vert' | 'bleu' | 'gris' | 'ambre';
export type HairId = 'noir' | 'brun' | 'chatain' | 'blond' | 'roux' | 'gris' | 'cuivre' | 'platine' | 'acajou';
export type HairStyle = 'courte' | 'queue' | 'chauve' | BuiltHairId;
export type ClothId =
  | 'origine'
  | 'blanc'
  | 'noir'
  | 'rouge'
  | 'bleu'
  | 'vert'
  | 'creme'
  | 'bordeaux'
  | 'dore'
  | 'rose'
  | 'kaki'
  | 'marine'
  | 'indigo'
  | 'terre'
  | 'olive'
  | 'ciel'
  | 'prune'
  | 'sable';

export type PlayerLook = {
  sex: Sex;
  characterId: CharacterId;
  skinId: SkinId;
  /** 1 keeps the authored nose. Lower flattens it, higher pushes it forward. */
  nose: number;
  /** 1 keeps the authored width. */
  noseWidth: number;
  /** 1 keeps the authored jaw. Higher widens it. */
  jaw: number;
  /** 1 keeps the authored chin. Higher lengthens it. */
  chin: number;
  eyeId: EyeId;
  hairId: HairId;
  /** Painted on the eyebrow mesh, separate from the hair color. */
  browId: HairId;
  hairStyle: HairStyle;
  /** Uniform height. 1 is the authored size. */
  height: number;
  shoulders: number;
  torso: number;
  hips: number;
  arms: number;
  legs: number;
  topId: ClothId;
  bottomId: ClothId;
  shoeId: ClothId;
  /** Dress id from fashion/dresses, or 'aucune'. Female characters only. */
  dressId: string;
  dressColor: ClothId;
  /** Accessory ids from fashion/catalog, or 'aucun'. */
  hatId: string;
  hatColor: ClothId;
  glassesId: string;
  glassesColor: ClothId;
  bagId: string;
  bagColor: ClothId;
  watchId: string;
  watchColor: ClothId;
  neckId: string;
  earId: string;
  beardId: BeardId;
  lipId: LipId;
  blushId: BlushId;
  shadowId: ShadowId;
  freckles: boolean;
};

export const SLOT_FIELDS: Record<AccessorySlot, { id: keyof PlayerLook; color?: keyof PlayerLook }> = {
  hat: { id: 'hatId', color: 'hatColor' },
  glasses: { id: 'glassesId', color: 'glassesColor' },
  bag: { id: 'bagId', color: 'bagColor' },
  watch: { id: 'watchId', color: 'watchColor' },
  neck: { id: 'neckId' },
  ears: { id: 'earId' },
};

export function equippedAccessories(look: PlayerLook): { slot: AccessorySlot; id: string; color: ClothId }[] {
  const out: { slot: AccessorySlot; id: string; color: ClothId }[] = [];
  for (const slot of Object.keys(SLOT_FIELDS) as AccessorySlot[]) {
    const field = SLOT_FIELDS[slot];
    const id = String(look[field.id]);
    if (!accessoryById(id)) continue;
    out.push({ slot, id, color: field.color ? (look[field.color] as ClothId) : 'origine' });
  }
  return out;
}

/** Items on the look the player has not bought. */
export function unownedAccessories(look: PlayerLook): string[] {
  const ids = equippedAccessories(look).map((item) => item.id);
  if (dressById(look.dressId)) ids.push(look.dressId);
  return ids.filter((id) => !isOwned(id));
}

export function withoutUnowned(look: PlayerLook): PlayerLook {
  const next = { ...look };
  for (const slot of Object.keys(SLOT_FIELDS) as AccessorySlot[]) {
    const key = SLOT_FIELDS[slot].id;
    const id = String(next[key]);
    if (accessoryById(id) && !isOwned(id)) (next as Record<string, unknown>)[key] = 'aucun';
  }
  if (dressById(next.dressId) && !isOwned(next.dressId)) next.dressId = 'aucune';
  return next;
}

export function isBuiltHair(style: HairStyle): style is BuiltHairId {
  return BUILT_HAIR.some((item) => item.id === style);
}

export type CharacterDef = {
  id: CharacterId;
  sex: Sex;
  name: string;
  clothes: string;
  /** False when the jacket and trousers are a single mesh, as on Harper. */
  separateClothes: boolean;
  url: string;
};

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'harper',
    sex: 'femme',
    name: 'Harper',
    clothes: 'Tailleur',
    separateClothes: false,
    url: '/assets/characters/harper-locomotion.glb',
  },
  {
    id: 'maya',
    sex: 'femme',
    name: 'Maya',
    clothes: 'Satin',
    separateClothes: true,
    url: '/assets/characters/maya-locomotion.glb',
  },
  {
    id: 'sam',
    sex: 'homme',
    name: 'Sam',
    clothes: 'Casual',
    separateClothes: true,
    url: '/assets/characters/sam-locomotion.glb',
  },
];

export const SKINS: { id: SkinId; name: string; color: number }[] = [
  { id: 'porcelaine', name: 'Porcelaine', color: 0xfff6f2 },
  { id: 'claire', name: 'Claire', color: 0xffe4d6 },
  { id: 'doree', name: 'Dorée', color: 0xe8b48a },
  { id: 'miel', name: 'Miel', color: 0xd39a62 },
  { id: 'ambree', name: 'Ambrée', color: 0xc68642 },
  { id: 'cuivre', name: 'Cuivre', color: 0xa86b3c },
  { id: 'brune', name: 'Brune', color: 0x8d5524 },
  { id: 'cacao', name: 'Cacao', color: 0x6b3a1f },
  { id: 'ebene', name: 'Ébène', color: 0x4a2912 },
  { id: 'nuit', name: 'Nuit', color: 0x2c160c },
];

export const EYES: { id: EyeId; name: string; color: number }[] = [
  { id: 'brun', name: 'Brun', color: 0x4a2c17 },
  { id: 'noisette', name: 'Noisette', color: 0x8d6a3b },
  { id: 'miel', name: 'Miel', color: 0xb8894a },
  { id: 'ambre', name: 'Ambre', color: 0xc47a2b },
  { id: 'vert', name: 'Vert', color: 0x3e6b45 },
  { id: 'bleu', name: 'Bleu', color: 0x3a6ea5 },
  { id: 'gris', name: 'Gris', color: 0x8d939c },
];

export const HAIR: { id: HairId; name: string; color: number }[] = [
  { id: 'noir', name: 'Noir', color: 0x1c140f },
  { id: 'brun', name: 'Brun', color: 0x3d2817 },
  { id: 'chatain', name: 'Châtain', color: 0x6b4423 },
  { id: 'acajou', name: 'Acajou', color: 0x6a2e1a },
  { id: 'roux', name: 'Roux', color: 0x8e3b1b },
  { id: 'cuivre', name: 'Cuivre', color: 0xb56a2a },
  { id: 'blond', name: 'Blond', color: 0xd4b483 },
  { id: 'platine', name: 'Platine', color: 0xefe6d6 },
  { id: 'gris', name: 'Gris', color: 0xc4beb6 },
];

export const CLOTHES: { id: ClothId; name: string; color: number }[] = [
  { id: 'origine', name: "D'origine", color: 0xffffff },
  { id: 'blanc', name: 'Blanc', color: 0xf4f4f4 },
  { id: 'noir', name: 'Noir', color: 0x2b2b2b },
  { id: 'rouge', name: 'Rouge', color: 0xc62828 },
  { id: 'bleu', name: 'Bleu', color: 0x1565c0 },
  { id: 'vert', name: 'Vert', color: 0x0f7660 },
  { id: 'creme', name: 'Crème', color: 0xfff3e0 },
  { id: 'bordeaux', name: 'Bordeaux', color: 0x6d1a36 },
  { id: 'dore', name: 'Doré', color: 0xf9a825 },
  { id: 'rose', name: 'Rose', color: 0xd48aa5 },
  { id: 'kaki', name: 'Kaki', color: 0x8a7a45 },
  { id: 'marine', name: 'Marine', color: 0x1b3a5f },
  { id: 'indigo', name: 'Indigo', color: 0x2c2a72 },
  { id: 'terre', name: 'Terre', color: 0xc45c36 },
  { id: 'olive', name: 'Olive', color: 0x5c6b3a },
  { id: 'ciel', name: 'Ciel', color: 0x7eb6d6 },
  { id: 'prune', name: 'Prune', color: 0x6b3a55 },
  { id: 'sable', name: 'Sable', color: 0xd8c3a5 },
];

export const HAIR_CUTS: { id: HairStyle; name: string; detail: string; sexes: Sex[] }[] = [
  { id: 'courte', name: 'Courte', detail: 'Coupe courte', sexes: ['femme', 'homme'] },
  { id: 'queue', name: 'Queue', detail: 'Queue de cheval', sexes: ['femme'] },
  { id: 'chauve', name: 'Chauve', detail: 'Crâne rasé', sexes: ['femme', 'homme'] },
];

const STORAGE_KEY = 'lifecity-look-v2';

const DEFAULT_LOOK: PlayerLook = {
  sex: 'femme',
  characterId: 'harper',
  skinId: 'claire',
  nose: 1,
  noseWidth: 1,
  jaw: 1,
  chin: 1,
  eyeId: 'brun',
  hairId: 'brun',
  browId: 'brun',
  hairStyle: 'courte',
  height: 1,
  shoulders: 1,
  torso: 1,
  hips: 1,
  arms: 1,
  legs: 1,
  topId: 'origine',
  bottomId: 'origine',
  shoeId: 'origine',
  dressId: 'aucune',
  dressColor: 'origine',
  hatId: 'aucun',
  hatColor: 'origine',
  glassesId: 'aucun',
  glassesColor: 'origine',
  bagId: 'aucun',
  bagColor: 'origine',
  watchId: 'aucun',
  watchColor: 'origine',
  neckId: 'aucun',
  earId: 'aucun',
  beardId: 'aucune',
  lipId: 'aucun',
  blushId: 'aucun',
  shadowId: 'aucun',
  freckles: false,
};

/** NPC clone of Harper / Maya / Sam with a clothing patch. */
export function withLookPatch(characterId: CharacterId, patch: Partial<PlayerLook> = {}): PlayerLook {
  return {
    ...DEFAULT_LOOK,
    ...patch,
    characterId,
    sex: characterId === 'sam' ? 'homme' : 'femme',
  };
}

export type LookPreset = {
  id: string;
  name: string;
  blurb: string;
  look: Partial<PlayerLook>;
};

/** Starting appearances. Every field here is applied on the real rig. */
export const LOOK_PRESETS: LookPreset[] = [
  {
    id: 'bastos',
    name: 'Bastos',
    blurb: 'Harper · tailleur clair',
    look: {
      sex: 'femme',
      characterId: 'harper',
      skinId: 'claire',
      hairStyle: 'courte',
      hairId: 'chatain',
      browId: 'brun',
      eyeId: 'noisette',
      topId: 'origine',
      bottomId: 'origine',
      shoeId: 'noir',
    },
  },
  {
    id: 'mvog-ada',
    name: 'Mvog-Ada',
    blurb: 'Maya · satin bordeaux',
    look: {
      sex: 'femme',
      characterId: 'maya',
      skinId: 'brune',
      hairStyle: 'queue',
      hairId: 'noir',
      browId: 'noir',
      eyeId: 'brun',
      topId: 'bordeaux',
      bottomId: 'noir',
      shoeId: 'dore',
      height: 1.03,
      hips: 1.06,
    },
  },
  {
    id: 'briqueterie',
    name: 'Briqueterie',
    blurb: 'Sam · casual',
    look: {
      sex: 'homme',
      characterId: 'sam',
      skinId: 'ebene',
      hairStyle: 'courte',
      hairId: 'noir',
      browId: 'noir',
      eyeId: 'brun',
      topId: 'bleu',
      bottomId: 'noir',
      shoeId: 'blanc',
      shoulders: 1.08,
      arms: 1.06,
      torso: 1.04,
    },
  },
  {
    id: 'nlongkak',
    name: 'Nlongkak',
    blurb: 'Sam · crâne rasé',
    look: {
      sex: 'homme',
      characterId: 'sam',
      skinId: 'doree',
      hairStyle: 'chauve',
      hairId: 'brun',
      browId: 'brun',
      eyeId: 'noisette',
      topId: 'creme',
      bottomId: 'vert',
      shoeId: 'rouge',
      height: 1.05,
      legs: 1.03,
    },
  },
  {
    id: 'essos',
    name: 'Essos',
    blurb: 'Maya · queue blonde',
    look: {
      sex: 'femme',
      characterId: 'maya',
      skinId: 'claire',
      hairStyle: 'queue',
      hairId: 'blond',
      browId: 'chatain',
      eyeId: 'bleu',
      topId: 'rose',
      bottomId: 'blanc',
      shoeId: 'rose',
    },
  },
  {
    id: 'mokolo',
    name: 'Mokolo',
    blurb: 'Harper · tailleur bordeaux',
    look: {
      sex: 'femme',
      characterId: 'harper',
      skinId: 'brune',
      hairStyle: 'courte',
      hairId: 'noir',
      browId: 'noir',
      eyeId: 'brun',
      topId: 'bordeaux',
      bottomId: 'bordeaux',
      shoeId: 'noir',
    },
  },
  {
    id: 'biyem-assi',
    name: 'Biyem-Assi',
    blurb: 'Sam · kaki',
    look: {
      sex: 'homme',
      characterId: 'sam',
      skinId: 'ambree',
      hairStyle: 'courte',
      hairId: 'chatain',
      browId: 'brun',
      eyeId: 'miel',
      topId: 'kaki',
      bottomId: 'olive',
      shoeId: 'noir',
      shoulders: 1.04,
    },
  },
  {
    id: 'etoa-meki',
    name: 'Etoa-Meki',
    blurb: 'Maya · satin or',
    look: {
      sex: 'femme',
      characterId: 'maya',
      skinId: 'ebene',
      hairStyle: 'queue',
      hairId: 'acajou',
      browId: 'noir',
      eyeId: 'brun',
      topId: 'dore',
      bottomId: 'noir',
      shoeId: 'dore',
      hips: 1.05,
    },
  },
  {
    id: 'mvog-mbi',
    name: 'Mvog-Mbi',
    blurb: 'Sam · locs et barbe',
    look: {
      sex: 'homme',
      characterId: 'sam',
      skinId: 'ebene',
      hairStyle: 'locs',
      hairId: 'noir',
      browId: 'noir',
      beardId: 'courte',
      topId: 'noir',
      bottomId: 'kaki',
      shoeId: 'blanc',
      hatId: 'casquette',
      hatColor: 'noir',
      shoulders: 1.06,
    },
  },
  {
    id: 'nkolbisson',
    name: 'Nkolbisson',
    blurb: 'Sam · nattes collées',
    look: {
      sex: 'homme',
      characterId: 'sam',
      skinId: 'cacao',
      hairStyle: 'cornrows',
      hairId: 'noir',
      browId: 'noir',
      beardId: 'trois-jours',
      topId: 'blanc',
      bottomId: 'marine',
      shoeId: 'noir',
      bagId: 'sac-dos',
      bagColor: 'rouge',
    },
  },
  {
    id: 'elig-essono',
    name: 'Elig-Essono',
    blurb: 'Maya · box braids',
    look: {
      sex: 'femme',
      characterId: 'maya',
      skinId: 'cacao',
      hairStyle: 'box-braids',
      hairId: 'noir',
      browId: 'noir',
      lipId: 'bordeaux',
      shadowId: 'or',
      topId: 'terre',
      bottomId: 'noir',
      shoeId: 'dore',
    },
  },
  {
    id: 'ekounou',
    name: 'Ekounou',
    blurb: 'Harper · afro',
    look: {
      sex: 'femme',
      characterId: 'harper',
      skinId: 'nuit',
      hairStyle: 'afro',
      hairId: 'noir',
      browId: 'noir',
      lipId: 'rouge',
      blushId: 'bronze',
      topId: 'creme',
      bottomId: 'creme',
      shoeId: 'noir',
    },
  },
];

/** Colorways of the garment the character is already wearing. */
export const OUTFITS: { id: string; name: string; detail: string; topId: ClothId; bottomId: ClothId; shoeId: ClothId }[] = [
  { id: 'origine', name: 'Origine', detail: 'Couleur du modèle', topId: 'origine', bottomId: 'origine', shoeId: 'origine' },
  { id: 'ville', name: 'Ville', detail: 'Blanc et bleu', topId: 'blanc', bottomId: 'bleu', shoeId: 'noir' },
  { id: 'bureau', name: 'Bureau', detail: 'Marine', topId: 'noir', bottomId: 'marine', shoeId: 'noir' },
  { id: 'wax', name: 'Wax', detail: 'Terre et or', topId: 'terre', bottomId: 'dore', shoeId: 'noir' },
  { id: 'indigo', name: 'Indigo', detail: 'Tenue unie', topId: 'indigo', bottomId: 'indigo', shoeId: 'blanc' },
  { id: 'soir', name: 'Soir', detail: 'Bordeaux', topId: 'bordeaux', bottomId: 'noir', shoeId: 'dore' },
  { id: 'gala', name: 'Gala', detail: 'Prune', topId: 'prune', bottomId: 'noir', shoeId: 'dore' },
  { id: 'kaki', name: 'Kaki', detail: 'Kaki et olive', topId: 'kaki', bottomId: 'olive', shoeId: 'noir' },
  { id: 'stade', name: 'Stade', detail: 'Vert et blanc', topId: 'vert', bottomId: 'blanc', shoeId: 'blanc' },
  { id: 'ciel', name: 'Ciel', detail: 'Bleu clair', topId: 'ciel', bottomId: 'blanc', shoeId: 'blanc' },
  { id: 'dimanche', name: 'Dimanche', detail: 'Blanc et or', topId: 'blanc', bottomId: 'sable', shoeId: 'dore' },
  { id: 'maison', name: 'Maison', detail: 'Crème', topId: 'creme', bottomId: 'sable', shoeId: 'rose' },
];

const FAV_KEY = 'lifecity-outfit-fav';

const LEGACY_CLOTH: Record<string, ClothId> = {
  original: 'origine',
  casual: 'vert',
  street: 'rouge',
  smart: 'bleu',
  home: 'creme',
  sport: 'dore',
  bordeaux: 'bordeaux',
  dore: 'dore',
};

export function characterById(id: CharacterId): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0]!;
}

export function charactersFor(sex: Sex): CharacterDef[] {
  return CHARACTERS.filter((c) => c.sex === sex);
}

export function loadLook(): PlayerLook {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return sanitize(JSON.parse(raw) as Partial<PlayerLook>);
    const v1 = localStorage.getItem('lifecity-look-v1');
    if (v1) {
      const old = JSON.parse(v1) as { sex?: Sex; characterId?: CharacterId; skinId?: SkinId; outfitId?: string };
      const cloth = LEGACY_CLOTH[old.outfitId ?? ''] ?? 'origine';
      return sanitize({ ...old, topId: cloth, bottomId: cloth, shoeId: 'origine' });
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_LOOK };
}

export function saveLook(look: Partial<PlayerLook>): PlayerLook {
  const next = sanitize(look);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function resetLook(): PlayerLook {
  return saveLook({ ...DEFAULT_LOOK });
}

export function applyPreset(id: string): PlayerLook | null {
  const preset = LOOK_PRESETS.find((item) => item.id === id);
  if (!preset) return null;
  return saveLook({ ...DEFAULT_LOOK, ...preset.look });
}

export function randomizeLook(): PlayerLook {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]!;
  const sex: Sex = Math.random() < 0.5 ? 'femme' : 'homme';
  const characterId: CharacterId = sex === 'homme' ? 'sam' : Math.random() < 0.5 ? 'harper' : 'maya';
  let hairStyle: HairStyle = 'courte';
  if (Math.random() < 0.55) hairStyle = pick(BUILT_HAIR).id;
  else if (characterId === 'maya') hairStyle = Math.random() < 0.25 ? 'chauve' : 'queue';
  else if (Math.random() < 0.25) hairStyle = 'chauve';
  const around = (min: number, max: number) => min + Math.random() * (max - min);
  const owned = ownedItems();
  const wear = (slot: AccessorySlot): string => {
    const choices = ACCESSORIES.filter((item) => item.slot === slot && owned.includes(item.id));
    return choices.length > 0 && Math.random() < 0.4 ? pick(choices).id : 'aucun';
  };
  const dressed = CLOTHES.filter((c) => c.id !== 'origine');
  return saveLook({
    hatId: wear('hat'),
    hatColor: pick(dressed).id,
    glassesId: wear('glasses'),
    bagId: wear('bag'),
    bagColor: pick(dressed).id,
    watchId: wear('watch'),
    neckId: wear('neck'),
    earId: wear('ears'),
    beardId: sex === 'homme' ? pick(BEARDS).id : 'aucune',
    lipId: sex === 'femme' && Math.random() < 0.6 ? pick(LIPS).id : 'aucun',
    blushId: sex === 'femme' && Math.random() < 0.4 ? pick(BLUSHES).id : 'aucun',
    shadowId: sex === 'femme' && Math.random() < 0.4 ? pick(SHADOWS).id : 'aucun',
    freckles: Math.random() < 0.15,
    sex,
    characterId,
    hairStyle,
    skinId: pick(SKINS).id,
    eyeId: pick(EYES).id,
    hairId: pick(HAIR).id,
    browId: pick(HAIR).id,
    topId: pick(CLOTHES).id,
    bottomId: pick(CLOTHES).id,
    shoeId: pick(CLOTHES).id,
    dressId:
      sex === 'femme' && Math.random() < 0.45
        ? pick(DRESSES.filter((d) => owned.includes(d.id))).id
        : 'aucune',
    dressColor: pick(dressed).id,
    nose: around(0.84, 1.28),
    noseWidth: around(0.84, 1.28),
    jaw: around(0.94, 1.08),
    chin: around(0.9, 1.12),
    height: around(0.94, 1.06),
    shoulders: around(0.94, 1.08),
    torso: around(0.94, 1.08),
    hips: around(0.94, 1.08),
    arms: around(0.94, 1.08),
    legs: around(0.97, 1.04),
  });
}

export function saveFavoriteOutfit(look: PlayerLook = loadLook()): void {
  localStorage.setItem(
    FAV_KEY,
    JSON.stringify({ topId: look.topId, bottomId: look.bottomId, shoeId: look.shoeId }),
  );
}

export function favoriteOutfitPatch(): Pick<PlayerLook, 'topId' | 'bottomId' | 'shoeId'> | null {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<PlayerLook>;
    if (!data.topId || !data.bottomId || !data.shoeId) return null;
    return { topId: clothOr(data.topId), bottomId: clothOr(data.bottomId), shoeId: clothOr(data.shoeId) };
  } catch {
    return null;
  }
}

export function chooseLook(patch: Partial<PlayerLook>): { prev: PlayerLook; next: PlayerLook } {
  const prev = loadLook();
  const merged: PlayerLook = { ...prev, ...patch };
  if (patch.sex === 'homme') {
    merged.characterId = 'sam';
    merged.dressId = 'aucune';
    if (merged.hairStyle === 'queue') merged.hairStyle = 'courte';
  } else if (patch.hairStyle === 'queue') {
    merged.sex = 'femme';
    merged.characterId = 'maya';
  } else if (patch.hairStyle === 'courte' && merged.sex === 'femme') {
    merged.characterId = 'harper';
  } else if (patch.characterId === 'maya') {
    merged.sex = 'femme';
    if (merged.hairStyle === 'courte') merged.hairStyle = 'queue';
  } else if (patch.characterId === 'harper') {
    merged.sex = 'femme';
    if (merged.hairStyle === 'queue') merged.hairStyle = 'courte';
  } else if (patch.sex === 'femme' && merged.characterId === 'sam') {
    merged.characterId = 'harper';
    if (merged.hairStyle === 'queue') merged.hairStyle = 'courte';
  }
  const next = saveLook(merged);
  return { prev, next };
}

export function applyLookMaterials(player: THREE.Object3D, look: PlayerLook = loadLook()): void {
  const skin = SKINS.find((s) => s.id === look.skinId) ?? SKINS[0]!;
  const eye = EYES.find((s) => s.id === look.eyeId) ?? EYES[0]!;
  const hair = HAIR.find((s) => s.id === look.hairId) ?? HAIR[0]!;
  const brow = HAIR.find((s) => s.id === look.browId) ?? hair;
  const top = CLOTHES.find((s) => s.id === look.topId) ?? CLOTHES[0]!;
  const bottom = CLOTHES.find((s) => s.id === look.bottomId) ?? CLOTHES[0]!;
  const shoe = CLOTHES.find((s) => s.id === look.shoeId) ?? CLOTHES[0]!;

  paint(player.userData.skinMats, skin.color, false);
  paint(player.userData.skinShadeMats, shade(skin.color), false);
  paint(player.userData.eyeMats, eye.color, true);
  paintHair(player.userData.hairMats, hair.color);
  paintHair(player.userData.browMats, brow.color);
  paint(player.userData.shirtMats, top.color, true, true);
  const bottoms = player.userData.pantsMats as THREE.MeshStandardMaterial[] | undefined;
  if (bottoms && bottoms.length > 0) paint(bottoms, bottom.color, true, true);
  paint(player.userData.shoeMats, shoe.color, true, true);
}

function paint(
  list: THREE.MeshStandardMaterial[] | undefined,
  hex: number,
  keepTexture: boolean,
  glow = false,
): void {
  if (!list) return;
  for (const mat of list) {
    const tint = new THREE.Color(hex);
    if (glow && keepTexture && mat.map && hex !== 0xffffff) {
      tint.lerp(new THREE.Color(0xffffff), 0.42);
      mat.color.copy(tint);
      mat.emissive.setHex(hex);
      mat.emissiveIntensity = 0.28;
      continue;
    }
    if (keepTexture && mat.map) tint.lerp(new THREE.Color(0xffffff), 0.58);
    mat.color.copy(tint);
    mat.emissive.setHex(0x000000);
    mat.emissiveIntensity = 0;
  }
}

/** Ears, nose and the other accent parts sit a shade under the main skin tone. */
function shade(hex: number): number {
  return new THREE.Color(hex).multiplyScalar(0.78).getHex();
}

function paintHair(list: THREE.MeshStandardMaterial[] | undefined, hex: number): void {
  if (!list) return;
  const light = hex > 0x888888;
  for (const mat of list) {
    mat.color.setHex(hex);
    mat.emissive.setHex(light ? hex : 0x000000);
    mat.emissiveIntensity = light ? 0.18 : 0;
  }
}

export function normalizeLook(raw: Partial<PlayerLook>): PlayerLook {
  return sanitize(raw);
}

export const FACE_PRESETS: { id: string; name: string; detail: string; look: Partial<PlayerLook> }[] = [
  { id: 'doux', name: 'Doux', detail: 'Nez court, mâchoire fine', look: { nose: 0.88, noseWidth: 0.92, jaw: 0.94, chin: 0.9 } },
  { id: 'fin', name: 'Fin', detail: 'Nez étroit', look: { nose: 1.05, noseWidth: 0.86, jaw: 0.92, chin: 1.02 } },
  { id: 'marque', name: 'Marqué', detail: 'Nez et menton longs', look: { nose: 1.24, noseWidth: 1.04, jaw: 1.06, chin: 1.14 } },
  { id: 'large', name: 'Large', detail: 'Nez et mâchoire larges', look: { nose: 1, noseWidth: 1.18, jaw: 1.1, chin: 0.96 } },
];

function clampNum(value: number | undefined, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitize(raw: Partial<PlayerLook>): PlayerLook {
  const sex: Sex = raw.sex === 'homme' ? 'homme' : 'femme';
  let characterId: CharacterId = CHARACTERS.some((c) => c.id === raw.characterId)
    ? (raw.characterId as CharacterId)
    : 'harper';
  let hairStyle: HairStyle =
    raw.hairStyle === 'queue' || raw.hairStyle === 'chauve' || (raw.hairStyle && isBuiltHair(raw.hairStyle))
      ? (raw.hairStyle as HairStyle)
      : 'courte';
  if (sex === 'homme' || characterId === 'sam') {
    characterId = 'sam';
    if (hairStyle === 'queue') hairStyle = 'courte';
  } else if (characterId === 'maya' || hairStyle === 'queue') {
    characterId = 'maya';
    if (hairStyle === 'courte') hairStyle = 'queue';
  } else {
    characterId = 'harper';
  }
  const hairId = HAIR.some((s) => s.id === raw.hairId) ? (raw.hairId as HairId) : DEFAULT_LOOK.hairId;
  return {
    sex: characterId === 'sam' ? 'homme' : 'femme',
    characterId,
    skinId: SKINS.some((s) => s.id === raw.skinId) ? (raw.skinId as SkinId) : DEFAULT_LOOK.skinId,
    nose: clampNum(raw.nose, 0.75, 1.4, 1),
    noseWidth: clampNum(raw.noseWidth, 0.75, 1.4, 1),
    jaw: clampNum(raw.jaw, 0.9, 1.12, 1),
    chin: clampNum(raw.chin, 0.85, 1.2, 1),
    eyeId: EYES.some((s) => s.id === raw.eyeId) ? (raw.eyeId as EyeId) : DEFAULT_LOOK.eyeId,
    hairId,
    browId: HAIR.some((s) => s.id === raw.browId) ? (raw.browId as HairId) : hairId,
    hairStyle,
    height: clampNum(raw.height, 0.92, 1.08, 1),
    shoulders: clampNum(raw.shoulders, 0.9, 1.12, 1),
    torso: clampNum(raw.torso, 0.92, 1.1, 1),
    hips: clampNum(raw.hips, 0.9, 1.12, 1),
    arms: clampNum(raw.arms, 0.9, 1.12, 1),
    legs: clampNum(raw.legs, 0.96, 1.06, 1),
    topId: clothOr(raw.topId),
    bottomId: clothOr(raw.bottomId),
    shoeId: clothOr(raw.shoeId),
    // Dresses are cut for the female bodies only.
    dressId: characterId !== 'sam' && dressById(raw.dressId) ? (raw.dressId as string) : 'aucune',
    dressColor: clothOr(raw.dressColor),
    hatId: slotOr(raw.hatId, 'hat'),
    hatColor: clothOr(raw.hatColor),
    glassesId: slotOr(raw.glassesId, 'glasses'),
    glassesColor: clothOr(raw.glassesColor),
    bagId: slotOr(raw.bagId, 'bag'),
    bagColor: clothOr(raw.bagColor),
    watchId: slotOr(raw.watchId, 'watch'),
    watchColor: clothOr(raw.watchColor),
    neckId: slotOr(raw.neckId, 'neck'),
    earId: slotOr(raw.earId, 'ears'),
    beardId: BEARDS.some((b) => b.id === raw.beardId) ? (raw.beardId as BeardId) : 'aucune',
    lipId: LIPS.some((b) => b.id === raw.lipId) ? (raw.lipId as LipId) : 'aucun',
    blushId: BLUSHES.some((b) => b.id === raw.blushId) ? (raw.blushId as BlushId) : 'aucun',
    shadowId: SHADOWS.some((b) => b.id === raw.shadowId) ? (raw.shadowId as ShadowId) : 'aucun',
    freckles: raw.freckles === true,
  };
}

function slotOr(id: string | undefined, slot: AccessorySlot): string {
  return accessoryById(id)?.slot === slot ? (id as string) : 'aucun';
}

/** Hex for a dress, falling back to the cut's own color on "origine". */
export function dressColorHex(id: string, color: ClothId): number {
  const pickId = color === 'origine' ? dressById(id)?.baseColor ?? 'noir' : color;
  return CLOTHES.find((c) => c.id === pickId)?.color ?? 0x2b2b2b;
}

/** Dress currently on the look — unpaid items still preview until Confirm. */
export function equippedDress(look: PlayerLook): { id: string; color: ClothId } | null {
  if (!dressById(look.dressId)) return null;
  return { id: look.dressId, color: look.dressColor };
}

/** Hex for an accessory, falling back to the item's own color on "origine". */
export function accessoryColor(id: string, color: ClothId): number {
  const item = accessoryById(id);
  const pickId = color === 'origine' || !item?.recolor ? item?.baseColor ?? 'noir' : color;
  return CLOTHES.find((c) => c.id === pickId)?.color ?? 0x2b2b2b;
}

function clothOr(id: ClothId | undefined): ClothId {
  return CLOTHES.some((c) => c.id === id) ? (id as ClothId) : 'origine';
}
