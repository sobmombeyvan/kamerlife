import * as THREE from 'three';
import { WorldConfig } from '../config/WorldConfig';
import type { Input } from '../core/Input';

export type CameraFollowOpts = {
  distance?: number;
  lookHeight?: number;
  /** Elevated isometric-style follow (home interior). */
  isometric?: boolean;
};

export class ThirdPersonCamera {
  yaw = 0;
  pitch = 0.2;
  private readonly desired = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();
  private isoBlend = 0;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly input: Input,
  ) {}

  update(target: THREE.Object3D, dt: number, opts?: CameraFollowOpts): void {
    const look = this.input.consumeLook();
    const sens = WorldConfig.camera.sensitivity;
    const iso = !!opts?.isometric;

    // Smooth blend in/out of isometric framing
    const blendTarget = iso ? 1 : 0;
    this.isoBlend += (blendTarget - this.isoBlend) * Math.min(1, dt * 4);

    if (iso) {
      // Prefer a high corner view; allow small orbit
      this.yaw -= look.dx * sens * 0.45;
      this.pitch = THREE.MathUtils.lerp(this.pitch, 0.92, Math.min(1, dt * 5));
      this.pitch = THREE.MathUtils.clamp(this.pitch, 0.72, 1.05);
      // Nudge toward classic NE isometric when nearly free
      const prefer = -Math.PI * 0.65;
      let dyaw = prefer - this.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      if (Math.abs(look.dx) < 0.5) this.yaw += dyaw * Math.min(1, dt * 1.2);
    } else {
      this.yaw -= look.dx * sens;
      this.pitch = Math.max(
        WorldConfig.camera.minPitch,
        Math.min(WorldConfig.camera.maxPitch, this.pitch - look.dy * sens),
      );
    }

    const distOutdoor = opts?.distance ?? WorldConfig.camera.distance;
    const distIso = opts?.distance ?? 12.5;
    const dist = THREE.MathUtils.lerp(distOutdoor, distIso, this.isoBlend);
    const lookH = THREE.MathUtils.lerp(opts?.lookHeight ?? 1.45, 0.55, this.isoBlend);
    const camH = THREE.MathUtils.lerp(WorldConfig.camera.height, 2.8, this.isoBlend);

    const horiz = dist * Math.cos(this.pitch);
    this.desired.set(
      target.position.x + Math.sin(this.yaw) * horiz,
      target.position.y + camH + Math.sin(this.pitch) * dist * (0.55 + 0.45 * this.isoBlend),
      target.position.z + Math.cos(this.yaw) * horiz,
    );

    const alpha = 1 - Math.exp(-WorldConfig.camera.lerp * dt);
    this.camera.position.lerp(this.desired, alpha);
    this.lookAt.set(target.position.x, target.position.y + lookH, target.position.z);
    this.camera.lookAt(this.lookAt);

    // Slight FOV tighten indoors for toy-like depth
    const targetFov = THREE.MathUtils.lerp(60, 48, this.isoBlend);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }
  }
}
