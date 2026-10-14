import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loadCharacterGltf } from '../player/PlayerRig';
import type { CharacterId } from '../player/PlayerLook';

export const NPC_CHARS: CharacterId[] = ['harper', 'maya', 'sam'];
export type BakeSlot = 'skin' | 'hair' | 'top' | 'bottom' | 'shoes' | 'eyes';
export const BAKE_SLOTS: BakeSlot[] = ['skin', 'hair', 'top', 'bottom', 'shoes', 'eyes'];

export type BakedBody = {
  id: CharacterId;
  geos: Partial<Record<BakeSlot, THREE.BufferGeometry>>;
  maps: Partial<Record<BakeSlot, THREE.Texture | null>>;
  headY: number;
};

export type NpcKit = {
  bodies: Partial<Record<CharacterId, BakedBody>>;
};

let kitPromise: Promise<NpcKit | null> | null = null;
let kit: NpcKit | null = null;

export function getNpcKit(): NpcKit | null {
  return kit;
}

/** Load each GLB once, pose Idle_Standing, freeze vertices, drop the skeleton. */
export function ensureNpcKit(): Promise<NpcKit | null> {
  if (!kitPromise) kitPromise = bakeAll();
  return kitPromise;
}

async function bakeAll(): Promise<NpcKit | null> {
  const bodies: Partial<Record<CharacterId, BakedBody>> = {};
  for (const id of NPC_CHARS) {
    try {
      const body = await bakeOne(id);
      if (body) bodies[id] = body;
    } catch (err) {
      console.warn(`[npc] bake ${id} failed`, err);
    }
  }
  if (!Object.keys(bodies).length) return null;
  kit = { bodies };
  return kit;
}

async function bakeOne(id: CharacterId): Promise<BakedBody | null> {
  const gltf = await loadCharacterGltf(id);
  if (!gltf || gltf.animations.length === 0) return null;

  const model = cloneSkeleton(gltf.scene) as THREE.Group;
  model.traverse((obj) => {
    if (/accessory/i.test(obj.name)) obj.visible = false;
  });

  const mixer = new THREE.AnimationMixer(model);
  const clip = gltf.animations.find((c) => c.name === 'Idle_Standing') ?? gltf.animations[0]!;
  const action = mixer.clipAction(clip);
  action.play();
  action.time = Math.min(0.12, clip.duration * 0.2);
  mixer.update(0);
  model.updateMatrixWorld(true);
  alignFeet(model);

  const buckets: Record<BakeSlot, THREE.BufferGeometry[]> = {
    skin: [],
    hair: [],
    top: [],
    bottom: [],
    shoes: [],
    eyes: [],
  };
  const maps: Partial<Record<BakeSlot, THREE.Texture | null>> = {};

  model.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.visible) return;
    const mat0 = Array.isArray(obj.material) ? obj.material[0] : obj.material;
    const slot = clothSlot(obj.name, mat0?.name ?? '');
    if (!slot) return;
    const geo = freezeMesh(obj);
    if (!geo) return;
    buckets[slot].push(geo);
    if (maps[slot] === undefined && mat0 instanceof THREE.MeshStandardMaterial) {
      maps[slot] = mat0.map;
    }
  });

  const geos: Partial<Record<BakeSlot, THREE.BufferGeometry>> = {};
  for (const slot of BAKE_SLOTS) {
    const merged = mergeSlot(buckets[slot]);
    if (merged) geos[slot] = merged;
  }

  mixer.stopAllAction();
  mixer.uncacheRoot(model);
  releaseClone(model);

  if (!Object.keys(geos).length) return null;
  const bound = geos.skin ?? geos.top ?? Object.values(geos)[0]!;
  bound.computeBoundingBox();
  const headY = bound.boundingBox?.max.y ?? 1.7;

  return { id, geos, maps, headY };
}

function mergeSlot(list: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (!list.length) return null;
  if (list.length === 1) {
    list[0]!.computeVertexNormals();
    list[0]!.computeBoundingBox();
    return list[0]!;
  }
  const merged = mergeGeometries(list, false);
  for (const geo of list) geo.dispose();
  if (!merged) return null;
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  return merged;
}

/** Posed vertices in world space, UVs kept, skeleton discarded. */
function freezeMesh(mesh: THREE.Mesh): THREE.BufferGeometry | null {
  const src = mesh.geometry;
  const pos = src.getAttribute('position');
  if (!pos) return null;
  const count = pos.count;
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const v = new THREE.Vector3();
  const uv = src.getAttribute('uv');
  for (let i = 0; i < count; i++) {
    mesh.getVertexPosition(i, v);
    v.applyMatrix4(mesh.matrixWorld);
    const o = i * 3;
    positions[o] = v.x;
    positions[o + 1] = v.y;
    positions[o + 2] = v.z;
    if (uv) {
      uvs[i * 2] = uv.getX(i);
      uvs[i * 2 + 1] = uv.getY(i);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (src.index) geo.setIndex(src.index.clone());
  return geo;
}

function alignFeet(model: THREE.Object3D): void {
  const box = new THREE.Box3();
  const vertex = new THREE.Vector3();
  model.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.visible) return;
    const positions = obj.geometry.getAttribute('position');
    if (!positions) return;
    for (let i = 0; i < positions.count; i++) {
      obj.getVertexPosition(i, vertex);
      vertex.applyMatrix4(obj.matrixWorld);
      box.expandByPoint(vertex);
    }
  });
  if (Number.isFinite(box.min.y)) {
    model.position.y -= box.min.y;
    model.updateMatrixWorld(true);
  }
}

function releaseClone(model: THREE.Object3D): void {
  model.traverse((obj) => {
    if (obj instanceof THREE.SkinnedMesh) obj.skeleton?.dispose();
  });
}

function clothSlot(meshName: string, matName: string): BakeSlot | null {
  const blob = `${meshName} ${matName}`.toLowerCase();
  if (/accessory/i.test(blob)) return null;
  if (/shoe/.test(blob)) return 'shoes';
  if (/eyebrow/.test(blob)) return 'hair';
  if (/short01|ponytail|hair root|hairline|scalp/.test(blob)) return 'hair';
  if (/low-poly/.test(blob)) return 'eyes';
  if (/trouser|\.bottom| original bottom/.test(blob)) return 'bottom';
  if (/top|fabric|elegantsuit|satin/.test(blob)) return 'top';
  if (matName.endsWith('.body') || /\.body/.test(blob)) return 'skin';
  return null;
}
