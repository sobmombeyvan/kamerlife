import {
  applyQuality,
  GraphicsConfig,
  saveGraphicsSettings,
  type GraphicsQuality,
} from '../config/GraphicsConfig';

export type PauseHandlers = {
  onResume: () => void;
  onQuality: (q: GraphicsQuality) => void;
  onSave: () => void;
  onQuitHint: () => void;
};

export class PauseMenu {
  private readonly root: HTMLElement;
  private handlers: PauseHandlers | null = null;

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
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  private render(): void {
    const q = GraphicsConfig.quality;
    this.root.innerHTML = `
      <div class="pause-panel">
        <h2>Pause</h2>
        <p class="pause-sub">LIFE CITY: YAOUNDÉ</p>
        <button type="button" class="pause-btn primary" data-act="resume">Reprendre</button>
        <button type="button" class="pause-btn" data-act="save">Sauvegarder</button>
        <div class="pause-section">
          <label>Graphismes</label>
          <div class="pause-qualities">
            ${(['low', 'medium', 'high', 'ultra'] as GraphicsQuality[])
              .map(
                (id) =>
                  `<button type="button" class="pause-q ${q === id ? 'on' : ''}" data-q="${id}">${labelQ(id)}</button>`,
              )
              .join('')}
          </div>
          <p class="pause-note">PNJ ×${GraphicsConfig.npcDensity.toFixed(2)} · Trafic ×${GraphicsConfig.trafficDensity.toFixed(2)} · ombres ${GraphicsConfig.shadowMapSize}px · F3 performances · redémarrage pour densité</p>
        </div>
        <button type="button" class="pause-btn ghost" data-act="hint">Contrôles</button>
      </div>
    `;

    this.root.querySelector('[data-act="resume"]')?.addEventListener('click', () => {
      this.hide();
      this.handlers?.onResume();
    });
    this.root.querySelector('[data-act="save"]')?.addEventListener('click', () => {
      this.handlers?.onSave();
    });
    this.root.querySelector('[data-act="hint"]')?.addEventListener('click', () => {
      this.handlers?.onQuitHint();
    });
    this.root.querySelectorAll('[data-q]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const quality = (btn as HTMLElement).dataset.q as GraphicsQuality;
        applyQuality(quality);
        saveGraphicsSettings();
        this.handlers?.onQuality(quality);
        this.render();
      });
    });
  }
}

function labelQ(q: GraphicsQuality): string {
  if (q === 'low') return 'Bas';
  if (q === 'medium') return 'Moyen';
  if (q === 'high') return 'Haut';
  return 'Ultra';
}
