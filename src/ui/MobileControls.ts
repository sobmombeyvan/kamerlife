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
    window.visualViewport?.addEventListener('resize', this.sync);
    window.visualViewport?.addEventListener('scroll', this.sync);
  }

  private readonly sync = (): void => {
    const show = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 900;
    this.root.classList.toggle('visible', show);
    document.documentElement.classList.toggle('is-phone', show);
    const vv = window.visualViewport;
    const inset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    document.documentElement.style.setProperty('--vv-bottom', `${inset}px`);
  };

  private bindJoystick(): void {
    const joy = this.root.querySelector('#joy') as HTMLElement;
    const stick = this.root.querySelector('#stick') as HTMLElement;
    let active = false;
    let pointerId = -1;

    const end = (): void => {
      if (!active) return;
      active = false;
      pointerId = -1;
      stick.style.transform = 'translate(0,0)';
      this.input.setMobileMove(0, 0);
    };

    const move = (e: PointerEvent): void => {
      const r = joy.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const lim = 38;
      const d = Math.max(1, Math.hypot(dx, dy));
      const nx = (dx / d) * Math.min(d, lim);
      const ny = (dy / d) * Math.min(d, lim);
      stick.style.transform = `translate(${nx}px,${ny}px)`;
      this.input.setMobileMove(nx / lim, ny / lim);
    };

    joy.addEventListener(
      'pointerdown',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        active = true;
        pointerId = e.pointerId;
        try {
          joy.setPointerCapture(e.pointerId);
        } catch {
          /* iOS Safari can refuse capture; window listeners still track the finger. */
        }
        move(e);
      },
      { passive: false },
    );

    const onMove = (e: PointerEvent): void => {
      if (!active || (pointerId >= 0 && e.pointerId !== pointerId)) return;
      e.preventDefault();
      move(e);
    };
    const onUp = (e: PointerEvent): void => {
      if (pointerId >= 0 && e.pointerId !== pointerId) return;
      end();
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', end);
  }

  private bindButtons(): void {
    const run = this.root.querySelector('#btn-run') as HTMLButtonElement;
    const jump = this.root.querySelector('#btn-jump') as HTMLButtonElement;
    const interact = this.root.querySelector('#btn-interact') as HTMLButtonElement;
    let runId = -1;
    const setRun = (v: boolean): void => this.input.setMobileRun(v);
    const tap = (el: HTMLElement, fn: () => void) => {
      el.addEventListener(
        'pointerdown',
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          fn();
        },
        { passive: false },
      );
    };
    run.addEventListener(
      'pointerdown',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        runId = e.pointerId;
        setRun(true);
        try {
          run.setPointerCapture(e.pointerId);
        } catch {
          /* tracked via window */
        }
      },
      { passive: false },
    );
    const endRun = (e: PointerEvent): void => {
      if (runId < 0 || e.pointerId !== runId) return;
      runId = -1;
      setRun(false);
    };
    window.addEventListener('pointerup', endRun);
    window.addEventListener('pointercancel', endRun);
    tap(jump, () => this.input.queueJump());
    tap(interact, () => this.input.queueInteract());
  }
}
