import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  applyLookMaterials,
  characterById,
  loadLook,
  type CharacterId,
  type HairStyle,
  type PlayerLook,
} from './PlayerLook';
import { applyFashion, disposeFashion } from './fashion/applyFashion';
import { measureFit } from './fashion/fit';

const CLIP = {
  idle: 'Idle_Standing',
  walk: 'Walk_Brisk',
  run: 'Run',
  sit: 'Sit_Stand',
} as const;

/** Authored in-place speeds from the clip notes, in metres per second. */
const CLIP_SPEED: Record<string, number> = {
  [CLIP.walk]: 1.7,
  [CLIP.run]: 4.5,
};

const LIMB_KEYS = [
  'legL',
  'legR',
  'shinL',
  'shinR',
  'armL',
  'armR',
  'foreL',
  'foreR',
  'hipL',
  'hipR',
  'shoulderL',
  'shoulderR',
  'body',
  'head',
] as const;

export type PlayerAnimator = {
  setLocomotion(moving: boolean, running: boolean, dt: number, speed: number): void;
  setActivity(kind: string | null): void;
};

const loader = new GLTFLoader();
const gltfCache = new Map<string, Promise<GLTF | null>>();
let mountToken = 0;

/**
 * Replaces the body with the chosen rigged GLB.
 * Returns false if the asset is missing, and leaves the current body in place.
 */
export async function mountRiggedPlayer(
  root: THREE.Group,
  renderer?: THREE.WebGLRenderer,
  characterId?: CharacterId,
): Promise<boolean> {
  const token = ++mountToken;
  const def = characterById(characterId ?? loadLook().characterId);
  const gltf = await loadCached(def.url);
  if (token !== mountToken) return false;
  if (!gltf || gltf.animations.length === 0) return false;

  const model = cloneSkeleton(gltf.scene) as THREE.Group;
  model.name = 'player-rig';
  cloneMaterials(model);
  prepareMaterials(model, renderer);

  const animator = createAnimator(model, gltf);
  alignFeet(model, animator);
  model.userData.soleY = model.position.y;
  model.userData.fit = measureFit(model);

  const wasRigged = root.userData.rigged === true;
  for (const child of [...root.children]) {
    disposeFashion(child);
    root.remove(child);
    releaseBody(child, wasRigged);
  }
  root.add(model);
  for (const key of LIMB_KEYS) delete root.userData[key];

  const slots = collectSlots(model);
  root.userData.skinMats = slots.skin;
  root.userData.eyeMats = slots.eyes;
  root.userData.browMats = slots.brows;
  root.userData.hairMats = slots.hair;
  root.userData.shirtMats = slots.top;
  root.userData.pantsMats = slots.bottom;
  root.userData.shoeMats = slots.shoes;
  root.userData.hairMeshes = collectHairMeshes(model);
  root.userData.animator = animator;
  root.userData.procedural = false;
  root.userData.rigged = true;
  root.userData.characterId = def.id;
  applyAppearance(root);
  animator.setLocomotion(false, false, 0, 0);
  return true;
}

function loadCached(url: string): Promise<GLTF | null> {
  let pending = gltfCache.get(url);
  if (!pending) {
    pending = loadGltf(url);
    gltfCache.set(url, pending);
  }
  return pending;
}

function loadGltf(url: string): Promise<GLTF | null> {
  return new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => resolve(gltf),
      undefined,
      () => resolve(null),
    );
  });
}

function prepareMaterials(model: THREE.Object3D, renderer?: THREE.WebGLRenderer): void {
  const maxAniso = renderer?.capabilities.getMaxAnisotropy() ?? 4;
  model.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const name = obj.name || '';
    const shadow = /base|elegantsuit|shoes|short01/i.test(name);
    obj.castShadow = shadow;
    obj.receiveShadow = shadow;
    obj.frustumCulled = true;
    if (/accessory/i.test(name)) obj.visible = false;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      mat.envMapIntensity = 0.55;
      if (mat.map) mat.map.anisotropy = Math.min(8, maxAniso);
      if (mat.normalMap) mat.normalMap.anisotropy = Math.min(8, maxAniso);
    }
  });
}

function createAnimator(model: THREE.Object3D, gltf: GLTF): PlayerAnimator {
  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map<string, THREE.AnimationAction>();
  for (const clip of gltf.animations) {
    const action = mixer.clipAction(clip);
    action.enabled = true;
    action.clampWhenFinished = false;
    action.loop = THREE.LoopRepeat;
    actions.set(clip.name, action);
  }
  const sit = actions.get(CLIP.sit);
  const seatedAt = sit ? lowestPelvisTime(model, sit.getClip()) : 0;

  let current = '';
  let sitting = false;

  const play = (name: string, fade: number, timeScale: number, holdAt?: number): void => {
    const next = actions.get(name);
    if (!next) return;
    if (current === name) {
      next.setEffectiveTimeScale(timeScale);
      if (holdAt !== undefined) {
        next.paused = true;
        next.time = holdAt;
      }
      return;
    }
    if (current && current !== name) {
      actions.get(current)?.fadeOut(fade);
    }
    next.reset();
    next.setEffectiveTimeScale(timeScale);
    next.setEffectiveWeight(1);
    next.fadeIn(fade).play();
    if (holdAt !== undefined) {
      next.time = holdAt;
      next.paused = true;
    } else {
      next.paused = false;
    }
    current = name;
  };

  return {
    setActivity(kind: string | null): void {
      sitting = kind === 'tv' || kind === 'sleep';
      if (!sitting) return;
      if (kind === 'sleep') play(CLIP.idle, 0.25, 0.4);
      else play(CLIP.sit, 0.25, 0, seatedAt);
    },
    setLocomotion(moving: boolean, running: boolean, dt: number, speed: number): void {
      if (sitting && !moving) {
        mixer.update(dt);
        reapplyBodyScale(model);
        return;
      }
      sitting = false;
      const name = running ? CLIP.run : moving ? CLIP.walk : CLIP.idle;
      const authored = CLIP_SPEED[name] ?? 1;
      const timeScale = name === CLIP.idle ? 1 : THREE.MathUtils.clamp(speed / authored, 0.8, 1.7);
      play(name, 0.22, timeScale);
      mixer.update(dt);
      reapplyBodyScale(model);
    },
  };
}

/** The local pelvis track is not Y-up, so sample the posed world height instead. */
function lowestPelvisTime(model: THREE.Object3D, clip: THREE.AnimationClip): number {
  const pelvis = model.getObjectByName('pelvis');
  if (!pelvis) return clip.duration * 0.5;
  const probe = new THREE.AnimationMixer(model);
  const action = probe.clipAction(clip);
  action.play();
  const at = new THREE.Vector3();
  let bestT = clip.duration * 0.5;
  let bestY = Infinity;
  for (let t = 0; t <= clip.duration; t += clip.duration / 48) {
    action.time = t;
    probe.update(0);
    model.updateMatrixWorld(true);
    pelvis.getWorldPosition(at);
    if (at.y < bestY) {
      bestY = at.y;
      bestT = t;
    }
  }
  action.stop();
  probe.uncacheRoot(model);
  return bestT;
}

/**
 * Bind-pose bounds ignore the skeleton. Measure the posed, visible vertices
 * after the idle clip is applied so the soles sit on y = 0.
 */
function alignFeet(model: THREE.Object3D, animator: PlayerAnimator): void {
  animator.setLocomotion(false, false, 0, 0);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const vertex = new THREE.Vector3();
  let any = false;
  model.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.visible) return;
    const positions = obj.geometry.getAttribute('position');
    if (!positions) return;
    for (let i = 0; i < positions.count; i++) {
      obj.getVertexPosition(i, vertex);
      vertex.applyMatrix4(obj.matrixWorld);
      box.expandByPoint(vertex);
      any = true;
    }
  });
  if (any && Number.isFinite(box.min.y)) model.position.y -= box.min.y;
}

function cloneMaterials(model: THREE.Object3D): void {
  model.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (Array.isArray(obj.material)) obj.material = obj.material.map((mat) => mat.clone());
    else obj.material = obj.material.clone();
  });
}

/** Geometry stays shared with the cached GLB. Cloned materials can be disposed. */
function releaseBody(obj: THREE.Object3D, rigged: boolean): void {
  obj.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (!rigged) {
      child.geometry.dispose();
      return;
    }
    if (child.geometry.userData.noseBase) child.geometry.dispose();
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) mat.dispose();
  });
}

function collectSlots(model: THREE.Object3D): {
  skin: THREE.MeshStandardMaterial[];
  eyes: THREE.MeshStandardMaterial[];
  brows: THREE.MeshStandardMaterial[];
  hair: THREE.MeshStandardMaterial[];
  top: THREE.MeshStandardMaterial[];
  bottom: THREE.MeshStandardMaterial[];
  shoes: THREE.MeshStandardMaterial[];
} {
  const skin: THREE.MeshStandardMaterial[] = [];
  const eyes: THREE.MeshStandardMaterial[] = [];
  const brows: THREE.MeshStandardMaterial[] = [];
  const hair: THREE.MeshStandardMaterial[] = [];
  const top: THREE.MeshStandardMaterial[] = [];
  const bottom: THREE.MeshStandardMaterial[] = [];
  const shoes: THREE.MeshStandardMaterial[] = [];
  model.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      const slot = clothSlot(obj.name, mat.name);
      if (slot === 'skin') skin.push(mat);
      else if (slot === 'eyes') eyes.push(mat);
      else if (slot === 'brows') brows.push(mat);
      else if (slot === 'hair') hair.push(mat);
      else if (slot === 'top') top.push(mat);
      else if (slot === 'bottom') bottom.push(mat);
      else if (slot === 'shoes') shoes.push(mat);
    }
  });
  return { skin, eyes, brows, hair, top, bottom, shoes };
}

function clothSlot(
  meshName: string,
  matName: string,
): 'skin' | 'eyes' | 'brows' | 'hair' | 'top' | 'bottom' | 'shoes' | null {
  const blob = `${meshName} ${matName}`.toLowerCase();
  if (/shoe/.test(blob)) return 'shoes';
  if (/eyebrow/.test(blob)) return 'brows';
  if (/short01|ponytail|hair root|hairline|scalp/.test(blob)) return 'hair';
  if (/low-poly/.test(blob)) return 'eyes';
  if (/trouser|\.bottom| original bottom/.test(blob)) return 'bottom';
  if (/top|fabric|elegantsuit|satin/.test(blob)) return 'top';
  if (matName.endsWith('.body')) return 'skin';
  return null;
}

type FaceEdit = {
  noseIndex: number[];
  noseX: Float32Array;
  noseZ: Float32Array;
  noseBackZ: number;
  jawIndex: number[];
  jawX: Float32Array;
  chinIndex: number[];
  chinY: Float32Array;
  chinZ: Float32Array;
};

/** Paints materials, nose vertices, body scale and hair visibility from one look. */
export function applyAppearance(root: THREE.Object3D, look: PlayerLook = loadLook()): void {
  applyLookMaterials(root, look);
  applyNose(root, look.nose, look.noseWidth, look.jaw, look.chin);
  applyBody(root, look);
  applyHairStyle(root, look.hairStyle);
  applyFashion(root, look);
}

/** Moves nose, jaw and chin on the body mesh. 1 leaves each feature as modeled. */
export function applyNose(root: THREE.Object3D, length: number, width = 1, jaw = 1, chin = 1): void {
  const model = root.getObjectByName('player-rig');
  if (!model) return;
  const k = Math.min(1.4, Math.max(0.75, length));
  const w = Math.min(1.4, Math.max(0.75, width));
  const jawK = Math.min(1.12, Math.max(0.9, jaw));
  const chinK = Math.min(1.2, Math.max(0.85, chin));
  model.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    if (!mats.some((mat) => mat.name.endsWith('.body'))) return;
    if (!obj.geometry.userData.faceEdit) {
      const geo = obj.geometry.clone();
      geo.userData.faceEdit = captureFace(geo);
      geo.userData.noseBase = true;
      obj.geometry = geo;
    }
    const base = obj.geometry.userData.faceEdit as FaceEdit;
    const pos = obj.geometry.getAttribute('position');
    for (let n = 0; n < base.noseIndex.length; n++) {
      const i = base.noseIndex[n]!;
      pos.setX(i, (base.noseX[n] ?? 0) * w);
      pos.setZ(i, base.noseBackZ + ((base.noseZ[n] ?? base.noseBackZ) - base.noseBackZ) * k);
    }
    for (let n = 0; n < base.jawIndex.length; n++) {
      const i = base.jawIndex[n]!;
      pos.setX(i, (base.jawX[n] ?? 0) * jawK);
    }
    const drop = (chinK - 1) * -0.01;
    const push = (chinK - 1) * 0.014;
    for (let n = 0; n < base.chinIndex.length; n++) {
      const i = base.chinIndex[n]!;
      pos.setY(i, (base.chinY[n] ?? 0) + drop);
      pos.setZ(i, (base.chinZ[n] ?? 0) + push);
    }
    pos.needsUpdate = true;
    obj.geometry.computeBoundingSphere();
  });
}

type BodyTune = {
  shoulders: number;
  torso: number;
  hips: number;
  arms: number;
  legs: number;
};

/**
 * Height is a uniform scale around the feet.
 * Limb proportions are reapplied after the clip, because these GLBs animate bone scale.
 */
export function applyBody(root: THREE.Object3D, look: PlayerLook): void {
  const model = root.getObjectByName('player-rig');
  if (!model) return;
  const height = Math.min(1.08, Math.max(0.92, look.height));
  const legs = Math.min(1.06, Math.max(0.96, look.legs));
  model.scale.setScalar(height);
  const sole = Number(model.userData.soleY ?? 0);
  model.position.y = sole + 0.7 * (legs - 1) * height;
  const tune: BodyTune = {
    shoulders: Math.min(1.12, Math.max(0.9, look.shoulders)),
    torso: Math.min(1.1, Math.max(0.92, look.torso)),
    hips: Math.min(1.12, Math.max(0.9, look.hips)),
    arms: Math.min(1.12, Math.max(0.9, look.arms)),
    legs,
  };
  model.userData.bodyScale = tune;
}

function reapplyBodyScale(model: THREE.Object3D): void {
  const tune = model.userData.bodyScale as BodyTune | undefined;
  if (!tune) return;
  // These clips also write bone scale, and that write does not replace our edit.
  // Set the proportion directly so it cannot stack from frame to frame.
  const set = (name: string, x: number, y: number, z: number) => {
    const bone = model.getObjectByName(name);
    if (!bone) return;
    bone.scale.set(x, y, z);
  };
  set('clavicle_l', 1, tune.shoulders, 1);
  set('clavicle_r', 1, tune.shoulders, 1);
  for (const name of ['spine_01', 'spine_02', 'spine_03']) set(name, tune.torso, 1, tune.torso);
  set('pelvis', tune.hips, 1, tune.hips);
  for (const name of ['upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r']) {
    set(name, tune.arms, 1, tune.arms);
  }
  for (const name of ['thigh_l', 'thigh_r']) set(name, 1, tune.legs, 1);
}

function collectHairMeshes(model: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  model.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (/short01|ponytail|hairline|scalp/i.test(obj.name)) meshes.push(obj);
  });
  return meshes;
}

export function applyHairStyle(root: THREE.Object3D, style: HairStyle): void {
  const meshes = root.userData.hairMeshes as THREE.Mesh[] | undefined;
  if (!meshes) return;
  const show = style === 'courte' || style === 'queue';
  for (const mesh of meshes) mesh.visible = show;
}

function captureFace(geo: THREE.BufferGeometry): FaceEdit {
  const pos = geo.getAttribute('position');
  let ymax = -Infinity;
  for (let i = 0; i < pos.count; i++) ymax = Math.max(ymax, pos.getY(i));
  const y0 = ymax - 0.18;
  const y1 = ymax - 0.08;
  let tipZ = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > y0 && pos.getY(i) < y1 && Math.abs(pos.getX(i)) < 0.03) {
      tipZ = Math.max(tipZ, pos.getZ(i));
    }
  }
  const noseIndex: number[] = [];
  const noseX: number[] = [];
  const noseZ: number[] = [];
  const jawIndex: number[] = [];
  const jawX: number[] = [];
  const chinIndex: number[] = [];
  const chinY: number[] = [];
  const chinZ: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ax = Math.abs(x);
    if (y > y0 && y < y1 && ax < 0.025 && z > tipZ - 0.016) {
      noseIndex.push(i);
      noseX.push(x);
      noseZ.push(z);
    } else if (y > ymax - 0.3 && y < ymax - 0.16 && ax > 0.032 && ax < 0.085 && z > tipZ - 0.05) {
      jawIndex.push(i);
      jawX.push(x);
    } else if (y > ymax - 0.32 && y < ymax - 0.2 && ax < 0.02 && z > tipZ - 0.04) {
      chinIndex.push(i);
      chinY.push(y);
      chinZ.push(z);
    }
  }
  let backZ = Infinity;
  for (const z of noseZ) backZ = Math.min(backZ, z);
  if (!Number.isFinite(backZ)) backZ = 0;
  return {
    noseIndex,
    noseX: Float32Array.from(noseX),
    noseZ: Float32Array.from(noseZ),
    noseBackZ: backZ,
    jawIndex,
    jawX: Float32Array.from(jawX),
    chinIndex,
    chinY: Float32Array.from(chinY),
    chinZ: Float32Array.from(chinZ),
  };
}

