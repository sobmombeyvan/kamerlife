import * as pc from 'playcanvas';

const cache = new Map<string, pc.StandardMaterial>();

export function material(r: number, g: number, b: number, rough = 0.85, metal = 0): pc.StandardMaterial {
  const key = `${r.toFixed(3)}_${g.toFixed(3)}_${b.toFixed(3)}_${rough}_${metal}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(r, g, b);
  m.specular = new pc.Color(metal, metal, metal);
  m.shininess = Math.max(1, (1 - rough) * 80);
  m.useLighting = true;
  m.update();
  cache.set(key, m);
  return m;
}

export function hexMaterial(hex: number, rough = 0.85, metal = 0): pc.StandardMaterial {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  return material(r, g, b, rough, metal);
}

export function createMesh(
  app: pc.AppBase,
  name: string,
  type: 'box' | 'sphere' | 'cylinder' | 'cone' | 'capsule',
  mat: pc.StandardMaterial,
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
  parent?: pc.Entity,
): pc.Entity {
  const entity = new pc.Entity(name);
  // PlayCanvas primitives: box/sphere/cylinder; cone approximated as cylinder taper via scale
  const renderType = type === 'cone' || type === 'capsule' ? (type === 'cone' ? 'cone' : 'capsule') : type;
  const safeType =
    renderType === 'cone' || renderType === 'capsule'
      ? renderType === 'cone'
        ? 'cone'
        : 'capsule'
      : renderType;

  try {
    entity.addComponent('render', {
      type: safeType as 'box' | 'sphere' | 'cylinder' | 'cone' | 'capsule',
      material: mat,
      castShadows: false,
      receiveShadows: false,
    });
  } catch {
    entity.addComponent('render', {
      type: type === 'sphere' ? 'sphere' : 'box',
      material: mat,
      castShadows: false,
      receiveShadows: false,
    });
  }

  entity.setLocalPosition(x, y, z);
  entity.setLocalScale(sx, sy, sz);
  (parent ?? app.root).addChild(entity);
  return entity;
}

export function box(
  app: pc.AppBase,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  hex: number,
  parent?: pc.Entity,
): pc.Entity {
  return createMesh(app, 'box', 'box', hexMaterial(hex), x, y, z, w, h, d, parent);
}
