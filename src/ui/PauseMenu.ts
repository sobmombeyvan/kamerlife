import { WorldConfig } from '../config/WorldConfig';
import {
  applyQuality,
  deriveGraphics,
  GraphicsConfig,
  matchingPreset,
  saveGraphicsSettings,
  type GraphicsQuality,
  type ShadowQuality,
} from '../config/GraphicsConfig';

export type PauseStats = {
  fps: number;
  calls: number;
  triangles: number;
  chunks: string;
  npcs: number;
  vehicles: number;
};

export type PauseHandlers = {
  onResume: () => void;
  /** A preset or an individual graphics setting changed (already written to GraphicsConfig). */
  onGraphics: (label: string) => void;
  onSave: () => void;
  onQuitHint: () => void;
  getStats?: () => PauseStats | null;
};

type Slider = {
  key: 'renderScale' | 'maxPixelRatio' | 'viewDistance' | 'vegetationDensity' | 'npcDensity' | 'trafficDensity';
  label: string;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
  hint: string;
};

const SLIDERS: Slider[] = [
  { key: 'renderScale', label: 'Résolution de rendu', min: 0.5, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)} %`, hint: 'pixels dessinés par image' },
  { key: 'maxPixelRatio', label: 'Netteté (écrans HiDPI)', min: 0.75, max: 2, step: 0.05, fmt: (v) => `×${v.toFixed(2)}`, hint: 'plafond du devicePixelRatio' },
  { key: 'viewDistance', label: 'Distance de vue', min: 260, max: 1200, step: 20, fmt: (v) => `${Math.round(v)} m`, hint: 'quartiers chargés, brouillard, plan lointain' },
  { key: 'vegetationDensity', label: 'Végétation', min: 0, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)} %`, hint: 'arbres, palmiers, buissons (reconstruit la ville)' },
  { key: 'npcDensity', label: 'Densité de PNJ', min: 0.35, max: 1.6, step: 0.05, fmt: (v) => `×${v.toFixed(2)}`, hint: 'passants simulés autour de toi' },
  { key: 'trafficDensity', label: 'Densité du trafic', min: 0.4, max: 1.5, step: 0.05, fmt: (v) => `×${v.toFixed(2)}`, hint: 'véhicules simulés autour de toi' },
];

type Toggle = { key: 'postFx' | 'ao' | 'reflections' | 'antialias'; label: string; hint: string };

const TOGGLES: Toggle[] = [
  { key: 'postFx', label: 'Post-traitement', hint: 'bloom, étalonnage, vignette' },
  { key: 'ao', label: 'Occlusion ambiante', hint: 'ombres de contact (SSAO) · nécessite le post-traitement' },
  { key: 'reflections', label: 'Réflexions', hint: 'ciel reflété sur vitres, métal, peinture, routes mouillées' },
  { key: 'antialias', label: 'Anticrénelage MSAA', hint: '4× MSAA · nécessite le post-traitement' },
];

const SHADOWS: Array<{ q: ShadowQuality; label: string }> = [
  { q: 0, label: 'Off' },
  { q: 1, label: 'Bas' },
  { q: 2, label: 'Moyen' },
  { q: 3, label: 'Haut' },
];

export class PauseMenu {
  private readonly root: HTMLElement;
  private handlers: PauseHandlers | null = null;
  private statsTimer = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'pause-menu';
    this.root.className = 'pause-menu hidden';
    parent.appendChild(this.root);
  }

  show(handlers: PauseHandlers): void {
    this.handlers = handlers;
    this.render();
    this.root.classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
    window.clearInterval(this.statsTimer);
    this.statsTimer = window.setInterval(() => this.refreshStats(), 500);
  }

  hide(): void {
    this.root.classList.add('hidden');
    window.clearInterval(this.statsTimer);
  }

  isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  private changed(label: string): void {
    deriveGraphics();
    saveGraphicsSettings();
    this.handlers?.onGraphics(label);
    this.render();
  }

  private render(): void {
    const g = GraphicsConfig;
    const preset = matchingPreset();
    const post = g.postFx;
    this.root.innerHTML = `
      <div class="pause-panel pause-wide">
        <h2>Pause</h2>
        <p class="pause-sub">${WorldConfig.title}</p>
        <div class="pause-row">
          <button type="button" class="pause-btn primary" data-act="resume">Reprendre</button>
          <button type="button" class="pause-btn" data-act="save">Sauvegarder</button>
        </div>
        <div class="pause-section">
          <label>Graphismes · préréglage ${preset ? '' : '<em>(personnalisé)</em>'}</label>
          <div class="pause-qualities">
            ${(['low', 'medium', 'high', 'ultra'] as GraphicsQuality[])
              .map((id) => `<button type="button" class="pause-q ${preset === id ? 'on' : ''}" data-q="${id}">${labelQ(id)}</button>`)
              .join('')}
          </div>
        </div>
        <div class="pause-section">
          <label>Ombres <small>${g.shadows ? `${g.shadowMapSize}px · ${g.shadowSoft ? 'douces' : 'nettes'}` : 'désactivées'}</small></label>
          <div class="pause-qualities">
            ${SHADOWS.map((s) => `<button type="button" class="pause-q ${g.shadowQuality === s.q ? 'on' : ''}" data-shadow="${s.q}">${s.label}</button>`).join('')}
          </div>
        </div>
        <div class="pause-grid">
          ${SLIDERS.map(
            (s) => `
            <label class="pause-slider" title="${s.hint}">
              <span>${s.label} <b data-out="${s.key}">${s.fmt(g[s.key])}</b></span>
              <input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${g[s.key]}" data-slider="${s.key}" />
              <small>${s.hint}</small>
            </label>`,
          ).join('')}
        </div>
        <div class="pause-toggles">
          ${TOGGLES.map((t) => {
            const needsPost = (t.key === 'ao' || t.key === 'antialias') && !post;
            return `
            <label class="pause-toggle ${needsPost ? 'disabled' : ''}" title="${t.hint}">
              <input type="checkbox" data-toggle="${t.key}" ${g[t.key] ? 'checked' : ''} ${needsPost ? 'disabled' : ''} />
              <span>${t.label}<small>${t.hint}</small></span>
            </label>`;
          }).join('')}
        </div>
        <p class="pause-note" data-stats>…</p>
        <button type="button" class="pause-btn ghost" data-act="hint">Contrôles</button>
      </div>
    `;

    this.root.querySelector('[data-act="resume"]')?.addEventListener('click', () => {
      this.hide();
      this.handlers?.onResume();
    });
    this.root.querySelector('[data-act="save"]')?.addEventListener('click', () => this.handlers?.onSave());
    this.root.querySelector('[data-act="hint"]')?.addEventListener('click', () => this.handlers?.onQuitHint());
    this.root.querySelectorAll<HTMLElement>('[data-q]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const quality = btn.dataset.q as GraphicsQuality;
        applyQuality(quality);
        this.changed(`préréglage ${labelQ(quality)}`);
      });
    });
    this.root.querySelectorAll<HTMLElement>('[data-shadow]').forEach((btn) => {
      btn.addEventListener('click', () => {
        GraphicsConfig.shadowQuality = Number(btn.dataset.shadow) as ShadowQuality;
        this.changed(`ombres ${btn.textContent}`);
      });
    });
    this.root.querySelectorAll<HTMLInputElement>('[data-slider]').forEach((input) => {
      const s = SLIDERS.find((x) => x.key === input.dataset.slider)!;
      const out = this.root.querySelector<HTMLElement>(`[data-out="${s.key}"]`);
      input.addEventListener('input', () => {
        if (out) out.textContent = s.fmt(Number(input.value));
      });
      // apply on release: vegetation and view distance rebuild city chunks
      input.addEventListener('change', () => {
        GraphicsConfig[s.key] = Number(input.value);
        this.changed(`${s.label} ${s.fmt(GraphicsConfig[s.key])}`);
      });
    });
    this.root.querySelectorAll<HTMLInputElement>('[data-toggle]').forEach((input) => {
      input.addEventListener('change', () => {
        const t = TOGGLES.find((x) => x.key === input.dataset.toggle)!;
        GraphicsConfig[t.key] = input.checked;
        this.changed(`${t.label} ${input.checked ? 'activé' : 'désactivé'}`);
      });
    });
    this.refreshStats();
  }

  private refreshStats(): void {
    const el = this.root.querySelector<HTMLElement>('[data-stats]');
    const s = this.handlers?.getStats?.();
    if (!el || !s) return;
    el.textContent = `${s.fps} FPS · ${s.calls} draw calls · ${fmtK(s.triangles)} triangles · ${s.chunks} · ${s.npcs} PNJ · ${s.vehicles} véhicules`;
  }
}

function fmtK(v: number): string {
  return v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v);
}

function labelQ(q: GraphicsQuality): string {
  if (q === 'low') return 'Bas';
  if (q === 'medium') return 'Moyen';
  if (q === 'high') return 'Haut';
  return 'Ultra';
}
