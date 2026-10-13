import type * as THREE from 'three';

export type PerfSample = {
  fps: number;
  frameMs: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  npcs: number;
  traffic: number;
};

/**
 * Optional performance readout. Toggle with F3.
 * Logs one baseline sample a few seconds after boot.
 */
export class PerfHud {
  private readonly root: HTMLElement;
  private visible = false;
  private logged = false;
  private elapsed = 0;
  private lastStamp = 0;
  private latest: PerfSample | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'perf-hud';
    this.root.className = 'perf-panel hidden';
    this.root.textContent = 'F3 · performances';
    parent.appendChild(this.root);
    window.addEventListener('keydown', this.onKey);
  }

  sample(dt: number, renderer: THREE.WebGLRenderer, counts: { npcs: number; traffic: number; fps: number }): void {
    const now = performance.now();
    const frameMs = this.lastStamp > 0 ? now - this.lastStamp : dt * 1000;
    this.lastStamp = now;
    const info = renderer.info;
    this.latest = {
      fps: counts.fps,
      frameMs,
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      npcs: counts.npcs,
      traffic: counts.traffic,
    };
    this.elapsed += dt;
    if (!this.logged && this.elapsed > 4 && this.latest.fps > 0) {
      this.logged = true;
      console.info('[Perf] baseline', { ...this.latest });
    }
    if (this.visible) this.render();
  }

  get last(): PerfSample | null {
    return this.latest;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
  }

  private render(): void {
    const s = this.latest;
    if (!s) return;
    this.root.innerHTML = `
      <strong>Performances</strong>
      <span>${s.fps} FPS · ${s.frameMs.toFixed(1)} ms</span>
      <span>${s.calls} draw calls · ${formatK(s.triangles)} tris</span>
      <span>${s.geometries} géométries · ${s.textures} textures</span>
      <span>${s.npcs} PNJ · ${s.traffic} véhicules</span>
      <em>F3 masquer</em>
    `;
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.code !== 'F3') return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    event.preventDefault();
    this.visible = !this.visible;
    this.root.classList.toggle('hidden', !this.visible);
    if (this.visible) this.render();
  };
}

function formatK(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}
