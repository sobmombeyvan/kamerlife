import type { InputManager } from '../input/InputManager';

export class MobileControls {
  private readonly root: HTMLElement;
  private active = false;

  constructor(
    parent: HTMLElement,
    private readonly input: InputManager,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'mobile-controls';
    this.root.innerHTML = `
      <div class="stick" id="move-stick" aria-label="Déplacement">
        <div class="stick-knob" id="move-knob"></div>
      </div>
      <div class="look-pad" id="look-pad" aria-label="Caméra"></div>
      <div class="action-buttons">
        <button type="button" id="btn-run">Courir</button>
        <button type="button" id="btn-jump">Sauter</button>
        <button type="button" id="btn-interact">E</button>
      </div>
    `;
    parent.appendChild(this.root);

    this.bindMoveStick();
    this.bindLookPad();
    this.bindButtons();
    this.syncVisibility();
    window.addEventListener('resize', this.syncVisibility);
  }

  destroy(): void {
    window.removeEventListener('resize', this.syncVisibility);
    this.root.remove();
  }

  private readonly syncVisibility = (): void => {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const narrow = window.innerWidth <= 900;
    this.active = coarse || narrow;
    this.root.classList.toggle('visible', this.active);
  };

  private bindMoveStick(): void {
    const stick = this.root.querySelector('#move-stick') as HTMLElement;
    const knob = this.root.querySelector('#move-knob') as HTMLElement;
    let pointerId: number | null = null;

    const reset = (): void => {
      knob.style.transform = 'translate(-50%, -50%)';
      this.input.setMobileMove(0, 0);
      pointerId = null;
    };

    stick.addEventListener('pointerdown', (e) => {
      pointerId = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      update(e);
    });
    stick.addEventListener('pointermove', (e) => {
      if (pointerId !== e.pointerId) return;
      update(e);
    });
    stick.addEventListener('pointerup', reset);
    stick.addEventListener('pointercancel', reset);

    const update = (e: PointerEvent): void => {
      const rect = stick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = (e.clientX - cx) / (rect.width / 2);
      let dy = (e.clientY - cy) / (rect.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      knob.style.transform = `translate(calc(-50% + ${dx * 36}px), calc(-50% + ${dy * 36}px))`;
      // stick: up = forward = negative Z in our input space
      this.input.setMobileMove(dx, dy);
    };
  }

  private bindLookPad(): void {
    const pad = this.root.querySelector('#look-pad') as HTMLElement;
    let lastX = 0;
    let lastY = 0;
    let dragging = false;

    pad.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      pad.setPointerCapture(e.pointerId);
    });
    pad.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      this.input.setMobileLook(dx * 1.8, dy * 1.8);
    });
    const end = (): void => {
      dragging = false;
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
  }

  private bindButtons(): void {
    const run = this.root.querySelector('#btn-run') as HTMLButtonElement;
    const jump = this.root.querySelector('#btn-jump') as HTMLButtonElement;
    const interact = this.root.querySelector('#btn-interact') as HTMLButtonElement;

    const setRun = (active: boolean): void => this.input.setMobileRun(active);
    run.addEventListener('pointerdown', () => setRun(true));
    run.addEventListener('pointerup', () => setRun(false));
    run.addEventListener('pointercancel', () => setRun(false));
    run.addEventListener('pointerleave', () => setRun(false));

    jump.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.input.queueMobileJump();
    });
    interact.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.input.queueMobileInteract();
    });
  }
}
