import { ACCESSORIES, accessoryById } from './catalog';

const KEY = 'lifecity-fashion-v1';

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(list)) return new Set(list.filter((id): id is string => typeof id === 'string' && !!accessoryById(id)));
  } catch {
    /* ignore */
  }
  return new Set();
}

export function ownedItems(): string[] {
  const owned = read();
  for (const item of ACCESSORIES) if (item.starter) owned.add(item.id);
  return [...owned];
}

export function isOwned(id: string): boolean {
  const item = accessoryById(id);
  if (!item) return false;
  return item.starter || read().has(id);
}

/** Records a paid item. The caller deducts the FCFA first. */
export function grantItem(id: string): void {
  if (!accessoryById(id)) return;
  const owned = read();
  owned.add(id);
  localStorage.setItem(KEY, JSON.stringify([...owned]));
}

export function replaceOwned(list: unknown): void {
  if (!Array.isArray(list)) return;
  const owned = list.filter((id): id is string => typeof id === 'string' && !!accessoryById(id));
  localStorage.setItem(KEY, JSON.stringify(owned));
}
