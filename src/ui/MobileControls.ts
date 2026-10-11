import type { Input } from '../core/Input';

export class MobileControls {
  private readonly root: HTMLElement;

  constructor(parent: HTMLElement, private readonly input: Input) {
    this.root = document.createElement('div');
    this.root.id = 'mobile-controls';
    this.root.innerHTML = `
      <div class="joystick" id="joy"><div class="stick" id="stick"></div></div>
      <div class="mbtn-col">
        <button type="button" class="mbtn" id="btn-jump" aria-label="Sauter">↑</button>
        <button type="button" class="mbtn" id="btn-interact" aria-label="Interagir">E</button>
        <button type="button" class="mbtn mbtn-run" id="btn-run" aria-label="Courir">RUN</button>
      </div>
    `;
    parent.appendChild(this.root);
    this.bindJoystick();
    this.bindButtons();
    this.sync();
    window.addEventListener('resize', this.sync);
  }

  private readonly sync = (): void => {
    const show = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 900;
    this.root.classList.toggle('visible', show);
    document.documentElement.classList.toggle('is-phone', show);
  };

  private bindJoystick(): void {
    const joy = this.root.querySelector('#joy') as HTMLElement;
    const stick = this.root.querySelector('#stick') as HTMLElement;
    let active = false;

    const end = (): void => {
      active = false;
      stick.style.transform = 'translate(0,0)';
      this.input.setMobileMove(0, 0);
    };

    joy.addEventListener('pointerdown', (e) => {
      active = true;
      joy.setPointerCapture(e.pointerId);
      move(e);
    });
    joy.addEventListener('pointermove', (e) => {
      if (active) move(e);
    });
    joy.addEventListener('pointerup', end);
    joy.addEventListener('pointercancel', end);

    const move = (e: PointerEvent): void => {
      const r = joy.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const lim = 34;
      const d = Math.max(1, Math.hypot(dx, dy));
      const nx = (dx / d) * Math.min(d, lim);
      const ny = (dy / d) * Math.min(d, lim);
      stick.style.transform = `translate(${nx}px,${ny}px)`;
      this.input.setMobileMove(nx / lim, ny / lim);
    };
  }

  private bindButtons(): void {
    const run = this.root.querySelector('#btn-run') as HTMLButtonElement;
    const jump = this.root.querySelector('#btn-jump') as HTMLButtonElement;
    const interact = this.root.querySelector('#btn-interact') as HTMLButtonElement;
    const setRun = (v: boolean): void => this.input.setMobileRun(v);
    run.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      setRun(true);
    });
    run.addEventListener('pointerup', () => setRun(false));
    run.addEventListener('pointercancel', () => setRun(false));
    run.addEventListener('pointerleave', () => setRun(false));
    jump.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.input.queueJump();
    });
    interact.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.input.queueInteract();
    });
  }
}
