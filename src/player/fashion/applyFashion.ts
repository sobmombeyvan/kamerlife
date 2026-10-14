import * as THREE from 'three';
import {
  accessoryColor,
  dressColorHex,
  equippedAccessories,
  equippedDress,
  HAIR,
  isBuiltHair,
  type PlayerLook,
} from '../PlayerLook';
import { buildDress, dressById } from './dresses';
import { BLUSHES, LIPS, SHADOWS, accessoryById, type AccessorySlot } from './catalog';
import { buildAccessory, disposeObject } from './accessories';
import { buildHair, builtHairPad } from './builtHair';
import { buildBeard, buildMakeup } from './faceShells';
import { attachToBone, type RigFit } from './fit';

type Slot = { key: string; obj: THREE.Object3D | null };

type FashionState = {
  hair: Slot;
  beard: Slot;
  dress: Slot;
  makeup: { key: string; objs: THREE.Object3D[] };
  acc: Partial<Record<AccessorySlot, Slot>>;
};

const IDENTITY = new THREE.Matrix4();

function state(model: THREE.Object3D): FashionState {
  let s = model.userData.fashion as FashionState | undefined;
  if (!s) {
    s = {
      hair: { key: '', obj: null },
      beard: { key: '', obj: null },
      dress: { key: '', obj: null },
      makeup: { key: '', objs: [] },
      acc: {},
    };
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

  const dress = equippedDress(look);
  const dressDef = dress ? dressById(dress.id) : undefined;
  const dressKey = dress && dressDef ? `${dress.id}-${dressColorHex(dress.id, dress.color)}` : '';
  if (dressKey !== s.dress.key) {
    drop(s.dress.obj);
    s.dress = { key: dressKey, obj: null };
    if (dress && dressDef) {
      const group = buildDress(dressDef, fit, dressColorHex(dress.id, dress.color));
      if (attachToBone(model, fit, 'spine_02', group, IDENTITY)) s.dress.obj = group;
      else disposeObject(group);
    }
  }
  // Keep authored clothes visible: they are the only torso and leg meshes.
  // Recolor the shirt as the bodice and the trousers as skin so a mini
  // still has legs, then drape the procedural dress over both.
  const wearingDress = !!s.dress.obj;
  const tops = (root.userData.topMeshes as THREE.Mesh[] | undefined) ?? [];
  const bottoms = (root.userData.bottomMeshes as THREE.Mesh[] | undefined) ?? [];
  for (const mesh of [...tops, ...bottoms]) mesh.visible = true;
  const legScale = wearingDress ? 0.86 : 1;
  for (const mesh of bottoms) mesh.scale.set(legScale, 1, legScale);
  if (wearingDress) {
    const dressHex = dress ? dressColorHex(dress.id, dress.color) : 0x2b2b2b;
    tintSolid(root.userData.shirtMats, dressHex);
    // Same color as the skirt, so thighs poking through read as fabric, not pants.
    tintSolid(root.userData.pantsMats, dressHex);
  } else {
    restoreMaps(root.userData.shirtMats);
    restoreMaps(root.userData.pantsMats);
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

function tintSolid(list: THREE.MeshStandardMaterial[] | undefined, hex: number): void {
  if (!list) return;
  for (const mat of list) {
    if (mat.userData.prevMap === undefined) mat.userData.prevMap = mat.map;
    mat.map = null;
    mat.color.setHex(hex);
    mat.emissive.setHex(0x000000);
    mat.emissiveIntensity = 0;
  }
}

function restoreMaps(list: THREE.MeshStandardMaterial[] | undefined): void {
  if (!list) return;
  for (const mat of list) {
    if (mat.userData.prevMap !== undefined) mat.map = mat.userData.prevMap;
  }
}

export function disposeFashion(model: THREE.Object3D): void {
  const s = model.userData.fashion as FashionState | undefined;
  if (!s) return;
  drop(s.hair.obj);
  drop(s.beard.obj);
  drop(s.dress.obj);
  for (const obj of s.makeup.objs) drop(obj);
  for (const slot of Object.values(s.acc)) drop(slot?.obj ?? null);
  delete model.userData.fashion;
}
