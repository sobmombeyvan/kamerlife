import { COMFORT_NEEDS, type NeedsState } from '../sim/PlayerNeeds';
import type { RelationEntry } from '../sim/SocialMemory';
import type { GraphicsQuality } from '../config/GraphicsConfig';
import type { PlayerLook } from '../player/PlayerLook';
import type { SavedOutfit } from '../player/Wardrobe';

const KEY = 'lifecity-gamesave-v2';
const LEGACY_KEY = 'lifecity-gamesave-v1';

export type GameSaveData = {
  version: 3;
  money: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  needs: NeedsState;
  clockMinutes: number;
  quality: GraphicsQuality;
  relations: Record<string, RelationEntry>;
  jobCooldownUntil: number;
  look?: PlayerLook;
  wardrobe?: SavedOutfit[];
  /** Fashion items bought with FCFA. Starter items are implied. */
  fashionOwned?: string[];
  /** Dealership cars the player bought. */
  ownedCars?: { sku: string; x: number; z: number; yaw: number }[];
  savedAt: number;
};

export function loadGameSave(): GameSaveData | null {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, unknown>;
    const ver = Number(data.version ?? 0);
    if (ver !== 1 && ver !== 2 && ver !== 3) return null;
    const needsRaw = (data.needs ?? {}) as Partial<NeedsState>;
    // Older saves were drained in minutes. Start those players comfortable again.
    const refreshNeeds = ver < 3;
    const relations = (data.relations ?? {}) as Record<string, RelationEntry>;
    return {
      version: 3,
      money: Number(data.money ?? 50000),
      x: Number(data.x ?? 38),
      y: Number(data.y ?? 0),
      z: Number(data.z ?? 108),
      yaw: Number(data.yaw ?? 0),
      needs: refreshNeeds
        ? { ...COMFORT_NEEDS }
        : {
            health: needsRaw.health ?? COMFORT_NEEDS.health,
            stamina: needsRaw.stamina ?? COMFORT_NEEDS.stamina,
            hunger: needsRaw.hunger ?? COMFORT_NEEDS.hunger,
            thirst: needsRaw.thirst ?? COMFORT_NEEDS.thirst,
            energy: needsRaw.energy ?? COMFORT_NEEDS.energy,
            hygiene: needsRaw.hygiene ?? COMFORT_NEEDS.hygiene,
            fun: needsRaw.fun ?? COMFORT_NEEDS.fun,
            social: needsRaw.social ?? COMFORT_NEEDS.social,
          },
      clockMinutes: Number(data.clockMinutes ?? 8 * 60),
      quality: (data.quality as GraphicsQuality) ?? 'medium',
      relations,
      jobCooldownUntil: Number(data.jobCooldownUntil ?? -999),
      look: data.look && typeof data.look === 'object' ? (data.look as PlayerLook) : undefined,
      wardrobe: Array.isArray(data.wardrobe) ? (data.wardrobe as SavedOutfit[]) : undefined,
      fashionOwned: Array.isArray(data.fashionOwned)
        ? (data.fashionOwned as unknown[]).filter((id): id is string => typeof id === 'string')
        : undefined,
      ownedCars: Array.isArray(data.ownedCars)
        ? (data.ownedCars as { sku: string; x: number; z: number; yaw: number }[])
        : undefined,
      savedAt: Number(data.savedAt ?? Date.now()),
    };
  } catch {
    return null;
  }
}

export function writeGameSave(data: Omit<GameSaveData, 'version' | 'savedAt'>): void {
  const full: GameSaveData = { ...data, version: 3, savedAt: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(full));
}

export function clearGameSave(): void {
  localStorage.removeItem(KEY);
  localStorage.removeItem(LEGACY_KEY);
}
