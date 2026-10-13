import * as THREE from 'three';
import { HOME_FLOOR_TOP } from '../home/homeLayout';

export type ActivityKind = 'sleep' | 'cook' | 'tv' | 'wash' | 'clothes' | 'work';

type LimbBag = {
  legL?: THREE.Group;
  legR?: THREE.Group;
  shinL?: THREE.Group;
  shinR?: THREE.Group;
  armL?: THREE.Group;
  armR?: THREE.Group;
  foreL?: THREE.Group;
  foreR?: THREE.Group;
  body?: THREE.Group;
  head?: THREE.Group;
  hipL?: THREE.Group;
  hipR?: THREE.Group;
};

function limbs(player: THREE.Object3D): LimbBag {
  const u = player.userData;
  return {
    legL: u.legL,
    legR: u.legR,
    shinL: u.shinL,
    shinR: u.shinR,
    armL: u.armL,
    armR: u.armR,
    foreL: u.foreL,
    foreR: u.foreR,
    body: u.body,
    head: u.head,
    hipL: u.hipL,
    hipR: u.hipR,
  };
}

function lerpRot(obj: THREE.Group | undefined, x: number, y: number, z: number, a: number): void {
  if (!obj) return;
  obj.rotation.x = THREE.MathUtils.lerp(obj.rotation.x, x, a);
  obj.rotation.y = THREE.MathUtils.lerp(obj.rotation.y, y, a);
  obj.rotation.z = THREE.MathUtils.lerp(obj.rotation.z, z, a);
}

/**
 * Procedural home-activity poses for the articulated avatar.
 */
export class PlayerActivity {
  kind: ActivityKind | null = null;
  private t = 0;
  private readonly savedPos = new THREE.Vector3();
  private savedYaw = 0;
  private snapX = 0;
  private snapZ = 0;
  private faceYaw = 0;

  get active(): boolean {
    return this.kind !== null;
  }

  start(
    player: THREE.Object3D,
    kind: ActivityKind,
    snapX: number,
    snapZ: number,
    faceYaw: number,
  ): void {
    this.kind = kind;
    this.t = 0;
    this.savedPos.copy(player.position);
    this.savedYaw = player.rotation.y;
    this.snapX = snapX;
    this.snapZ = snapZ;
    this.faceYaw = faceYaw;
    player.position.x = snapX;
    player.position.z = snapZ;
    player.position.y = HOME_FLOOR_TOP;
    player.rotation.y = faceYaw;
  }

  /** Call every frame while busy. */
  update(player: THREE.Object3D, dt: number): void {
    if (!this.kind) return;
    this.t += dt;
    const L = limbs(player);
    const a = Math.min(1, dt * 8);
    const wave = this.t;

    // Hold snap during activity
    player.position.x = THREE.MathUtils.lerp(player.position.x, this.snapX, a);
    player.position.z = THREE.MathUtils.lerp(player.position.z, this.snapZ, a);
    player.rotation.y = this.faceYaw;

    const animator = player.userData.animator as { setActivity: (kind: string | null) => void; setLocomotion: (moving: boolean, running: boolean, dt: number, speed: number) => void } | undefined;
    if (animator) {
      animator.setActivity(this.kind);
      animator.setLocomotion(false, false, dt, 0);
      if (this.kind === 'sleep') {
        // Rig has no lying clip: tip the standing idle onto its back, head toward the pillows.
        player.rotation.order = 'YXZ';
        player.rotation.x = THREE.MathUtils.lerp(player.rotation.x, -Math.PI / 2, a);
        player.position.y = THREE.MathUtils.lerp(player.position.y, HOME_FLOOR_TOP + 0.5, a);
      }
      return;
    }

    switch (this.kind) {
      case 'sleep':
        this.poseSleep(player, L, a, wave);
        break;
      case 'cook':
        this.poseCook(player, L, a, wave);
        break;
      case 'tv':
        this.poseTv(player, L, a, wave);
        break;
      case 'wash':
        this.poseWash(player, L, a, wave);
        break;
      case 'clothes':
        this.poseClothes(player, L, a, wave);
        break;
      case 'work':
        this.poseCook(player, L, a, wave);
        break;
    }
  }

  stop(player: THREE.Object3D): void {
    if (!this.kind) return;
    const animator = player.userData.animator as { setActivity: (kind: string | null) => void } | undefined;
    animator?.setActivity(null);
    const L = limbs(player);
    // Stand upright again near activity spot (don't teleport across room)
    player.position.y = HOME_FLOOR_TOP;
    player.rotation.x = 0;
    player.rotation.z = 0;
    if (L.body) {
      L.body.position.set(0, 0, 0);
      L.body.rotation.set(0, 0, 0);
    }
    if (L.head) L.head.rotation.set(0, 0, 0);
    for (const g of [L.legL, L.legR, L.shinL, L.shinR, L.armL, L.armR, L.foreL, L.foreR, L.hipL, L.hipR]) {
      if (g) g.rotation.set(0, 0, 0);
    }
    this.kind = null;
    this.t = 0;
    void this.savedPos;
    void this.savedYaw;
  }

  private poseSleep(player: THREE.Object3D, L: LimbBag, a: number, t: number): void {
    // Lie on back on the bed
    player.position.y = THREE.MathUtils.lerp(player.position.y, 0.55, a);
    if (L.body) {
      L.body.rotation.x = THREE.MathUtils.lerp(L.body.rotation.x, -Math.PI / 2, a);
      L.body.position.y = THREE.MathUtils.lerp(L.body.position.y, 0.15, a);
      // Soft breathing
      L.body.position.z = Math.sin(t * 1.6) * 0.02;
    }
    lerpRot(L.legL, 0.08, 0, 0.05, a);
    lerpRot(L.legR, 0.05, 0, -0.05, a);
    lerpRot(L.shinL, 0.1, 0, 0, a);
    lerpRot(L.shinR, 0.08, 0, 0, a);
    lerpRot(L.armL, -0.15, 0, 0.35, a);
    lerpRot(L.armR, -0.1, 0, -0.35, a);
    lerpRot(L.foreL, 0.4, 0, 0, a);
    lerpRot(L.foreR, 0.35, 0, 0, a);
    if (L.head) {
      L.head.rotation.x = THREE.MathUtils.lerp(L.head.rotation.x, 0.15, a);
      L.head.rotation.z = Math.sin(t * 0.8) * 0.03;
    }
  }

  private poseCook(player: THREE.Object3D, L: LimbBag, a: number, t: number): void {
    player.position.y = 0;
    if (L.body) {
      L.body.rotation.x = THREE.MathUtils.lerp(L.body.rotation.x, 0.18, a);
      L.body.position.y = Math.sin(t * 6) * 0.02;
    }
    // Stirring motion
    const stir = Math.sin(t * 8);
    lerpRot(L.armR, -0.9 + stir * 0.35, 0.2, -0.4, a);
    lerpRot(L.foreR, 0.9 + stir * 0.4, 0, 0, a);
    lerpRot(L.armL, -0.5, -0.15, 0.25, a);
    lerpRot(L.foreL, 0.7, 0, 0, a);
    lerpRot(L.legL, 0.05, 0, 0, a);
    lerpRot(L.legR, -0.05, 0, 0, a);
    if (L.head) L.head.rotation.x = THREE.MathUtils.lerp(L.head.rotation.x, 0.25, a);
  }

  private poseTv(player: THREE.Object3D, L: LimbBag, a: number, t: number): void {
    // Sit on sofa
    player.position.y = THREE.MathUtils.lerp(player.position.y, 0.35, a);
    if (L.body) {
      L.body.rotation.x = THREE.MathUtils.lerp(L.body.rotation.x, -0.12, a);
      L.body.position.y = THREE.MathUtils.lerp(L.body.position.y, -0.15, a);
    }
    lerpRot(L.hipL, 0, 0, 0, a);
    lerpRot(L.hipR, 0, 0, 0, a);
    lerpRot(L.legL, -1.35, 0.08, 0, a);
    lerpRot(L.legR, -1.3, -0.08, 0, a);
    lerpRot(L.shinL, 1.45, 0, 0, a);
    lerpRot(L.shinR, 1.4, 0, 0, a);
    lerpRot(L.armL, -0.35, 0, 0.4, a);
    lerpRot(L.armR, -0.3, 0, -0.35, a);
    lerpRot(L.foreL, 0.55, 0, 0, a);
    lerpRot(L.foreR, 0.5, 0, 0, a);
    if (L.head) {
      L.head.rotation.x = THREE.MathUtils.lerp(L.head.rotation.x, -0.05 + Math.sin(t * 0.7) * 0.04, a);
    }
  }

  private poseWash(player: THREE.Object3D, L: LimbBag, a: number, t: number): void {
    player.position.y = 0;
    const scrub = Math.sin(t * 10);
    if (L.body) {
      L.body.rotation.y = Math.sin(t * 3) * 0.08;
      L.body.position.y = Math.abs(Math.sin(t * 5)) * 0.03;
    }
    // Hands to head / washing
    lerpRot(L.armL, -2.2 + scrub * 0.15, 0.4, 0.6, a);
    lerpRot(L.armR, -2.15 - scrub * 0.15, -0.35, -0.55, a);
    lerpRot(L.foreL, 1.2, 0, 0, a);
    lerpRot(L.foreR, 1.15, 0, 0, a);
    lerpRot(L.legL, 0.1, 0, 0.08, a);
    lerpRot(L.legR, -0.05, 0, -0.08, a);
    if (L.head) {
      L.head.rotation.x = THREE.MathUtils.lerp(L.head.rotation.x, 0.35, a);
      L.head.rotation.z = scrub * 0.12;
    }
  }

  private poseClothes(player: THREE.Object3D, L: LimbBag, a: number, t: number): void {
    player.position.y = 0;
    const pull = Math.sin(t * 7);
    if (L.body) {
      L.body.rotation.x = THREE.MathUtils.lerp(L.body.rotation.x, 0.1, a);
      L.body.position.y = Math.abs(pull) * 0.04;
    }
    // Pull shirt over head
    lerpRot(L.armL, -2.4 + pull * 0.25, 0.5, 0.3, a);
    lerpRot(L.armR, -2.35 - pull * 0.25, -0.5, -0.3, a);
    lerpRot(L.foreL, 1.4, 0, 0, a);
    lerpRot(L.foreR, 1.35, 0, 0, a);
    lerpRot(L.legL, 0.05, 0, 0, a);
    lerpRot(L.legR, -0.05, 0, 0, a);
    if (L.head) L.head.rotation.x = THREE.MathUtils.lerp(L.head.rotation.x, 0.4, a);
  }
}

/** Face direction toward a point from another (yaw). */
export function yawToward(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return Math.atan2(toX - fromX, toZ - fromZ);
}
