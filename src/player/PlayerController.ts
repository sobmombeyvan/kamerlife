import * as THREE from 'three';
import { WorldConfig } from '../config/WorldConfig';
import type { Input } from '../core/Input';
import type { ThirdPersonCamera } from '../camera/ThirdPersonCamera';
import type { CollisionSystem } from '../world/CollisionSystem';
import type { PlayerAnimator } from './PlayerRig';

export class PlayerController {
  private vy = 0;
  private grounded = true;
  private walkTime = 0;
  private readonly move = new THREE.Vector3();
  moving = false;
  running = false;

  constructor(
    readonly object: THREE.Group,
    private readonly input: Input,
    private readonly cameraRig: ThirdPersonCamera,
    private readonly collisions: CollisionSystem,
  ) {
    object.position.set(WorldConfig.spawn.x, WorldConfig.spawn.y, WorldConfig.spawn.z);
  }

  update(dt: number, opts?: { speedMul?: number; canRun?: boolean; groundY?: number }): void {
    const axes = this.input.getMoveAxes();
    const wantRun = this.input.isRunning() && (opts?.canRun ?? true);
    const mul = opts?.speedMul ?? 1;
    const speed = (wantRun ? WorldConfig.player.runSpeed : WorldConfig.player.walkSpeed) * mul;
    const yaw = this.cameraRig.yaw;

    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    this.move.set(rightX * axes.x + forwardX * -axes.z, 0, rightZ * axes.x + forwardZ * -axes.z);

    const moving = this.move.lengthSq() > 0.0025;
    this.moving = moving;
    this.running = moving && wantRun;
    if (moving) {
      this.move.normalize();
      const nx = this.object.position.x + this.move.x * speed * dt;
      const nz = this.object.position.z + this.move.z * speed * dt;
      const resolved = this.collisions.resolve(
        nx,
        nz,
        WorldConfig.player.radius,
        this.object.position.y,
        WorldConfig.player.height,
      );
      this.object.position.x = resolved.x;
      this.object.position.z = resolved.z;
      this.turnToward(Math.atan2(this.move.x, this.move.z), dt);
      this.walkTime += dt * (wantRun ? 14 : 9);
      this.animateWalk(this.walkTime, wantRun ? 1.15 : 0.85, true, dt, speed);
    } else {
      this.animateWalk(this.walkTime, 0, false, dt, 0);
    }

    if (this.input.consumeJump() && this.grounded) {
      this.vy = WorldConfig.player.jumpSpeed;
      this.grounded = false;
    }

    const groundY = opts?.groundY ?? 0;
    this.vy -= WorldConfig.player.gravity * dt;
    this.object.position.y += this.vy * dt;
    if (this.object.position.y <= groundY) {
      this.object.position.y = groundY;
      this.vy = 0;
      this.grounded = true;
    }

    if (!this.grounded && !this.animator()) this.animateJumpPose();

    const bound = WorldConfig.worldHalfSize - 20;
    this.object.position.x = THREE.MathUtils.clamp(this.object.position.x, -bound, bound);
    this.object.position.z = THREE.MathUtils.clamp(this.object.position.z, -bound, bound);
  }

  private animator(): PlayerAnimator | undefined {
    return this.object.userData.animator as PlayerAnimator | undefined;
  }

  private turnToward(target: number, dt: number): void {
    let dy = target - this.object.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.object.rotation.y += dy * Math.min(1, dt * 8);
  }

  private animateWalk(t: number, amp: number, moving: boolean, dt: number, speed: number): void {
    const animator = this.animator();
    if (animator) {
      animator.setLocomotion(moving, this.running, dt, speed);
      return;
    }
    const legL = this.object.userData.legL as THREE.Group | undefined;
    const legR = this.object.userData.legR as THREE.Group | undefined;
    const shinL = this.object.userData.shinL as THREE.Group | undefined;
    const shinR = this.object.userData.shinR as THREE.Group | undefined;
    const armL = this.object.userData.armL as THREE.Group | undefined;
    const armR = this.object.userData.armR as THREE.Group | undefined;
    const foreL = this.object.userData.foreL as THREE.Group | undefined;
    const foreR = this.object.userData.foreR as THREE.Group | undefined;
    const body = this.object.userData.body as THREE.Group | undefined;
    const head = this.object.userData.head as THREE.Group | undefined;

    if (!moving || amp < 0.01) {
      const ease = 0.2;
      if (legL) legL.rotation.x *= 1 - ease;
      if (legR) legR.rotation.x *= 1 - ease;
      if (shinL) shinL.rotation.x *= 1 - ease;
      if (shinR) shinR.rotation.x *= 1 - ease;
      if (armL) armL.rotation.x *= 1 - ease;
      if (armR) armR.rotation.x *= 1 - ease;
      if (foreL) foreL.rotation.x = THREE.MathUtils.lerp(foreL.rotation.x, 0.15, ease);
      if (foreR) foreR.rotation.x = THREE.MathUtils.lerp(foreR.rotation.x, 0.15, ease);
      if (body) {
        body.position.y = THREE.MathUtils.lerp(body.position.y, 0, ease);
        body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, 0, ease);
      }
      if (head) head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, 0, ease);
      return;
    }

    const swing = Math.sin(t) * amp;
    const knee = Math.max(0, -Math.sin(t)) * amp * 0.9;
    const kneeR = Math.max(0, Math.sin(t)) * amp * 0.9;

    if (legL) legL.rotation.x = swing * 0.75;
    if (legR) legR.rotation.x = -swing * 0.75;
    if (shinL) shinL.rotation.x = knee;
    if (shinR) shinR.rotation.x = kneeR;

    if (armL) armL.rotation.x = -swing * 0.65;
    if (armR) armR.rotation.x = swing * 0.65;
    if (foreL) foreL.rotation.x = 0.25 + Math.abs(swing) * 0.2;
    if (foreR) foreR.rotation.x = 0.25 + Math.abs(swing) * 0.2;

    if (body) {
      body.position.y = Math.abs(Math.sin(t * 2)) * 0.035 * amp;
      body.rotation.z = Math.sin(t) * 0.04 * amp;
    }
    if (head) head.rotation.x = -Math.abs(Math.sin(t)) * 0.04 * amp;
  }

  private animateJumpPose(): void {
    const legL = this.object.userData.legL as THREE.Group | undefined;
    const legR = this.object.userData.legR as THREE.Group | undefined;
    const shinL = this.object.userData.shinL as THREE.Group | undefined;
    const shinR = this.object.userData.shinR as THREE.Group | undefined;
    const armL = this.object.userData.armL as THREE.Group | undefined;
    const armR = this.object.userData.armR as THREE.Group | undefined;
    if (legL) legL.rotation.x = 0.35;
    if (legR) legR.rotation.x = 0.25;
    if (shinL) shinL.rotation.x = 0.5;
    if (shinR) shinR.rotation.x = 0.4;
    if (armL) armL.rotation.x = -0.8;
    if (armR) armR.rotation.x = -0.6;
  }
}
