export type MoveAxes = { x: number; z: number };

export class InputManager {
  private keys = new Set<string>();
  private pointerLocked = false;
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private jumpQueued = false;
  private interactQueued = false;

  private mobileMove: MoveAxes = { x: 0, z: 0 };
  private mobileLook: MoveAxes = { x: 0, z: 0 };
  private mobileRun = false;
  private mobileJumpQueued = false;
  private mobileInteractQueued = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('click', this.requestPointerLock);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('click', this.requestPointerLock);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
  }

  setMobileMove(x: number, z: number): void {
    this.mobileMove.x = clamp(x, -1, 1);
    this.mobileMove.z = clamp(z, -1, 1);
  }

  setMobileLook(x: number, z: number): void {
    this.mobileLook.x = x;
    this.mobileLook.z = z;
  }

  setMobileRun(active: boolean): void {
    this.mobileRun = active;
  }

  queueMobileJump(): void {
    this.mobileJumpQueued = true;
  }

  queueMobileInteract(): void {
    this.mobileInteractQueued = true;
  }

  getMoveAxes(): MoveAxes {
    let x = this.mobileMove.x;
    let z = this.mobileMove.z;

    if (this.keys.has('KeyA') || this.keys.has('KeyQ')) x -= 1;
    if (this.keys.has('KeyD')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('KeyZ')) z -= 1;
    if (this.keys.has('KeyS')) z += 1;

    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { x, z };
  }

  consumeLookDelta(): { dx: number; dy: number } {
    const dx = this.mouseDeltaX + this.mobileLook.x;
    const dy = this.mouseDeltaY + this.mobileLook.z;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.mobileLook.x = 0;
    this.mobileLook.z = 0;
    return { dx, dy };
  }

  isRunning(): boolean {
    return this.mobileRun || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  consumeJump(): boolean {
    const pressed = this.jumpQueued || this.mobileJumpQueued;
    this.jumpQueued = false;
    this.mobileJumpQueued = false;
    return pressed;
  }

  consumeInteract(): boolean {
    const pressed = this.interactQueued || this.mobileInteractQueued;
    this.interactQueued = false;
    this.mobileInteractQueued = false;
    return pressed;
  }

  isEscapePressed(): boolean {
    return this.keys.has('Escape');
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    if (e.code === 'Space') {
      e.preventDefault();
      this.jumpQueued = true;
    }
    if (e.code === 'KeyE') {
      this.interactQueued = true;
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private readonly requestPointerLock = (): void => {
    if (!this.pointerLocked) {
      void this.canvas.requestPointerLock();
    }
  };

  private readonly onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    this.mouseDeltaX += e.movementX;
    this.mouseDeltaY += e.movementY;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
