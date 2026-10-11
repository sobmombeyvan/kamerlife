import * as THREE from 'three';
import { WorldConfig } from '../config/WorldConfig';
import { GraphicsConfig } from '../config/GraphicsConfig';
import type { Input } from '../core/Input';

/**
 * Free aerial overview of the whole city.
 * WASD / ZQSD pan · molette ou +/- zoom · souris oriente · V pour quitter.
 */
export class AerialCamera {
  active = false;
  private height = 900;
  private lookX = 0;
  private lookZ = 0;
  private yaw = 0;
  private pitch = 1.05;
  private readonly desired = new THREE.Vector3();
  private savedFar = GraphicsConfig.cameraFar;
  private savedFogNear = GraphicsConfig.fogNear;
  private savedFogFar = GraphicsConfig.fogFar;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly scene: THREE.Scene,
    private readonly input: Input,
  ) {}

  toggle(): void {
    if (this.active) this.exit();
    else this.enter();
  }

  enter(focusX = 0, focusZ = 0): void {
    this.active = true;
    this.lookX = focusX;
    this.lookZ = focusZ;
    this.height = Math.min(1100, WorldConfig.worldHalfSize * 0.85);
    this.yaw = 0;
    this.pitch = 1.12;

    this.savedFar = this.camera.far;
    this.camera.far = WorldConfig.worldHalfSize * 3.2;
    this.camera.fov = 55;
    this.camera.updateProjectionMatrix();

    // Keep light fog instead of disabling — huge fill-rate win
    if (this.scene.fog instanceof THREE.Fog) {
      this.savedFogNear = this.scene.fog.near;
      this.savedFogFar = this.scene.fog.far;
      this.scene.fog.near = 400;
      this.scene.fog.far = WorldConfig.worldHalfSize * 2.4;
    }

    if (document.pointerLockElement) document.exitPointerLock();
  }

  exit(): void {
    if (!this.active) return;
    this.active = false;
    this.camera.far = this.savedFar;
    this.camera.fov = 60;
    this.camera.updateProjectionMatrix();
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = this.savedFogNear;
      this.scene.fog.far = this.savedFogFar;
    }
  }

  update(dt: number): void {
    if (!this.active) return;

    const look = this.input.consumeLook();
    this.yaw -= look.dx * 0.003;
    this.pitch = Math.max(0.35, Math.min(1.45, this.pitch - look.dy * 0.0025));

    const zoom = this.input.consumeZoom();
    if (zoom !== 0) {
      this.height = Math.max(120, Math.min(1600, this.height + zoom * 40));
    }
    if (this.input.isKeyDown('Equal') || this.input.isKeyDown('NumpadAdd')) {
      this.height = Math.max(120, this.height - 220 * dt);
    }
    if (this.input.isKeyDown('Minus') || this.input.isKeyDown('NumpadSubtract')) {
      this.height = Math.min(1600, this.height + 220 * dt);
    }

    const axes = this.input.getMoveAxes();
    const speed = (this.height * 0.55 + 80) * (this.input.isRunning() ? 2.2 : 1);
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    this.lookX += (rightX * axes.x + forwardX * -axes.z) * speed * dt;
    this.lookZ += (rightZ * axes.x + forwardZ * -axes.z) * speed * dt;

    const bound = WorldConfig.worldHalfSize + 200;
    this.lookX = THREE.MathUtils.clamp(this.lookX, -bound, bound);
    this.lookZ = THREE.MathUtils.clamp(this.lookZ, -bound, bound);

    const horiz = this.height * Math.cos(this.pitch) * 0.35;
    this.desired.set(
      this.lookX + Math.sin(this.yaw) * horiz,
      this.height,
      this.lookZ + Math.cos(this.yaw) * horiz,
    );

    const alpha = 1 - Math.exp(-6 * dt);
    this.camera.position.lerp(this.desired, alpha);
    this.camera.lookAt(this.lookX, 0, this.lookZ);
  }
}
