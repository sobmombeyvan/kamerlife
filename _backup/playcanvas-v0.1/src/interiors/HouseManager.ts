import * as pc from 'playcanvas';
import { box } from '../world/MeshFactory';
import { FurnitureCatalog, type FurnitureType } from '../game/GameConfig';
import { makeFurniture, getFurnitureType } from './FurnitureFactory';
import { SaveManager } from '../save/SaveManager';
import type { CollisionWorld } from '../world/CollisionWorld';

const HOME_WORLD = { x: 132, z: 132 };
const HOME_DOOR_OUTSIDE = new pc.Vec3(25, 0, 51.5);
const HOME_SPAWN_INSIDE = new pc.Vec3(132, 0, 132);
const HOME_EXIT = new pc.Vec3(132, 0, 126.7);
const DEFAULT_SPOTS: Record<FurnitureType, [number, number]> = {
  canape: [-2, 1.8],
  lit: [2, -1],
  tv: [0, -4.2],
  table: [2, 2],
  plante: [-5, -4],
  chaise: [3, 2],
};

export class HouseManager {
  readonly exteriorDoor = HOME_DOOR_OUTSIDE;
  readonly interiorExit = HOME_EXIT;
  inside = false;
  private readonly homeGroup: pc.Entity;
  private readonly items: pc.Entity[] = [];
  private selected: pc.Entity | null = null;
  private readonly saves = new SaveManager();

  constructor(
    private readonly app: pc.AppBase,
    _collisions: CollisionWorld,
  ) {
    this.homeGroup = new pc.Entity('home-interior');
    this.homeGroup.setPosition(HOME_WORLD.x, 0, HOME_WORLD.z);
    this.app.root.addChild(this.homeGroup);
    this.buildInterior();
    this.loadSaved();
  }

  private buildInterior(): void {
    box(this.app, 0, -0.13, 0, 14, 0.25, 12, 0xc5a57d, this.homeGroup);
    box(this.app, 0, 3, 6, 14, 6, 0.25, 0xf0dfc4, this.homeGroup);
    box(this.app, -7, 3, 0, 0.25, 6, 12, 0xe6d3b7, this.homeGroup);
    box(this.app, 7, 3, 0, 0.25, 6, 12, 0xe6d3b7, this.homeGroup);
    box(this.app, 0, 3, -6, 14, 6, 0.25, 0xe6d3b7, this.homeGroup);
    box(this.app, -4, 3, 5.95, 6, 6, 0.2, 0xe6d3b7, this.homeGroup);
    box(this.app, 4, 3, 5.95, 6, 6, 0.2, 0xe6d3b7, this.homeGroup);
    box(this.app, 0, 5.9, 0, 14, 0.2, 12, 0xf6ead8, this.homeGroup);
    box(this.app, -4, 3, 5.78, 2.2, 1.8, 0.1, 0x6ea2aa, this.homeGroup);
    box(this.app, 4, 3, 5.78, 2.2, 1.8, 0.1, 0x6ea2aa, this.homeGroup);
    this.makeSign('SALON', 0, 4.7, 5.9, 0x3c8069);

    // Interior walls as soft collision when inside (handled via clamp, not boxes)
  }

  private makeSign(text: string, x: number, y: number, z: number, color: number): void {
    // Lightweight label plate (text via toast/HUD; plate for landmark feel)
    box(this.app, x, y, z, 4.5, 1.1, 0.08, color, this.homeGroup);
    void text;
  }

  enter(player: pc.Entity): void {
    this.inside = true;
    player.setPosition(HOME_SPAWN_INSIDE.x, 0, HOME_SPAWN_INSIDE.z);
    this.collectPending();
  }

  exit(player: pc.Entity): void {
    this.inside = false;
    this.selected = null;
    player.setPosition(25, 0, 45);
  }

  clampPlayer(player: pc.Entity): void {
    if (!this.inside) {
      const p = player.getPosition();
      player.setPosition(
        Math.max(-153, Math.min(153, p.x)),
        p.y,
        Math.max(-153, Math.min(153, p.z)),
      );
      return;
    }
    const p = player.getPosition();
    player.setPosition(
      Math.max(125.7, Math.min(138.3, p.x)),
      p.y,
      Math.max(127.1, Math.min(137.1, p.z)),
    );
  }

  nearExteriorDoor(pos: pc.Vec3): boolean {
    return pos.distance(this.exteriorDoor) < 8;
  }

  nearInteriorExit(pos: pc.Vec3): boolean {
    return pos.distance(this.interiorExit) < 4;
  }

  addFurniture(type: FurnitureType, x?: number, z?: number, rot = 0, save = true): pc.Entity {
    const spot = DEFAULT_SPOTS[type];
    const fx = x ?? spot[0];
    const fz = z ?? spot[1];
    // Parent under homeGroup via local coords: world = home + local
    const entity = makeFurniture(this.app, type, HOME_WORLD.x + fx, HOME_WORLD.z + fz, rot);
    // Reparent under home group with local offset
    entity.reparent(this.homeGroup);
    entity.setLocalPosition(fx, 0, fz);
    entity.setLocalEulerAngles(0, (rot * 180) / Math.PI, 0);
    this.items.push(entity);
    if (save) this.persist();
    return entity;
  }

  getOwnedCounts(): Record<FurnitureType, number> {
    const owned = { canape: 0, lit: 0, tv: 0, table: 0, plante: 0, chaise: 0 };
    for (const item of this.items) {
      const t = getFurnitureType(item);
      if (t) owned[t] += 1;
    }
    return owned;
  }

  selectType(type: FurnitureType): boolean {
    const found = this.items.find((i) => getFurnitureType(i) === type) ?? null;
    this.selected = found;
    return !!found;
  }

  moveSelected(dx: number, dz: number): boolean {
    if (!this.selected) return false;
    const p = this.selected.getLocalPosition();
    this.selected.setLocalPosition(
      Math.max(-5, Math.min(5, p.x + dx)),
      0,
      Math.max(-4, Math.min(4, p.z + dz)),
    );
    this.persist();
    return true;
  }

  rotateSelected(): boolean {
    if (!this.selected) return false;
    const e = this.selected.getLocalEulerAngles();
    this.selected.setLocalEulerAngles(0, e.y + 45, 0);
    this.persist();
    return true;
  }

  getSelectedLabel(): string | null {
    if (!this.selected) return null;
    const t = getFurnitureType(this.selected);
    return t ? FurnitureCatalog[t].name : null;
  }

  queuePending(type: FurnitureType): void {
    const pending = this.saves.loadPending();
    pending.push(type);
    this.saves.savePending(pending);
  }

  private collectPending(): void {
    const pending = this.saves.loadPending();
    for (const type of pending) this.addFurniture(type);
    this.saves.clearPending();
  }

  private loadSaved(): void {
    for (const item of this.saves.loadFurniture()) {
      this.addFurniture(item.type, item.x, item.z, item.rot, false);
    }
  }

  private persist(): void {
    this.saves.saveFurniture(
      this.items.map((e) => {
        const p = e.getLocalPosition();
        const r = e.getLocalEulerAngles();
        return {
          type: getFurnitureType(e)!,
          x: p.x,
          z: p.z,
          rot: (r.y * Math.PI) / 180,
        };
      }),
    );
  }
}
