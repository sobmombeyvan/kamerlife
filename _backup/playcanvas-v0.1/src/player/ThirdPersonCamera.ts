import * as pc from 'playcanvas';
import { GameConfig } from '../game/GameConfig';
import type { CollisionWorld } from '../world/CollisionWorld';
import type { InputManager } from '../input/InputManager';

export class ThirdPersonCamera {
  private yaw = 0;
  private pitch = 0.25;
  private readonly desiredOffset = new pc.Vec3();
  private readonly lookTarget = new pc.Vec3();
  private readonly rayDir = new pc.Vec3();
  readonly entity: pc.Entity;

  constructor(
    app: pc.AppBase,
    private readonly input: InputManager,
    private readonly collisions: CollisionWorld,
  ) {
    this.entity = new pc.Entity('camera');
    this.entity.addComponent('camera', {
      clearColor: new pc.Color(
        GameConfig.clearColor.r,
        GameConfig.clearColor.g,
        GameConfig.clearColor.b,
      ),
      farClip: 220,
      nearClip: 0.1,
      fov: 55,
    });
    // Initial framing before the first update tick
    this.entity.setPosition(0, 3.2, 12.5);
    this.entity.lookAt(0, 1.2, 8);
    app.root.addChild(this.entity);
  }

  update(target: pc.Entity, dt: number): void {
    void dt;
    const look = this.input.consumeLookDelta();
    this.yaw -= look.dx * GameConfig.cameraSensitivity;
    this.pitch -= look.dy * GameConfig.cameraSensitivity;
    this.pitch = Math.max(GameConfig.cameraMinPitch, Math.min(GameConfig.cameraMaxPitch, this.pitch));

    const pos = target.getPosition();
    this.lookTarget.set(pos.x, pos.y + GameConfig.cameraHeight, pos.z);

    const cosPitch = Math.cos(this.pitch);
    this.desiredOffset.set(
      Math.sin(this.yaw) * cosPitch * GameConfig.cameraDistance,
      Math.sin(this.pitch) * GameConfig.cameraDistance,
      Math.cos(this.yaw) * cosPitch * GameConfig.cameraDistance,
    );

    this.rayDir.copy(this.desiredOffset).normalize();
    const hit = this.collisions.raycast(this.lookTarget, this.rayDir, GameConfig.cameraDistance);
    let distance: number = GameConfig.cameraDistance;
    if (hit !== null) {
      distance = Math.max(1.1, hit - GameConfig.cameraCollisionPadding);
    }

    this.entity.setPosition(
      this.lookTarget.x + this.rayDir.x * distance,
      this.lookTarget.y + this.rayDir.y * distance,
      this.lookTarget.z + this.rayDir.z * distance,
    );
    this.entity.lookAt(this.lookTarget);
  }

  getYaw(): number {
    return this.yaw;
  }
}
