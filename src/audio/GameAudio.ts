/**
 * Procedural city audio via Web Audio API — no external files.
 * Unlocks on first user gesture (browser autoplay policy).
 */

export type AudioState = {
  walking: boolean;
  running: boolean;
  driving: boolean;
  carSpeed: number;
  aerial: boolean;
  muted: boolean;
};

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private ambientGain!: GainNode;
  private sfxGain!: GainNode;
  private engineGain!: GainNode;
  private engineOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private unlocked = false;
  private muted = false;
  private footTimer = 0;
  private whooshTimer = 2 + Math.random() * 4;
  private lastDriving = false;
  private started = false;

  /** Call once; attaches unlock listeners. */
  init(): void {
    const unlock = (): void => {
      void this.unlock().then(() => {
        // Keep listening until audio really runs: mobile browsers often refuse
        // the first resume, and they suspend the context when the tab sleeps.
        if (!this.unlocked) return;
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      });
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.85, this.now(), 0.05);
    }
    return this.muted;
  }

  async unlock(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state !== 'running') await this.resumeCtx(this.ctx);
      this.unlocked = this.ctx.state === 'running';
      if (this.unlocked) this.startAmbient();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    // Assigned before the first await so a second gesture reuses this context.
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(this.ctx.destination);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.22;
    this.ambientGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.55;
    this.sfxGain.connect(this.master);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineGain.connect(this.master);

    await this.resumeCtx(this.ctx);
    this.unlocked = this.ctx.state === 'running';
    if (this.unlocked) this.startAmbient();
  }

  private async resumeCtx(ctx: AudioContext): Promise<void> {
    try {
      await ctx.resume();
    } catch {
      /* the gesture was not accepted; a later one retries */
    }
  }

  update(dt: number, state: AudioState): void {
    if (!this.unlocked || !this.ctx) return;
    if (state.muted !== this.muted) {
      this.muted = state.muted;
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.85, this.now(), 0.05);
    }

    // Ambient duck when aerial / driving
    const ambTarget = state.aerial ? 0.08 : state.driving ? 0.12 : 0.22;
    this.ambientGain.gain.setTargetAtTime(ambTarget, this.now(), 0.3);

    // Engine
    if (state.driving) {
      if (!this.lastDriving) {
        this.startEngine();
        this.playDoor(true);
      }
      const t = Math.min(1, Math.abs(state.carSpeed) / 28);
      const idle = 0.12;
      this.engineGain.gain.setTargetAtTime(idle + t * 0.35, this.now(), 0.08);
      if (this.engineOsc) {
        this.engineOsc.frequency.setTargetAtTime(55 + t * 90, this.now(), 0.1);
      }
      if (this.engineFilter) {
        this.engineFilter.frequency.setTargetAtTime(280 + t * 900, this.now(), 0.1);
      }
    } else if (this.lastDriving) {
      this.stopEngine();
      this.playDoor(false);
    }
    this.lastDriving = state.driving;

    // Footsteps
    if (state.walking && !state.driving && !state.aerial) {
      const interval = state.running ? 0.28 : 0.42;
      this.footTimer += dt;
      if (this.footTimer >= interval) {
        this.footTimer = 0;
        this.playFootstep(state.running);
      }
    } else {
      this.footTimer = 0;
    }

    // Occasional traffic whoosh
    this.whooshTimer -= dt;
    if (this.whooshTimer <= 0) {
      this.whooshTimer = 5 + Math.random() * 9;
      if (!state.aerial) this.playWhoosh();
    }
  }

  playUi(): void {
    if (!this.ctx || !this.unlocked) return;
    const t0 = this.now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(660, t0);
    o.frequency.exponentialRampToValueAtTime(880, t0 + 0.06);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    o.connect(g);
    g.connect(this.sfxGain);
    o.start(t0);
    o.stop(t0 + 0.14);
  }

  playShot(): void {
    if (!this.ctx || !this.unlocked) return;
    const t0 = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.makeNoiseBuffer(0.12);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, t0);
    filter.frequency.exponentialRampToValueAtTime(240, t0 + 0.09);
    filter.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.26, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + 0.12);

    const pop = this.ctx.createOscillator();
    const pg = this.ctx.createGain();
    pop.type = 'square';
    pop.frequency.setValueAtTime(130, t0);
    pop.frequency.exponentialRampToValueAtTime(48, t0 + 0.06);
    pg.gain.setValueAtTime(0.0001, t0);
    pg.gain.exponentialRampToValueAtTime(0.15, t0 + 0.003);
    pg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
    pop.connect(pg);
    pg.connect(this.sfxGain);
    pop.start(t0);
    pop.stop(t0 + 0.08);
  }

  playConfirm(): void {
    if (!this.ctx || !this.unlocked) return;
    const t0 = this.now();
    for (let i = 0; i < 2; i++) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = 420 + i * 180;
      g.gain.setValueAtTime(0.0001, t0 + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.1, t0 + i * 0.05 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.05 + 0.15);
      o.connect(g);
      g.connect(this.sfxGain);
      o.start(t0 + i * 0.05);
      o.stop(t0 + i * 0.05 + 0.18);
    }
  }

  private startAmbient(): void {
    if (!this.ctx || this.started) return;
    this.started = true;

    // Brown-ish noise bed
    const buffer = this.makeNoiseBuffer(3);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.5;
    const hum = this.ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 68;
    const humGain = this.ctx.createGain();
    humGain.gain.value = 0.04;

    src.connect(filter);
    filter.connect(this.ambientGain);
    hum.connect(humGain);
    humGain.connect(this.ambientGain);
    src.start();
    hum.start();

    // Soft mid “city” tone
    const pad = this.ctx.createOscillator();
    pad.type = 'triangle';
    pad.frequency.value = 110;
    const padGain = this.ctx.createGain();
    padGain.gain.value = 0.018;
    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 240;
    pad.connect(padFilter);
    padFilter.connect(padGain);
    padGain.connect(this.ambientGain);
    pad.start();
  }

  private startEngine(): void {
    if (!this.ctx || this.engineOsc) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 2;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.makeNoiseBuffer(1);
    noise.loop = true;
    const nGain = this.ctx.createGain();
    nGain.gain.value = 0.08;
    const nFilter = this.ctx.createBiquadFilter();
    nFilter.type = 'bandpass';
    nFilter.frequency.value = 400;

    osc.connect(filter);
    filter.connect(this.engineGain);
    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(this.engineGain);
    osc.start();
    noise.start();
    this.engineOsc = osc;
    this.engineFilter = filter;
  }

  private stopEngine(): void {
    if (!this.ctx) return;
    this.engineGain.gain.setTargetAtTime(0, this.now(), 0.08);
    const osc = this.engineOsc;
    this.engineOsc = null;
    this.engineFilter = null;
    if (osc) {
      try {
        osc.stop(this.now() + 0.2);
      } catch {
        /* already stopped */
      }
    }
  }

  private playFootstep(running: boolean): void {
    if (!this.ctx) return;
    const t0 = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.makeNoiseBuffer(0.08);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = running ? 380 : 220;
    filter.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(running ? 0.18 : 0.11, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + 0.09);
  }

  private playWhoosh(): void {
    if (!this.ctx) return;
    const t0 = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.makeNoiseBuffer(0.6);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200, t0);
    filter.frequency.exponentialRampToValueAtTime(900, t0 + 0.35);
    filter.frequency.exponentialRampToValueAtTime(180, t0 + 0.7);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.75);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.ambientGain);
    src.start(t0);
    src.stop(t0 + 0.8);
  }

  private playDoor(enter: boolean): void {
    if (!this.ctx) return;
    const t0 = this.now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(enter ? 180 : 140, t0);
    o.frequency.exponentialRampToValueAtTime(enter ? 90 : 60, t0 + 0.1);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.08, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    o.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    o.start(t0);
    o.stop(t0 + 0.2);

    // Soft thud
    const thud = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.value = 70;
    tg.gain.setValueAtTime(0.0001, t0 + 0.05);
    tg.gain.exponentialRampToValueAtTime(0.14, t0 + 0.06);
    tg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    thud.connect(tg);
    tg.connect(this.sfxGain);
    thud.start(t0 + 0.05);
    thud.stop(t0 + 0.25);
  }

  private makeNoiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buffer;
  }

  private now(): number {
    return this.ctx?.currentTime ?? 0;
  }
}
