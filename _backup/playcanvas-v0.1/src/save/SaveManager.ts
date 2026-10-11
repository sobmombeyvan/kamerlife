import { GameConfig, type FurnitureType } from '../game/GameConfig';

export type FurnitureSave = {
  type: FurnitureType;
  x: number;
  z: number;
  rot: number;
};

export class SaveManager {
  loadFurniture(): FurnitureSave[] {
    try {
      const raw = localStorage.getItem(GameConfig.saveKeyFurniture);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as FurnitureSave[];
      return Array.isArray(parsed) ? parsed.filter(isFurnitureSave) : [];
    } catch {
      return [];
    }
  }

  saveFurniture(items: FurnitureSave[]): void {
    try {
      localStorage.setItem(GameConfig.saveKeyFurniture, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }

  loadPending(): FurnitureType[] {
    try {
      const raw = localStorage.getItem(GameConfig.saveKeyPending);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as FurnitureType[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  savePending(types: FurnitureType[]): void {
    try {
      localStorage.setItem(GameConfig.saveKeyPending, JSON.stringify(types));
    } catch {
      /* ignore */
    }
  }

  clearPending(): void {
    this.savePending([]);
  }
}

function isFurnitureSave(v: unknown): v is FurnitureSave {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.type === 'string' && typeof o.x === 'number' && typeof o.z === 'number' && typeof o.rot === 'number';
}
