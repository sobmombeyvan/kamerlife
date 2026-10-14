import * as THREE from 'three';
import { WorldConfig } from '../config/WorldConfig';
import type { Input } from '../core/Input';
import type { CollisionSystem } from '../world/CollisionSystem';

/** How the camera frames the inside of a home. */
export type HomeView = 'plan' | 'iso' | 'shoulder';

export const HOME_VIEWS: ReadonlyArray<{ id: HomeView; label: string; short: string }> = [
  { id: 'iso', label: 'Vue 3/4', short: '3/4' },
  { id: 'plan', label: 'Vue du dessus', short: 'Dessus' },
  { id: 'shoulder', label: 'Vue épaule', short: 'Épaule' },
];

export function homeViewLabel(view: HomeView): string {
  return HOME_VIEWS.find((v) => v.id === view)?.label ?? 'Vue';
}

type Framing = { pitch: number; dist: number; fov: number; lookH: number; camH: number; focus: number };

/** Pitch, distance and lens per indoor framing. */
const HOME_FRAMING: Record<HomeView, Framing> = {
  plan: { pitch: 1.52, dist: 20, fov: 46, lookH: 0.35, camH: 0.15, focus: 1 },
  iso: { pitch: 0.86, dist: 11.5, fov: 50, lookH: 1.0, camH: 0.5, focus: 0 },
  shoulder: { pitch: 0.26, dist: 4.6, fov: 58, lookH: 1.45, camH: 1.5, focus: 0 },
};

/** Same three views, scaled for the street. */
const CITY_FRAMING: Record<HomeView, Framing> = {
  plan: { pitch: 1.38, dist: 36, fov: 50, lookH: 0.2, camH: 0.25, focus: 0 },
  iso: { pitch: 0.7, dist: 18, fov: 52, lookH: 1.15, camH: 0.9, focus: 0 },
  shoulder: { pitch: 0.22, dist: 7.2, fov: 60, lookH: 1.45, camH: 1.6, focus: 0 },
};

export type CameraFollowOpts = {
  distance?: number;
  lookHeight?: number;
  /** Indoor framing of the house. */
  isometric?: boolean;
  /** City-scale 3/4 and plan (not locked to the apartment). */
  outdoor?: boolean;
  /** Which indoor framing to use; defaults to the overhead plan. */
  homeView?: HomeView;
  /** Room point the indoor camera frames, blended with the player. */
  focusX?: number;
  focusZ?: number;
  /** Interior box around the focus point; keeps the eye-level view in the room. */
  roomHalfW?: number;
  roomHalfD?: number;
  roomHeight?: number;
};

export class ThirdPersonCamera {
  yaw = 0;
  pitch = 0.2;
  private indoorZoom = 1;
  private homeView: HomeView = 'iso';
  private readonly desired = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();
  private isoBlend = 0;
  /** 0 frames the face, 1 frames the whole body. */
  private creatorZoom = 0.72;
  private creatorPitch = 0.18;
  private creatorFocus: 'face' | 'body' = 'body';
  private creatorSnap = false;
  private collisions: CollisionSystem | null = null;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly input: Input,
  ) {}

  /** Keep the outdoor camera in front of walls between it and the player. */
  setCollisions(collisions: CollisionSystem): void {
    this.collisions = collisions;
  }

  /** Frames the apartment with the player's chosen indoor view. */
  beginIndoorView(view: HomeView = this.homeView): void {
    this.homeView = view;
    this.yaw = view === 'plan' ? 0 : -0.6;
    this.pitch = HOME_FRAMING[view].pitch;
    this.indoorZoom = 1;
    this.isoBlend = 1;
    // Wheel ticks spent outdoors must not snap the plan on the first indoor frame.
    this.input.consumeZoom();
  }

  /** 3/4, plan or shoulder in the street — keeps the current heading. */
  beginOutdoorView(view: HomeView): void {
    this.homeView = view;
    this.indoorZoom = 1;
    this.isoBlend = view === 'shoulder' ? 0 : 1;
    this.pitch = view === 'shoulder' ? 0.22 : CITY_FRAMING[view].pitch;
    this.input.consumeZoom();
  }

  /** Portrait framing while the player is built, like a character creator. */
  beginCreatorView(playerYaw: number): void {
    this.yaw = playerYaw;
    this.creatorPitch = 0.12;
    this.creatorZoom = 1;
    this.creatorFocus = 'body';
    this.isoBlend = 0;
    this.creatorSnap = true;
  }

  /** Face tab pulls in; body and clothes pull back. Wheel zoom still wins afterwards. */
  setCreatorFocus(focus: 'face' | 'body'): void {
    if (focus === this.creatorFocus) return;
    this.creatorFocus = focus;
    this.creatorZoom = focus === 'face' ? 0.08 : 1;
  }

  snapCreator(which: 'front' | 'left' | 'right' | 'back' | 'full' | 'side' | 'reset', playerYaw: number): void {
    if (which === 'reset' || which === 'full') {
      this.beginCreatorView(playerYaw);
      return;
    }
    const offset =
      which === 'front' ? 0 : which === 'left' ? -Math.PI / 2 : which === 'back' ? Math.PI : Math.PI / 2;
    this.yaw = playerYaw + offset;
  }

  endCreatorView(indoor: boolean): void {
    if (indoor) {
      this.beginIndoorView();
      return;
    }
    this.beginOutdoorView(this.homeView);
    if (this.homeView === 'shoulder') {
      this.camera.fov = 60;
      this.camera.updateProjectionMatrix();
    }
  }

  updateCreator(
    target: THREE.Object3D,
    dt: number,
    yawDelta: number,
    pitchDelta: number,
    zoomDelta: number,
    /** Eye height of the current rig, so taller bodies stay framed. */
    faceH = 1.52,
  ): void {
    this.isoBlend = 0;
    this.yaw -= yawDelta * 0.005;
    this.creatorPitch = THREE.MathUtils.clamp(this.creatorPitch - pitchDelta * 0.004, -0.15, 0.85);
    if (zoomDelta) {
      this.creatorZoom = THREE.MathUtils.clamp(this.creatorZoom + zoomDelta * 0.12, 0, 1);
    }
    const zoom = this.creatorZoom;
    const dist = THREE.MathUtils.lerp(1.15, 3.7, zoom);
    const lookH = THREE.MathUtils.lerp(faceH - 0.05, faceH * 0.64, Math.min(1, zoom / 0.6));
    const horiz = dist * Math.cos(this.creatorPitch);
    // Pan the subject into the open gap between the side panels.
    const bias = 0.38;
    const sideX = Math.cos(this.yaw) * bias;
    const sideZ = -Math.sin(this.yaw) * bias;
    this.desired.set(
      target.position.x + Math.sin(this.yaw) * horiz + sideX,
      target.position.y + lookH + Math.sin(this.creatorPitch) * dist * 0.55,
      target.position.z + Math.cos(this.yaw) * horiz + sideZ,
    );
    const alpha = this.creatorSnap ? 1 : 1 - Math.exp(-8 * dt);
    this.creatorSnap = false;
    this.camera.position.lerp(this.desired, alpha);
    this.lookAt.set(target.position.x + sideX, target.position.y + lookH, target.position.z + sideZ);
    this.camera.lookAt(this.lookAt);
    const fov = THREE.MathUtils.lerp(32, 44, zoom);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  update(target: THREE.Object3D, dt: number, opts?: CameraFollowOpts): void {
    const look = this.input.consumeLook();
    const sens = WorldConfig.camera.sensitivity;
    const iso = !!opts?.isometric;

    // Smooth blend in/out of isometric framing
    const blendTarget = iso ? 1 : 0;
    this.isoBlend += (blendTarget - this.isoBlend) * Math.min(1, dt * 4);

    const table = opts?.outdoor ? CITY_FRAMING : HOME_FRAMING;
    if (iso) {
      const view = opts?.homeView ?? this.homeView;
      if (view !== this.homeView) {
        this.homeView = view;
        this.indoorZoom = 1;
      }
      const frame = table[view];
      if (view === 'shoulder') {
        this.yaw -= look.dx * sens;
        this.pitch = THREE.MathUtils.clamp(this.pitch - look.dy * sens, -0.1, 1.2);
      } else {
        this.yaw -= look.dx * sens * 0.35;
        this.pitch = THREE.MathUtils.lerp(this.pitch, frame.pitch, Math.min(1, dt * 8));
      }
      const wheel = this.input.consumeZoom();
      if (wheel) {
        this.indoorZoom = THREE.MathUtils.clamp(this.indoorZoom + wheel * 0.08, 0.7, 1.5);
      }
    } else {
      this.yaw -= look.dx * sens;
      this.pitch = Math.max(
        WorldConfig.camera.minPitch,
        Math.min(WorldConfig.camera.maxPitch, this.pitch - look.dy * sens),
      );
    }

    const frame = table[this.homeView];
    const distOutdoor = opts?.isometric
      ? WorldConfig.camera.distance
      : (opts?.distance ?? WorldConfig.camera.distance);
    const distIndoor = opts?.isometric ? (opts.distance ?? frame.dist) * this.indoorZoom : distOutdoor;
    const dist = THREE.MathUtils.lerp(distOutdoor, distIndoor, this.isoBlend);
    const lookOutdoor = opts?.isometric ? 1.45 : (opts?.lookHeight ?? 1.45);
    const lookIndoor = opts?.isometric ? (opts.lookHeight ?? frame.lookH) : lookOutdoor;
    const lookH = THREE.MathUtils.lerp(lookOutdoor, lookIndoor, this.isoBlend);
    const camH = THREE.MathUtils.lerp(WorldConfig.camera.height, frame.camH, this.isoBlend);
    // The plan frames the room, the shoulder view stays on the player.
    const focusBlend = this.isoBlend * frame.focus;
    const focusX = opts?.focusX ?? target.position.x;
    const focusZ = opts?.focusZ ?? target.position.z;
    const lookX = THREE.MathUtils.lerp(target.position.x, focusX, focusBlend);
    const lookZ = THREE.MathUtils.lerp(target.position.z, focusZ, focusBlend);

    const horiz = dist * Math.cos(this.pitch);
    const lift = THREE.MathUtils.lerp(0.55, 1, this.isoBlend);
    this.desired.set(
      lookX + Math.sin(this.yaw) * horiz,
      target.position.y + camH + Math.sin(this.pitch) * dist * lift,
      lookZ + Math.cos(this.yaw) * horiz,
    );

    const alpha = 1 - Math.exp(-WorldConfig.camera.lerp * dt);
    this.camera.position.lerp(this.desired, alpha);
    this.lookAt.set(lookX, target.position.y + lookH, lookZ);
    if (this.collisions && (this.isoBlend < 0.5 || this.homeView === 'shoulder' || (opts?.outdoor && this.homeView === 'iso'))) {
      const c = this.camera.position;
      const l = this.lookAt;
      const t = this.collisions.segmentFraction(l.x, l.y, l.z, c.x, c.y, c.z);
      if (t < 1) {
        const len = c.distanceTo(l);
        const k = Math.max(0.06, t - 0.35 / Math.max(len, 0.01));
        c.set(l.x + (c.x - l.x) * k, l.y + (c.y - l.y) * k, l.z + (c.z - l.z) * k);
      }
    }
    // Window openings have no collider, so the eye-level view would slip out of
    // the house through them: keep it inside the room box instead.
    if (this.homeView === 'shoulder' && this.isoBlend > 0.5 && opts?.roomHalfW && opts.roomHalfD) {
      const c = this.camera.position;
      c.x = THREE.MathUtils.clamp(c.x, focusX - opts.roomHalfW, focusX + opts.roomHalfW);
      c.z = THREE.MathUtils.clamp(c.z, focusZ - opts.roomHalfD, focusZ + opts.roomHalfD);
      if (opts.roomHeight) c.y = Math.min(c.y, target.position.y + opts.roomHeight);
    }
    this.camera.lookAt(this.lookAt);

    // Slight FOV tighten indoors for toy-like depth
    const targetFov = THREE.MathUtils.lerp(60, frame.fov, this.isoBlend);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }
  }
}
