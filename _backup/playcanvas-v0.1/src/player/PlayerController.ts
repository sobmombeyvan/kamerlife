import * as pc from 'playcanvas';
import { GameConfig } from '../game/GameConfig';
import type { InputManager } from '../input/InputManager';
import type { CollisionWorld } from '../world/CollisionWorld';
import type { ThirdPersonCamera } from './ThirdPersonCamera';
import type { LoadedCharacter } from './CharacterLoader';

export class PlayerController {
  private velocityY = 0;
  private grounded = true;
  private readonly moveDir = new pc.Vec3();
  readonly entity: pc.Entity;

  constructor(
    private readonly character: LoadedCharacter,
    private readonly input: InputManager,
    private readonly camera: ThirdPersonCamera,
    private readonly collisions: CollisionWorld,
  ) {
    this.entity = character.entity;
    this.entity.setPosition(0, 0, 8);
  }

  update(dt: number): void {
    const axes = this.input.getMoveAxes();
    const running = this.input.isRunning();
    const speed = running ? GameConfig.runSpeed : GameConfig.walkSpeed;

    const yaw = this.camera.getYaw();
    const forwardX = Math.sin(yaw);
    const forwardZ = Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    this.moveDir.set(
      rightX * axes.x + forwardX * -axes.z,
      0,
      rightZ * axes.x + forwardZ * -axes.z,
    );

    const moving = this.moveDir.length() > 0.05;
    if (moving) {
      this.moveDir.normalize();
      const pos = this.entity.getPosition();
      let nextX = pos.x + this.moveDir.x * speed * dt;
      let nextZ = pos.z + this.moveDir.z * speed * dt;
      const resolved = this.collisions.resolveHorizontal(
        nextX,
        nextZ,
        GameConfig.playerRadius,
        pos.y,
        GameConfig.playerHeight,
      );
      nextX = resolved.x;
      nextZ = resolved.z;

      const faceYaw = Math.atan2(this.moveDir.x, this.moveDir.z);
      this.entity.setPosition(nextX, pos.y, nextZ);
      this.entity.setEulerAngles(0, (faceYaw * 180) / Math.PI, 0);
    }

    if (this.input.consumeJump() && this.grounded) {
      this.velocityY = GameConfig.jumpSpeed;
      this.grounded = false;
    }

    this.velocityY -= GameConfig.gravity * dt;
    const pos = this.entity.getPosition();
    let y = pos.y + this.velocityY * dt;
    if (y <= 0) {
      y = 0;
      this.velocityY = 0;
      this.grounded = true;
    }
    this.entity.setPosition(pos.x, y, pos.z);

    if (!this.grounded) {
      this.character.setLocomotion('idle');
    } else if (!moving) {
      this.character.setLocomotion('idle');
    } else if (running) {
      this.character.setLocomotion('run');
    } else {
      this.character.setLocomotion('walk');
    }
  }
}
