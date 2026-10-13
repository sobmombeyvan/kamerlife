import * as THREE from 'three';
import {
  accessoryColor,
  equippedAccessories,
  HAIR,
  isBuiltHair,
  type PlayerLook,
} from '../PlayerLook';
import { BLUSHES, LIPS, SHADOWS, accessoryById, type AccessorySlot } from './catalog';
import { buildAccessory, disposeObject } from './accessories';
import { buildHair, builtHairPad } from './builtHair';
import { buildBeard, buildMakeup } from './faceShells';
import { attachToBone, type RigFit } from './fit';

type Slot = { key: string; obj: THREE.Object3D | null };

type FashionState = {
  hair: Slot;
  beard: Slot;
  makeup: { key: string; objs: THREE.Object3D[] };
  acc: Partial<Record<AccessorySlot, Slot>>;
};

const IDENTITY = new THREE.Matrix4();

function state(model: THREE.Object3D): FashionState {
  let s = model.userData.fashion as FashionState | undefined;
  if (!s) {
    s = { hair: { key: '', obj: null }, beard: { key: '', obj: null }, makeup: { key: '', objs: [] }, acc: {} };
    model.userData.fashion = s;
  }
  return s;
}

function drop(obj: THREE.Object3D | null): void {
  if (!obj) return;
  obj.removeFromParent();
  disposeObject(obj);
}

function bodyMesh(model: THREE.Object3D): THREE.SkinnedMesh | null {
  let found: THREE.SkinnedMesh | null = null;
  model.traverse((obj) => {
    if (found || !(obj instanceof THREE.SkinnedMesh) || obj.name === 'face-shell') return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    if (mats.some((m) => m.name.endsWith('.body'))) found = obj;
  });
  return found;
}

/** Hair styles, accessories, beard and makeup for one look. Rebuilds only what changed. */
export function applyFashion(root: THREE.Object3D, look: PlayerLook): void {
  const model = root.getObjectByName('player-rig');
  const fit = model?.userData.fit as RigFit | undefined;
  if (!model || !fit) return;
  const s = state(model);
  const hairHex = HAIR.find((h) => h.id === look.hairId)?.color ?? 0x1c140f;
  const face = `${look.nose.toFixed(3)}-${look.noseWidth.toFixed(3)}-${look.jaw.toFixed(3)}-${look.chin.toFixed(3)}`;

  const built = isBuiltHair(look.hairStyle) ? look.hairStyle : null;
  const hairKey = built ? `${built}-${hairHex}` : '';
  if (hairKey !== s.hair.key) {
    drop(s.hair.obj);
    s.hair = { key: hairKey, obj: null };
    if (built) {
      const group = buildHair(built, fit, hairHex);
      if (attachToBone(model, fit, 'head', group, IDENTITY)) s.hair.obj = group;
      else disposeObject(group);
    }
  }

  const pad = built ? builtHairPad(built) : look.hairStyle === 'chauve' ? 0.003 : 0.014;
  const worn = new Map(equippedAccessories(look).map((item) => [item.slot, item]));
  let covered = false;
  for (const slot of ['hat', 'glasses', 'bag', 'watch', 'neck', 'ears'] as AccessorySlot[]) {
    const item = worn.get(slot);
    const def = item ? accessoryById(item.id) : undefined;
    const hex = item ? accessoryColor(item.id, item.color) : 0;
    const key = item && def ? `${item.id}-${hex}-${slot === 'hat' ? pad : 0}` : '';
    const prev = s.acc[slot] ?? { key: '', obj: null };
    if (def?.coversHair) covered = true;
    if (key === prev.key) continue;
    drop(prev.obj);
    s.acc[slot] = { key, obj: null };
    if (!item || !def) continue;
    const group = buildAccessory(item.id, fit, hex, pad);
    if (group && attachToBone(model, fit, def.bone, group, IDENTITY)) s.acc[slot]!.obj = group;
    else if (group) disposeObject(group);
  }

  const hairMeshes = (root.userData.hairMeshes as THREE.Mesh[] | undefined) ?? [];
  const showOriginal = !covered && (look.hairStyle === 'courte' || look.hairStyle === 'queue');
  for (const mesh of hairMeshes) mesh.visible = showOriginal;
  if (s.hair.obj) s.hair.obj.visible = !covered;

  const body = bodyMesh(model);
  if (!body?.parent) return;
  const beardKey = `${look.beardId}-${hairHex}-${face}`;
  if (beardKey !== s.beard.key) {
    drop(s.beard.obj);
    s.beard = { key: beardKey, obj: null };
    const beard = buildBeard(body, look.beardId, hairHex);
    if (beard) {
      body.parent.add(beard);
      s.beard.obj = beard;
    }
  }

  const color = (list: { id: string; color: number }[], id: string) =>
    id === 'aucun' ? null : list.find((item) => item.id === id)?.color ?? null;
  const spec = {
    lips: color(LIPS, look.lipId),
    gloss: look.lipId === 'gloss',
    blush: color(BLUSHES, look.blushId),
    shadow: color(SHADOWS, look.shadowId),
    freckles: look.freckles,
  };
  const makeupKey = `${JSON.stringify(spec)}-${face}`;
  if (makeupKey !== s.makeup.key) {
    for (const obj of s.makeup.objs) drop(obj);
    s.makeup = { key: makeupKey, objs: buildMakeup(body, spec) };
    for (const obj of s.makeup.objs) body.parent.add(obj);
  }
}

export function disposeFashion(model: THREE.Object3D): void {
  const s = model.userData.fashion as FashionState | undefined;
  if (!s) return;
  drop(s.hair.obj);
  drop(s.beard.obj);
  for (const obj of s.makeup.objs) drop(obj);
  for (const slot of Object.values(s.acc)) drop(slot?.obj ?? null);
  delete model.userData.fashion;
}
