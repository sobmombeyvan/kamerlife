import * as THREE from 'three';
import { mat } from '../world/materials';
import { ensureOutfitApplied } from './PlayerOutfits';

function cloth(color: number): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
  return m;
}

/**
 * Procedural fallback used until the rigged GLB loads, and if that file is missing.
 * It is a block figure, not a scanned human.
 */
export function createPlayerAvatar(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'player';
  const body = new THREE.Group();
  root.add(body);

  const skin = mat(0x6b4423);
  const skinDark = mat(0x5a381c);
  const shirt = cloth(0x0f7660);
  const shirtDark = cloth(0x0a5446);
  shirtDark.userData.shirtDark = true;
  const pants = cloth(0x1e2a3a);
  const pantsSeam = cloth(0x15202c);
  const hair = mat(0x1a120c);
  const shoe = mat(0x1a1a1a);
  const shoeSole = mat(0xe8e8e8);
  const eyeWhite = mat(0xf5f0e8);
  const iris = mat(0x2c1810);
  const lip = mat(0x8b4a3a);

  // —— Pelvis / torso ——
  const hips = mesh(new THREE.SphereGeometry(0.2, 12, 10), pants, 0, 0.95, 0);
  hips.scale.set(1.15, 0.55, 0.85);
  body.add(hips);

  body.add(mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.22, 12), shirtDark, 0, 1.12, 0));

  const torso = mesh(new THREE.CapsuleGeometry(0.27, 0.48, 6, 12), shirt, 0, 1.42, 0.02);
  torso.scale.set(1.15, 1, 0.85);
  torso.castShadow = true;
  body.add(torso);

  const chest = mesh(new THREE.SphereGeometry(0.28, 12, 10), shirt, 0, 1.58, 0.04);
  chest.scale.set(1.25, 0.55, 0.75);
  body.add(chest);

  body.add(mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 16), shirtDark, 0, 1.78, 0.02));
  body.add(mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.16, 10), skin, 0, 1.88, 0.02));

  // —— Head ——
  const head = new THREE.Group();
  head.position.set(0, 2.08, 0.02);
  body.add(head);

  const skull = mesh(new THREE.SphereGeometry(0.24, 16, 14), skin, 0, 0.02, 0);
  skull.scale.set(1.02, 1.06, 1.0);
  skull.castShadow = true;
  head.add(skull);

  const jaw = mesh(new THREE.SphereGeometry(0.15, 12, 10), skin, 0, -0.1, 0.04);
  jaw.scale.set(1.08, 0.72, 0.98);
  head.add(jaw);

  const blush = mat(0xc47a72, 0.65);
  for (const side of [-1, 1] as const) {
    const ear = mesh(new THREE.SphereGeometry(0.05, 8, 6), skinDark, side * 0.22, 0, 0);
    ear.scale.set(0.42, 1.05, 0.65);
    head.add(ear);
    const cheek = mesh(new THREE.SphereGeometry(0.055, 8, 6), blush, side * 0.12, -0.04, 0.14);
    cheek.scale.set(1.15, 0.7, 0.65);
    head.add(cheek);
  }

  const nose = mesh(new THREE.SphereGeometry(0.032, 8, 6), skinDark, 0, -0.01, 0.22);
  nose.scale.set(0.75, 0.75, 0.95);
  head.add(nose);

  for (const side of [-1, 1] as const) {
    const white = mesh(new THREE.SphereGeometry(0.048, 10, 8), eyeWhite, side * 0.08, 0.04, 0.19);
    white.scale.set(1, 1.1, 0.7);
    head.add(white);
    head.add(mesh(new THREE.SphereGeometry(0.028, 8, 6), iris, side * 0.08, 0.042, 0.225));
    head.add(mesh(new THREE.SphereGeometry(0.01, 6, 4), eyeWhite, side * 0.065, 0.055, 0.24));
    const brow = mesh(new THREE.SphereGeometry(0.04, 8, 6), hair, side * 0.08, 0.1, 0.18);
    brow.scale.set(1.2, 0.28, 0.45);
    head.add(brow);
  }

  const smile = mesh(new THREE.TorusGeometry(0.045, 0.01, 6, 10, Math.PI), lip, 0, -0.08, 0.2);
  smile.rotation.set(Math.PI / 2, 0, Math.PI);
  head.add(smile);

  // Short textured hair / fade
  const hairCap = mesh(new THREE.SphereGeometry(0.225, 14, 12), hair, 0, 0.06, -0.01);
  hairCap.scale.set(1.02, 0.72, 1.0);
  head.add(hairCap);

  const topHair = mesh(new THREE.SphereGeometry(0.12, 10, 8), hair, 0, 0.16, -0.02);
  topHair.scale.set(1.35, 0.65, 1.15);
  head.add(topHair);

  for (const side of [-1, 1] as const) {
    const fade = mesh(new THREE.SphereGeometry(0.1, 8, 6), hair, side * 0.16, 0.02, -0.02);
    fade.scale.set(0.55, 0.9, 0.85);
    head.add(fade);
  }

  // —— Arms ——
  for (const side of [-1, 1] as const) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.38, 1.62, 0.02);
    body.add(shoulder);
    shoulder.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), shirt, 0, 0, 0));

    const upperArm = new THREE.Group();
    upperArm.position.set(side * 0.02, -0.02, 0);
    shoulder.add(upperArm);
    const ua = mesh(new THREE.CapsuleGeometry(0.075, 0.28, 4, 8), shirt, 0, -0.2, 0);
    ua.castShadow = true;
    upperArm.add(ua);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.42, 0);
    upperArm.add(elbow);
    elbow.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), skin, 0, 0, 0));

    const forearm = new THREE.Group();
    elbow.add(forearm);
    forearm.add(mesh(new THREE.CapsuleGeometry(0.06, 0.26, 4, 8), skin, 0, -0.18, 0));

    const hand = mesh(new THREE.SphereGeometry(0.055, 8, 6), skin, 0, -0.38, 0.02);
    hand.scale.set(0.9, 0.75, 1.15);
    forearm.add(hand);

    root.userData[side === -1 ? 'armL' : 'armR'] = upperArm;
    root.userData[side === -1 ? 'foreL' : 'foreR'] = forearm;
    root.userData[side === -1 ? 'shoulderL' : 'shoulderR'] = shoulder;
  }

  // —— Legs ——
  for (const side of [-1, 1] as const) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.14, 0.92, 0);
    body.add(hip);
    hip.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), pants, 0, 0, 0));

    const thigh = new THREE.Group();
    hip.add(thigh);
    const th = mesh(new THREE.CapsuleGeometry(0.1, 0.32, 4, 8), pants, 0, -0.24, 0);
    th.castShadow = true;
    thigh.add(th);
    thigh.add(mesh(new THREE.BoxGeometry(0.02, 0.35, 0.02), pantsSeam, side * 0.09, -0.24, 0));

    const knee = new THREE.Group();
    knee.position.set(0, -0.48, 0);
    thigh.add(knee);
    knee.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), pants, 0, 0, 0));

    const shin = new THREE.Group();
    knee.add(shin);
    shin.add(mesh(new THREE.CapsuleGeometry(0.08, 0.3, 4, 8), pants, 0, -0.22, 0));

    const ankle = new THREE.Group();
    ankle.position.set(0, -0.48, 0);
    shin.add(ankle);

    const foot = new THREE.Group();
    ankle.add(foot);
    foot.add(mesh(new THREE.BoxGeometry(0.14, 0.08, 0.28), shoe, 0, 0.02, 0.06));
    foot.add(mesh(new THREE.BoxGeometry(0.15, 0.04, 0.3), shoeSole, 0, -0.02, 0.06));
    const toe = mesh(new THREE.SphereGeometry(0.06, 8, 6), shoe, 0, 0.02, 0.18);
    toe.scale.set(1.15, 0.65, 0.95);
    foot.add(toe);

    root.userData[side === -1 ? 'legL' : 'legR'] = thigh;
    root.userData[side === -1 ? 'shinL' : 'shinR'] = shin;
    root.userData[side === -1 ? 'footL' : 'footR'] = foot;
    root.userData[side === -1 ? 'hipL' : 'hipR'] = hip;
  }

  root.userData.body = body;
  root.userData.head = head;
  root.userData.procedural = true;
  root.userData.skinMats = [skin];
  root.userData.skinShadeMats = [skinDark];
  root.userData.hairMats = [hair];
  root.userData.shirtMats = [shirt, shirtDark];
  root.userData.pantsMats = [pants, pantsSeam];
  ensureOutfitApplied(root);
  return root;
}

function mesh(
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  return m;
}
