import { loadLook, normalizeLook, type PlayerLook } from './PlayerLook';

export type SavedOutfit = {
  id: string;
  name: string;
  favorite: boolean;
  createdAt: number;
  look: PlayerLook;
};

const KEY = 'lifecity-wardrobe-v1';

export function loadWardrobe(): SavedOutfit[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.flatMap((item) => {
      const next = normalizeSaved(item);
      return next ? [next] : [];
    });
  } catch {
    return [];
  }
}

export function writeWardrobe(items: SavedOutfit[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function replaceWardrobe(items: unknown): void {
  if (!Array.isArray(items)) return;
  writeWardrobe(
    items.flatMap((item) => {
      const next = normalizeSaved(item);
      return next ? [next] : [];
    }),
  );
}

export function addOutfit(name: string, look: PlayerLook = loadLook()): SavedOutfit {
  const items = loadWardrobe();
  const next: SavedOutfit = {
    id: `tenue-${Date.now()}-${items.length}`,
    name: cleanName(name, `Tenue ${items.length + 1}`),
    favorite: false,
    createdAt: Date.now(),
    look: normalizeLook(look),
  };
  items.unshift(next);
  writeWardrobe(items);
  return next;
}

export function renameOutfit(id: string, name: string): void {
  const items = loadWardrobe();
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  item.name = cleanName(name, item.name);
  writeWardrobe(items);
}

export function deleteOutfit(id: string): void {
  writeWardrobe(loadWardrobe().filter((entry) => entry.id !== id));
}

export function duplicateOutfit(id: string): SavedOutfit | null {
  const source = loadWardrobe().find((entry) => entry.id === id);
  if (!source) return null;
  return addOutfit(`${source.name} copie`, source.look);
}

export function toggleFavoriteOutfit(id: string): void {
  const items = loadWardrobe();
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  item.favorite = !item.favorite;
  writeWardrobe(items);
}

export function outfitById(id: string): SavedOutfit | null {
  return loadWardrobe().find((entry) => entry.id === id) ?? null;
}

function cleanName(name: string, fallback: string): string {
  const trimmed = name.trim().slice(0, 32);
  return trimmed || fallback;
}

function normalizeSaved(raw: unknown): SavedOutfit | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<SavedOutfit>;
  if (!item.look || typeof item.look !== 'object') return null;
  return {
    id: typeof item.id === 'string' && item.id ? item.id : `tenue-${Date.now()}`,
    name: cleanName(typeof item.name === 'string' ? item.name : '', 'Tenue'),
    favorite: item.favorite === true,
    createdAt: Number(item.createdAt) || Date.now(),
    look: normalizeLook(item.look),
  };
}
