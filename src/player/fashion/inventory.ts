import { ACCESSORIES, accessoryById } from './catalog';
import { DRESSES, dressById } from './dresses';

const KEY = 'lifecity-fashion-v1';

type Buyable = { id: string; starter: boolean };

/** Accessories and dresses share one wardrobe inventory. */
function itemById(id: string): Buyable | undefined {
  return accessoryById(id) ?? dressById(id);
}

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(list)) return new Set(list.filter((id): id is string => typeof id === 'string' && !!itemById(id)));
  } catch {
    /* ignore */
  }
  return new Set();
}

export function ownedItems(): string[] {
  const owned = read();
  for (const item of [...ACCESSORIES, ...DRESSES]) if (item.starter) owned.add(item.id);
  return [...owned];
}

export function isOwned(id: string): boolean {
  const item = itemById(id);
  if (!item) return false;
  return item.starter || read().has(id);
}

/** Records a paid item. The caller deducts the FCFA first. */
export function grantItem(id: string): void {
  if (!itemById(id)) return;
  const owned = read();
  owned.add(id);
  localStorage.setItem(KEY, JSON.stringify([...owned]));
}

export function replaceOwned(list: unknown): void {
  if (!Array.isArray(list)) return;
  const owned = list.filter((id): id is string => typeof id === 'string' && !!itemById(id));
  localStorage.setItem(KEY, JSON.stringify(owned));
}
