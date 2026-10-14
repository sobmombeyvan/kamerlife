import { WorldConfig } from '../config/WorldConfig';
import type { TaxiDestination } from '../vehicles/TaxiDestinations';
import { estimateFare, filterDestinations } from '../vehicles/TaxiDestinations';
import {
  activeWallFinish,
  DECOR_CATALOG,
  decorGroup,
  equippedItem,
  FLOOR_PAINTS,
  FURN_LABELS,
  WALL_PAINTS,
  type DecorGroup,
  type HomeDecorState,
} from '../home/HomeDecor';
import { decorThumbnail } from '../home/decorThumbnails';
import type { NeedsState } from '../sim/PlayerNeeds';
import type { DecorShopHandlers } from './HudTypes';
import {
  charactersFor,
  characterById,
  CLOTHES,
  EYES,
  FACE_PRESETS,
  HAIR,
  HAIR_CUTS,
  LOOK_PRESETS,
  OUTFITS,
  SKINS,
  type ClothId,
  type EyeId,
  type HairId,
  type HairStyle,
  type PlayerLook,
  type Sex,
  type SkinId,
} from '../player/PlayerLook';
import { loadWardrobe } from '../player/Wardrobe';
import {
  ACCESSORIES,
  BEARDS,
  BLUSHES,
  BUILT_HAIR,
  LIPS,
  SHADOWS,
  SLOT_LABEL,
  accessoriesFor,
  type AccessoryDef,
  type AccessorySlot,
  type BeardId,
  type BlushId,
  type LipId,
  type ShadowId,
} from '../player/fashion/catalog';
import { isOwned } from '../player/fashion/inventory';
import { DRESSES } from '../player/fashion/dresses';
import { accessoryThumb, ensureThumbnails, hairThumb } from '../player/fashion/thumbnails';
import { SLOT_FIELDS, unownedAccessories } from '../player/PlayerLook';
import { HOME_VIEWS, type HomeView } from '../camera/ThirdPersonCamera';

export type LookFocus =
  | 'person'
  | 'body'
  | 'face'
  | 'hair'
  | 'dresses'
  | 'top'
  | 'bottom'
  | 'shoes'
  | 'hats'
  | 'bags'
  | 'jewelry'
  | 'makeup'
  | 'outfits'
  | 'shop'
  | 'wardrobe';

type ShopFilter = 'all' | 'owned' | 'shop';

export type CreatorView = 'front' | 'left' | 'right' | 'back' | 'full';
export type CreatorPose = 'idle' | 'walk' | 'run' | 'turn' | 'sit';

export type LookHandlers = {
  onSex: (sex: Sex) => void;
  onCharacter: (id: PlayerLook['characterId']) => void;
  onSkin: (id: SkinId) => void;
  onNose: (nose: number) => void;
  onNoseWidth: (width: number) => void;
  onJaw: (jaw: number) => void;
  onChin: (chin: number) => void;
  onEye: (id: EyeId) => void;
  onHair: (id: HairId) => void;
  onBrow: (id: HairId) => void;
  onHairStyle: (style: HairStyle) => void;
  onHeight: (value: number) => void;
  onShoulders: (value: number) => void;
  onTorso: (value: number) => void;
  onHips: (value: number) => void;
  onArms: (value: number) => void;
  onLegs: (value: number) => void;
  onPreset: (id: string) => void;
  onOutfit: (id: string) => void;
  onTop: (id: ClothId) => void;
  onBottom: (id: ClothId) => void;
  onShoes: (id: ClothId) => void;
  /** Harper's suit is one mesh: this paints the whole thing. */
  onSuit: (id: ClothId) => void;
  onDressPick: (id: string) => void;
  onDressColor: (color: ClothId) => void;
  onView: (view: CreatorView) => void;
  onPose: (pose: CreatorPose) => void;
  onRandom: () => void;
  onReset: () => void;
  onSaveOutfit: () => void;
  onEquipSaved: (id: string) => void;
  onRenameSaved: (id: string, name: string) => void;
  onDeleteSaved: (id: string) => void;
  onDuplicateSaved: (id: string) => void;
  onFavoriteSaved: (id: string) => void;
  onAccessory: (slot: AccessorySlot, id: string) => void;
  onAccessoryColor: (slot: AccessorySlot, color: ClothId) => void;
  onBuy: (ids: string[]) => void;
  onBeard: (id: BeardId) => void;
  onLip: (id: LipId) => void;
  onBlush: (id: BlushId) => void;
  onShadow: (id: ShadowId) => void;
  onFreckles: (on: boolean) => void;
  money: () => number;
  onCancel: () => void;
  onConfirm: () => void;
};

export type { DecorShopHandlers } from './HudTypes';

/** Needs shown bottom-left, in reading order. Colors live in main.css per data-need. */
const NEEDS: ReadonlyArray<{ key: keyof NeedsState; label: string }> = [
  { key: 'health', label: 'Santé' },
  { key: 'stamina', label: 'Forme' },
  { key: 'hunger', label: 'Faim' },
  { key: 'thirst', label: 'Soif' },
  { key: 'energy', label: 'Énergie' },
  { key: 'hygiene', label: 'Hygiène' },
  { key: 'fun', label: 'Loisirs' },
  { key: 'social', label: 'Social' },
];
/** Below this a need is urgent enough to call out in the alert chip. */
const NEED_LOW = 25;
const NEED_WARN = 50;

export type ControlMode = 'walk' | 'home' | 'build' | 'aerial' | 'drive';

type ControlHint = { keys: string[]; label: string; pad?: true };

/** Bottom legend, swapped whenever the player changes how they control the game. */
const MOVE_PAD: ControlHint = { pad: true, keys: ['Z', 'Q', 'S', 'D'], label: 'Se déplacer' };
const CONTROL_SETS: Record<ControlMode, ControlHint[]> = {
  walk: [
    MOVE_PAD,
    { keys: ['Maj'], label: 'Courir' },
    { keys: ['Espace'], label: 'Sauter' },
    { keys: ['E'], label: 'Interagir' },
    { keys: ['V'], label: 'Changer de vue' },
  ],
  home: [
    MOVE_PAD,
    { keys: ['V'], label: 'Changer de vue' },
    { keys: ['E'], label: 'Interagir' },
    { keys: ['F'], label: 'Meubles' },
    { keys: ['Molette'], label: 'Zoomer' },
  ],
  build: [
    { keys: ['Clic'], label: 'Glisser un meuble' },
    { keys: ['R'], label: 'Tourner' },
    { keys: ['Suppr'], label: 'Ranger' },
    { keys: ['Molette'], label: 'Zoomer' },
    { keys: ['F'], label: 'Terminer' },
  ],
  aerial: [
    { ...MOVE_PAD, label: 'Survoler' },
    { keys: ['Molette'], label: 'Zoomer' },
    { keys: ['Clic'], label: 'Destination' },
    { keys: ['M'], label: 'Fermer la carte' },
  ],
  drive: [
    { ...MOVE_PAD, label: 'Conduire' },
    { keys: ['Maj'], label: 'Turbo' },
    { keys: ['E'], label: 'Sortir' },
    { keys: ['V'], label: 'Changer de vue' },
  ],
};

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
  private readonly taxiSearch: HTMLInputElement;
  private taxiDests: TaxiDestination[] = [];
  private taxiFrom = { x: 0, z: 0 };
  private taxiQuery = '';
  private readonly decorPanel: HTMLElement;
  private readonly decorList: HTMLElement;
  private readonly decorBtn: HTMLElement;
  private readonly furnBtn: HTMLElement;
  private readonly viewBtn: HTMLElement;
  private readonly lookBtn: HTMLElement;
  private lookAvailable = true;
  private readonly lookPanel: HTMLElement;
  private readonly lookList: HTMLElement;
  private readonly lookStage: HTMLElement;
  private readonly lookNav: HTMLElement;
  private readonly lookTitle: HTMLElement;
  private readonly lookSearch: HTMLInputElement;
  private lookQuery = '';
  private shownLook: PlayerLook | null = null;
  private readonly shopPanel: HTMLElement;
  private readonly shopList: HTMLElement;
  private readonly shopTitle: HTMLElement;
  private readonly moodEl: HTMLElement;
  private readonly bars: Record<string, HTMLElement>;
  private readonly needVals: Record<string, HTMLElement>;
  private readonly needRows: Record<string, HTMLElement>;
  private readonly needAlertEl: HTMLElement;
  private readonly controlsEl: HTMLElement;
  private controlMode: ControlMode | null = null;
  private toastTimer = 0;
  private frames = 0;
  private fpsTimer = 0;
  private fps = 0;
  private onTaxiPick: ((dest: TaxiDestination) => void) | null = null;
  private onTaxiClose: (() => void) | null = null;
  private onShopClose: (() => void) | null = null;
  private onMapClick: (() => void) | null = null;
  private onMuteClick: (() => void) | null = null;
  private onDecorOpen: (() => void) | null = null;
  private onFurnClick: (() => void) | null = null;
  private onViewClick: (() => void) | null = null;
  private onPhoneClick: (() => void) | null = null;
  private onPauseClick: (() => void) | null = null;
  private onLookClick: (() => void) | null = null;
  private decorHandlers: DecorShopHandlers | null = null;
  private lookHandlers: LookHandlers | null = null;
  private lookFocus: LookFocus = 'person';
  /** Corps keeps a full-body frame even on the face and hair tabs. */
  private framingOverride: 'face' | 'body' | null = null;
  private shopFilter: ShopFilter = 'all';
  private aerialMode = false;
  private lastPrompt = '';
  private tipTimer = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-brand">
          <div class="hud-logo">LC</div>
          <div class="hud-brand-txt">
            <strong>${WorldConfig.title}</strong>
            <div class="hud-time">
              <small id="hud-clock">--:--</small>
              <span class="hud-chip" id="hud-weather">Clair</span>
            </div>
            <small class="hud-tz">Yaoundé · temps réel</small>
          </div>
        </div>
        <div class="hud-stats">
          <div class="money" id="hud-money">0 FCFA</div>
          <div class="mood" id="hud-mood">Humeur · Bien</div>
          <div class="district" id="hud-district">Centre-ville</div>
          <div class="hud-meta"><span id="hud-fps">-- FPS</span></div>
        </div>
      </div>
      <div class="hud-mission" id="hud-mission">
        <em>Objectif</em>
        <strong>Mange · dors · travaille · socialise</strong>
      </div>
      <div class="hud-needs" id="hud-vitals">
        <div class="needs-head">
          <em>Besoins</em>
          <span class="needs-alert hidden" id="needs-alert"></span>
        </div>
        <div class="needs-grid">
          ${NEEDS.map(
            (need) => `
          <div class="vital" data-need="${need.key}">
            <span class="v-name">${need.label}</span>
            <div class="bar"><i data-bar="${need.key}"></i></div>
            <em class="v-val" data-val="${need.key}">--</em>
          </div>`,
          ).join('')}
        </div>
      </div>
      <div class="hud-prompt hidden" id="hud-prompt"></div>
      <div class="hud-toast hidden" id="hud-toast"></div>
      <div class="tip" id="hud-tip">Explore la ville · appuie sur E devant un lieu</div>
      <div class="fab-col">
        <button type="button" class="map-fab" id="btn-look"><span class="fab-txt">Perso</span><kbd>C</kbd></button>
        <button type="button" class="map-fab" id="btn-view"><span class="fab-txt">3/4</span><kbd>V</kbd></button>
        <button type="button" class="map-fab hidden" id="btn-furn"><span class="fab-txt">Meubles</span><kbd>F</kbd></button>
        <button type="button" class="map-fab hidden" id="btn-decor"><span class="fab-txt">Déco</span></button>
        <button type="button" class="map-fab" id="btn-phone"><span class="fab-txt">Tél</span><kbd>P</kbd></button>
        <button type="button" class="map-fab" id="btn-mute"><span class="fab-txt">Son</span></button>
        <button type="button" class="map-fab" id="btn-map"><span class="fab-txt">Carte</span><kbd>M</kbd></button>
        <button type="button" class="map-fab" id="btn-pause"><span class="fab-txt">Pause</span><kbd>Esc</kbd></button>
      </div>
      <div class="taxi-panel yango-panel hidden" id="taxi-panel">
        <div class="taxi-head">
          <strong>Yango</strong>
          <button type="button" id="taxi-close">✕</button>
        </div>
        <p class="taxi-sub">Où allez-vous ? · tous les lieux de Yaoundé</p>
        <input type="search" class="yango-search" id="taxi-search" placeholder="Rechercher un quartier, un lieu…" autocomplete="off" />
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
      <div class="creator hidden" id="look-panel">
        <nav class="creator-nav" id="look-nav"></nav>
        <aside class="creator-side">
          <div class="taxi-head">
            <strong id="look-title">Personnage</strong>
            <button type="button" id="look-close">✕</button>
          </div>
          <input id="look-search" class="look-search" type="search" placeholder="Rechercher" />
          <div class="decor-list" id="look-list"></div>
        </aside>
        <footer class="creator-bar" id="look-stage"></footer>
      </div>
      <div class="taxi-panel hidden" id="shop-panel">
        <div class="taxi-head">
          <strong id="shop-title">Boutique</strong>
          <button type="button" id="shop-close">✕</button>
        </div>
        <p class="taxi-sub" id="shop-sub">Choisis un article</p>
        <div class="taxi-list" id="shop-list"></div>
      </div>
      <div class="hud-controls desktop-only" id="hud-controls"></div>
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
    this.taxiSearch = this.root.querySelector('#taxi-search') as HTMLInputElement;
    this.taxiSearch.addEventListener('input', () => {
      this.taxiQuery = this.taxiSearch.value;
      this.fillTaxiList();
    });
    this.decorPanel = this.root.querySelector('#decor-panel') as HTMLElement;
    this.decorList = this.root.querySelector('#decor-list') as HTMLElement;
    this.decorBtn = this.root.querySelector('#btn-decor') as HTMLElement;
    this.furnBtn = this.root.querySelector('#btn-furn') as HTMLElement;
    this.viewBtn = this.root.querySelector('#btn-view') as HTMLElement;
    this.lookBtn = this.root.querySelector('#btn-look') as HTMLElement;
    this.lookPanel = this.root.querySelector('#look-panel') as HTMLElement;
    this.lookList = this.root.querySelector('#look-list') as HTMLElement;
    this.lookStage = this.root.querySelector('#look-stage') as HTMLElement;
    this.lookNav = this.root.querySelector('#look-nav') as HTMLElement;
    this.lookTitle = this.root.querySelector('#look-title') as HTMLElement;
    this.lookSearch = this.root.querySelector('#look-search') as HTMLInputElement;
    this.lookSearch.addEventListener('input', () => {
      this.lookQuery = this.lookSearch.value;
      if (this.shownLook && this.lookHandlers) this.showLookPanel(this.shownLook, this.lookHandlers);
    });
    this.shopPanel = this.root.querySelector('#shop-panel') as HTMLElement;
    this.shopList = this.root.querySelector('#shop-list') as HTMLElement;
    this.shopTitle = this.root.querySelector('#shop-title') as HTMLElement;
    this.moodEl = this.root.querySelector('#hud-mood') as HTMLElement;
    this.bars = {};
    this.needVals = {};
    this.needRows = {};
    this.needAlertEl = this.root.querySelector('#needs-alert') as HTMLElement;
    this.controlsEl = this.root.querySelector('#hud-controls') as HTMLElement;
    this.setControls('walk');
    const vitals = this.root.querySelector('#hud-vitals') as HTMLElement;
    vitals.addEventListener('click', () => vitals.classList.toggle('expanded'));
    for (const { key } of NEEDS) {
      this.bars[key] = this.root.querySelector(`[data-bar="${key}"]`) as HTMLElement;
      this.needVals[key] = this.root.querySelector(`[data-val="${key}"]`) as HTMLElement;
      this.needRows[key] = this.root.querySelector(`.vital[data-need="${key}"]`) as HTMLElement;
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
    this.root.querySelector('#look-close')!.addEventListener('click', () => {
      this.lookHandlers?.onConfirm();
    });
    this.root.querySelector('#btn-look')!.addEventListener('click', () => this.onLookClick?.());
    this.root.querySelector('#btn-map')!.addEventListener('click', () => this.onMapClick?.());
    this.root.querySelector('#btn-mute')!.addEventListener('click', () => this.onMuteClick?.());
    this.root.querySelector('#btn-phone')!.addEventListener('click', () => this.onPhoneClick?.());
    this.root.querySelector('#btn-pause')!.addEventListener('click', () => this.onPauseClick?.());
    this.decorBtn.addEventListener('click', () => this.onDecorOpen?.());
    this.furnBtn.addEventListener('click', () => this.onFurnClick?.());
    this.viewBtn.addEventListener('click', () => this.onViewClick?.());
  }

  onOpenMap(cb: () => void): void {
    this.onMapClick = cb;
  }
  onToggleMute(cb: () => void): void {
    this.onMuteClick = cb;
  }
  onOpenDecor(cb: () => void): void {
    this.onDecorOpen = cb;
  }
  onMoveFurniture(cb: () => void): void {
    this.onFurnClick = cb;
  }
  onCycleHomeView(cb: () => void): void {
    this.onViewClick = cb;
  }
  onOpenPhone(cb: () => void): void {
    this.onPhoneClick = cb;
  }
  onOpenPause(cb: () => void): void {
    this.onPauseClick = cb;
  }
  onOpenLook(cb: () => void): void {
    this.onLookClick = cb;
  }

  setMuted(muted: boolean): void {
    const btn = this.root.querySelector('#btn-mute') as HTMLElement;
    btn.classList.toggle('off', muted);
    setFabLabel(btn, muted ? 'Muet' : 'Son');
  }

  setAerialMode(on: boolean): void {
    if (this.aerialMode === on) return;
    this.aerialMode = on;
    this.root.classList.toggle('aerial-on', on);
    const mapBtn = this.root.querySelector('#btn-map') as HTMLElement | null;
    if (mapBtn) setFabLabel(mapBtn, on ? 'Sol' : 'Carte');
  }

  setHomeMode(on: boolean): void {
    this.decorBtn.classList.toggle('hidden', !on);
    this.furnBtn.classList.toggle('hidden', !on);
    if (!on) {
      this.hideDecorShop();
      this.furnBtn.classList.remove('on');
    }
  }

  /** Dims the character button where the look cannot be changed. */
  setLookAvailable(on: boolean): void {
    if (this.lookAvailable === on) return;
    this.lookAvailable = on;
    this.lookBtn.classList.toggle('off', !on);
  }

  /** Names the framing currently in use; pressing the button moves to the next. */
  setHomeView(view: HomeView): void {
    setFabLabel(this.viewBtn, HOME_VIEWS.find((v) => v.id === view)?.short ?? 'Vue');
  }

  setFurnitureMode(on: boolean): void {
    this.furnBtn.classList.toggle('on', on);
    setFabLabel(this.furnBtn, on ? 'Finir' : 'Meubles');
  }

  setDistrict(name: string): void {
    if (this.districtEl.textContent === name) return;
    this.districtEl.textContent = name;
  }

  setTip(text: string): void {
    if (this.tipEl.textContent === text) return;
    this.tipEl.textContent = text;
    this.tipEl.classList.remove('tip-gone');
    window.clearTimeout(this.tipTimer);
    if (document.documentElement.classList.contains('is-phone') && text) {
      this.tipTimer = window.setTimeout(() => this.tipEl.classList.add('tip-gone'), 3200);
    }
  }

  /** Swaps the bottom legend for the keys that actually do something right now. */
  setControls(mode: ControlMode): void {
    if (this.controlMode === mode) return;
    this.controlMode = mode;
    this.controlsEl.innerHTML = CONTROL_SETS[mode]
      .map((hint) => {
        const keys = hint.keys.map((k) => `<kbd>${k}</kbd>`).join('');
        const cls = hint.pad ? 'keypad' : 'keys';
        const title = hint.pad ? ' title="ZQSD, WASD ou les flèches"' : '';
        const pad = hint.pad
          ? `<kbd class="k-up">${hint.keys[0]}</kbd><kbd class="k-left">${hint.keys[1]}</kbd><kbd class="k-down">${hint.keys[2]}</kbd><kbd class="k-right">${hint.keys[3]}</kbd>`
          : keys;
        return `<div class="ctrl"${title}><span class="${cls}">${pad}</span><b>${hint.label}</b></div>`;
      })
      .join('');
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
    let urgent = 0;
    for (const { key, label } of NEEDS) {
      const value = Math.max(0, Math.min(100, Math.round(n[key])));
      setBar(this.bars[key]!, value);
      const val = this.needVals[key];
      if (val && val.textContent !== String(value)) val.textContent = String(value);
      const row = this.needRows[key];
      if (row) {
        row.classList.toggle('low', value <= NEED_LOW);
        row.classList.toggle('warn', value > NEED_LOW && value <= NEED_WARN);
      }
      if (value <= NEED_LOW) {
        urgent += 1;
        if (urgent === 1) this.needAlertEl.dataset.first = label;
      }
    }
    const alert = urgent === 0 ? '' : urgent === 1 ? `${this.needAlertEl.dataset.first} au plus bas` : `${urgent} besoins urgents`;
    if (this.needAlertEl.textContent !== alert) this.needAlertEl.textContent = alert;
    this.needAlertEl.classList.toggle('hidden', urgent === 0);
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
    const phone = document.documentElement.classList.contains('is-phone');
    this.promptEl.innerHTML = phone ? text.replace(/<kbd>[^<]*<\/kbd>\s*/g, '') : text;
    this.promptEl.classList.remove('hidden');
  }

  setMission(title: string): void {
    const strong = this.missionEl.querySelector('strong');
    if (strong && strong.textContent !== title) strong.textContent = title;
  }

  notify(text: string, ms = 2800): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    // Without clearing, an earlier toast's timer hides this one early.
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.add('hidden'), ms);
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
    this.taxiDests = destinations;
    this.taxiFrom = { x: fromX, z: fromZ };
    this.taxiQuery = '';
    this.taxiSearch.value = '';
    (this.root.querySelector('.taxi-head strong') as HTMLElement).textContent = standName;
    this.fillTaxiList();
    this.taxiPanel.classList.remove('hidden');
    this.taxiSearch.focus();
  }

  private fillTaxiList(): void {
    this.taxiList.innerHTML = '';
    const shown = filterDestinations(this.taxiDests, this.taxiQuery);
    for (const dest of shown) {
      const fare = estimateFare(this.taxiFrom.x, this.taxiFrom.z, dest);
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
    if (!shown.length) {
      const empty = document.createElement('p');
      empty.className = 'taxi-sub';
      empty.textContent = 'Aucun lieu pour cette recherche';
      this.taxiList.appendChild(empty);
    }
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
    const groups: [DecorGroup, string][] = [
      ['furniture', 'Meubles'],
      ['finish', 'Cuisine, salle de bain, rideaux & lumière'],
      ['exterior', 'Extérieur (façade, portail, jardin)'],
    ];
    for (const [group, title] of groups) {
      section(title);
      for (const item of DECOR_CATALOG) {
        if (decorGroup(item) !== group) continue;
        const owned = state.owned.includes(item.id);
        const equipped = equippedItem(state, item.slot).id === item.id;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className =
          'taxi-dest' + (group === 'furniture' ? ' decor-card' : '') + (equipped ? ' decor-equipped' : '');
        const label = equipped ? 'Équipé' : owned ? 'Équiper' : `${item.price.toLocaleString('fr-FR')} FCFA`;
        if (group === 'furniture') {
          const img = document.createElement('img');
          img.className = 'decor-thumb';
          img.src = decorThumbnail(item);
          img.alt = item.name;
          const name = document.createElement('span');
          name.className = 'decor-card-name';
          name.textContent = item.name;
          const price = document.createElement('em');
          price.textContent = label;
          btn.append(img, name, price);
        } else {
          btn.innerHTML = `<span>${item.name}</span><em>${label}</em>`;
        }
        btn.addEventListener('click', () => handlers.onBuyItem(item.id));
        this.decorList.appendChild(btn);
      }
    }
    section('Disposition');
    for (const id of state.stored) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'taxi-dest';
      btn.innerHTML = `<span>${FURN_LABELS[id] ?? id} (rangé)</span><em>Remettre</em>`;
      btn.addEventListener('click', () => handlers.onRestore(id));
      this.decorList.appendChild(btn);
    }
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'taxi-dest';
    reset.innerHTML = '<span>Disposition d’origine (tous les meubles)</span><em>Gratuit</em>';
    reset.addEventListener('click', () => handlers.onResetLayout());
    this.decorList.appendChild(reset);
    section('Murs');
    const wallId = activeWallFinish(state);
    for (const paint of WALL_PAINTS) {
      const active = wallId === paint.id;
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

  showLookPanel(look: PlayerLook, handlers: LookHandlers): void {
    this.lookHandlers = handlers;
    this.shownLook = look;
    const categories: [LookFocus, string][] = [
      ['person', 'Personnage'],
      ['body', 'Corps'],
      ['face', 'Visage'],
      ['hair', 'Cheveux'],
      ...(look.sex === 'femme' ? ([['dresses', 'Robes']] as [LookFocus, string][]) : []),
      ['top', 'Haut'],
      ['bottom', 'Bas'],
      ['shoes', 'Chaussures'],
      ['hats', 'Chapeaux'],
      ['bags', 'Sacs'],
      ['jewelry', 'Accessoires'],
      ['makeup', 'Maquillage'],
      ['outfits', 'Tenues'],
      ['shop', 'Boutique'],
      ['wardrobe', 'Garde-robe'],
    ];
    ensureThumbnails();
    this.lookNav.innerHTML = '';
    for (const [id, label] of categories) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = this.lookFocus === id ? 'on' : '';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        this.lookFocus = id;
        this.framingOverride = null;
        this.showLookPanel(look, handlers);
      });
      this.lookNav.appendChild(btn);
    }
    this.lookTitle.textContent = categories.find((item) => item[0] === this.lookFocus)?.[1] ?? 'Création';
    this.lookList.innerHTML = '';
    if (this.lookFocus === 'person') this.fillPerson(look, handlers);
    else if (this.lookFocus === 'body') this.fillProportions(look, handlers);
    else if (this.lookFocus === 'face') this.fillFace(look, handlers);
    else if (this.lookFocus === 'hair') this.fillHair(look, handlers);
    else if (this.lookFocus === 'dresses') this.fillDresses(look, handlers);
    else if (this.lookFocus === 'top') this.fillGarment(look, handlers, 'top');
    else if (this.lookFocus === 'bottom') this.fillGarment(look, handlers, 'bottom');
    else if (this.lookFocus === 'shoes') this.fillGarment(look, handlers, 'shoes');
    else if (this.lookFocus === 'hats') this.fillAccessories(look, handlers, ['hat']);
    else if (this.lookFocus === 'bags') this.fillAccessories(look, handlers, ['bag']);
    else if (this.lookFocus === 'jewelry') this.fillAccessories(look, handlers, ['glasses', 'watch', 'neck', 'ears']);
    else if (this.lookFocus === 'makeup') this.fillMakeup(look, handlers);
    else if (this.lookFocus === 'outfits') this.fillOutfits(look, handlers);
    else if (this.lookFocus === 'shop') this.fillShop(look, handlers);
    else this.fillWardrobe(look, handlers);
    this.fillStage(handlers);
    this.lookPanel.classList.remove('hidden');
    this.root.classList.add('studio-open');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  showWardrobe(): void {
    this.lookFocus = 'wardrobe';
    if (this.shownLook && this.lookHandlers) this.showLookPanel(this.shownLook, this.lookHandlers);
  }

  lookCamera(): 'face' | 'body' {
    if (this.framingOverride) return this.framingOverride;
    return this.lookFocus === 'face' || this.lookFocus === 'hair' || this.lookFocus === 'makeup' ? 'face' : 'body';
  }

  private wanted(text: string): boolean {
    const query = this.lookQuery.trim().toLowerCase();
    return query.length === 0 || text.toLowerCase().includes(query);
  }

  private fillHair(look: PlayerLook, handlers: LookHandlers): void {
    const hair = cssColor(HAIR.find((item) => item.id === look.hairId)?.color ?? 0x3d2817);
    const skin = cssColor(SKINS.find((item) => item.id === look.skinId)?.color ?? 0xe8b48a);
    const cuts = document.createElement('div');
    cuts.className = 'look-gallery';
    for (const cut of HAIR_CUTS) {
      if (!cut.sexes.includes(look.sex) || !this.wanted(`${cut.name} ${cut.detail}`)) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'look-card' + (look.hairStyle === cut.id ? ' on' : '');
      btn.innerHTML = `${hairSvg(cut.id, hair, skin)}<strong>${cut.name}</strong><em>${cut.detail}</em>`;
      btn.addEventListener('click', () => handlers.onHairStyle(cut.id));
      cuts.appendChild(btn);
    }
    this.section('Coupes du modèle');
    this.lookList.appendChild(cuts);
    for (const group of [...new Set(BUILT_HAIR.map((item) => item.group))]) {
      const items = BUILT_HAIR.filter((item) => item.group === group && this.wanted(`${item.name} ${item.detail} ${group}`));
      if (items.length === 0) continue;
      this.section(group);
      const gallery = document.createElement('div');
      gallery.className = 'look-gallery';
      for (const item of items) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'look-card' + (look.hairStyle === item.id ? ' on' : '');
        const thumb = hairThumb(item.id);
        btn.innerHTML = `${thumb ? `<img class="look-thumb" src="${thumb}" alt="">` : ''}<strong>${item.name}</strong><em>${item.detail}</em>`;
        btn.addEventListener('click', () => handlers.onHairStyle(item.id));
        gallery.appendChild(btn);
      }
      this.lookList.appendChild(gallery);
    }
    this.section('Couleur');
    this.lookList.appendChild(this.chips(HAIR, look.hairId, handlers.onHair));
    this.section('Sourcils');
    this.lookList.appendChild(this.chips(HAIR, look.browId, handlers.onBrow));
    this.section('Barbe et moustache');
    this.lookList.appendChild(this.pills(BEARDS, look.beardId, handlers.onBeard));
  }

  private pills<T extends string>(items: { id: T; name: string }[], active: T, onPick: (id: T) => void): HTMLElement {
    const row = document.createElement('div');
    row.className = 'look-row look-row-3';
    for (const item of items) {
      if (!this.wanted(item.name)) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'look-pill' + (item.id === active ? ' on' : '');
      btn.textContent = item.name;
      btn.addEventListener('click', () => onPick(item.id));
      row.appendChild(btn);
    }
    return row;
  }

  private priceLabel(item: AccessoryDef): string {
    if (item.starter) return 'Offert';
    if (isOwned(item.id)) return 'Possédé';
    return `${item.price.toLocaleString('fr-FR')} FCFA`;
  }

  private accessoryCard(look: PlayerLook, handlers: LookHandlers, item: AccessoryDef): HTMLElement {
    const field = SLOT_FIELDS[item.slot];
    const worn = look[field.id] === item.id;
    const owned = isOwned(item.id);
    const card = document.createElement('div');
    card.className = 'shop-card' + (worn ? ' on' : '');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'look-card' + (worn ? ' on' : '');
    const thumb = accessoryThumb(item.id);
    btn.innerHTML = `${thumb ? `<img class="look-thumb" src="${thumb}" alt="">` : ''}<strong>${item.name}</strong><em>${item.detail}</em><b class="${owned ? 'owned' : 'price'}">${this.priceLabel(item)}</b>`;
    btn.addEventListener('click', () => handlers.onAccessory(item.slot, worn ? 'aucun' : item.id));
    card.appendChild(btn);
    if (!owned) {
      const buy = document.createElement('button');
      buy.type = 'button';
      buy.className = 'shop-buy';
      buy.disabled = handlers.money() < item.price;
      buy.textContent = buy.disabled ? 'FCFA insuffisants' : `Acheter · ${item.price.toLocaleString('fr-FR')}`;
      buy.addEventListener('click', () => handlers.onBuy([item.id]));
      card.appendChild(buy);
    }
    return card;
  }

  private fillDresses(look: PlayerLook, handlers: LookHandlers): void {
    const note = document.createElement('div');
    note.className = 'look-note';
    note.textContent =
      'Une robe remplace le haut et le bas du modèle. « Aucune » rend ses habits d’origine.';
    this.lookList.appendChild(note);
    this.section('Robes');
    const gallery = document.createElement('div');
    gallery.className = 'look-gallery';
    const none = document.createElement('button');
    none.type = 'button';
    none.className = 'look-card' + (look.dressId === 'aucune' ? ' on' : '');
    none.innerHTML = `<strong>Aucune</strong><em>Habits du modèle</em>`;
    none.addEventListener('click', () => handlers.onDressPick('aucune'));
    gallery.appendChild(none);
    for (const item of DRESSES) {
      if (!this.wanted(`${item.name} ${item.detail}`)) continue;
      const worn = look.dressId === item.id;
      const owned = isOwned(item.id);
      const card = document.createElement('div');
      card.className = 'shop-card' + (worn ? ' on' : '');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'look-card' + (worn ? ' on' : '');
      const price = owned ? 'Possédé' : `${item.price.toLocaleString('fr-FR')} FCFA`;
      btn.innerHTML = `<strong>${item.name}</strong><em>${item.detail}</em><b class="${owned ? 'owned' : 'price'}">${price}</b>`;
      btn.addEventListener('click', () => handlers.onDressPick(worn ? 'aucune' : item.id));
      card.appendChild(btn);
      if (!owned) {
        const buy = document.createElement('button');
        buy.type = 'button';
        buy.className = 'shop-buy';
        buy.disabled = handlers.money() < item.price;
        buy.textContent = buy.disabled ? 'FCFA insuffisants' : `Acheter · ${item.price.toLocaleString('fr-FR')}`;
        buy.addEventListener('click', () => handlers.onBuy([item.id]));
        card.appendChild(buy);
      }
      gallery.appendChild(card);
    }
    this.lookList.appendChild(gallery);
    if (look.dressId === 'aucune') return;
    this.section('Couleur de la robe');
    this.lookList.appendChild(this.chips(CLOTHES, look.dressColor, handlers.onDressColor));
  }

  private shopFilters(look: PlayerLook, handlers: LookHandlers): void {
    const row = document.createElement('div');
    row.className = 'look-row look-row-3';
    for (const [id, label] of [
      ['all', 'Tout'],
      ['owned', 'Possédés'],
      ['shop', 'À acheter'],
    ] as const) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'look-pill' + (this.shopFilter === id ? ' on' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        this.shopFilter = id;
        this.showLookPanel(look, handlers);
      });
      row.appendChild(btn);
    }
    this.lookList.appendChild(row);
    const unpaid = unownedAccessories(look);
    if (unpaid.length === 0) return;
    const total = unpaid.reduce((sum, id) => {
      const acc = ACCESSORIES.find((a) => a.id === id)?.price;
      const dress = DRESSES.find((d) => d.id === id)?.price;
      return sum + (acc ?? dress ?? 0);
    }, 0);
    const bar = document.createElement('div');
    bar.className = 'shop-summary';
    bar.innerHTML = `<span>Essayé, pas encore acheté · <b>${total.toLocaleString('fr-FR')} FCFA</b></span>`;
    const buy = document.createElement('button');
    buy.type = 'button';
    buy.disabled = handlers.money() < total;
    buy.textContent = buy.disabled ? 'FCFA insuffisants' : 'Tout acheter';
    buy.addEventListener('click', () => handlers.onBuy(unpaid));
    bar.appendChild(buy);
    this.lookList.appendChild(bar);
  }

  private passesFilter(item: AccessoryDef): boolean {
    if (this.shopFilter === 'owned') return isOwned(item.id);
    if (this.shopFilter === 'shop') return !isOwned(item.id);
    return true;
  }

  private fillAccessories(look: PlayerLook, handlers: LookHandlers, slots: AccessorySlot[]): void {
    this.shopFilters(look, handlers);
    for (const slot of slots) {
      const items = accessoriesFor(slot).filter((item) => this.passesFilter(item) && this.wanted(`${item.name} ${item.detail} ${SLOT_LABEL[slot]}`));
      if (items.length === 0) continue;
      this.section(SLOT_LABEL[slot]);
      const gallery = document.createElement('div');
      gallery.className = 'look-gallery';
      for (const item of items) gallery.appendChild(this.accessoryCard(look, handlers, item));
      this.lookList.appendChild(gallery);
      const field = SLOT_FIELDS[slot];
      const worn = ACCESSORIES.find((item) => item.id === look[field.id]);
      if (worn) {
        const off = document.createElement('button');
        off.type = 'button';
        off.className = 'look-pill';
        off.textContent = `Retirer ${worn.name.toLowerCase()}`;
        off.addEventListener('click', () => handlers.onAccessory(slot, 'aucun'));
        this.lookList.appendChild(off);
        if (worn.recolor && field.color) {
          this.section(`Couleur · ${worn.name}`);
          this.lookList.appendChild(this.chips(CLOTHES, look[field.color] as ClothId, (color) => handlers.onAccessoryColor(slot, color)));
        }
      }
    }
  }

  private fillShop(look: PlayerLook, handlers: LookHandlers): void {
    const note = document.createElement('div');
    note.className = 'look-note';
    note.textContent = `Solde · ${handlers.money().toLocaleString('fr-FR')} FCFA. Clique un article pour l’essayer, puis Acheter pour le garder.`;
    this.lookList.appendChild(note);
    this.fillAccessories(look, handlers, ['hat', 'glasses', 'bag', 'watch', 'neck', 'ears']);
    if (look.sex === 'femme') this.fillDresses(look, handlers);
  }

  private fillMakeup(look: PlayerLook, handlers: LookHandlers): void {
    this.section('Rouge à lèvres');
    this.lookList.appendChild(this.chips(LIPS, look.lipId, handlers.onLip));
    this.section('Blush');
    this.lookList.appendChild(this.chips(BLUSHES, look.blushId, handlers.onBlush));
    this.section('Fard à paupières');
    this.lookList.appendChild(this.chips(SHADOWS, look.shadowId, handlers.onShadow));
    this.section('Peau');
    const row = document.createElement('div');
    row.className = 'look-row';
    for (const [on, label] of [
      [false, 'Sans taches'],
      [true, 'Taches de rousseur'],
    ] as const) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'look-pill' + (look.freckles === on ? ' on' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => handlers.onFreckles(on));
      row.appendChild(btn);
    }
    this.lookList.appendChild(row);
  }

  private fillFace(look: PlayerLook, handlers: LookHandlers): void {
    this.section('Visages');
    const faces = document.createElement('div');
    faces.className = 'look-gallery';
    for (const preset of FACE_PRESETS) {
      if (!this.wanted(`${preset.name} ${preset.detail}`)) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'look-card';
      btn.innerHTML = `<strong>${preset.name}</strong><em>${preset.detail}</em>`;
      btn.addEventListener('click', () => {
        handlers.onNose(preset.look.nose ?? 1);
        handlers.onNoseWidth(preset.look.noseWidth ?? 1);
        handlers.onJaw(preset.look.jaw ?? 1);
        handlers.onChin(preset.look.chin ?? 1);
        handlers.onEye(look.eyeId);
      });
      faces.appendChild(btn);
    }
    this.lookList.appendChild(faces);
    this.section('Yeux');
    this.lookList.appendChild(this.chips(EYES, look.eyeId, handlers.onEye));
    this.section('Peau');
    this.lookList.appendChild(this.chips(SKINS, look.skinId, handlers.onSkin));
    if (this.wanted('nez')) {
      this.slider('Nez — longueur', look.nose, 0.75, 1.4, (nose) => handlers.onNose(nose));
      this.slider('Nez — largeur', look.noseWidth, 0.75, 1.4, (width) => handlers.onNoseWidth(width));
    }
    if (this.wanted('machoire') || this.wanted('mâchoire') || this.lookQuery.trim() === '') {
      this.slider('Mâchoire', look.jaw, 0.9, 1.12, (jaw) => handlers.onJaw(jaw));
    }
    if (this.wanted('menton') || this.lookQuery.trim() === '') {
      this.slider('Menton', look.chin, 0.85, 1.2, (chin) => handlers.onChin(chin));
    }
  }

  private fillPerson(look: PlayerLook, handlers: LookHandlers): void {
    this.section('Sexe');
    const row = document.createElement('div');
    row.className = 'look-row';
    for (const sex of ['femme', 'homme'] as const) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'taxi-dest look-choice' + (look.sex === sex ? ' decor-equipped' : '');
      btn.innerHTML = `<span>${sex === 'femme' ? 'Femme' : 'Homme'}</span>`;
      btn.addEventListener('click', () => handlers.onSex(sex));
      row.appendChild(btn);
    }
    this.lookList.appendChild(row);

    this.section('Personnages');
    const people = document.createElement('div');
    people.className = 'look-gallery';
    for (const character of charactersFor(look.sex)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'look-card' + (look.characterId === character.id ? ' on' : '');
      const style = character.id === 'maya' ? 'queue' : 'courte';
      btn.innerHTML = `${portraitSvg(look, style, !character.separateClothes)}<strong>${character.name}</strong><em>${character.clothes}</em>`;
      btn.addEventListener('click', () => handlers.onCharacter(character.id));
      people.appendChild(btn);
    }
    this.lookList.appendChild(people);

    this.section('Apparences');
    const presets = document.createElement('div');
    presets.className = 'look-gallery';
    for (const preset of LOOK_PRESETS) {
      if (preset.look.sex && preset.look.sex !== look.sex) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'look-card';
      btn.innerHTML = `${portraitSvg({ ...look, ...preset.look }, preset.look.hairStyle ?? look.hairStyle, preset.look.characterId === 'harper')}<strong>${preset.name}</strong><em>${preset.blurb}</em>`;
      btn.addEventListener('click', () => handlers.onPreset(preset.id));
      presets.appendChild(btn);
    }
    this.lookList.appendChild(presets);

  }

  private fillProportions(look: PlayerLook, handlers: LookHandlers): void {
    this.section('Peau');
    this.lookList.appendChild(this.chips(SKINS, look.skinId, handlers.onSkin));
    this.slider('Taille', look.height, 0.92, 1.08, handlers.onHeight);
    this.slider('Épaules', look.shoulders, 0.9, 1.12, handlers.onShoulders);
    this.slider('Torse', look.torso, 0.92, 1.1, handlers.onTorso);
    this.slider('Hanches', look.hips, 0.9, 1.12, handlers.onHips);
    this.slider('Bras', look.arms, 0.9, 1.12, handlers.onArms);
    this.slider('Jambes', look.legs, 0.96, 1.06, handlers.onLegs);
  }

  private fillOutfits(look: PlayerLook, handlers: LookHandlers): void {
    const separate = characterById(look.characterId).separateClothes;
    const outfits = document.createElement('div');
    outfits.className = 'look-gallery';
    for (const outfit of OUTFITS) {
      if (!this.wanted(`${outfit.name} ${outfit.detail}`)) continue;
      const on = look.topId === outfit.topId && look.bottomId === outfit.bottomId && look.shoeId === outfit.shoeId;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'look-card' + (on ? ' on' : '');
      btn.innerHTML = `${outfitSvg(outfit.topId, outfit.bottomId, outfit.shoeId, !separate)}<strong>${outfit.name}</strong><em>${outfit.detail}</em>`;
      btn.addEventListener('click', () => handlers.onOutfit(outfit.id));
      outfits.appendChild(btn);
    }
    this.lookList.appendChild(outfits);
    if (!separate) {
      const note = document.createElement('div');
      note.className = 'look-note';
      note.textContent = 'Le tailleur de Harper est une seule pièce. La couleur du haut teint tout le costume.';
      this.lookList.appendChild(note);
    }
  }

  private fillGarment(look: PlayerLook, handlers: LookHandlers, slot: 'top' | 'bottom' | 'shoes'): void {
    const separate = characterById(look.characterId).separateClothes;
    if (slot === 'top' && !separate) {
      const note = document.createElement('div');
      note.className = 'look-note';
      note.textContent = 'Harper porte un tailleur d’une seule pièce.';
      this.lookList.appendChild(note);
      this.lookList.appendChild(this.chips(CLOTHES, look.topId, handlers.onSuit));
      return;
    }
    if (slot === 'bottom' && !separate) {
      const note = document.createElement('div');
      note.className = 'look-note';
      note.textContent = 'Ce bas est gardé pour Maya et Sam. Le tailleur de Harper ne se sépare pas.';
      this.lookList.appendChild(note);
    }
    const active = slot === 'top' ? look.topId : slot === 'bottom' ? look.bottomId : look.shoeId;
    const pick = slot === 'top' ? handlers.onTop : slot === 'bottom' ? handlers.onBottom : handlers.onShoes;
    this.lookList.appendChild(this.chips(CLOTHES, active, pick));
  }

  private fillWardrobe(look: PlayerLook, handlers: LookHandlers): void {
    const note = document.createElement('div');
    note.className = 'look-note';
    note.textContent = 'Chaque tenue enregistrée garde le personnage, la coupe, le visage et les couleurs.';
    this.lookList.appendChild(note);
    const items = loadWardrobe().filter((item) => this.wanted(item.name));
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'look-note';
      empty.textContent = 'Aucune tenue enregistrée. Sauver en bas du studio en crée une.';
      this.lookList.appendChild(empty);
    }
    for (const item of items) {
      const card = document.createElement('div');
      card.className = 'wardrobe-card' + (item.favorite ? ' fav' : '');
      const head = document.createElement('div');
      head.className = 'wardrobe-head';
      const name = document.createElement('input');
      name.className = 'look-name-input';
      name.value = item.name;
      name.addEventListener('change', () => handlers.onRenameSaved(item.id, name.value));
      const star = document.createElement('button');
      star.type = 'button';
      star.textContent = item.favorite ? '★' : '☆';
      star.addEventListener('click', () => handlers.onFavoriteSaved(item.id));
      head.append(name, star);
      const actions = document.createElement('div');
      actions.className = 'look-row look-row-3';
      for (const [label, run] of [
        ['Porter', () => handlers.onEquipSaved(item.id)],
        ['Copier', () => handlers.onDuplicateSaved(item.id)],
        ['Supprimer', () => handlers.onDeleteSaved(item.id)],
      ] as const) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.addEventListener('click', run);
        actions.appendChild(btn);
      }
      card.append(head, actions);
      this.lookList.appendChild(card);
    }
    void look;
  }

  private fillStage(handlers: LookHandlers): void {
    this.lookStage.innerHTML = '';
    const views = document.createElement('div');
    views.className = 'creator-views';
    for (const [id, label] of [
      ['front', 'Face'],
      ['left', 'Gauche'],
      ['right', 'Droite'],
      ['back', 'Dos'],
      ['full', 'Corps'],
    ] as const) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        if (id === 'full') this.framingOverride = 'body';
        handlers.onView(id);
      });
      views.appendChild(btn);
    }
    const poses = document.createElement('div');
    poses.className = 'creator-views';
    for (const [id, label] of [
      ['idle', 'Pose'],
      ['walk', 'Marche'],
      ['run', 'Course'],
      ['turn', 'Tour'],
      ['sit', 'Assis'],
    ] as const) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.addEventListener('click', () => handlers.onPose(id));
      poses.appendChild(btn);
    }
    const actions = document.createElement('div');
    actions.className = 'creator-actions';
    const order: LookFocus[] = [
      'person', 'body', 'face', 'hair', 'dresses', 'top', 'bottom', 'shoes', 'hats', 'bags', 'jewelry', 'makeup', 'outfits', 'shop', 'wardrobe',
    ];
    const back = document.createElement('button');
    back.type = 'button';
    back.textContent = 'Retour';
    back.addEventListener('click', () => {
      const index = order.indexOf(this.lookFocus);
      this.lookFocus = order[Math.max(0, index - 1)] ?? 'person';
      this.framingOverride = null;
      if (this.shownLook && this.lookHandlers) this.showLookPanel(this.shownLook, this.lookHandlers);
    });
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Reset';
    reset.addEventListener('click', () => handlers.onReset());
    const random = document.createElement('button');
    random.type = 'button';
    random.textContent = 'Hasard';
    random.addEventListener('click', () => handlers.onRandom());
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'Sauver';
    save.addEventListener('click', () => handlers.onSaveOutfit());
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Annuler';
    cancel.addEventListener('click', () => handlers.onCancel());
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'on';
    confirm.textContent = 'Confirmer';
    confirm.addEventListener('click', () => handlers.onConfirm());
    actions.append(back, reset, random, save, cancel, confirm);
    this.lookStage.append(views, poses, actions);
  }

  private slider(
    title: string,
    value: number,
    min: number,
    max: number,
    onInput: (value: number) => void,
  ): void {
    this.section(title);
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'look-slider';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = '0.01';
    slider.value = String(value);
    slider.addEventListener('input', () => onInput(Number(slider.value)));
    this.lookList.appendChild(slider);
  }

  private section(title: string): void {
    const h = document.createElement('div');
    h.className = 'decor-section';
    h.textContent = title;
    this.lookList.appendChild(h);
  }

  private chips<T extends string>(
    items: { id: T; name: string; color: number }[],
    active: T,
    onPick: (id: T) => void,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'look-chips';
    for (const item of items) {
      if (!this.wanted(item.name)) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'look-chip' + (item.id === active ? ' on' : '');
      btn.innerHTML = `<span style="background:${cssColor(item.color)}"></span><em>${item.name}</em>`;
      btn.addEventListener('click', () => onPick(item.id));
      row.appendChild(btn);
    }
    return row;
  }

  hideLookPanel(): void {
    this.lookPanel.classList.add('hidden');
    this.root.classList.remove('studio-open');
  }

  isLookPanelOpen(): boolean {
    return !this.lookPanel.classList.contains('hidden');
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

/** Writes a FAB caption without wiping its shortcut badge. */
function setFabLabel(btn: HTMLElement, text: string): void {
  const txt = btn.querySelector('.fab-txt') ?? btn;
  if (txt.textContent !== text) txt.textContent = text;
}

function cssColor(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function clothColor(id: string): string {
  return cssColor(CLOTHES.find((item) => item.id === id)?.color ?? 0xffffff);
}

function tone(id: string, fallback: string): string {
  return id === 'origine' ? fallback : clothColor(id);
}

function hairSvg(style: HairStyle, hair: string, skin: string): string {
  const cut =
    style === 'chauve'
      ? `<ellipse cx="40" cy="28" rx="14" ry="5" fill="#000" opacity=".12"/>`
      : style === 'queue'
        ? `<path d="M26 30c1-14 26-16 28-1 2 6-2 12-8 14-4-8-10-6-14-1-5-8-10-8-12-12z" fill="${hair}"/>
           <path d="M52 40c8 2 12 16 8 32-6-2-8-16-6-26-2-4-4-6-2-6z" fill="${hair}"/>`
        : `<path d="M22 34c2-16 36-18 38 0 2 8-2 14-8 16-6-10-12-6-16 0-6-10-14-10-14-16z" fill="${hair}"/>`;
  const gid = `hg-${style}`;
  return `<svg viewBox="0 0 80 104" aria-hidden="true">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#355a4c"/><stop offset="100%" stop-color="#10211b"/></linearGradient></defs>
    <rect width="80" height="104" rx="14" fill="url(#${gid})"/>
    <rect x="1.2" y="1.2" width="77.6" height="101.6" rx="13" fill="none" stroke="#c9a227" stroke-opacity=".28"/>
    <ellipse cx="40" cy="92" rx="18" ry="5" fill="#000" opacity=".22"/>
    <circle cx="40" cy="40" r="16" fill="${skin}"/>
    ${cut}
    <circle cx="34" cy="39" r="1.6" fill="#24180f"/>
    <circle cx="46" cy="39" r="1.6" fill="#24180f"/>
    <path d="M34 48c2.4 3.2 9.6 3.2 12 0" fill="none" stroke="#24180f" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`;
}

function outfitSvg(topId: string, bottomId: string, shoeId: string, suit: boolean): string {
  const top = tone(topId, '#2c3444');
  const bottom = tone(bottomId, '#3a4252');
  const shoe = tone(shoeId, '#1a120c');
  const legs = suit ? top : bottom;
  const body = suit
    ? `<path d="M22 40h36l3 26H19z" fill="${top}"/><path d="M36 40l5 12h-10z" fill="#f6f3ee"/>`
    : `<path d="M28 40h24l2 16H26z" fill="${top}"/>`;
  const gid = `og-${topId}-${bottomId}-${shoeId}`;
  return `<svg viewBox="0 0 80 104" aria-hidden="true">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#355a4c"/><stop offset="100%" stop-color="#10211b"/></linearGradient></defs>
    <rect width="80" height="104" rx="14" fill="url(#${gid})"/>
    <rect x="1.2" y="1.2" width="77.6" height="101.6" rx="13" fill="none" stroke="#c9a227" stroke-opacity=".28"/>
    <ellipse cx="40" cy="96" rx="16" ry="4" fill="#000" opacity=".2"/>
    <circle cx="40" cy="22" r="8" fill="#e6c3a6"/>
    <path d="M32 18c1-7 15-8 16 0 1 3-1 5-3 6H35c-2-1-4-3-3-6z" fill="#3a2418"/>
    ${body}
    <path d="M26 66h12v22H24z" fill="${legs}"/><path d="M42 66h12v22H40z" fill="${legs}"/>
    <path d="M24 88h14v6H22z" fill="${shoe}"/><path d="M42 88h16v6H40z" fill="${shoe}"/>
  </svg>`;
}

function portraitSvg(look: Partial<PlayerLook>, style: HairStyle, suit: boolean): string {
  const skin = cssColor(SKINS.find((item) => item.id === look.skinId)?.color ?? 0xe8b48a);
  const hair = cssColor(HAIR.find((item) => item.id === look.hairId)?.color ?? 0x3d2817);
  const top = tone(look.topId ?? 'origine', '#2c3444');
  const legs = suit ? top : tone(look.bottomId ?? 'origine', '#3a4252');
  const shoe = tone(look.shoeId ?? 'origine', '#1a120c');
  const cut =
    style === 'chauve'
      ? ''
      : style === 'queue'
        ? `<path d="M28 20c1-8 22-9 24 0 2 4-1 8-6 9-3-5-8-4-11 0-4-5-8-5-9-9z" fill="${hair}"/><path d="M50 28c6 2 8 12 5 22-4-1-5-10-4-16z" fill="${hair}"/>`
        : `<path d="M26 22c1-10 28-11 30 0 1 5-2 9-6 10-5-6-10-4-13 0-4-6-10-6-11-10z" fill="${hair}"/>`;
  const torso = suit
    ? `<path d="M24 36h32l2 18H22z" fill="${top}"/><path d="M37 36l4 8h-8z" fill="#f6f3ee"/>`
    : `<path d="M28 36h24l1 14H27z" fill="${top}"/>`;
  const gid = `pg-${look.skinId ?? 's'}-${style}`;
  return `<svg viewBox="0 0 80 104" aria-hidden="true">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#355a4c"/><stop offset="100%" stop-color="#10211b"/></linearGradient></defs>
    <rect width="80" height="104" rx="14" fill="url(#${gid})"/>
    <rect x="1.2" y="1.2" width="77.6" height="101.6" rx="13" fill="none" stroke="#c9a227" stroke-opacity=".28"/>
    <ellipse cx="40" cy="96" rx="16" ry="4" fill="#000" opacity=".2"/>
    ${cut}
    <circle cx="40" cy="24" r="10" fill="${skin}"/>
    <circle cx="36" cy="24" r="1.2" fill="#24180f"/><circle cx="44" cy="24" r="1.2" fill="#24180f"/>
    ${torso}
    <path d="M28 54h10v24H26z" fill="${legs}"/><path d="M42 54h10v24H40z" fill="${legs}"/>
    <path d="M26 78h12v6H24z" fill="${shoe}"/><path d="M42 78h14v6H40z" fill="${shoe}"/>
  </svg>`;
}
