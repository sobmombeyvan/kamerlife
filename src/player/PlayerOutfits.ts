import * as THREE from 'three';

export type OutfitId =
  | 'original'
  | 'casual'
  | 'street'
  | 'smart'
  | 'home'
  | 'sport'
  | 'bordeaux'
  | 'dore';

export type Outfit = {
  id: OutfitId;
  name: string;
  shirt: number;
  shirtDark: number;
  pants: number;
};

export const OUTFITS: Outfit[] = [
  { id: 'original', name: "D'origine", shirt: 0xffffff, shirtDark: 0xffffff, pants: 0xffffff },
  { id: 'casual', name: 'Vert', shirt: 0x0f7660, shirtDark: 0x0a5446, pants: 0x1e2a3a },
  { id: 'street', name: 'Rouge', shirt: 0xc62828, shirtDark: 0x8e0000, pants: 0x212121 },
  { id: 'smart', name: 'Bleu', shirt: 0x1565c0, shirtDark: 0x0d47a1, pants: 0x37474f },
  { id: 'home', name: 'Crème', shirt: 0xfff3e0, shirtDark: 0xd7ccc8, pants: 0x5d4037 },
  { id: 'bordeaux', name: 'Bordeaux', shirt: 0x6d1a36, shirtDark: 0x4a1024, pants: 0x6d1a36 },
  { id: 'dore', name: 'Doré', shirt: 0xf9a825, shirtDark: 0xf57f17, pants: 0x6d4c41 },
  { id: 'sport', name: 'Sport', shirt: 0xff8f00, shirtDark: 0xe65100, pants: 0x263238 },
];

const STORAGE_KEY = 'lifecity-outfit-v1';

export function loadOutfitId(): OutfitId {
  try {
    const id = localStorage.getItem(STORAGE_KEY) as OutfitId | null;
    if (id && OUTFITS.some((o) => o.id === id)) return id;
  } catch {
    /* ignore */
  }
  return 'original';
}

export function saveOutfitId(id: OutfitId): void {
  localStorage.setItem(STORAGE_KEY, id);
}

export function applyPlayerOutfit(player: THREE.Object3D, outfit: Outfit): void {
  const shirtMats = player.userData.shirtMats as THREE.MeshStandardMaterial[] | undefined;
  const pantsMats = player.userData.pantsMats as THREE.MeshStandardMaterial[] | undefined;
  if (shirtMats) {
    for (const m of shirtMats) {
      const dark = m.userData.shirtDark;
      const tint = new THREE.Color(dark ? outfit.shirtDark : outfit.shirt);
      // A textured suit stays readable; the swatch still shifts the fabric color.
      if (m.map) tint.lerp(new THREE.Color(0xffffff), 0.62);
      m.color.copy(tint);
    }
  }
  if (pantsMats) {
    for (const m of pantsMats) m.color.setHex(outfit.pants);
  }
  player.userData.outfitId = outfit.id;
  saveOutfitId(outfit.id);
}

export function cyclePlayerOutfit(player: THREE.Object3D): Outfit {
  const cur = (player.userData.outfitId as OutfitId | undefined) ?? loadOutfitId();
  const idx = OUTFITS.findIndex((o) => o.id === cur);
  const next = OUTFITS[(idx + 1) % OUTFITS.length]!;
  applyPlayerOutfit(player, next);
  return next;
}

export function ensureOutfitApplied(player: THREE.Object3D): void {
  const id = loadOutfitId();
  const outfit = OUTFITS.find((o) => o.id === id) ?? OUTFITS[0]!;
  applyPlayerOutfit(player, outfit);
}
