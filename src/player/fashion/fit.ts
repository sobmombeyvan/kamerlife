import * as THREE from 'three';
import type { AttachBone } from './catalog';

/** Idle-pose measurements in rig space (Y up, face toward +Z). */
export type RigFit = {
  rest: Partial<Record<AttachBone, THREE.Matrix4>>;
  skull: { cx: number; cy: number; cz: number; rx: number; ry: number; rz: number };
  eyeY: number;
  eyeFrontZ: number;
  neckY: number;
  neckZ: number;
  chestY: number;
  chestFrontZ: number;
  chestBackZ: number;
  shoulderX: number;
  hipY: number;
  hipFrontZ: number;
  hipX: number;
  shoulderTopY: number;
  hand: THREE.Vector3;
  wrist: THREE.Vector3;
  wristR: number;
  forearm: THREE.Vector3;
};

const SKIP = /short01|ponytail|hair|scalp|eyebrow|eyelash|low-poly|teeth|tongue|accessory/i;
const BONES: AttachBone[] = ['head', 'spine_03', 'spine_02', 'hand_r', 'lowerarm_l'];

/** Call with the idle pose applied and matrices updated. */
export function measureFit(model: THREE.Object3D): RigFit | null {
  model.updateMatrixWorld(true);
  const toRig = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const at = (name: string): THREE.Vector3 | null => {
    const bone = model.getObjectByName(name);
    if (!bone) return null;
    return new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld).applyMatrix4(toRig);
  };
  const head = at('head');
  const neck = at('neck_01');
  const spine = at('spine_03');
  const pelvis = at('pelvis');
  const handR = at('hand_r');
  const handL = at('hand_l');
  const elbowL = at('lowerarm_l');
  if (!head || !neck || !spine || !pelvis || !handR || !handL || !elbowL) return null;

  const rest: RigFit['rest'] = {};
  for (const name of BONES) {
    const bone = model.getObjectByName(name);
    if (bone) rest[name] = new THREE.Matrix4().multiplyMatrices(toRig, bone.matrixWorld);
  }

  let eyeY = 0;
  let eyeN = 0;
  let eyeFrontZ = -Infinity;
  let top = -Infinity;
  let back = Infinity;
  let halfX = 0;
  let chestFront = -Infinity;
  let chestBack = Infinity;
  let shoulderX = 0;
  let hipFront = -Infinity;
  let hipX = 0;
  const chestY = spine.y + 0.08;
  const shoulderY = neck.y - 0.07;
  const hipY = pelvis.y + 0.04;
  const wrist = handL.clone().lerp(elbowL, 0.14);
  const forearm = handL.clone().sub(elbowL).normalize();
  let wristR = 0.026;
  let shoulderTopY = -Infinity;
  const rel = new THREE.Vector3();
  const v = new THREE.Vector3();
  const toRigMesh = new THREE.Matrix4();

  model.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.visible) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const label = `${obj.name} ${mats.map((m) => m.name).join(' ')}`;
    const isEye = /low-poly/i.test(label);
    const isBody = mats.some((m) => m.name.endsWith('.body'));
    if (!isEye && SKIP.test(label)) return;
    const pos = obj.geometry.getAttribute('position');
    if (!pos) return;
    toRigMesh.multiplyMatrices(toRig, obj.matrixWorld);
    for (let i = 0; i < pos.count; i += 2) {
      obj.getVertexPosition(i, v);
      v.applyMatrix4(toRigMesh);
      if (isEye) {
        eyeY += v.y;
        eyeN += 1;
        eyeFrontZ = Math.max(eyeFrontZ, v.z);
        continue;
      }
      if (isBody && v.y > head.y + 0.02) {
        top = Math.max(top, v.y);
        back = Math.min(back, v.z);
      }
      if (Math.abs(v.y - chestY) < 0.04 && Math.abs(v.x) < 0.1) {
        chestFront = Math.max(chestFront, v.z);
        chestBack = Math.min(chestBack, v.z);
      }
      if (Math.abs(v.y - shoulderY) < 0.03 && Math.abs(v.x) < 0.26) shoulderX = Math.max(shoulderX, Math.abs(v.x));
      const ax = Math.abs(v.x);
      if (ax > 0.07 && ax < 0.12 && Math.abs(v.z - neck.z) < 0.04 && v.y < neck.y) {
        shoulderTopY = Math.max(shoulderTopY, v.y);
      }
      rel.copy(v).sub(wrist);
      const along = rel.dot(forearm);
      if (Math.abs(along) < 0.012) {
        const radial = rel.addScaledVector(forearm, -along).length();
        if (radial < 0.07) wristR = Math.max(wristR, radial);
      }
      if (Math.abs(v.y - hipY) < 0.04) {
        if (Math.abs(v.x) < 0.12) hipFront = Math.max(hipFront, v.z);
        if (Math.abs(v.x) < 0.24) hipX = Math.max(hipX, Math.abs(v.x));
      }
    }
  });
  if (eyeN === 0 || !Number.isFinite(top)) return null;
  eyeY /= eyeN;

  model.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.visible) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    if (!mats.some((m) => m.name.endsWith('.body'))) return;
    const pos = obj.geometry.getAttribute('position');
    toRigMesh.multiplyMatrices(toRig, obj.matrixWorld);
    for (let i = 0; i < pos.count; i += 2) {
      obj.getVertexPosition(i, v);
      v.applyMatrix4(toRigMesh);
      if (v.y > eyeY && v.z < eyeFrontZ) halfX = Math.max(halfX, Math.abs(v.x));
    }
  });

  const cy = eyeY + 0.005;
  const front = eyeFrontZ + 0.004;
  return {
    rest,
    skull: {
      cx: 0,
      cy,
      cz: (front + back) / 2,
      rx: halfX,
      ry: top - cy,
      rz: (front - back) / 2,
    },
    eyeY,
    eyeFrontZ,
    neckY: neck.y,
    neckZ: neck.z,
    chestY,
    chestFrontZ: Number.isFinite(chestFront) ? chestFront : spine.z + 0.11,
    chestBackZ: Number.isFinite(chestBack) ? chestBack : spine.z - 0.11,
    shoulderX: shoulderX || 0.19,
    hipY,
    hipFrontZ: Number.isFinite(hipFront) ? hipFront : pelvis.z + 0.1,
    hipX: hipX || 0.17,
    shoulderTopY: Number.isFinite(shoulderTopY) ? shoulderTopY : neck.y - 0.05,
    hand: handR,
    wrist,
    wristR,
    forearm,
  };
}

/** Parents obj to a bone so that, in the idle pose, it sits at `rigMatrix` in rig space. */
export function attachToBone(
  model: THREE.Object3D,
  fit: RigFit,
  boneName: AttachBone,
  obj: THREE.Object3D,
  rigMatrix: THREE.Matrix4,
): boolean {
  const bone = model.getObjectByName(boneName);
  const rest = fit.rest[boneName];
  if (!bone || !rest) return false;
  const local = new THREE.Matrix4().copy(rest).invert().multiply(rigMatrix);
  local.decompose(obj.position, obj.quaternion, obj.scale);
  bone.add(obj);
  return true;
}
