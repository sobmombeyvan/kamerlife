import * as THREE from 'three';
import { mat } from '../world/materials';
import { lodColors, roleOutfit, type NpcRole } from './roles';
import { BAKE_SLOTS, getNpcKit, type BakeSlot, type NpcKit } from './NpcBake';

export type { NpcRole } from './roles';

const torsoGeo = new THREE.CapsuleGeometry(0.26, 0.5, 4, 8);
const headGeo = new THREE.SphereGeometry(0.22, 12, 10);
const hairGeo = new THREE.SphereGeometry(0.23, 10, 8);
const limbGeo = new THREE.CapsuleGeometry(0.09, 0.32, 3, 6);
const legGeo = new THREE.CapsuleGeometry(0.11, 0.36, 3, 6);
const shoeGeo = new THREE.BoxGeometry(0.2, 0.1, 0.32);
const eyeGeo = new THREE.SphereGeometry(0.028, 8, 6);
const irisGeo = new THREE.SphereGeometry(0.016, 8, 6);

const pending: THREE.Group[] = [];

/** Landmark NPCs — baked Harper / Maya / Sam when the kit is ready, capsules until then. */
export function createNpcAvatar(seed: number, role: NpcRole = 'pedestrian'): THREE.Group {
  const root = new THREE.Group();
  root.name = `npc-${seed}`;
  root.userData.role = role;
  root.userData.npcRole = role;
  root.userData.npcSeed = seed;

  const kit = getNpcKit();
  if (kit) dressBaked(root, seed, role, kit);
  else {
    dressProcedural(root, seed, role);
    pending.push(root);
  }
  return root;
}

export function dressPendingNpcs(kit: NpcKit): void {
  for (const root of pending) {
    if (!root.parent && root.children.length === 0) continue;
    const seed = (root.userData.npcSeed as number) ?? 0;
    const role = (root.userData.npcRole as NpcRole) ?? 'pedestrian';
    dressBaked(root, seed, role, kit);
  }
  pending.length = 0;
}

function clearBody(root: THREE.Group): void {
  for (const child of [...root.children]) root.remove(child);
}

function slotHex(slot: BakeSlot, lod: ReturnType<typeof lodColors>): number {
  if (slot === 'skin') return lod.skin;
  if (slot === 'hair') return lod.hair;
  if (slot === 'top') return lod.shirt;
  if (slot === 'bottom') return lod.pants;
  if (slot === 'shoes') return lod.shoes;
  return 0xf5f0e8;
}

function dressBaked(root: THREE.Group, seed: number, role: NpcRole, kit: NpcKit): void {
  const paint = roleOutfit(role, seed);
  const bodyDef = kit.bodies[paint.characterId];
  if (!bodyDef) {
    if (!root.children.length) dressProcedural(root, seed, role);
    return;
  }
  clearBody(root);
  root.userData.procedural = false;
  root.userData.rigged = false;
  const lod = lodColors(paint);
  const body = new THREE.Group();
  body.scale.setScalar(paint.height);
  root.add(body);

  for (const slot of BAKE_SLOTS) {
    const geo = bodyDef.geos[slot];
    if (!geo) continue;
    const material = new THREE.MeshStandardMaterial({
      color: slotHex(slot, lod),
      roughness: slot === 'skin' ? 0.58 : slot === 'eyes' ? 0.28 : 0.78,
      metalness: 0,
      map: bodyDef.maps[slot] ?? null,
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = false;
    mesh.frustumCulled = true;
    body.add(mesh);
  }

  addRoleProps(body, role, bodyDef.headY);
  root.userData.body = body;
  root.userData.head = body;
}

function dressProcedural(root: THREE.Group, seed: number, role: NpcRole): void {
  clearBody(root);
  root.userData.procedural = true;
  const paint = roleOutfit(role, seed);
  const lod = lodColors(paint);
  const skin = mat(lod.skin, 0.72, 0.04);
  const shirt = mat(lod.shirt, 0.82, 0);
  const pants = mat(lod.pants, 0.82, 0);
  const hairM = mat(lod.hair, 0.78, 0);
  const shoe = mat(lod.shoes, 0.7, 0.05);
  const white = mat(0xf5f0e8, 0.35, 0);
  const iris = mat(0x2c1810, 0.4, 0);

  const body = new THREE.Group();
  root.add(body);

  const torso = new THREE.Mesh(torsoGeo, shirt);
  torso.position.y = 1.15;
  torso.castShadow = true;
  body.add(torso);

  const head = new THREE.Group();
  head.position.set(0, 1.72, 0.02);
  body.add(head);
  const skull = new THREE.Mesh(headGeo, skin);
  skull.castShadow = true;
  head.add(skull);
  const hairCap = new THREE.Mesh(hairGeo, hairM);
  hairCap.position.set(0, 0.1, -0.03);
  hairCap.scale.set(1.02, 0.55, 1);
  head.add(hairCap);
  for (const side of [-1, 1] as const) {
    const eye = new THREE.Mesh(eyeGeo, white);
    eye.position.set(side * 0.07, 0.02, 0.18);
    eye.scale.set(1, 1.05, 0.7);
    head.add(eye);
    const pupil = new THREE.Mesh(irisGeo, iris);
    pupil.position.set(side * 0.07, 0.02, 0.2);
    head.add(pupil);
  }

  for (const side of [-1, 1] as const) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.36, 1.45, 0);
    body.add(arm);
    const armMesh = new THREE.Mesh(limbGeo, shirt);
    armMesh.position.y = -0.22;
    arm.add(armMesh);
    root.userData[side === -1 ? 'armL' : 'armR'] = arm;

    const leg = new THREE.Group();
    leg.position.set(side * 0.14, 0.72, 0);
    body.add(leg);
    const legMesh = new THREE.Mesh(legGeo, pants);
    legMesh.position.y = -0.26;
    leg.add(legMesh);
    const shoeMesh = new THREE.Mesh(shoeGeo, shoe);
    shoeMesh.position.set(0, -0.52, 0.06);
    leg.add(shoeMesh);
    root.userData[side === -1 ? 'legL' : 'legR'] = leg;
  }

  addRoleProps(body, role, 1.72);
  root.userData.body = body;
  root.userData.head = head;
}

function addRoleProps(body: THREE.Group, role: NpcRole, headY: number): void {
  if (role === 'police' || role === 'security') {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.08, 12), mat(0xf5f5f5));
    cap.position.y = headY + 0.04;
    body.add(cap);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 12), mat(0x222222));
    brim.position.y = headY;
    body.add(brim);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.03, 12), mat(0xce1126));
    band.position.y = headY + 0.02;
    body.add(band);
  }
  if (role === 'vendor') {
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.28), mat(0x6d4c41, 0.8, 0));
    tray.position.set(0.32, 1.05, 0.1);
    body.add(tray);
  }
  if (role === 'military') {
    const beret = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mat(0x1b3d1a, 0.72, 0.04));
    beret.scale.set(1.18, 0.36, 1.08);
    beret.position.set(-0.03, headY + 0.07, 0.01);
    beret.rotation.z = 0.28;
    body.add(beret);
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.018, 8), mat(0xd4af37, 0.35, 0.55));
    badge.position.set(0.04, headY + 0.07, 0.11);
    body.add(badge);

    const rifle = new THREE.Group();
    rifle.position.set(0.26, 1.12, 0.14);
    rifle.rotation.set(0.12, 0.35, -0.55);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.22), mat(0x4a3728, 0.8, 0.05));
    stock.position.z = -0.28;
    rifle.add(stock);
    const bodyR = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.28), mat(0x2a2a2a, 0.45, 0.25));
    rifle.add(bodyR);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.42), mat(0x1a1a1a, 0.4, 0.45));
    barrel.position.z = 0.3;
    rifle.add(barrel);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.06), mat(0x222222, 0.5, 0.15));
    mag.position.set(0, -0.07, 0.02);
    rifle.add(mag);
    body.add(rifle);
  }
}
