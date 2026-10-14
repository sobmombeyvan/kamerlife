import * as THREE from 'three';
import { mat } from '../world/materials';

/** Shared layout so crowd instances and unique NPCs match. */
export const CUTE = {
  torsoY: 1.02,
  headY: 1.56,
  hairY: 1.74,
  armX: 0.33,
  armY: 1.28,
  legX: 0.12,
  legY: 0.68,
  eyeX: 0.09,
  eyeY: 1.59,
  eyeZ: 0.268,
  irisZ: 0.298,
  blushX: 0.17,
  blushY: 1.50,
  blushZ: 0.22,
  smileY: 1.435,
  smileZ: 0.288,
} as const;

export const EYE_WHITE = 0xfff8ee;
export const IRIS_DARK = 0x2a1810;
export const LIP = 0xc46a62;
export const SHOE = 0x2a2420;

const skinShared = new Map<number, THREE.MeshStandardMaterial>();
function skinMat(color: number): THREE.MeshStandardMaterial {
  let m = skinShared.get(color);
  if (!m) {
    m = mat(color, 0.72, 0.04);
    skinShared.set(color, m);
  }
  return m;
}

export function blushColor(skin: number): number {
  const r = Math.min(255, ((skin >> 16) & 255) + 72);
  const g = Math.min(255, ((skin >> 8) & 255) + 14);
  const b = Math.min(255, (skin & 255) + 22);
  return (r << 16) | (g << 8) | b;
}

const geo = {
  torso: new THREE.CapsuleGeometry(0.22, 0.34, 6, 10),
  head: new THREE.SphereGeometry(0.30, 16, 12),
  hair: new THREE.SphereGeometry(0.27, 12, 8),
  cheek: new THREE.SphereGeometry(0.07, 8, 6),
  eye: new THREE.SphereGeometry(0.055, 10, 8),
  iris: new THREE.SphereGeometry(0.032, 8, 6),
  spark: new THREE.SphereGeometry(0.012, 6, 4),
  nose: new THREE.SphereGeometry(0.032, 8, 6),
  smile: new THREE.TorusGeometry(0.07, 0.014, 6, 10, Math.PI),
  limb: new THREE.CapsuleGeometry(0.075, 0.28, 4, 8),
  leg: new THREE.CapsuleGeometry(0.09, 0.30, 4, 8),
  shoe: new THREE.BoxGeometry(0.16, 0.08, 0.26),
  bag: new THREE.BoxGeometry(0.22, 0.28, 0.1),
  dress: new THREE.CylinderGeometry(0.18, 0.32, 0.85, 10, 1, true),
};

export type CuteColors = {
  skin: number;
  shirt: number;
  pants: number;
  hair: number;
  shoe?: number;
  scale?: number;
  hairH?: number;
  bag?: boolean;
  dress?: boolean;
};

/** Unique NPCs (vendors, police, staff) — cute round head, big eyes, smile. */
export function addCuteFigure(root: THREE.Group, c: CuteColors): void {
  const body = new THREE.Group();
  const scale = c.scale ?? 1;
  body.scale.setScalar(scale);
  root.add(body);

  const skin = skinMat(c.skin);
  const shirt = mat(c.shirt, 0.82, 0);
  const pants = mat(c.pants, 0.82, 0);
  const hairM = mat(c.hair, 0.78, 0);
  const shoeM = mat(c.shoe ?? SHOE, 0.7, 0.05);
  const blush = mat(blushColor(c.skin), 0.7, 0);
  const white = mat(EYE_WHITE, 0.35, 0);
  const iris = mat(IRIS_DARK, 0.4, 0);
  const lip = mat(LIP, 0.55, 0.04);

  const torso = new THREE.Mesh(geo.torso, c.dress ? pants : shirt);
  torso.position.y = CUTE.torsoY;
  torso.castShadow = true;
  body.add(torso);

  const head = new THREE.Group();
  head.position.set(0, CUTE.headY, 0.02);
  body.add(head);
  const skull = new THREE.Mesh(geo.head, skin);
  skull.castShadow = true;
  head.add(skull);

  const hairCap = new THREE.Mesh(geo.hair, hairM);
  hairCap.position.set(0, 0.2, -0.08);
  hairCap.scale.set(1.08, Math.min(0.55, c.hairH ?? 0.5), 0.9);
  head.add(hairCap);

  for (const side of [-1, 1] as const) {
    const cheek = new THREE.Mesh(geo.cheek, blush);
    cheek.position.set(side * CUTE.blushX, CUTE.blushY - CUTE.headY, CUTE.blushZ);
    cheek.scale.set(1.1, 0.75, 0.7);
    head.add(cheek);

    const eye = new THREE.Mesh(geo.eye, white);
    eye.position.set(side * CUTE.eyeX, CUTE.eyeY - CUTE.headY, CUTE.eyeZ);
    eye.scale.set(1, 1.08, 0.72);
    head.add(eye);
    const pupil = new THREE.Mesh(geo.iris, iris);
    pupil.position.set(side * CUTE.eyeX, CUTE.eyeY - CUTE.headY + 0.004, CUTE.irisZ - 0.02);
    head.add(pupil);
    const spark = new THREE.Mesh(geo.spark, white);
    spark.position.set(side * CUTE.eyeX - 0.018, CUTE.eyeY - CUTE.headY + 0.018, CUTE.irisZ);
    head.add(spark);
  }

  const nose = new THREE.Mesh(geo.nose, skin);
  nose.position.set(0, -0.04, 0.30);
  nose.scale.set(0.9, 0.85, 1.15);
  head.add(nose);

  const smile = new THREE.Mesh(geo.smile, lip);
  smile.position.set(0, CUTE.smileY - CUTE.headY, CUTE.smileZ);
  smile.rotation.set(Math.PI / 2, 0, Math.PI);
  head.add(smile);

  for (const side of [-1, 1] as const) {
    const arm = new THREE.Group();
    arm.position.set(side * CUTE.armX, CUTE.armY, 0);
    body.add(arm);
    const armMesh = new THREE.Mesh(geo.limb, shirt);
    armMesh.position.y = -0.2;
    arm.add(armMesh);
    root.userData[side === -1 ? 'armL' : 'armR'] = arm;

    const leg = new THREE.Group();
    leg.position.set(side * CUTE.legX, CUTE.legY, 0);
    body.add(leg);
    if (c.dress) {
      const shoeMesh = new THREE.Mesh(geo.shoe, shoeM);
      shoeMesh.position.set(0, -0.64, 0.05);
      leg.add(shoeMesh);
    } else {
      const legMesh = new THREE.Mesh(geo.leg, pants);
      legMesh.position.y = -0.24;
      leg.add(legMesh);
      const shoeMesh = new THREE.Mesh(geo.shoe, shoeM);
      shoeMesh.position.set(0, -0.48, 0.05);
      leg.add(shoeMesh);
    }
    root.userData[side === -1 ? 'legL' : 'legR'] = leg;
  }

  if (c.dress) {
    const skirt = new THREE.Mesh(geo.dress, pants);
    skirt.position.y = 0.58;
    body.add(skirt);
  }

  if (c.bag) {
    const bag = new THREE.Mesh(geo.bag, mat(0x5d4037, 0.8, 0));
    bag.position.set(0.4, 0.98, 0.08);
    body.add(bag);
  }

  root.userData.body = body;
  root.userData.head = head;
  root.userData.procedural = true;
}
