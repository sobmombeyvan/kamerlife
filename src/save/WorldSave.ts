/**
 * World save/load stub for Stage D editor.
 * Stores editable object transforms as JSON in localStorage.
 */

export type WorldObjectSave = {
  id: string;
  type: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale: number;
  props?: Record<string, unknown>;
};

export type WorldSaveFile = {
  version: number;
  savedAt: string;
  objects: WorldObjectSave[];
};

const KEY = 'lifecity-world-v1';

export function saveWorld(objects: WorldObjectSave[]): void {
  const file: WorldSaveFile = {
    version: 1,
    savedAt: new Date().toISOString(),
    objects,
  };
  localStorage.setItem(KEY, JSON.stringify(file));
}

export function loadWorld(): WorldSaveFile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WorldSaveFile;
  } catch {
    return null;
  }
}

export function exportWorldJson(objects: WorldObjectSave[]): string {
  return JSON.stringify(
    {
      version: 1,
      savedAt: new Date().toISOString(),
      objects,
    } satisfies WorldSaveFile,
    null,
    2,
  );
}
