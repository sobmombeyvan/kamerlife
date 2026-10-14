export type MoveAxes = { x: number; z: number };

export class Input {
  private readonly keys = new Set<string>();
  private mouseDx = 0;
  private mouseDy = 0;
  private jumpQueued = false;
  private interactQueued = false;
  private mapQueued = false;
  private aerialQueued = false;
  private phoneQueued = false;
  private pauseQueued = false;
  private lookQueued = false;
  private furnitureQueued = false;
  private viewQueued = false;
  private zoomDelta = 0;
  private pointerLocked = false;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private downX = 0;
  private downY = 0;
  private clickQueued: { clientX: number; clientY: number } | null = null;
  private mobileMove: MoveAxes = { x: 0, z: 0 };
  private mobileRun = false;
  private mobileLookX = 0;
  private mobileLookY = 0;
  /** When true, click won't force pointer lock (aerial / menus). */
  blockPointerLock = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('click', this.requestLock);
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('click', this.requestLock);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
  }

  setMobileMove(x: number, z: number): void {
    this.mobileMove.x = clamp(x, -1, 1);
    this.mobileMove.z = clamp(z, -1, 1);
  }

  setMobileRun(v: boolean): void {
    this.mobileRun = v;
  }

  /** Right stick. Held deflection keeps turning the camera. */
  setMobileLook(x: number, y: number): void {
    this.mobileLookX = clamp(x, -1, 1);
    this.mobileLookY = clamp(y, -1, 1);
  }

  queueJump(): void {
    this.jumpQueued = true;
  }

  queueInteract(): void {
    this.interactQueued = true;
  }

  getMoveAxes(): MoveAxes {
    let x = this.mobileMove.x;
    let z = this.mobileMove.z;
    if (this.keys.has('KeyA') || this.keys.has('KeyQ') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('KeyZ') || this.keys.has('ArrowUp')) z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { x, z };
  }

  consumeLook(): { dx: number; dy: number } {
    const stick = this.blockPointerLock ? 0 : 1;
    const out = {
      dx: this.mouseDx + this.mobileLookX * 12 * stick,
      dy: this.mouseDy + this.mobileLookY * 8 * stick,
    };
    this.mouseDx = 0;
    this.mouseDy = 0;
    return out;
  }

  isRunning(): boolean {
    return this.mobileRun || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  consumeJump(): boolean {
    const v = this.jumpQueued;
    this.jumpQueued = false;
    return v;
  }

  consumeInteract(): boolean {
    const v = this.interactQueued;
    this.interactQueued = false;
    return v;
  }

  consumeMapToggle(): boolean {
    const v = this.mapQueued;
    this.mapQueued = false;
    return v;
  }

  consumeAerialToggle(): boolean {
    const v = this.aerialQueued;
    this.aerialQueued = false;
    return v;
  }

  consumePhoneToggle(): boolean {
    const v = this.phoneQueued;
    this.phoneQueued = false;
    return v;
  }

  consumePauseToggle(): boolean {
    const v = this.pauseQueued;
    this.pauseQueued = false;
    return v;
  }

  consumeLookToggle(): boolean {
    const v = this.lookQueued;
    this.lookQueued = false;
    return v;
  }

  consumeFurnitureToggle(): boolean {
    const v = this.furnitureQueued;
    this.furnitureQueued = false;
    return v;
  }

  consumeViewToggle(): boolean {
    const v = this.viewQueued;
    this.viewQueued = false;
    return v;
  }

  consumeZoom(): number {
    const z = this.zoomDelta;
    this.zoomDelta = 0;
    return z;
  }

  consumeClick(): { clientX: number; clientY: number } | null {
    const c = this.clickQueued;
    this.clickQueued = null;
    return c;
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.zoomDelta += Math.sign(e.deltaY);
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    if (e.code === 'Space') {
      e.preventDefault();
      this.jumpQueued = true;
    }
    if (e.code === 'KeyE') {
      this.interactQueued = true;
    }
    if (e.code === 'KeyM' || e.code === 'KeyT') {
      this.mapQueued = true;
    }
    if (e.code === 'KeyV' && !e.repeat) {
      this.viewQueued = true;
    }
    if (e.code === 'KeyP') {
      this.phoneQueued = true;
    }
    if (e.code === 'Escape') {
      this.pauseQueued = true;
    }
    if (e.code === 'KeyC' && !e.repeat) {
      this.lookQueued = true;
    }
    if (e.code === 'KeyF' && !e.repeat) {
      this.furnitureQueued = true;
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private readonly requestLock = (): void => {
    if (this.blockPointerLock) return;
    if (window.innerWidth > 800 && !this.pointerLocked) {
      void this.canvas.requestPointerLock();
    }
  };

  private readonly onLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    if (this.pointerLocked) {
      this.mouseDx += e.movementX;
      this.mouseDy += e.movementY;
    }
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.pointerLocked) return;
    const phone = document.documentElement.classList.contains('is-phone');
    if (!this.blockPointerLock) {
      // Leave the whole bottom strip and left third for the joystick / E / RUN.
      if (e.clientX < window.innerWidth * (phone ? 0.42 : 0.38)) return;
      if (phone && e.clientY > window.innerHeight * 0.62) return;
    }
    this.dragging = true;
    this.downX = e.clientX;
    this.downY = e.clientY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.canvas.setPointerCapture(e.pointerId);
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.mouseDx += e.clientX - this.lastX;
    this.mouseDy += e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    const moved = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
    this.dragging = false;
    if (moved <= 8) this.clickQueued = { clientX: e.clientX, clientY: e.clientY };
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
