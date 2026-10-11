import type * as THREE from 'three';
import { Engine } from './Engine';
import { Input } from './Input';
import { CollisionSystem } from '../world/CollisionSystem';
import { buildBootstrapWorld } from '../world/BootstrapWorld';
import { createPlayerAvatar } from '../player/PlayerAvatar';
import { PlayerController } from '../player/PlayerController';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera';
import { AerialCamera } from '../camera/AerialCamera';
import { Hud } from '../ui/Hud';
import { CityMap } from '../ui/CityMap';
import { MobileControls } from '../ui/MobileControls';
import { findDistrictAt } from '../data/districts';
import { profileFor } from '../data/districtProfiles';
import { EditorStub } from '../editor/EditorStub';
import { PedestrianSystem } from '../pedestrians/PedestrianSystem';
import { nearestLandmark } from '../landmarks/LandmarkSites';
import {
  isInsidePlayerHouse,
  setHomeInteriorMode,
  PLAYER_HOUSE,
} from '../landmarks/PlayerHouse';
import { TrafficSystem } from '../vehicles/TrafficSystem';
import { TaxiSystem } from '../vehicles/TaxiSystem';
import { ParkedCarSystem } from '../vehicles/ParkedCarSystem';
import { estimateFare, type TaxiDestination } from '../vehicles/TaxiDestinations';
import { GameAudio } from '../audio/GameAudio';
import {
  applyHomeDecor,
  loadHomeDecor,
  purchaseDecorItem,
  purchaseFloorPaint,
  purchaseWallPaint,
  type HomeDecorState,
} from '../home/HomeDecor';
import {
  getHomeSpots,
  isHomeDoorOpen,
  nearestHomeSpot,
  nearOutsideDoor,
  runHomeAction,
  tipForSpot,
  type HomeSpot,
} from '../home/HomeInteract';
import { PlayerActivity } from '../player/PlayerActivity';
import { PhoneUI } from '../ui/PhoneUI';
import { PauseMenu } from '../ui/PauseMenu';
import { DialogueUI, dialogueForRole } from '../ui/DialogueUI';
import { GameClock } from '../sim/GameClock';
import { PlayerNeeds } from '../sim/PlayerNeeds';
import { loadGameSave, writeGameSave } from '../save/GameSave';
import { GraphicsConfig, applyQuality, saveGraphicsSettings, type GraphicsQuality } from '../config/GraphicsConfig';
import { PerfHud } from '../render/PerfHud';
import { CityDistanceCull } from '../world/CityDistanceCull';
import { SocialMemory } from '../sim/SocialMemory';
import {
  nearestLifeSpot,
  offersFor,
  jobPay,
  type LifeSpot,
  type ShopOffer,
} from '../sim/LifeSpots';

export class GameApp {
  private engine!: Engine;
  private input!: Input;
  private player!: PlayerController;
  private cameraRig!: ThirdPersonCamera;
  private aerial!: AerialCamera;
  private hud!: Hud;
  private cityMap!: CityMap;
  private phone!: PhoneUI;
  private pauseMenu!: PauseMenu;
  private dialogue!: DialogueUI;
  private pedestrians!: PedestrianSystem;
  private traffic!: TrafficSystem;
  private taxis!: TaxiSystem;
  private parked!: ParkedCarSystem;
  private cityRoot!: THREE.Group;
  private houseRoot: THREE.Group | null = null;
  private homeSpots: HomeSpot[] = [];
  private activity = new PlayerActivity();
  private clock = new GameClock();
  private needs = new PlayerNeeds();
  private audio = new GameAudio();
  private money = 50000;
  private collisions = new CollisionSystem();
  private editor = new EditorStub();
  private running = false;
  private wasInsideHome = false;
  private homeBusy = 0;
  private pendingActivity: 'sleep' | 'cook' | 'tv' | 'wash' | 'clothes' | 'work' | null = null;
  private lastJobPay = 0;
  private homeDecor: HomeDecorState = loadHomeDecor();
  private talkingNpc: THREE.Group | null = null;
  private social = new SocialMemory();
  /** Real timestamp (ms) of last finished job — cooldown independent of clock. */
  private lastJobAt = 0;
  private fpsWarnTimer = 0;
  private fpsAutoDropped = false;
  private dayNightAcc = 0;
  private autoSaveAcc = 0;
  private cityCull = new CityDistanceCull();
  private perf!: PerfHud;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly uiRoot: HTMLElement,
  ) {}

  start(): void {
    this.engine = new Engine(this.canvas);
    this.input = new Input(this.canvas);
    this.cityRoot = buildBootstrapWorld(this.engine.scene, this.collisions);
    this.houseRoot = this.cityRoot.getObjectByName('landmark-player-house') as THREE.Group | null;
    this.homeSpots = getHomeSpots(PLAYER_HOUSE.cx, PLAYER_HOUSE.cz);
    const anchors = (this.cityRoot.userData.landmarkAnchors ?? []) as Array<{
      x: number;
      z: number;
      landmarkId: string;
    }>;

    const npcDens = 1.15 * GraphicsConfig.npcDensity;
    const trafficCount = Math.round(55 * GraphicsConfig.trafficDensity);
    this.pedestrians = new PedestrianSystem(this.engine.scene, anchors, npcDens);
    this.traffic = new TrafficSystem(this.engine.scene, trafficCount);
    this.taxis = new TaxiSystem(this.engine.scene);
    this.parked = new ParkedCarSystem(this.engine.scene, this.collisions);
    this.parked.collectFrom(this.cityRoot);

    const avatar = createPlayerAvatar();
    this.engine.scene.add(avatar);

    this.cameraRig = new ThirdPersonCamera(this.engine.camera, this.input);
    this.aerial = new AerialCamera(this.engine.camera, this.engine.scene, this.input);
    this.player = new PlayerController(avatar, this.input, this.cameraRig, this.collisions);
    avatar.rotation.y = 0;

    this.hud = new Hud(this.uiRoot);
    this.perf = new PerfHud(this.uiRoot);
    this.cityMap = new CityMap(this.uiRoot);
    this.phone = new PhoneUI(this.uiRoot);
    this.pauseMenu = new PauseMenu(this.uiRoot);
    this.dialogue = new DialogueUI(this.uiRoot);
    new MobileControls(this.uiRoot, this.input);

    this.restoreSave();
    this.hud.setMoney(this.money);
    this.hud.setNeeds(this.needs.snapshot(), this.needs.moodLabel());
    this.hud.setDistrict(PLAYER_HOUSE.name);
    this.hud.setTip('WASD · E interagir · P téléphone · Esc pause');
    this.hud.setMission(`Ville vivante · ${this.pedestrians.count} PNJ · ${this.traffic.count} véhicules`);
    this.hud.onOpenMap(() => {
      this.audio.playUi();
      this.toggleMap();
    });
    this.hud.onToggleAerial(() => {
      this.audio.playUi();
      this.toggleAerial();
    });
    this.hud.onToggleMute(() => {
      const muted = this.audio.toggleMute();
      this.hud.setMuted(muted);
    });
    this.hud.onOpenDecor(() => this.openDecorShop());
    this.hud.onOpenPhone(() => this.togglePhone());
    this.hud.onOpenPause(() => this.togglePause());
    this.audio.init();

    if (this.houseRoot && isInsidePlayerHouse(this.player.object.position.x, this.player.object.position.z)) {
      this.enterHomeMode();
      this.wasInsideHome = true;
    }

    this.hud.notify(`Vie Sims · mange, dors, travaille, socialise`);
    this.hud.setMission('Satisfais tes besoins · gagne des FCFA');
    this.running = true;
    this.loop();
  }

  private loop = (): void => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const dt = this.engine.getDelta();
    const p = this.player.object.position;

    const ride = this.taxis.update(dt, this.player.object);
    if (ride.status) {
      this.hud.setTip(ride.status);
      this.hud.setDistrict(ride.status);
    }
    if (ride.arrived) {
      this.money = Math.max(0, this.money - ride.arrived.fare);
      this.hud.setMoney(this.money);
      this.hud.setTip(`Arrivé : ${ride.arrived.name} · −${ride.arrived.fare.toLocaleString('fr-FR')} FCFA`);
      this.hud.notify(`Yango · arrivé · ${ride.arrived.name}`);
      this.player.object.visible = true;
    }

    if (this.input.consumeAerialToggle()) this.toggleAerial();
    if (this.input.consumeMapToggle() && !this.aerial.active && !this.parked.driving) this.toggleMap();

    if (this.homeBusy > 0) {
      this.homeBusy = Math.max(0, this.homeBusy - dt);
      if (this.activity.active) this.activity.update(this.player.object, dt);
      if (this.homeBusy <= 0) {
        const kind = this.pendingActivity ?? this.activity.kind;
        if (this.activity.active) this.activity.stop(this.player.object);
        if (kind === 'sleep') {
          this.needs.applyActivity('sleep');
          this.clock.syncFromYaounde();
          this.engine.applyDayNight(this.clock.sunFactor, this.clock.weather);
          this.hud.notify(`Réveil · ${this.clock.label} (Yaoundé)`);
          this.hud.setTip('Repos restauré — heure réelle Yaoundé');
        } else if (kind === 'work') {
          const pay = this.lastJobPay;
          this.money += pay;
          this.needs.applyActivity('work');
          this.lastJobAt = Date.now();
          this.hud.setMoney(this.money);
          this.clock.syncFromYaounde();
          this.engine.applyDayNight(this.clock.sunFactor, this.clock.weather);
          this.hud.notify(`+${pay.toLocaleString('fr-FR')} FCFA · fin de service`);
          this.hud.setTip('Travail terminé — tu as gagné de l’argent');
        } else if (kind) {
          this.needs.applyActivity(kind);
          this.hud.notify('Activité terminée');
          this.hud.setTip('Terminé — tu peux bouger');
        }
        this.pendingActivity = null;
        this.hud.setNeeds(this.needs.snapshot(), this.needs.moodLabel());
      }
    }

    this.clock.update(dt);
    this.dayNightAcc += dt;
    if (this.dayNightAcc > 0.5 && !this.wasInsideHome && !this.aerial.active) {
      this.dayNightAcc = 0;
      this.engine.applyDayNight(this.clock.sunFactor, this.clock.weather);
    }
    this.hud.setClock(this.clock.label, this.clock.weatherLabel);

    if (this.input.consumePhoneToggle()) this.togglePhone();
    if (this.input.consumePauseToggle()) this.togglePause();

    const uiBlocking =
      this.hud.isTaxiMenuOpen() ||
      this.hud.isDecorShopOpen() ||
      this.hud.isShopMenuOpen() ||
      this.cityMap.isOpen() ||
      this.phone.isOpen() ||
      this.pauseMenu.isOpen() ||
      this.dialogue.isOpen();
    const driving = this.parked.driving;
    const busy = this.homeBusy > 0;

    if (this.aerial.active) {
      this.aerial.update(dt);
      this.hud.setDistrict('Vue aérienne');
      this.hud.setTip('WASD déplace · molette zoom · glisser oriente · V revient au sol');
      this.hud.setAerialMode(true);
    } else {
      this.hud.setAerialMode(false);

      if (driving && !uiBlocking) {
        const car = this.parked.update(dt, this.input, this.player.object);
        if (car) this.cameraRig.update(car, dt, { distance: 11, lookHeight: 1.2 });
        this.handleVehicleInteract();
        const carLabel = (this.parked.activeMesh?.userData.label as string) || 'Voiture';
        this.hud.setDistrict(`Au volant · ${carLabel}`);
        this.hud.setTip('WASD conduire · Shift turbo · E sortir');
      } else if (!ride.riding && !this.editor.isActive() && !uiBlocking) {
        if (!busy) {
          this.player.update(dt, {
            speedMul: this.needs.moveMultiplier(),
            canRun: this.needs.canRun(),
          });
        }
        this.needs.update(dt, this.player.moving, this.player.running, busy);
        this.hud.setNeeds(this.needs.snapshot(), this.needs.moodLabel());
        const warn = this.needs.popWarning();
        if (warn) this.hud.notify(warn);
        const inside = isInsidePlayerHouse(p.x, p.z);

        if (inside && !this.wasInsideHome) {
          this.enterHomeMode();
          this.audio.playUi();
          this.hud.setTip('Chez toi — approche lit / cuisine / TV / douche / armoire · E');
        } else if (!inside && this.wasInsideHome) {
          this.exitHomeMode();
          this.hud.setTip('Dehors — ta Jetour est dans l’allée · E pour conduire');
        }
        this.wasInsideHome = inside;

        this.cameraRig.update(
          this.player.object,
          dt,
          inside
            ? {
                distance: busy && this.activity.kind === 'sleep' ? 11 : 15,
                lookHeight: busy && this.activity.kind === 'sleep' ? 0.9 : 0.55,
                isometric: true,
              }
            : undefined,
        );
        if (!busy) this.handleVehicleInteract();

        const district = findDistrictAt(p.x, p.z);
        const landmark = nearestLandmark(p.x, p.z, 70);
        const stand = this.taxis.nearestStand(p.x, p.z, 9);
        const nearCar = this.parked.nearest(p.x, p.z, 5.5);
        const outsideDoor = nearOutsideDoor(
          p.x,
          p.z,
          PLAYER_HOUSE.doorOutside.x,
          PLAYER_HOUSE.doorOutside.z,
        );
        const spot = inside ? nearestHomeSpot(p.x, p.z, this.homeSpots) : null;
        const doorOpen = this.houseRoot ? isHomeDoorOpen(this.houseRoot) : false;
        const nearNpc = !inside ? this.pedestrians.nearest(p.x, p.z, 3.0) : null;
        const lifeSpot = !inside ? nearestLifeSpot(p.x, p.z) : null;

        if (ride.riding) {
          this.hud.setPrompt(null);
        } else if (busy && (this.activity.kind || this.pendingActivity)) {
          const k = this.activity.kind ?? this.pendingActivity!;
          this.hud.setDistrict(k === 'work' ? 'Au travail' : PLAYER_HOUSE.name);
          const labels: Record<string, string> = {
            sleep: 'Dort… (nuit qui passe)',
            cook: 'Cuisine…',
            tv: 'Regarde la télé…',
            wash: 'Sous la douche…',
            clothes: 'Change d’habits…',
            work: 'Travaille…',
          };
          this.hud.setTip(labels[k] ?? '…');
          this.hud.setPrompt(null);
        } else if (inside && spot && !uiBlocking) {
          this.hud.setDistrict(PLAYER_HOUSE.name);
          this.hud.setTip(tipForSpot(spot, doorOpen));
          this.hud.setPrompt(`<kbd>E</kbd> ${spot.label}`);
        } else if (inside && !uiBlocking) {
          this.hud.setDistrict(PLAYER_HOUSE.name);
          this.hud.setTip('Lit · cuisine · TV · douche · armoire · porte · Déco');
          this.hud.setPrompt(null);
        } else if (outsideDoor && !uiBlocking) {
          this.hud.setDistrict(PLAYER_HOUSE.name);
          this.hud.setTip(doorOpen ? 'Porte ouverte — entre' : 'Ouvre la porte pour entrer');
          this.hud.setPrompt(doorOpen ? null : '<kbd>E</kbd> Ouvrir la porte');
        } else if (lifeSpot && !uiBlocking) {
          this.hud.setDistrict(lifeSpot.name);
          if (lifeSpot.kind === 'job') {
            this.hud.setTip(`Job · ~${jobPay(lifeSpot).toLocaleString('fr-FR')} FCFA`);
            this.hud.setPrompt(`<kbd>E</kbd> Travailler`);
          } else if (lifeSpot.kind === 'phone') {
            this.hud.setTip('Avenue Kennedy · smartphones & accessoires');
            this.hud.setPrompt(`<kbd>E</kbd> Boutique · ${lifeSpot.name}`);
          } else {
            this.hud.setTip('Acheter nourriture / boisson');
            this.hud.setPrompt(`<kbd>E</kbd> Acheter · ${lifeSpot.name}`);
          }
        } else if (nearNpc && !uiBlocking) {
          const rel = this.social.get(nearNpc.name);
          this.hud.setDistrict(nearNpc.name);
          this.hud.setTip(this.social.label(rel.affinity));
          this.hud.setPrompt(`<kbd>E</kbd> Parler · ${nearNpc.name}`);
        } else if (nearCar && !uiBlocking) {
          const label = (nearCar.mesh.userData.label as string) || 'Voiture';
          this.hud.setDistrict(`${label} garée`);
          this.hud.setTip(`Conduire ${label}`);
          this.hud.setPrompt(`<kbd>E</kbd> Entrer · ${label}`);
        } else if (stand && !uiBlocking) {
          this.hud.setDistrict(stand.name);
          this.hud.setTip('Arrêt Yango');
          this.hud.setPrompt('<kbd>E</kbd> Commander Yango');
        } else if (!uiBlocking) {
          const profile = profileFor(district, p.x, p.z);
          const label = district?.name ?? 'Yaoundé';
          this.hud.setDistrict(landmark ? `${label} · ${landmark.name}` : label);
          this.hud.setTip(profile.blurb);
          this.hud.setPrompt(null);
        }
      } else if (ride.riding) {
        const follow = ride.follow ?? this.player.object;
        this.cameraRig.update(follow, dt, { distance: 11, lookHeight: 1.15 });
      }
    }

    const cullX = this.aerial.active ? this.engine.camera.position.x : p.x;
    const cullZ = this.aerial.active ? this.engine.camera.position.z : p.z;
    if (!this.wasInsideHome) {
      this.pedestrians.update(dt, cullX, cullZ);
      this.traffic.update(dt, cullX, cullZ);
      this.cityCull.update(dt, this.cityRoot, cullX, cullZ);
    }
    if (!this.aerial.active) this.engine.followShadows(p.x, p.z);
    this.cityMap.updatePlayer(p.x, p.z);

    this.audio.update(dt, {
      walking: this.player.moving && !driving,
      running: this.player.running,
      driving,
      carSpeed: this.parked.currentSpeed,
      aerial: this.aerial.active,
      muted: this.audio.isMuted,
    });

    this.autoSaveAcc += dt;
    if (this.autoSaveAcc > 90) {
      this.autoSaveAcc = 0;
      this.saveGame(true);
    }

    this.hud.tickFps(dt);
    this.watchFps(dt);
    this.engine.render();
    this.perf.sample(dt, this.engine.renderer, {
      fps: this.hud.getFps(),
      npcs: this.pedestrians.count,
      traffic: this.traffic.count,
    });
  };

  private restoreSave(): void {
    const save = loadGameSave();
    if (!save) return;
    this.money = save.money;
    this.needs.load(save.needs);
    // Clock always follows Yaoundé real time — ignore saved minutes
    this.clock.syncFromYaounde();
    this.social.load(save.relations);
    this.lastJobAt = typeof save.jobCooldownUntil === 'number' && save.jobCooldownUntil > 1e12
      ? save.jobCooldownUntil
      : 0;
    this.player.object.position.set(save.x, save.y, save.z);
    this.player.object.rotation.y = save.yaw;
    this.cameraRig.yaw = save.yaw;
  }

  private saveGame(silent = false): void {
    const p = this.player.object;
    writeGameSave({
      money: this.money,
      x: p.position.x,
      y: p.position.y,
      z: p.position.z,
      yaw: p.rotation.y,
      needs: this.needs.snapshot(),
      clockMinutes: this.clock.minutes,
      quality: GraphicsConfig.quality,
      relations: this.social.serialize(),
      jobCooldownUntil: this.lastJobAt,
    });
    if (!silent) {
      this.hud.notify('Partie sauvegardée');
      this.audio.playConfirm();
    }
  }

  private togglePhone(): void {
    if (this.pauseMenu.isOpen() || this.aerial.active || this.parked.driving) return;
    if (this.phone.isOpen()) {
      this.phone.hide();
      this.input.blockPointerLock = false;
      return;
    }
    this.hud.hideTaxiMenu();
    this.audio.playUi();
    this.input.blockPointerLock = true;
    this.phone.show({
      onClose: () => {
        this.input.blockPointerLock = false;
      },
      onOpenMap: () => this.toggleMap(),
      onOrderTaxi: (dest) => this.orderRide(dest),
      getMoney: () => this.money,
      getMood: () => this.needs.moodLabel(),
      getClockLabel: () => this.clock.fullLabel,
      getNeedsSummary: () => {
        const n = this.needs.snapshot();
        return `Faim ${Math.round(n.hunger)} · Énergie ${Math.round(n.energy)} · Fun ${Math.round(n.fun)} · Social ${Math.round(n.social)}`;
      },
      getPlayerPos: () => ({
        x: this.player.object.position.x,
        z: this.player.object.position.z,
      }),
      destinations: this.taxis.destinations,
    });
  }

  private togglePause(): void {
    if (this.phone.isOpen()) {
      this.phone.hide();
      return;
    }
    if (this.dialogue.isOpen()) {
      this.endDialogue();
      return;
    }
    if (this.pauseMenu.isOpen()) {
      this.pauseMenu.hide();
      this.input.blockPointerLock = false;
      return;
    }
    this.audio.playUi();
    this.input.blockPointerLock = true;
    this.pauseMenu.show({
      onResume: () => {
        this.input.blockPointerLock = false;
      },
      onSave: () => this.saveGame(),
      onQuality: (q: GraphicsQuality) => {
        this.engine.applyLiveGraphics();
        this.hud.notify(`Graphismes : ${q} (densité PNJ au prochain chargement)`);
      },
      onQuitHint: () => {
        this.hud.notify('E interagir · P téléphone · Esc pause · M carte · V aérien · F3 perfs');
      },
    });
  }

  private watchFps(dt: number): void {
    this.fpsWarnTimer += dt;
    if (this.fpsWarnTimer < 8) return;
    this.fpsWarnTimer = 0;
    const fps = this.hud.getFps();
    if (fps > 0 && fps < 26 && GraphicsConfig.quality !== 'low' && !this.fpsAutoDropped) {
      this.fpsAutoDropped = true;
      applyQuality('low');
      saveGraphicsSettings();
      this.engine.applyLiveGraphics();
      this.hud.notify('FPS bas — graphismes passés en Bas automatiquement');
    }
  }

  private endDialogue(): void {
    if (this.talkingNpc) {
      this.pedestrians.setPaused(this.talkingNpc, false);
      this.talkingNpc = null;
    }
    this.dialogue.hide();
    this.input.blockPointerLock = false;
  }

  private talkToNpc(npc: { mesh: THREE.Group; name: string; role: string }): void {
    this.talkingNpc = npc.mesh;
    this.pedestrians.setPaused(npc.mesh, true);
    const dx = this.player.object.position.x - npc.mesh.position.x;
    const dz = this.player.object.position.z - npc.mesh.position.z;
    npc.mesh.rotation.y = Math.atan2(dx, dz);
    const rel = this.social.get(npc.name);
    const pack = dialogueForRole(npc.role, rel.affinity);
    this.input.blockPointerLock = true;
    this.dialogue.show(
      npc.name,
      npc.role,
      pack.lines,
      pack.choices,
      {
        onClose: () => this.endDialogue(),
        onChoice: (id) => {
          const next = this.social.chat(npc.name, id === 'chat' ? 14 : 8);
          this.needs.applyActivity('chat');
          this.hud.setNeeds(this.needs.snapshot(), this.needs.moodLabel());
          if (id === 'dir' || id === 'tip') {
            this.hud.notify('Direction : centre-ville · ouvre la carte (M)');
          } else if (id === 'shop') {
            this.hud.notify('Cherche un kiosque ou Santa Lucia (E pour acheter)');
          } else if (id === 'uni') {
            this.hud.notify('Université de Yaoundé I — Ngoa-Ekellé');
          } else if (id === 'chat') {
            this.hud.notify(`« Sympa de discuter ! » · ${this.social.label(next.affinity)}`);
          }
          this.endDialogue();
        },
      },
      this.social.label(rel.affinity),
    );
  }

  private enterHomeMode(): void {
    if (!this.houseRoot) return;
    setHomeInteriorMode(this.houseRoot, this.cityRoot, this.engine.scene, true);
    this.hud.setHomeMode(true);
  }

  private exitHomeMode(): void {
    if (!this.houseRoot) return;
    this.hud.hideDecorShop();
    setHomeInteriorMode(this.houseRoot, this.cityRoot, this.engine.scene, false);
    this.hud.setHomeMode(false);
  }

  private openDecorShop(): void {
    if (!this.wasInsideHome) return;
    this.audio.playUi();
    this.hud.showDecorShop(this.homeDecor, {
      onBuyItem: (id) => this.buyDecorItem(id),
      onBuyWall: (id) => this.buyWall(id),
      onBuyFloor: (id) => this.buyFloor(id),
      onClose: () => undefined,
    });
  }

  private buyDecorItem(id: string): void {
    const result = purchaseDecorItem(this.homeDecor, id, this.money);
    if (!result.ok) {
      this.hud.setTip(result.reason);
      return;
    }
    this.money -= result.spent;
    this.homeDecor = result.state;
    this.applyDecor();
    this.hud.setMoney(this.money);
    this.hud.refreshDecorShop(this.homeDecor);
    this.audio.playConfirm();
    this.hud.setTip(result.spent > 0 ? `Acheté · −${result.spent.toLocaleString('fr-FR')} FCFA` : 'Équipé');
  }

  private buyWall(id: string): void {
    const result = purchaseWallPaint(this.homeDecor, id, this.money);
    if (!result.ok) {
      this.hud.setTip(result.reason);
      return;
    }
    this.money -= result.spent;
    this.homeDecor = result.state;
    this.applyDecor();
    this.hud.setMoney(this.money);
    this.hud.refreshDecorShop(this.homeDecor);
    if (result.spent > 0) this.audio.playConfirm();
  }

  private buyFloor(id: string): void {
    const result = purchaseFloorPaint(this.homeDecor, id, this.money);
    if (!result.ok) {
      this.hud.setTip(result.reason);
      return;
    }
    this.money -= result.spent;
    this.homeDecor = result.state;
    this.applyDecor();
    this.hud.setMoney(this.money);
    this.hud.refreshDecorShop(this.homeDecor);
    if (result.spent > 0) this.audio.playConfirm();
  }

  private applyDecor(): void {
    if (!this.houseRoot) return;
    applyHomeDecor(this.houseRoot, this.homeDecor);
  }

  private openLifeShop(spot: LifeSpot): void {
    const offers = offersFor(spot);
    if (!offers.length) return;
    this.audio.playUi();
    this.hud.showShopMenu(
      spot.name,
      offers,
      (id) => {
        const offer = offers.find((o) => o.id === id);
        if (!offer) return;
        this.buyLifeOffer(offer);
      },
      () => undefined,
    );
  }

  private buyLifeOffer(offer: ShopOffer): void {
    if (this.money < offer.price) {
      this.hud.notify('Pas assez de FCFA');
      return;
    }
    this.money -= offer.price;
    if (offer.item) {
      this.needs.consume(offer.item);
      this.hud.setTip('Besoins améliorés — continue ta journée');
    } else {
      // Phone / accessory purchase on Avenue Kennedy
      this.needs.fun = Math.min(100, this.needs.fun + 18);
      this.needs.social = Math.min(100, this.needs.social + 8);
      this.hud.setTip('Achat téléphone · Avenue Kennedy');
    }
    this.hud.setMoney(this.money);
    this.hud.setNeeds(this.needs.snapshot(), this.needs.moodLabel());
    this.hud.hideShopMenu();
    this.audio.playConfirm();
    this.hud.notify(`${offer.label} · −${offer.price.toLocaleString('fr-FR')} FCFA`);
  }

  private startJob(spot: LifeSpot): void {
    // ~3 minutes real-time cooldown between jobs
    if (this.lastJobAt > 0 && Date.now() - this.lastJobAt < 3 * 60 * 1000) {
      this.hud.notify('Repos déjà — reviens dans un moment');
      return;
    }
    if (this.needs.energy < 25) {
      this.hud.notify('Trop fatigué pour travailler — dors d’abord');
      return;
    }
    this.lastJobPay = jobPay(spot);
    this.homeBusy = 4.5;
    this.pendingActivity = 'work';
    this.activity.start(
      this.player.object,
      'work',
      spot.x,
      spot.z,
      this.player.object.rotation.y,
    );
    this.audio.playConfirm();
    this.hud.setTip(`Tu travailles à ${spot.name}…`);
    this.hud.notify('Service en cours…');
  }

  private handleVehicleInteract(): void {
    if (this.taxis.isRiding()) return;
    if (this.cityMap.isOpen() || this.aerial.active) return;
    if (this.homeBusy > 0) return;
    if (this.hud.isDecorShopOpen()) {
      if (this.input.consumeInteract()) {
        this.hud.hideDecorShop();
      }
      return;
    }
    if (this.hud.isShopMenuOpen()) {
      if (this.input.consumeInteract()) this.hud.hideShopMenu();
      return;
    }
    if (!this.input.consumeInteract()) return;

    if (this.parked.driving) {
      this.parked.exit(this.player.object);
      this.audio.playUi();
      this.hud.setTip('Tu es descendu · E pour reprendre une voiture');
      return;
    }

    if (this.hud.isTaxiMenuOpen()) {
      this.hud.hideTaxiMenu();
      this.taxis.closeMenu();
      return;
    }

    const p = this.player.object.position;

    // Home interactions (door, sleep, cook, TV, wash, clothes)
    if (this.houseRoot && (this.wasInsideHome || isInsidePlayerHouse(p.x, p.z))) {
      const spot = nearestHomeSpot(p.x, p.z, this.homeSpots);
      if (spot) {
        const result = runHomeAction(
          spot.kind,
          this.player.object,
          this.houseRoot,
          this.collisions,
          spot,
        );
        if (result) {
          this.audio.playConfirm();
          this.hud.setTip(result.tip);
          if (result.busySec) {
            this.homeBusy = result.busySec;
            this.pendingActivity = (result.anim as typeof this.pendingActivity) ?? null;
          }
          if (result.anim && result.snapX != null && result.snapZ != null) {
            this.activity.start(
              this.player.object,
              result.anim,
              result.snapX,
              result.snapZ,
              result.faceYaw ?? this.player.object.rotation.y,
            );
          }
          return;
        }
      }
      this.hud.setTip('Approche lit, cuisine, TV, douche, armoire ou la porte · Déco = boutique');
      return;
    }

    // City shops / jobs
    const life = nearestLifeSpot(p.x, p.z);
    if (life) {
      if (life.kind === 'job') {
        this.startJob(life);
        return;
      }
      this.openLifeShop(life);
      return;
    }

    // Talk to NPC
    const npc = this.pedestrians.nearest(p.x, p.z, 3.0);
    if (npc) {
      this.audio.playUi();
      this.talkToNpc(npc);
      return;
    }

    // Outside: open house door
    if (
      this.houseRoot &&
      nearOutsideDoor(p.x, p.z, PLAYER_HOUSE.doorOutside.x, PLAYER_HOUSE.doorOutside.z)
    ) {
      const result = runHomeAction('door', this.player.object, this.houseRoot, this.collisions);
      if (result) {
        this.audio.playConfirm();
        this.hud.setTip(result.tip);
      }
      return;
    }

    if (this.parked.tryEnter(this.player.object)) {
      this.hud.hideTaxiMenu();
      this.taxis.closeMenu();
      this.audio.playConfirm();
      this.hud.setTip('Au volant — WASD · E pour sortir');
      return;
    }

    const stand = this.taxis.nearestStand(p.x, p.z, 9);
    if (!stand) {
      this.hud.setTip('Approche une voiture garée (E) ou un arrêt taxi');
      return;
    }

    this.taxis.openMenu(stand);
    if (document.pointerLockElement) document.exitPointerLock();
    this.hud.showTaxiMenu(
      stand.name,
      p.x,
      p.z,
      this.taxis.destinations,
      (dest) => this.orderRide(dest),
      () => this.taxis.closeMenu(),
    );
  }

  private toggleAerial(): void {
    if (this.taxis.isRiding()) return;
    if (this.parked.driving) return;
    if (this.wasInsideHome) return;
    if (this.cityMap.isOpen()) this.cityMap.hide();
    this.hud.hideTaxiMenu();
    this.hud.hideDecorShop();

    if (this.aerial.active) {
      this.aerial.exit();
      this.engine.setAerialBudget(false);
      this.input.blockPointerLock = false;
      this.hud.setTip('Retour au sol');
      return;
    }

    const p = this.player.object.position;
    this.aerial.enter(p.x, p.z);
    this.engine.setAerialBudget(true);
    this.input.blockPointerLock = true;
  }

  private toggleMap(): void {
    if (this.taxis.isRiding()) return;
    if (this.parked.driving) return;
    if (this.aerial.active) return;
    if (this.cityMap.isOpen()) {
      this.cityMap.hide();
      return;
    }
    this.hud.hideTaxiMenu();
    this.hud.hideDecorShop();
    this.taxis.closeMenu();
    const p = this.player.object.position;
    this.cityMap.show(p.x, p.z, this.taxis.destinations, {
      onOrderRide: (dest) => this.orderRide(dest),
      onClose: () => undefined,
    });
  }

  private orderRide(dest: TaxiDestination): void {
    const p = this.player.object.position;
    const fare = estimateFare(p.x, p.z, dest);
    if (fare > this.money) {
      this.hud.setTip(`Pas assez d’argent (${fare.toLocaleString('fr-FR')} FCFA)`);
      return;
    }
    this.taxis.startRide(p.x, p.z, dest);
    this.audio.playConfirm();
    this.hud.setTip('Yango arrive…');
    this.hud.notify(`Yango · course vers ${dest.name}`);
  }
}
