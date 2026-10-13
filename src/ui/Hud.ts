import { WorldConfig } from '../config/WorldConfig';
import type { TaxiDestination } from '../vehicles/TaxiDestinations';
import { estimateFare } from '../vehicles/TaxiDestinations';
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
import { accessoryThumb, ensureThumbnails, hairThumb } from '../player/fashion/thumbnails';
import { SLOT_FIELDS, unownedAccessories } from '../player/PlayerLook';

export type LookFocus =
  | 'person'
  | 'body'
  | 'face'
  | 'hair'
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
  onDress: (id: ClothId) => void;
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
  private readonly furnBtn: HTMLElement;
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
  private onFurnClick: (() => void) | null = null;
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
        <button type="button" class="map-fab" id="btn-look">Perso</button>
        <button type="button" class="map-fab hidden" id="btn-furn">Meubles</button>
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
    this.furnBtn = this.root.querySelector('#btn-furn') as HTMLElement;
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
    this.root.querySelector('#look-close')!.addEventListener('click', () => {
      this.lookHandlers?.onConfirm();
    });
    this.root.querySelector('#btn-look')!.addEventListener('click', () => this.onLookClick?.());
    this.root.querySelector('#btn-map')!.addEventListener('click', () => this.onMapClick?.());
    this.root.querySelector('#btn-aerial')!.addEventListener('click', () => this.onAerialClick?.());
    this.root.querySelector('#btn-mute')!.addEventListener('click', () => this.onMuteClick?.());
    this.root.querySelector('#btn-phone')!.addEventListener('click', () => this.onPhoneClick?.());
    this.root.querySelector('#btn-pause')!.addEventListener('click', () => this.onPauseClick?.());
    this.decorBtn.addEventListener('click', () => this.onDecorOpen?.());
    this.furnBtn.addEventListener('click', () => this.onFurnClick?.());
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
  onMoveFurniture(cb: () => void): void {
    this.onFurnClick = cb;
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
    this.furnBtn.classList.toggle('hidden', !on);
    if (!on) {
      this.hideDecorShop();
      this.furnBtn.classList.remove('on');
    }
  }

  setFurnitureMode(on: boolean): void {
    this.furnBtn.classList.toggle('on', on);
    this.furnBtn.textContent = on ? 'Finir' : 'Meubles';
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
    const total = unpaid.reduce((sum, id) => sum + (ACCESSORIES.find((a) => a.id === id)?.price ?? 0), 0);
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
      this.lookList.appendChild(this.chips(CLOTHES, look.topId, handlers.onDress));
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
      'person', 'body', 'face', 'hair', 'top', 'bottom', 'shoes', 'hats', 'bags', 'jewelry', 'makeup', 'outfits', 'shop', 'wardrobe',
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
  return `<svg viewBox="0 0 80 104" aria-hidden="true"><rect width="80" height="104" rx="12" fill="#0e1a16"/><circle cx="40" cy="40" r="16" fill="${skin}"/>${cut}<circle cx="34" cy="40" r="1.5" fill="#24180f"/><circle cx="46" cy="40" r="1.5" fill="#24180f"/><path d="M34 48c2 3 10 3 12 0" fill="none" stroke="#24180f" stroke-width="1"/></svg>`;
}

function outfitSvg(topId: string, bottomId: string, shoeId: string, suit: boolean): string {
  const top = tone(topId, '#2c3444');
  const bottom = tone(bottomId, '#3a4252');
  const shoe = tone(shoeId, '#1a120c');
  const legs = suit ? top : bottom;
  const body = suit
    ? `<path d="M22 40h36l3 26H19z" fill="${top}"/><path d="M36 40l5 12h-10z" fill="#f6f3ee"/>`
    : `<path d="M28 40h24l2 16H26z" fill="${top}"/>`;
  return `<svg viewBox="0 0 80 104" aria-hidden="true"><rect width="80" height="104" rx="12" fill="#0e1a16"/><circle cx="40" cy="22" r="8" fill="#e6c3a6"/><path d="M32 18c1-7 15-8 16 0 1 3-1 5-3 6H35c-2-1-4-3-3-6z" fill="#3a2418"/>${body}<path d="M26 66h12v22H24z" fill="${legs}"/><path d="M42 66h12v22H40z" fill="${legs}"/><path d="M24 88h14v6H22z" fill="${shoe}"/><path d="M42 88h16v6H40z" fill="${shoe}"/></svg>`;
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
  return `<svg viewBox="0 0 80 104" aria-hidden="true"><rect width="80" height="104" rx="12" fill="#0e1a16"/>${cut}<circle cx="40" cy="24" r="10" fill="${skin}"/><circle cx="36" cy="24" r="1.2" fill="#24180f"/><circle cx="44" cy="24" r="1.2" fill="#24180f"/>${torso}<path d="M28 54h10v24H26z" fill="${legs}"/><path d="M42 54h10v24H40z" fill="${legs}"/><path d="M26 78h12v6H24z" fill="${shoe}"/><path d="M42 78h14v6H40z" fill="${shoe}"/></svg>`;
}
