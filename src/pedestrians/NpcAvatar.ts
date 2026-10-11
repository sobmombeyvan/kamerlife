import * as THREE from 'three';
import { mat } from '../world/materials';

const SKIN_TONES = [0x5c3a24, 0x70452f, 0x8d5a3a, 0x3e2723, 0xa67c52];
const SHIRTS = [0x167f6b, 0xc62828, 0x1565c0, 0xff8f00, 0x6a1b9a, 0xffffff, 0x37474f];
const PANTS = [0x27364a, 0x4e342e, 0x212121, 0x455a64, 0x1b5e20];

const torsoGeo = new THREE.CapsuleGeometry(0.26, 0.5, 2, 5);
const headGeo = new THREE.SphereGeometry(0.26, 8, 6);
const hairGeo = new THREE.SphereGeometry(0.27, 6, 5);
const limbGeo = new THREE.CapsuleGeometry(0.09, 0.32, 2, 4);
const legGeo = new THREE.CapsuleGeometry(0.11, 0.36, 2, 4);
const shoeGeo = new THREE.BoxGeometry(0.2, 0.1, 0.32);
const bagGeo = new THREE.BoxGeometry(0.28, 0.35, 0.12);

export type NpcRole =
  | 'pedestrian'
  | 'shopper'
  | 'employee'
  | 'security'
  | 'tourist'
  | 'student'
  | 'taxi_wait';

export function createNpcAvatar(seed: number, role: NpcRole = 'pedestrian'): THREE.Group {
  const root = new THREE.Group();
  root.name = `npc-${seed}`;
  const r = mulberry(seed);
  const skin = mat(SKIN_TONES[Math.floor(r() * SKIN_TONES.length)]!);
  let shirtColor = SHIRTS[Math.floor(r() * SHIRTS.length)]!;
  if (role === 'security') shirtColor = 0x1a237e;
  if (role === 'employee') shirtColor = 0x00897b;
  if (role === 'tourist') shirtColor = 0xff7043;
  const shirt = mat(shirtColor);
  const pants = mat(PANTS[Math.floor(r() * PANTS.length)]!);
  const hair = mat(0x211711);
  const shoe = mat(0x222222);

  const body = new THREE.Group();
  root.add(body);

  const scale = 0.92 + r() * 0.16;
  body.scale.setScalar(scale);

  const torso = new THREE.Mesh(torsoGeo, shirt);
  torso.position.y = 1.15;
  body.add(torso);

  const head = new THREE.Mesh(headGeo, skin);
  head.position.y = 1.85;
  body.add(head);

  const hairCap = new THREE.Mesh(hairGeo, hair);
  hairCap.position.set(0, 2.0, -0.02);
  hairCap.scale.set(1, 0.5 + r() * 0.3, 1);
  body.add(hairCap);

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

  if (role === 'shopper' && r() > 0.4) {
    const bag = new THREE.Mesh(bagGeo, mat(0x5d4037));
    bag.position.set(0.45, 1.05, 0.1);
    body.add(bag);
  }

  root.userData.body = body;
  root.userData.role = role;
  root.userData.procedural = true;
  return root;
}

function mulberry(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
