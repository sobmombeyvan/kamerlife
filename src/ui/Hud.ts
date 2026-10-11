import { WorldConfig } from '../config/WorldConfig';
import type { TaxiDestination } from '../vehicles/TaxiDestinations';
import { estimateFare } from '../vehicles/TaxiDestinations';
import {
  DECOR_CATALOG,
  FLOOR_PAINTS,
  WALL_PAINTS,
  type HomeDecorState,
} from '../home/HomeDecor';
import type { NeedsState } from '../sim/PlayerNeeds';
import type { DecorShopHandlers } from './HudTypes';

export type { DecorShopHandlers } from './HudTypes';

export class Hud {
  private readonly root: HTMLElement;
  private readonly districtEl: HTMLElement;
  private readonly fpsEl: HTMLElement;
  private readonly tipEl: HTMLElement;
  private readonly moneyEl: HTMLElement;
  private readonly clockEl: HTMLElement;
  private readonly weatherEl: HTMLElement;
  private readonly promptEl: HTMLElement;
  private readonly missionEl: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly taxiPanel: HTMLElement;
  private readonly taxiList: HTMLElement;
  private readonly decorPanel: HTMLElement;
  private readonly decorList: HTMLElement;
  private readonly decorBtn: HTMLElement;
  private readonly shopPanel: HTMLElement;
  private readonly shopList: HTMLElement;
  private readonly shopTitle: HTMLElement;
  private readonly moodEl: HTMLElement;
  private readonly bars: Record<string, HTMLElement>;
  private frames = 0;
  private fpsTimer = 0;
  private fps = 0;
  private onTaxiPick: ((dest: TaxiDestination) => void) | null = null;
  private onTaxiClose: (() => void) | null = null;
  private onShopClose: (() => void) | null = null;
  private onMapClick: (() => void) | null = null;
  private onAerialClick: (() => void) | null = null;
  private onMuteClick: (() => void) | null = null;
  private onDecorOpen: (() => void) | null = null;
  private onPhoneClick: (() => void) | null = null;
  private onPauseClick: (() => void) | null = null;
  private decorHandlers: DecorShopHandlers | null = null;
  private aerialMode = false;
  private lastPrompt = '';

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-brand">
          <div class="hud-logo">LC</div>
          <div>
            <strong>${WorldConfig.title}</strong>
            <small id="hud-clock">--:--</small>
            <small class="hud-tz">Yaoundé · temps réel</small>
          </div>
        </div>
        <div class="hud-vitals" id="hud-vitals">
          <div class="vital"><span>PV</span><div class="bar"><i data-bar="health"></i></div></div>
          <div class="vital"><span>END</span><div class="bar"><i data-bar="stamina"></i></div></div>
          <div class="vital"><span>FAIM</span><div class="bar hunger"><i data-bar="hunger"></i></div></div>
          <div class="vital"><span>SOIF</span><div class="bar thirst"><i data-bar="thirst"></i></div></div>
          <div class="vital"><span>ÉNR</span><div class="bar energy"><i data-bar="energy"></i></div></div>
          <div class="vital"><span>HYG</span><div class="bar hygiene"><i data-bar="hygiene"></i></div></div>
          <div class="vital"><span>FUN</span><div class="bar fun"><i data-bar="fun"></i></div></div>
          <div class="vital"><span>SOC</span><div class="bar social"><i data-bar="social"></i></div></div>
        </div>
        <div class="hud-stats">
          <div class="money" id="hud-money">0 FCFA</div>
          <div class="mood" id="hud-mood">Humeur · Bien</div>
          <div class="district" id="hud-district">Centre-ville</div>
          <div class="hud-meta"><span id="hud-weather">Clair</span> · <span id="hud-fps">-- FPS</span></div>
        </div>
      </div>
      <div class="hud-mission" id="hud-mission">
        <em>Vie à Yaoundé</em>
        <strong>Mange · dors · travaille · socialise</strong>
      </div>
      <div class="hud-prompt hidden" id="hud-prompt"></div>
      <div class="hud-toast hidden" id="hud-toast"></div>
      <div class="tip" id="hud-tip">WASD déplacer · E interagir · P téléphone · Esc pause</div>
      <div class="fab-col">
        <button type="button" class="map-fab hidden" id="btn-decor">Déco</button>
        <button type="button" class="map-fab" id="btn-phone">Tél</button>
        <button type="button" class="map-fab" id="btn-mute">SON</button>
        <button type="button" class="map-fab" id="btn-aerial">Aérien</button>
        <button type="button" class="map-fab" id="btn-map">Carte</button>
        <button type="button" class="map-fab" id="btn-pause">❚❚</button>
      </div>
      <div class="taxi-panel yango-panel hidden" id="taxi-panel">
        <div class="taxi-head">
          <strong>Yango</strong>
          <button type="button" id="taxi-close">✕</button>
        </div>
        <p class="taxi-sub">Où allez-vous ? · tarif estimé FCFA</p>
        <div class="taxi-list" id="taxi-list"></div>
      </div>
      <div class="decor-panel hidden" id="decor-panel">
        <div class="taxi-head">
          <strong>Boutique déco</strong>
          <button type="button" id="decor-close">✕</button>
        </div>
        <p class="taxi-sub">Meubles & peinture</p>
        <div class="decor-list" id="decor-list"></div>
      </div>
      <div class="taxi-panel hidden" id="shop-panel">
        <div class="taxi-head">
          <strong id="shop-title">Boutique</strong>
          <button type="button" id="shop-close">✕</button>
        </div>
        <p class="taxi-sub" id="shop-sub">Choisis un article</p>
        <div class="taxi-list" id="shop-list"></div>
      </div>
      <div class="bottom-label desktop-only">
        <kbd>E</kbd> interagir · <kbd>P</kbd> téléphone · <kbd>Esc</kbd> pause · <kbd>M</kbd> carte · <kbd>V</kbd> aérien
      </div>
    `;
    parent.appendChild(this.root);
    this.districtEl = this.root.querySelector('#hud-district') as HTMLElement;
    this.fpsEl = this.root.querySelector('#hud-fps') as HTMLElement;
    this.tipEl = this.root.querySelector('#hud-tip') as HTMLElement;
    this.moneyEl = this.root.querySelector('#hud-money') as HTMLElement;
    this.clockEl = this.root.querySelector('#hud-clock') as HTMLElement;
    this.weatherEl = this.root.querySelector('#hud-weather') as HTMLElement;
    this.promptEl = this.root.querySelector('#hud-prompt') as HTMLElement;
    this.missionEl = this.root.querySelector('#hud-mission') as HTMLElement;
    this.toastEl = this.root.querySelector('#hud-toast') as HTMLElement;
    this.taxiPanel = this.root.querySelector('#taxi-panel') as HTMLElement;
    this.taxiList = this.root.querySelector('#taxi-list') as HTMLElement;
    this.decorPanel = this.root.querySelector('#decor-panel') as HTMLElement;
    this.decorList = this.root.querySelector('#decor-list') as HTMLElement;
    this.decorBtn = this.root.querySelector('#btn-decor') as HTMLElement;
    this.shopPanel = this.root.querySelector('#shop-panel') as HTMLElement;
    this.shopList = this.root.querySelector('#shop-list') as HTMLElement;
    this.shopTitle = this.root.querySelector('#shop-title') as HTMLElement;
    this.moodEl = this.root.querySelector('#hud-mood') as HTMLElement;
    this.bars = {};
    for (const key of ['health', 'stamina', 'hunger', 'thirst', 'energy', 'hygiene', 'fun', 'social']) {
      this.bars[key] = this.root.querySelector(`[data-bar="${key}"]`) as HTMLElement;
    }

    this.root.querySelector('#taxi-close')!.addEventListener('click', () => {
      this.hideTaxiMenu();
      this.onTaxiClose?.();
    });
    this.root.querySelector('#shop-close')!.addEventListener('click', () => {
      this.hideShopMenu();
      this.onShopClose?.();
    });
    this.root.querySelector('#decor-close')!.addEventListener('click', () => {
      this.hideDecorShop();
      this.decorHandlers?.onClose();
    });
    this.root.querySelector('#btn-map')!.addEventListener('click', () => this.onMapClick?.());
    this.root.querySelector('#btn-aerial')!.addEventListener('click', () => this.onAerialClick?.());
    this.root.querySelector('#btn-mute')!.addEventListener('click', () => this.onMuteClick?.());
    this.root.querySelector('#btn-phone')!.addEventListener('click', () => this.onPhoneClick?.());
    this.root.querySelector('#btn-pause')!.addEventListener('click', () => this.onPauseClick?.());
    this.decorBtn.addEventListener('click', () => this.onDecorOpen?.());
  }

  onOpenMap(cb: () => void): void {
    this.onMapClick = cb;
  }
  onToggleAerial(cb: () => void): void {
    this.onAerialClick = cb;
  }
  onToggleMute(cb: () => void): void {
    this.onMuteClick = cb;
  }
  onOpenDecor(cb: () => void): void {
    this.onDecorOpen = cb;
  }
  onOpenPhone(cb: () => void): void {
    this.onPhoneClick = cb;
  }
  onOpenPause(cb: () => void): void {
    this.onPauseClick = cb;
  }

  setMuted(muted: boolean): void {
    const btn = this.root.querySelector('#btn-mute') as HTMLElement;
    btn.textContent = muted ? 'MUTE' : 'SON';
  }

  setAerialMode(on: boolean): void {
    if (this.aerialMode === on) return;
    this.aerialMode = on;
    this.root.classList.toggle('aerial-on', on);
    (this.root.querySelector('#btn-aerial') as HTMLElement).textContent = on ? 'Sol' : 'Aérien';
  }

  setHomeMode(on: boolean): void {
    this.decorBtn.classList.toggle('hidden', !on);
    if (!on) this.hideDecorShop();
  }

  setDistrict(name: string): void {
    if (this.districtEl.textContent === name) return;
    this.districtEl.textContent = name;
  }

  setTip(text: string): void {
    if (this.tipEl.textContent === text) return;
    this.tipEl.textContent = text;
  }

  setMoney(fcfa: number): void {
    const next = `${Math.max(0, Math.round(fcfa)).toLocaleString('fr-FR')} FCFA`;
    if (this.moneyEl.textContent === next) return;
    this.moneyEl.textContent = next;
  }

  setClock(label: string, weather: string): void {
    if (this.clockEl.textContent !== label) this.clockEl.textContent = label;
    if (this.weatherEl.textContent !== weather) this.weatherEl.textContent = weather;
  }

  setNeeds(n: NeedsState, moodLabel?: string): void {
    setBar(this.bars.health!, n.health);
    setBar(this.bars.stamina!, n.stamina);
    setBar(this.bars.hunger!, n.hunger);
    setBar(this.bars.thirst!, n.thirst);
    setBar(this.bars.energy!, n.energy);
    if (this.bars.hygiene) setBar(this.bars.hygiene, n.hygiene);
    if (this.bars.fun) setBar(this.bars.fun, n.fun);
    if (this.bars.social) setBar(this.bars.social, n.social);
    if (moodLabel) {
      const next = `Humeur · ${moodLabel}`;
      if (this.moodEl.textContent !== next) this.moodEl.textContent = next;
    }
  }

  showShopMenu(
    title: string,
    offers: Array<{ id: string; label: string; price: number }>,
    onPick: (id: string) => void,
    onClose?: () => void,
  ): void {
    this.onShopClose = onClose ?? null;
    this.shopTitle.textContent = title;
    this.shopList.innerHTML = '';
    for (const o of offers) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'taxi-dest';
      btn.innerHTML = `<span>${o.label}</span><em>${o.price.toLocaleString('fr-FR')} FCFA</em>`;
      btn.addEventListener('click', () => onPick(o.id));
      this.shopList.appendChild(btn);
    }
    this.shopPanel.classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  hideShopMenu(): void {
    this.shopPanel.classList.add('hidden');
  }

  isShopMenuOpen(): boolean {
    return !this.shopPanel.classList.contains('hidden');
  }

  setPrompt(text: string | null): void {
    if (!text) {
      this.promptEl.classList.add('hidden');
      this.lastPrompt = '';
      return;
    }
    if (this.lastPrompt === text) return;
    this.lastPrompt = text;
    this.promptEl.innerHTML = text;
    this.promptEl.classList.remove('hidden');
  }

  setMission(title: string): void {
    const strong = this.missionEl.querySelector('strong');
    if (strong && strong.textContent !== title) strong.textContent = title;
  }

  notify(text: string, ms = 2800): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    window.setTimeout(() => this.toastEl.classList.add('hidden'), ms);
  }

  showTaxiMenu(
    standName: string,
    fromX: number,
    fromZ: number,
    destinations: TaxiDestination[],
    onPick: (dest: TaxiDestination) => void,
    onClose: () => void,
  ): void {
    this.hideDecorShop();
    this.onTaxiPick = onPick;
    this.onTaxiClose = onClose;
    (this.root.querySelector('.taxi-head strong') as HTMLElement).textContent = standName;
    this.taxiList.innerHTML = '';
    for (const dest of destinations) {
      const fare = estimateFare(fromX, fromZ, dest);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'taxi-dest';
      btn.innerHTML = `<span>${dest.name}</span><em>${fare.toLocaleString('fr-FR')} FCFA</em>`;
      btn.addEventListener('click', () => {
        this.hideTaxiMenu();
        this.onTaxiPick?.(dest);
      });
      this.taxiList.appendChild(btn);
    }
    this.taxiPanel.classList.remove('hidden');
  }

  hideTaxiMenu(): void {
    this.taxiPanel.classList.add('hidden');
  }

  isTaxiMenuOpen(): boolean {
    return !this.taxiPanel.classList.contains('hidden');
  }

  showDecorShop(state: HomeDecorState, handlers: DecorShopHandlers): void {
    this.hideTaxiMenu();
    this.decorHandlers = handlers;
    this.decorList.innerHTML = '';
    const section = (title: string) => {
      const h = document.createElement('div');
      h.className = 'decor-section';
      h.textContent = title;
      this.decorList.appendChild(h);
    };
    section('Meubles');
    for (const item of DECOR_CATALOG) {
      const owned = state.owned.includes(item.id);
      const equipped = state.equipped[item.slot] === item.id;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'taxi-dest' + (equipped ? ' decor-equipped' : '');
      const label = equipped ? 'Équipé' : owned ? 'Équiper' : `${item.price.toLocaleString('fr-FR')} FCFA`;
      btn.innerHTML = `<span>${item.name}</span><em>${label}</em>`;
      btn.addEventListener('click', () => handlers.onBuyItem(item.id));
      this.decorList.appendChild(btn);
    }
    section('Murs');
    for (const paint of WALL_PAINTS) {
      const active = state.wallColor === paint.color;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'taxi-dest' + (active ? ' decor-equipped' : '');
      btn.innerHTML = `<span>${paint.name}</span><em>${active ? 'Actuel' : `${paint.price.toLocaleString('fr-FR')} FCFA`}</em>`;
      btn.addEventListener('click', () => handlers.onBuyWall(paint.id));
      this.decorList.appendChild(btn);
    }
    section('Sol');
    for (const paint of FLOOR_PAINTS) {
      const active = state.floorColor === paint.color;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'taxi-dest' + (active ? ' decor-equipped' : '');
      btn.innerHTML = `<span>${paint.name}</span><em>${active ? 'Actuel' : `${paint.price.toLocaleString('fr-FR')} FCFA`}</em>`;
      btn.addEventListener('click', () => handlers.onBuyFloor(paint.id));
      this.decorList.appendChild(btn);
    }
    this.decorPanel.classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  hideDecorShop(): void {
    this.decorPanel.classList.add('hidden');
  }

  isDecorShopOpen(): boolean {
    return !this.decorPanel.classList.contains('hidden');
  }

  refreshDecorShop(state: HomeDecorState): void {
    if (!this.isDecorShopOpen() || !this.decorHandlers) return;
    this.showDecorShop(state, this.decorHandlers);
  }

  getFps(): number {
    return this.fps;
  }

  tickFps(_dt: number): void {
    const now = performance.now();
    if (this.fpsTimer === 0) this.fpsTimer = now;
    this.frames += 1;
    const elapsed = now - this.fpsTimer;
    if (elapsed >= 500) {
      this.fps = Math.round((this.frames * 1000) / elapsed);
      this.fpsEl.textContent = `${this.fps} FPS`;
      this.frames = 0;
      this.fpsTimer = now;
    }
  }
}

function setBar(el: HTMLElement, value: number): void {
  el.style.width = `${Math.max(0, Math.min(100, value))}%`;
}
