import * as THREE from 'three';
import type { CollisionSystem } from '../world/CollisionSystem';
import type { FurnPose } from './HomeDecor';
import { HOME_INNER, HOME_SHELL } from './homeLayout';
import { PLAYER_HOUSE } from '../landmarks/PlayerHouse';
import { applyFurnitureCollision, placementFits } from './furnitureLayout';

const ROTATE_STEP = Math.PI / 4;
const RING_OK = 0xffc857;
const RING_BAD = 0xe0453a;

function clampFurnXZ(x: number, z: number): { x: number; z: number } {
  const { cx, cz } = PLAYER_HOUSE;
  return {
    x: Math.min(cx + HOME_INNER.x1 - 0.2, Math.max(cx + HOME_INNER.x0 + 0.2, x)),
    z: Math.min(cz + HOME_INNER.z1 - 0.2, Math.max(cz + HOME_INNER.z0 + 0.2, z)),
  };
}

/**
 * Drag and rotate shop furniture on the apartment floor.
 * Active only while the player is arranging the room.
 */
export class FurnitureEditor {
  enabled = false;
  private selected: THREE.Object3D | null = null;
  /** Mouse button is held on a piece. */
  private dragging = false;
  private readonly grab = new THREE.Vector2();
  private restY: number = HOME_SHELL.floorY;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly floorHit = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  private readonly floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -HOME_SHELL.floorY);
  private readonly ring: THREE.Mesh;
  private readonly start = { x: 0, z: 0, yaw: 0 };
  /** Called when a drop is refused and the piece snaps back. */
  onRejected: (() => void) | null = null;
  /** Delete / Backspace / X while carrying stores the piece. */
  onRemove: ((id: string) => void) | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: THREE.Camera,
    private readonly collisions: CollisionSystem,
    private readonly getHouse: () => THREE.Object3D | null,
    private readonly onPose: (id: string, pose: FurnPose, commit: boolean) => void,
  ) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.72, 28),
      new THREE.MeshBasicMaterial({
        color: RING_OK,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    ring.name = 'furn-select';
    ring.userData.pickIgnore = true;
    this.ring = ring;

    window.addEventListener('pointerdown', this.onPointerDown, true);
    window.addEventListener('pointermove', this.onPointerMove, true);
    window.addEventListener('pointerup', this.onPointerUp, true);
    window.addEventListener('pointercancel', this.onPointerUp, true);
    window.addEventListener('keydown', this.onKeyDown);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.clearSelection();
  }

  get isCarrying(): boolean {
    return this.dragging;
  }

  /** Decor shop rebuilds the meshes, so a grabbed piece no longer exists. */
  dropSelection(): void {
    this.clearSelection();
  }

  destroy(): void {
    this.clearSelection();
    window.removeEventListener('pointerdown', this.onPointerDown, true);
    window.removeEventListener('pointermove', this.onPointerMove, true);
    window.removeEventListener('pointerup', this.onPointerUp, true);
    window.removeEventListener('pointercancel', this.onPointerUp, true);
    window.removeEventListener('keydown', this.onKeyDown);
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled || e.repeat || !this.selected) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (e.code === 'KeyR') {
      e.preventDefault();
      this.selected.rotation.y += ROTATE_STEP;
      this.updateValidity();
      this.publish(false);
    } else if (e.code === 'Delete' || e.code === 'Backspace' || e.code === 'KeyX') {
      e.preventDefault();
      const id = this.selected.userData.furnId as string | undefined;
      this.clearSelection();
      if (id) this.onRemove?.(id);
    }
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (!this.enabled || e.button !== 0 || this.isHudControl(e.target)) return;
    const piece = this.pick(e);
    if (!piece) return;
    e.preventDefault();
    e.stopPropagation();
    this.grabPiece(piece, e);
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* The canvas can miss capture when the press started on the page. */
    }
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging || !this.selected) return;
    e.preventDefault();
    e.stopPropagation();
    this.moveTo(e);
    this.updateValidity();
    this.publish(false);
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (!this.dragging) return;
    e.preventDefault();
    e.stopPropagation();
    this.dropPiece();
  };

  private grabPiece(piece: THREE.Object3D, e: PointerEvent): void {
    this.select(piece);
    this.dragging = true;
    this.restY = piece.position.y;
    this.start.x = piece.position.x;
    this.start.z = piece.position.z;
    this.start.yaw = piece.rotation.y;
    this.canvas.style.cursor = 'grabbing';
    if (this.floorPoint(e)) {
      this.grab.set(piece.position.x - this.floorHit.x, piece.position.z - this.floorHit.z);
    } else {
      this.grab.set(0, 0);
    }
    piece.position.y = this.restY + 0.35;
    this.publish(false);
  }

  private dropPiece(): void {
    const piece = this.selected;
    if (piece) {
      piece.position.y = this.restY;
      if (!this.fits(piece)) {
        piece.position.x = this.start.x;
        piece.position.z = this.start.z;
        piece.rotation.y = this.start.yaw;
        this.onRejected?.();
      }
    }
    this.setRing(true);
    this.publish(true);
    this.dragging = false;
    this.canvas.style.cursor = '';
    this.ring.removeFromParent();
    this.selected = null;
  }

  private moveTo(e: PointerEvent): void {
    if (!this.selected || !this.floorPoint(e)) return;
    const next = clampFurnXZ(this.floorHit.x + this.grab.x, this.floorHit.z + this.grab.y);
    this.selected.position.x = next.x;
    this.selected.position.z = next.z;
    this.selected.position.y = this.restY + 0.35;
  }

  private fits(piece: THREE.Object3D): boolean {
    const layer = this.getHouse()?.getObjectByName('home-decor-layer');
    return !layer || placementFits(piece, layer, PLAYER_HOUSE.cx, PLAYER_HOUSE.cz);
  }

  private updateValidity(): void {
    if (this.selected) this.setRing(this.fits(this.selected));
  }

  private setRing(ok: boolean): void {
    (this.ring.material as THREE.MeshBasicMaterial).color.setHex(ok ? RING_OK : RING_BAD);
  }

  private floorPoint(e: PointerEvent): boolean {
    this.setPointer(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.ray.intersectPlane(this.floorPlane, this.floorHit) !== null;
  }

  private isHudControl(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el?.closest) return false;
    return !!el.closest('#ui-root button, #ui-root a, #ui-root input, #ui-root textarea, .decor-panel, .taxi-panel, .city-map');
  }

  private publish(commit: boolean): void {
    const piece = this.selected;
    if (!piece) return;
    const id = piece.userData.furnId as string | undefined;
    if (!id) return;
    applyFurnitureCollision(piece, this.collisions, HOME_SHELL.floorY);
    this.onPose(
      id,
      {
        x: Math.round(piece.position.x * 100) / 100,
        z: Math.round(piece.position.z * 100) / 100,
        yaw: Math.round(piece.rotation.y * 1000) / 1000,
      },
      commit,
    );
  }

  private select(piece: THREE.Object3D): void {
    this.selected = piece;
    const foot = piece.userData.foot as { hx: number; hz: number } | null;
    const reach = foot ? Math.max(foot.hx, foot.hz) * 1.2 : 0.75;
    this.ring.scale.set(reach / 0.63, reach / 0.63, 1);
    piece.add(this.ring);
  }

  private clearSelection(): void {
    if (this.selected) this.selected.position.y = this.restY;
    this.setRing(true);
    this.dragging = false;
    this.canvas.style.cursor = '';
    this.ring.removeFromParent();
    this.selected = null;
  }

  private pick(e: PointerEvent): THREE.Object3D | null {
    const house = this.getHouse();
    const layer = house?.getObjectByName('home-decor-layer');
    if (!layer) return null;
    this.setPointer(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(layer.children, true);
    for (const hit of hits) {
      const piece = this.movableOf(hit.object, layer);
      if (piece) return piece;
    }
    return this.nearestOnScreen(e, layer);
  }

  private movableOf(node: THREE.Object3D, layer: THREE.Object3D): THREE.Object3D | null {
    let current: THREE.Object3D | null = node;
    while (current && current !== layer) {
      if (current.userData.movable) return current;
      current = current.parent;
    }
    return null;
  }

  /** Top-down clicks land near a piece even when the ray misses the mesh. */
  private nearestOnScreen(e: PointerEvent, layer: THREE.Object3D): THREE.Object3D | null {
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    let best: THREE.Object3D | null = null;
    let bestD = Infinity;
    for (const child of layer.children) {
      if (!child.userData.movable) continue;
      this.projected.set(child.position.x, HOME_SHELL.floorY + 0.4, child.position.z);
      this.projected.project(this.camera);
      if (this.projected.z < -1 || this.projected.z > 1) continue;
      const sx = (this.projected.x * 0.5 + 0.5) * rect.width;
      const sy = (-this.projected.y * 0.5 + 0.5) * rect.height;
      const d = Math.hypot(sx - px, sy - py);
      const foot = child.userData.foot as { hx: number; hz: number } | null;
      const allowance = foot ? 36 + Math.max(foot.hx, foot.hz) * 28 : 64;
      if (d <= allowance && d < bestD) {
        bestD = d;
        best = child;
      }
    }
    return best;
  }

  private setPointer(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }
}
