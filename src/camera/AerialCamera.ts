import * as THREE from 'three';
import { WorldConfig } from '../config/WorldConfig';
import { GraphicsConfig } from '../config/GraphicsConfig';
import type { Input } from '../core/Input';

/** Flight envelope of the drone view, in metres above the ground. */
const MIN_HEIGHT = 55;
const MAX_HEIGHT = 900;
/** Declination from the horizon: 0.2 skims the skyline, 1.4 is almost top-down. */
const MIN_PITCH = 0.22;
const MAX_PITCH = 1.4;

/**
 * Drone view of the city: low enough to read the streets, tilted enough to
 * show the skyline. WASD / ZQSD pan · molette ou +/- zoom · souris oriente · M quitte.
 */
export class AerialCamera {
  active = false;
  private height = 240;
  private lookX = 0;
  private lookZ = 0;
  private yaw = 0;
  private pitch = 0.62;
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
    this.height = 240;
    // Off-axis so streets run diagonally across the frame instead of straight up.
    this.yaw = 0.62;
    this.pitch = 0.62;

    this.savedFar = this.camera.far;
    this.camera.far = WorldConfig.worldHalfSize * 3.2;
    this.camera.fov = 50;
    this.camera.updateProjectionMatrix();

    // Keep light fog instead of disabling — huge fill-rate win
    if (this.scene.fog instanceof THREE.Fog) {
      this.savedFogNear = this.scene.fog.near;
      this.savedFogFar = this.scene.fog.far;
      // Fading before the world edge keeps the horizon clean instead of muddy.
      this.scene.fog.near = 180;
      this.scene.fog.far = WorldConfig.worldHalfSize * 1.1;
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
    this.pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, this.pitch - look.dy * 0.0025));

    const zoom = this.input.consumeZoom();
    // Proportional steps: one notch always feels like the same move, high or low.
    if (zoom !== 0) this.setHeight(this.height * (1 + zoom * 0.14));
    if (this.input.isKeyDown('Equal') || this.input.isKeyDown('NumpadAdd')) {
      this.setHeight(this.height * (1 - 1.1 * dt));
    }
    if (this.input.isKeyDown('Minus') || this.input.isKeyDown('NumpadSubtract')) {
      this.setHeight(this.height * (1 + 1.1 * dt));
    }

    const axes = this.input.getMoveAxes();
    const speed = (this.height * 0.3 + 30) * (this.input.isRunning() ? 2.4 : 1);
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    this.lookX += (rightX * axes.x + forwardX * -axes.z) * speed * dt;
    this.lookZ += (rightZ * axes.x + forwardZ * -axes.z) * speed * dt;

    const bound = WorldConfig.worldHalfSize + 200;
    this.lookX = THREE.MathUtils.clamp(this.lookX, -bound, bound);
    this.lookZ = THREE.MathUtils.clamp(this.lookZ, -bound, bound);

    // Set back by the declination angle, so the pitch reads as a real tilt.
    const horiz = this.height / Math.tan(this.pitch);
    this.desired.set(
      this.lookX + Math.sin(this.yaw) * horiz,
      this.height,
      this.lookZ + Math.cos(this.yaw) * horiz,
    );

    const alpha = 1 - Math.exp(-6 * dt);
    this.camera.position.lerp(this.desired, alpha);
    // Aiming above the ground keeps the skyline in frame instead of only roofs.
    this.camera.lookAt(this.lookX, this.height * 0.08, this.lookZ);
  }

  private setHeight(v: number): void {
    this.height = THREE.MathUtils.clamp(v, MIN_HEIGHT, MAX_HEIGHT);
  }
}
