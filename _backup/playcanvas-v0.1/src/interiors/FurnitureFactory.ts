import * as pc from 'playcanvas';
import { box, createMesh, hexMaterial } from '../world/MeshFactory';
import type { FurnitureType } from '../game/GameConfig';

export function makeFurniture(app: pc.AppBase, type: FurnitureType, x: number, z: number, rot = 0): pc.Entity {
  const g = new pc.Entity(`furn-${type}`);
  g.setLocalPosition(x, 0, z);
  g.setLocalEulerAngles(0, (rot * 180) / Math.PI, 0);
  app.root.addChild(g);

  const wood = 0x8a5737;
  const B = (xx: number, yy: number, zz: number, w: number, h: number, d: number, col: number) =>
    box(app, xx, yy, zz, w, h, d, col, g);
  const C = (xx: number, yy: number, zz: number, r: number, h: number, col: number) =>
    createMesh(app, 'cyl', 'cylinder', hexMaterial(col), xx, yy, zz, r, h, r, g);

  if (type === 'canape') {
    B(0, 0.55, 0, 2.6, 0.55, 1.0, 0x2f8b79);
    B(0, 1.05, -0.42, 2.6, 0.9, 0.22, 0x236d60);
    B(-1.25, 0.72, 0, 0.22, 0.8, 1.05, 0x236d60);
    B(1.25, 0.72, 0, 0.22, 0.8, 1.05, 0x236d60);
    B(-0.8, 0.88, 0.08, 0.65, 0.13, 0.65, 0x64b7a4);
    B(0.8, 0.88, 0.08, 0.65, 0.13, 0.65, 0x64b7a4);
  } else if (type === 'lit') {
    B(0, 0.35, 0, 1.7, 0.35, 2.3, wood);
    B(0, 0.62, 0, 1.55, 0.28, 2.15, 0xf3eee4);
    B(0, 0.86, -0.94, 1.7, 1.15, 0.15, wood);
    B(-0.45, 0.8, 0.65, 0.55, 0.2, 0.45, 0xffffff);
    B(0.45, 0.8, 0.65, 0.55, 0.2, 0.45, 0xffffff);
  } else if (type === 'tv') {
    B(0, 0.35, 0, 1.7, 0.6, 0.55, wood);
    B(0, 1.25, -0.05, 1.5, 0.9, 0.12, 0x272a2c);
    B(0, 1.25, 0.02, 1.34, 0.72, 0.03, 0x4e8798);
  } else if (type === 'table') {
    B(0, 0.85, 0, 1.7, 0.16, 1.15, wood);
    for (const xx of [-0.68, 0.68]) {
      for (const zz of [-0.42, 0.42]) B(xx, 0.42, zz, 0.12, 0.8, 0.12, wood);
    }
  } else if (type === 'plante') {
    C(0, 0.28, 0, 0.28, 0.5, 0xb36b3c);
    C(0, 0.75, 0, 0.12, 0.6, 0x397848);
    for (let i = 0; i < 5; i++) {
      const leaf = createMesh(
        app,
        'leaf',
        'sphere',
        hexMaterial(i % 2 ? 0x438b50 : 0x2e6f3c),
        Math.cos(i * 1.26) * 0.38,
        1.15 + Math.sin(i * 2) * 0.12,
        Math.sin(i * 1.26) * 0.38,
        0.28,
        0.12,
        0.18,
        g,
      );
      leaf.setLocalEulerAngles(0, 0, (Math.cos(i) * 0.4 * 180) / Math.PI);
    }
  } else if (type === 'chaise') {
    B(0, 0.48, 0, 0.6, 0.15, 0.6, wood);
    for (const xx of [-0.23, 0.23]) {
      for (const zz of [-0.23, 0.23]) B(xx, 0.23, zz, 0.07, 0.45, 0.07, wood);
    }
    B(0, 0.9, -0.22, 0.58, 0.65, 0.08, wood);
  }

  g.tags.add('furniture');
  (g as pc.Entity & { furnitureType?: FurnitureType }).furnitureType = type;
  return g;
}

export function getFurnitureType(entity: pc.Entity): FurnitureType | null {
  return (entity as pc.Entity & { furnitureType?: FurnitureType }).furnitureType ?? null;
}
