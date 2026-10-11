import type { TaxiDestination } from '../vehicles/TaxiDestinations';
import { estimateFare } from '../vehicles/TaxiDestinations';

export type PhoneHandlers = {
  onClose: () => void;
  onOrderTaxi: (dest: TaxiDestination) => void;
  onOpenMap: () => void;
  getMoney: () => number;
  getPlayerPos: () => { x: number; z: number };
  getMood?: () => string;
  getNeedsSummary?: () => string;
  getClockLabel?: () => string;
  destinations: TaxiDestination[];
};

/**
 * iPhone-style handset — home screen + Yango (rouge / blanc) for rides.
 */
export class PhoneUI {
  private readonly root: HTMLElement;
  private readonly screen: HTMLElement;
  private readonly statusTime: HTMLElement;
  private handlers: PhoneHandlers | null = null;
  private tab: 'home' | 'yango' | 'bank' | 'profile' = 'home';
  private tickId = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'phone-shell';
    this.root.className = 'phone-shell hidden';
    this.root.innerHTML = `
      <div class="iphone-bezel">
        <div class="iphone-side-btn iphone-silent"></div>
        <div class="iphone-side-btn iphone-vol-up"></div>
        <div class="iphone-side-btn iphone-vol-down"></div>
        <div class="iphone-side-btn iphone-power"></div>
        <div class="iphone-screen-wrap">
          <div class="iphone-status">
            <span id="iphone-time">09:41</span>
            <div class="iphone-island"></div>
            <span class="iphone-status-right">5G · ▮▮▮▮</span>
          </div>
          <div class="phone-screen" id="phone-screen"></div>
          <div class="iphone-home-bar" id="phone-close" role="button" aria-label="Fermer"></div>
        </div>
      </div>
    `;
    parent.appendChild(this.root);
    this.screen = this.root.querySelector('#phone-screen') as HTMLElement;
    this.statusTime = this.root.querySelector('#iphone-time') as HTMLElement;
    this.root.querySelector('#phone-close')!.addEventListener('click', () => this.hide());
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.hide();
    });
  }

  show(handlers: PhoneHandlers): void {
    this.handlers = handlers;
    this.tab = 'home';
    this.render();
    this.root.classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
    cancelAnimationFrame(this.tickId);
    const tick = () => {
      if (!this.isOpen()) return;
      this.statusTime.textContent = this.clockShort();
      this.tickId = requestAnimationFrame(tick);
    };
    this.tickId = requestAnimationFrame(tick);
  }

  hide(): void {
    this.root.classList.add('hidden');
    cancelAnimationFrame(this.tickId);
    this.handlers?.onClose();
  }

  isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  private clockShort(): string {
    const full = this.handlers?.getClockLabel?.();
    if (full && /\d{2}:\d{2}/.test(full)) {
      const m = full.match(/(\d{2}:\d{2})/);
      if (m) return m[1]!;
    }
    try {
      return new Date().toLocaleTimeString('fr-FR', {
        timeZone: 'Africa/Douala',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return '09:41';
    }
  }

  private render(): void {
    const h = this.handlers;
    if (!h) return;
    this.statusTime.textContent = this.clockShort();

    if (this.tab === 'home') {
      this.screen.innerHTML = `
        <div class="ios-wallpaper">
          <div class="ios-date">${h.getClockLabel?.() ?? 'Yaoundé'}</div>
          <div class="ios-grid">
            <button type="button" class="ios-app yango-app" data-tab="yango">
              <span class="ios-icon yango-icon">Y</span>
              <span>Yango</span>
            </button>
            <button type="button" class="ios-app" data-tab="bank">
              <span class="ios-icon ios-icon-bank">₣</span>
              <span>Wallet</span>
            </button>
            <button type="button" class="ios-app" data-map>
              <span class="ios-icon ios-icon-maps">◎</span>
              <span>Plans</span>
            </button>
            <button type="button" class="ios-app" data-tab="profile">
              <span class="ios-icon ios-icon-life">♥</span>
              <span>Vie</span>
            </button>
          </div>
          <div class="ios-dock">
            <button type="button" class="ios-app yango-app" data-tab="yango">
              <span class="ios-icon yango-icon">Y</span>
            </button>
            <button type="button" class="ios-app" data-map>
              <span class="ios-icon ios-icon-maps">◎</span>
            </button>
            <button type="button" class="ios-app" data-tab="bank">
              <span class="ios-icon ios-icon-bank">₣</span>
            </button>
          </div>
        </div>
      `;
    } else if (this.tab === 'yango') {
      const pos = h.getPlayerPos();
      const rows = h.destinations
        .slice(0, 14)
        .map((d) => {
          const fare = estimateFare(pos.x, pos.z, d);
          return `<button type="button" class="yango-row" data-dest="${d.id}">
            <span class="yango-pin"></span>
            <span class="yango-dest"><strong>${d.name}</strong><small>Course · Yaoundé</small></span>
            <em>${fare.toLocaleString('fr-FR')} F</em>
          </button>`;
        })
        .join('');
      this.screen.innerHTML = `
        <div class="yango-app-screen">
          <div class="yango-top">
            <button type="button" class="yango-back" data-back>‹</button>
            <div class="yango-brand"><span class="yango-logo">Yango</span></div>
          </div>
          <p class="yango-hello">Où allez-vous ?</p>
          <p class="yango-sub">Courses en ville · paiement FCFA</p>
          <div class="yango-list">${rows}</div>
        </div>
      `;
    } else if (this.tab === 'bank') {
      this.screen.innerHTML = `
        <div class="ios-page">
          <button type="button" class="ios-nav-back" data-back>‹ Wallet</button>
          <div class="ios-card">
            <small>Solde Mboa Pay</small>
            <strong>${h.getMoney().toLocaleString('fr-FR')} FCFA</strong>
            <p>Paiements · Yango · boutiques</p>
          </div>
        </div>
      `;
    } else {
      this.screen.innerHTML = `
        <div class="ios-page">
          <button type="button" class="ios-nav-back" data-back>‹ Vie</button>
          <div class="ios-card">
            <strong>Humeur · ${h.getMood?.() ?? 'Bien'}</strong>
            <p>${h.getNeedsSummary?.() ?? 'Gère faim, énergie, hygiène, fun, social.'}</p>
            <p class="phone-muted">Heure Yaoundé (réel) · ${h.getClockLabel?.() ?? ''}</p>
            <p class="phone-muted">Solde : ${h.getMoney().toLocaleString('fr-FR')} FCFA</p>
          </div>
        </div>
      `;
    }

    this.screen.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.tab = (btn as HTMLElement).dataset.tab as typeof this.tab;
        this.render();
      });
    });
    this.screen.querySelectorAll('[data-map]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.hide();
        h.onOpenMap();
      });
    });
    this.screen.querySelector('[data-back]')?.addEventListener('click', () => {
      this.tab = 'home';
      this.render();
    });
    this.screen.querySelectorAll('[data-dest]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.dest;
        const dest = h.destinations.find((d) => d.id === id);
        if (dest) {
          this.hide();
          h.onOrderTaxi(dest);
        }
      });
    });
  }
}
