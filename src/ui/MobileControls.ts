import type { Input } from '../core/Input';

export class MobileControls {
  private readonly root: HTMLElement;
  private activity: 'walk' | 'drive' = 'walk';

  constructor(parent: HTMLElement, private readonly input: Input) {
    this.root = document.createElement('div');
    this.root.id = 'mobile-controls';
    this.root.innerHTML = `
      <div class="joystick" id="joy" role="application" aria-label="Marcher ou conduire">
        <div class="stick" id="stick"></div>
        <span class="joy-caption" id="joy-caption">Marcher</span>
      </div>
      <div class="joystick look-joy" id="look" role="application" aria-label="Caméra">
        <div class="stick" id="look-stick"></div>
        <span class="joy-caption">Caméra</span>
      </div>
      <div class="mbtn-col">
        <button type="button" class="mbtn" id="btn-jump" aria-label="Sauter">↑</button>
        <button type="button" class="mbtn" id="btn-interact" aria-label="Interagir">E</button>
        <button type="button" class="mbtn mbtn-run" id="btn-run" aria-label="Courir">RUN</button>
      </div>
    `;
    parent.appendChild(this.root);
    this.bindStick(
      this.root.querySelector('#joy') as HTMLElement,
      this.root.querySelector('#stick') as HTMLElement,
      (x, y) => this.input.setMobileMove(x, y),
    );
    this.bindStick(
      this.root.querySelector('#look') as HTMLElement,
      this.root.querySelector('#look-stick') as HTMLElement,
      (x, y) => this.input.setMobileLook(x, y),
    );
    this.bindButtons();
    this.sync();
    window.addEventListener('resize', this.sync);
    window.visualViewport?.addEventListener('resize', this.sync);
    window.visualViewport?.addEventListener('scroll', this.sync);
  }

  /** Driving reuses the left stick as throttle and steering, and E leaves the car. */
  setActivity(mode: 'walk' | 'drive'): void {
    if (this.activity === mode) return;
    this.activity = mode;
    this.root.classList.toggle('is-drive', mode === 'drive');
    const caption = this.root.querySelector('#joy-caption');
    const interact = this.root.querySelector('#btn-interact');
    const run = this.root.querySelector('#btn-run');
    if (caption) caption.textContent = mode === 'drive' ? 'Conduire' : 'Marcher';
    if (interact) {
      interact.textContent = mode === 'drive' ? 'Sortir' : 'E';
      interact.setAttribute('aria-label', mode === 'drive' ? 'Sortir du véhicule' : 'Interagir');
    }
    if (run) {
      run.textContent = mode === 'drive' ? 'Turbo' : 'RUN';
      run.setAttribute('aria-label', mode === 'drive' ? 'Turbo' : 'Courir');
    }
  }

  private readonly sync = (): void => {
    const show = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 900;
    this.root.classList.toggle('visible', show);
    document.documentElement.classList.toggle('is-phone', show);
    const vv = window.visualViewport;
    const inset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    document.documentElement.style.setProperty('--vv-bottom', `${inset}px`);
  };

  private bindStick(zone: HTMLElement, stick: HTMLElement, onAxis: (x: number, y: number) => void): void {
    let active = false;
    let pointerId = -1;

    const end = (): void => {
      if (!active) return;
      active = false;
      pointerId = -1;
      stick.style.transform = 'translate(0,0)';
      onAxis(0, 0);
    };

    const move = (e: PointerEvent): void => {
      const r = zone.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const lim = Math.max(24, r.width * 0.34);
      const d = Math.max(1, Math.hypot(dx, dy));
      const nx = (dx / d) * Math.min(d, lim);
      const ny = (dy / d) * Math.min(d, lim);
      stick.style.transform = `translate(${nx}px,${ny}px)`;
      onAxis(nx / lim, ny / lim);
    };

    zone.addEventListener(
      'pointerdown',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        active = true;
        pointerId = e.pointerId;
        try {
          zone.setPointerCapture(e.pointerId);
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
