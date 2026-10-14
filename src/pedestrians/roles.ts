import type { CharacterId, ClothId, HairId, HairStyle, PlayerLook, SkinId } from '../player/PlayerLook';
import { SKINS, HAIR, CLOTHES, withLookPatch } from '../player/PlayerLook';

export type NpcRole =
  | 'pedestrian'
  | 'shopper'
  | 'employee'
  | 'security'
  | 'tourist'
  | 'student'
  | 'taxi_wait'
  | 'police'
  | 'military'
  | 'thief'
  | 'business'
  | 'vendor'
  | 'sex_worker';

const SKIN_IDS: SkinId[] = ['miel', 'ambree', 'cuivre', 'brune', 'cacao', 'ebene', 'nuit'];
const HAIR_IDS: HairId[] = ['noir', 'brun', 'chatain', 'acajou', 'cuivre'];

export function roleCharacter(role: NpcRole, seed: number): CharacterId {
  const r = ((seed * 17) >>> 0) % 100;
  switch (role) {
    case 'police':
    case 'military':
    case 'security':
    case 'thief':
      return r < 78 ? 'sam' : 'harper';
    case 'business':
      return r < 58 ? 'sam' : 'harper';
    case 'sex_worker':
      return r < 62 ? 'maya' : 'harper';
    case 'vendor':
      return r < 38 ? 'sam' : r < 78 ? 'maya' : 'harper';
    case 'student':
      return r < 36 ? 'sam' : r < 72 ? 'maya' : 'harper';
    default:
      return r < 40 ? 'sam' : r < 72 ? 'maya' : 'harper';
  }
}

export function roleOutfit(role: NpcRole, seed: number): PlayerLook {
  const characterId = roleCharacter(role, seed);
  const skinId = SKIN_IDS[seed % SKIN_IDS.length]!;
  const hairId = HAIR_IDS[(seed * 3) % HAIR_IDS.length]!;
  const hairStyle: HairStyle = characterId === 'maya' && seed % 3 !== 0 ? 'queue' : 'courte';
  let topId: ClothId = 'origine';
  let bottomId: ClothId = 'origine';
  let shoeId: ClothId = 'noir';
  switch (role) {
    case 'police':
    case 'security':
      topId = 'marine';
      bottomId = 'marine';
      shoeId = 'noir';
      break;
    case 'military':
      topId = 'olive';
      bottomId = 'kaki';
      shoeId = 'noir';
      break;
    case 'thief':
      topId = 'noir';
      bottomId = 'noir';
      shoeId = 'noir';
      break;
    case 'business':
      topId = seed % 2 ? 'noir' : 'marine';
      bottomId = 'noir';
      shoeId = 'noir';
      break;
    case 'vendor':
      topId = (['terre', 'dore', 'vert', 'rouge'] as ClothId[])[seed % 4]!;
      bottomId = 'kaki';
      shoeId = 'terre';
      break;
    case 'sex_worker':
      topId = (['rose', 'rouge', 'prune', 'bordeaux'] as ClothId[])[seed % 4]!;
      bottomId = 'noir';
      shoeId = 'dore';
      break;
    case 'employee':
      topId = 'vert';
      bottomId = 'marine';
      break;
    case 'tourist':
      topId = 'ciel';
      bottomId = 'kaki';
      shoeId = 'blanc';
      break;
    case 'student':
      topId = (['blanc', 'ciel', 'indigo'] as ClothId[])[seed % 3]!;
      bottomId = 'marine';
      break;
    case 'shopper':
      topId = (['creme', 'terre', 'olive'] as ClothId[])[seed % 3]!;
      bottomId = 'kaki';
      break;
    default:
      topId = (['blanc', 'vert', 'sable', 'olive'] as ClothId[])[seed % 4]!;
      bottomId = (['marine', 'noir', 'kaki'] as ClothId[])[seed % 3]!;
  }
  return withLookPatch(characterId, {
    skinId,
    hairId,
    browId: hairId,
    hairStyle,
    topId,
    bottomId,
    shoeId,
    height: 0.96 + ((seed * 13) % 10) * 0.008,
  });
}

export function lodColors(look: PlayerLook): { skin: number; shirt: number; pants: number; hair: number; shoes: number } {
  return {
    skin: SKINS.find((s) => s.id === look.skinId)?.color ?? 0x8d5524,
    shirt: CLOTHES.find((c) => c.id === look.topId)?.color ?? 0x37474f,
    pants: CLOTHES.find((c) => c.id === look.bottomId)?.color ?? 0x27364a,
    hair: HAIR.find((h) => h.id === look.hairId)?.color ?? 0x1c140f,
    shoes: CLOTHES.find((c) => c.id === look.shoeId)?.color ?? 0x222222,
  };
}

export function roleSpeed(role: NpcRole, rand: number): number {
  if (role === 'thief') return 1.55 + rand * 0.35;
  if (role === 'police') return 1.05 + rand * 0.2;
  if (role === 'sex_worker') return 0.7 + rand * 0.2;
  if (role === 'vendor') return 0.85 + rand * 0.2;
  if (role === 'business') return 1.2 + rand * 0.25;
  return 1.1 + rand * 0.4;
}

export function roleLabel(role: NpcRole): string {
  switch (role) {
    case 'police':
      return 'Police';
    case 'military':
      return 'Militaire';
    case 'security':
      return 'Sécurité';
    case 'thief':
      return 'Passant';
    case 'business':
      return 'Cadre';
    case 'vendor':
      return 'Vendeur de rue';
    case 'sex_worker':
      return 'Fille de joie';
    case 'employee':
      return 'Employé(e)';
    case 'student':
      return 'Étudiant(e)';
    case 'tourist':
      return 'Visiteur';
    case 'shopper':
      return 'Client(e)';
    case 'taxi_wait':
      return 'Client taxi';
    default:
      return 'Passant';
  }
}

const FIRST = ['Amina', 'Jean', 'Paul', 'Marie', 'Eric', 'Fatou', 'Serge', 'Claire', 'Boris', 'Nadine', 'Yves', 'Sandra', 'Hervé', 'Brenda', 'Ulrich', 'Larissa'];
const LAST = ['Ngono', 'Kamga', 'Mvondo', 'Atangana', 'Fouda', 'Owona', 'Essomba', 'Talla', 'Mbarga', 'Nkodo', 'Tchoua', 'Abena'];

export function pickNpcName(seed: number, role: NpcRole): string {
  const f = FIRST[seed % FIRST.length]!;
  const l = LAST[(seed * 7) % LAST.length]!;
  if (role === 'police' || role === 'security') return `Agent ${l}`;
  if (role === 'military') return `Soldat ${l}`;
  if (role === 'business') return `${f} ${l} · cadre`;
  if (role === 'vendor') return `${f} · vendeur`;
  if (role === 'sex_worker') return `${f} · nuit`;
  if (role === 'thief') return l;
  if (role === 'employee') return `${f} · employé(e)`;
  if (role === 'student') return `${f} · étudiant(e)`;
  if (role === 'tourist') return `${f} · visiteur`;
  return `${f} ${l}`;
}
