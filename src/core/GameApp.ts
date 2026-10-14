import * as THREE from 'three';
import { Engine } from './Engine';
import { Input } from './Input';
import { CollisionSystem } from '../world/CollisionSystem';
import { buildBootstrapWorld } from '../world/BootstrapWorld';
import { createPlayerAvatar } from '../player/PlayerAvatar';
import { roleLabel } from '../pedestrians/roles';
import type { NpcRole } from '../pedestrians/NpcAvatar';
import { applyAppearance, mountRiggedPlayer } from '../player/PlayerRig';
import { CharacterStudio } from '../player/CharacterStudio';
import {
  applyPreset,
  chooseLook,
  loadLook,
  OUTFITS,
  randomizeLook,
  resetLook,
  saveLook,
  SLOT_FIELDS,
  unownedAccessories,
  withoutUnowned,
  type PlayerLook,
} from '../player/PlayerLook';
import { accessoryById } from '../player/fashion/catalog';
import { dressById } from '../player/fashion/dresses';
import { grantItem, isOwned, ownedItems, replaceOwned } from '../player/fashion/inventory';
import {
  addOutfit,
  deleteOutfit,
  duplicateOutfit,
  loadWardrobe,
  outfitById,
  renameOutfit,
  replaceWardrobe,
  toggleFavoriteOutfit,
} from '../player/Wardrobe';
import type { LookHandlers } from '../ui/Hud';
import { PlayerController } from '../player/PlayerController';
import {
  HOME_VIEWS,
  ThirdPersonCamera,
  homeViewLabel,
  type HomeView,
} from '../camera/ThirdPersonCamera';
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
  refreshHomeInteriorLook,
  setHomeCeilingVisible,
  PLAYER_HOUSE,
} from '../landmarks/PlayerHouse';
import { TrafficSystem } from '../vehicles/TrafficSystem';
import { TaxiSystem } from '../vehicles/TaxiSystem';
import { ParkedCarSystem } from '../vehicles/ParkedCarSystem';
import { estimateFare, type TaxiDestination } from '../vehicles/TaxiDestinations';
import { GameAudio } from '../audio/GameAudio';
import {
  applyHomeDecor,
  FURN_LABELS,
  loadHomeDecor,
  purchaseDecorItem,
  resetFurnitureLayout,
  restoreFurniture,
  storeFurniture,
  purchaseFloorPaint,
  purchaseWallPaint,
  saveHomeDecor,
  type FurnPose,
  type HomeDecorState,
} from '../home/HomeDecor';
import { FurnitureEditor } from '../home/FurnitureEditor';
import {
  getHomeSpots,
  isHomeDoorOpen,
  nearestHomeSpot,
  nearOutsideDoor,
  syncHomeSpotsToFurniture,
  runHomeAction,
  tipForSpot,
  type HomeSpot,
} from '../home/HomeInteract';
import { HOME_FLOOR_TOP } from '../home/homeLayout';
import { PlayerActivity } from '../player/PlayerActivity';
import { PhoneUI } from '../ui/PhoneUI';
import { PauseMenu } from '../ui/PauseMenu';
import { DialogueUI, dialogueForRole } from '../ui/DialogueUI';
import { GameClock } from '../sim/GameClock';
import { PlayerNeeds, type NeedActivity } from '../sim/PlayerNeeds';
import { loadGameSave, writeGameSave } from '../save/GameSave';
import { GraphicsConfig, applyQuality } from '../config/GraphicsConfig';
import { WorldConfig } from '../config/WorldConfig';
import { PerfHud } from '../render/PerfHud';
import { DensityOverlay } from '../ui/DensityOverlay';
import { CityDistanceCull } from '../world/CityDistanceCull';
import type { CityChunks } from '../city/CityChunks';
import type { CityPlan } from '../city/CityPlan';
import { tickSignals } from '../city/signals';
import { SocialMemory } from '../sim/SocialMemory';
import {
  nearestLifeSpot,
  nearestSalon,
  offersFor,
  jobPay,
  type LifeSpot,
  type ShopOffer,
} from '../sim/LifeSpots';
import { isInsideMfoundiMall, mallFloorAt, nearestMallSpot, type MallSpot } from '../sim/MallSpots';
import { isInsideSantaLucia, nearestSantaSpot, santaFloorAt, type SantaSpot } from '../sim/SantaLuciaSpots';
import { setSantaRoofVisible } from '../landmarks/SantaLuciaExterior';
import { setNamedRoofVisible } from '../landmarks/interiorKit';
import { nearestVenueSpot, venueAt, VENUES, type VenueSpot } from '../sim/VenueSpots';
import {
  nearestPalaceMuzzles,
  palaceEjectPos,
  palaceZone,
} from '../sim/PalaceSecurity';

/** Vehicles kept around the player at traffic density ×1. */
const TRAFFIC_BASE = 80;

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
  private readonly trafficObstacles = [{ x: 0, z: 0, r: 0.5 }];
  /** DEV: camera pinned by __shot until __unfreeze. */
  private devPose: { x: number; z: number; h: number; pitch: number; yaw: number } | null = null;
  private taxis!: TaxiSystem;
  private parked!: ParkedCarSystem;
  private cityRoot!: THREE.Group;
  private houseRoot: THREE.Group | null = null;
  private santaRoot: THREE.Group | null = null;
  private readonly venueRoots = new Map<string, THREE.Object3D>();
  private spinParts: THREE.Object3D[] = [];
  private wasVenueId: string | null = null;
  private palaceWarned = false;
  private palaceFireAcc = 0;
  private palaceTracerLife = 0;
  private readonly palaceTracers: THREE.Line[] = [];
  private homeSpots: HomeSpot[] = [];
  private furniture!: FurnitureEditor;
  private activity = new PlayerActivity();
  private clock = new GameClock();
  private needs = new PlayerNeeds();
  private audio = new GameAudio();
  private money = 50000;
  private collisions = new CollisionSystem();
  private editor = new EditorStub();
  private running = false;
  private wasInsideHome = false;
  private wasInsideMall = false;
  private wasInsideSanta = false;
  private mapLiftedHome = false;
  private readonly mapRay = new THREE.Raycaster();
  private readonly mapGround = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly mapHit = new THREE.Vector3();
  private readonly mapNdc = new THREE.Vector2();
  private readonly cockpitLook = new THREE.Vector3();
  private homeView: HomeView = 'iso';
  private homeBusy = 0;
  private exitHouseGrace = 0;
  private pendingActivity: NeedActivity | null = null;
  private busyLabel: string | null = null;
  private lastJobPay = 0;
  private homeDecor: HomeDecorState = loadHomeDecor();
  private talkingNpc: THREE.Group | null = null;
  private social = new SocialMemory();
  /** Real timestamp (ms) of last finished job — cooldown independent of clock. */
  private lastJobAt = 0;
  private fpsWarnTimer = 0;
  private fpsLowStreak = 0;
  private fpsAutoDropped = false;
  private dayNightAcc = 0;
  private autoSaveAcc = 0;
  private cityCull = new CityDistanceCull();
  private chunks!: CityChunks;
  private lastVegetation = 1;
  private perf!: PerfHud;
  private density!: DensityOverlay;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly uiRoot: HTMLElement,
  ) {}

  start(): void {
    this.engine = new Engine(this.canvas);
    this.input = new Input(this.canvas);
    this.cityRoot = buildBootstrapWorld(this.engine.scene, this.collisions);
    this.chunks = this.cityRoot.userData.chunks as CityChunks;
    this.houseRoot = this.cityRoot.getObjectByName('landmark-player-house') as THREE.Group | null;
    this.santaRoot = this.cityRoot.getObjectByName('landmark-santa-lucia') as THREE.Group | null;
    for (const v of VENUES) {
      const node = this.cityRoot.getObjectByName(v.rootName);
      if (node) this.venueRoots.set(v.id, node);
    }
    this.homeSpots = getHomeSpots(PLAYER_HOUSE.cx, PLAYER_HOUSE.cz);
    if (this.houseRoot) syncHomeSpotsToFurniture(this.homeSpots, this.houseRoot);
    this.furniture = new FurnitureEditor(
      this.canvas,
      this.engine.camera,
      this.collisions,
      () => this.houseRoot,
      (id, pose, commit) => this.onFurnitureMoved(id, pose, commit),
    );
    this.furniture.onRejected = () => {
      this.hud.setTip('Pas de place ici (mur, porte ou autre meuble) — le meuble revient');
      this.audio.playUi();
    };
    this.furniture.onRemove = (id) => this.storeFurnitureItem(id);
    const npcDens = 1.15 * GraphicsConfig.npcDensity;
    const trafficCount = Math.round(TRAFFIC_BASE * GraphicsConfig.trafficDensity);
    const plan = this.cityRoot.userData.plan as CityPlan;
    this.pedestrians = new PedestrianSystem(this.engine.scene, npcDens, (x, z) => plan.zoneAt(x, z));
    this.density = new DensityOverlay(this.uiRoot, plan);
    this.traffic = new TrafficSystem(this.engine.scene, trafficCount);
    this.traffic.setObstacles(this.trafficObstacles);
    this.taxis = new TaxiSystem(this.engine.scene);
    this.parked = new ParkedCarSystem(this.engine.scene, this.collisions);
    this.parked.collectFrom(this.cityRoot);
    this.parked.syncPlayerBlockers();
    const base = this.cityRoot.getObjectByName('landmark-base-militaire');
    this.spinParts = (base?.userData.rotors as THREE.Object3D[] | undefined) ?? [];
    for (const p of this.spinParts) {
      p.traverse((o) => {
        o.matrixAutoUpdate = true;
      });
    }

    const avatar = createPlayerAvatar();
    this.engine.scene.add(avatar);
    void mountRiggedPlayer(avatar, this.engine.renderer).then((ok) => {
      if (!ok) {
        applyAppearance(avatar);
        this.hud.notify('Modèle du personnage introuvable — avatar de secours', 5000);
      }
      void this.pedestrians.preload();
    });

    this.cameraRig = new ThirdPersonCamera(this.engine.camera, this.input);
    this.cameraRig.setCollisions(this.collisions);
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
    this.hud.onToggleMute(() => {
      const muted = this.audio.toggleMute();
      this.hud.setMuted(muted);
    });
    this.hud.onOpenDecor(() => this.openDecorShop());
    this.hud.onMoveFurniture(() => this.toggleFurniture());
    this.hud.onCycleHomeView(() => this.cycleHomeView());
    this.hud.onOpenPhone(() => this.togglePhone());
    this.hud.onOpenPause(() => this.togglePause());
    this.hud.onOpenLook(() => this.toggleCharacterLook());
    this.audio.init();

    if (this.houseRoot && isInsidePlayerHouse(this.player.object.position.x, this.player.object.position.z)) {
      this.enterHomeMode();
      this.wasInsideHome = true;
    }

    this.hud.notify(`Vie Sims · mange, dors, travaille, socialise`);
    this.hud.setMission('Satisfais tes besoins · gagne des FCFA');
    this.chunks.warm(this.player.object.position.x, this.player.object.position.z);
    this.lastVegetation = GraphicsConfig.vegetationDensity;
    if (import.meta.env.DEV) this.installDevHooks();
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

    if (this.input.consumeAerialToggle()) this.toggleMap();
    if (this.input.consumeMapToggle() && !this.parked.driving) this.toggleMap();
    const mapClick = this.input.consumeClick();
    if (mapClick && this.cityMap.isOpen() && this.aerial.active) this.pickMapGround(mapClick);

    if (this.exitHouseGrace > 0) this.exitHouseGrace = Math.max(0, this.exitHouseGrace - dt);

    if (this.homeBusy > 0) {
      const stick = this.input.getMoveAxes();
      if (Math.hypot(stick.x, stick.z) > 0.4) {
        if (this.activity.active) this.activity.stop(this.player.object);
        this.homeBusy = 0;
        this.pendingActivity = null;
        this.busyLabel = null;
        this.hud.setTip('Tu bouges');
      }
    }
    if (this.homeBusy > 0) {
      this.homeBusy = Math.max(0, this.homeBusy - dt);
      if (this.activity.active) this.activity.update(this.player.object, dt);
      if (this.homeBusy <= 0) {
        const kind = this.pendingActivity ?? this.activity.kind;
        if (this.activity.active) this.activity.stop(this.player.object);
        if (kind === 'sleep') {
          this.needs.applyActivity('sleep');
          this.clock.syncFromYaounde();
          this.refreshDayNight();
          this.hud.notify(`Réveil · ${this.clock.label} (Yaoundé)`);
          this.hud.setTip('Repos restauré — heure réelle Yaoundé');
        } else if (kind === 'work') {
          const pay = this.lastJobPay;
          this.money += pay;
          this.needs.applyActivity('work');
          this.lastJobAt = Date.now();
          this.hud.setMoney(this.money);
          this.clock.syncFromYaounde();
          this.refreshDayNight();
          this.hud.notify(`+${pay.toLocaleString('fr-FR')} FCFA · fin de service`);
          this.hud.setTip('Travail terminé — tu as gagné de l’argent');
        } else if (kind) {
          this.needs.applyActivity(kind);
          this.hud.notify('Activité terminée');
          this.hud.setTip('Terminé — tu peux bouger');
        }
        this.pendingActivity = null;
        this.busyLabel = null;
        this.hud.setNeeds(this.needs.snapshot(), this.needs.moodLabel());
      }
    }

    this.clock.update(dt);
    this.dayNightAcc += dt;
    if (
      this.dayNightAcc > 0.5 &&
      !this.wasInsideHome &&
      !this.aerial.active &&
      !this.hud.isLookPanelOpen()
    ) {
      this.dayNightAcc = 0;
      this.engine.applyDayNight(this.clock.sunFactor, this.clock.weather, this.clock.hourFloat);
    }
    this.hud.setClock(this.clock.label, this.clock.weatherLabel);

    if (this.input.consumePhoneToggle()) this.togglePhone();
    if (this.input.consumeLookToggle()) this.toggleCharacterLook();
    if (this.input.consumePauseToggle()) this.togglePause();

    const uiBlocking =
      this.hud.isTaxiMenuOpen() ||
      this.hud.isDecorShopOpen() ||
      this.hud.isShopMenuOpen() ||
      this.hud.isLookPanelOpen() ||
      this.cityMap.isOpen() ||
      this.phone.isOpen() ||
      this.pauseMenu.isOpen() ||
      this.dialogue.isOpen();
    const furnitureKey = this.input.consumeFurnitureToggle();
    const viewKey = this.input.consumeViewToggle();
    if (!uiBlocking && this.wasInsideHome && furnitureKey) this.toggleFurniture();
    if (!uiBlocking && !this.aerial.active && viewKey) this.cycleHomeView();
    const driving = this.parked.driving;
    const busy = this.homeBusy > 0;

    if (this.aerial.active) {
      this.aerial.update(dt);
      this.hud.setDistrict('Carte · Yaoundé');
      this.hud.setTip('WASD déplace · molette zoom · glisser oriente · M ferme');
      this.hud.setAerialMode(true);
      this.hud.setControls('aerial');
    } else {
      this.hud.setAerialMode(false);
      if (!driving) {
        this.hud.setControls(
          this.furniture.enabled ? 'build' : this.wasInsideHome ? 'home' : 'walk',
        );
      }
      this.hud.setLookAvailable(this.wasInsideHome || !!nearestSalon(p.x, p.z));

      if (this.hud.isLookPanelOpen() && !ride.riding) {
        this.hud.setPrompt(null);
        const animator = this.player.object.userData.animator as
          | {
              setLocomotion: (moving: boolean, running: boolean, dt: number, speed: number) => void;
              setActivity: (kind: string | null) => void;
            }
          | undefined;
        if (this.creatorTurn > 0) {
          this.creatorTurn = Math.max(0, this.creatorTurn - dt);
          this.player.object.rotation.y += dt * 1.2;
          if (this.creatorTurn === 0) this.creatorPose = 'idle';
        }
        const moving = this.creatorPose === 'walk' || this.creatorPose === 'run';
        const running = this.creatorPose === 'run';
        if (this.creatorPose === 'sit') animator?.setActivity('tv');
        animator?.setLocomotion(moving, running, dt, running ? 4.5 : moving ? 1.7 : 0);
        const look = this.input.consumeLook();
        this.cameraRig.setCreatorFocus(this.hud.lookCamera());
        this.cameraRig.updateCreator(
          this.player.object,
          dt,
          look.dx,
          look.dy,
          this.input.consumeZoom(),
          this.creatorFaceHeight(),
        );
        this.studio.follow(this.player.object.position);
      } else if (driving && !uiBlocking) {
        const car = this.parked.update(dt, this.input, this.player.object);
        if (car) this.updateDriveCamera(car, dt);
        this.handleVehicleInteract();
        const carLabel = (this.parked.activeMesh?.userData.label as string) || 'Voiture';
        this.hud.setDistrict(`Au volant · ${carLabel}`);
        this.hud.setPrompt(null);
        this.hud.setTip(
          this.homeView === 'shoulder'
            ? 'Cockpit — WASD · Shift turbo · V autres vues · E sortir'
            : 'WASD conduire · Shift turbo · V cockpit · E sortir',
        );
        this.hud.setControls('drive');
      } else if (!ride.riding && !this.editor.isActive() && !uiBlocking) {
        const onHomeFloor = isInsidePlayerHouse(p.x, p.z);
        const inVenueEarly = !onHomeFloor ? venueAt(p.x, p.z) : null;
        const mallGround =
          !onHomeFloor &&
          (isInsideMfoundiMall(p.x, p.z) || isInsideSantaLucia(p.x, p.z) || !!inVenueEarly)
            ? this.collisions.supportY(p.x, p.z, WorldConfig.player.radius, p.y)
            : 0;
        if (!busy) {
          this.player.update(dt, {
            speedMul: this.needs.moveMultiplier(),
            canRun: this.needs.canRun(),
            groundY: onHomeFloor ? HOME_FLOOR_TOP : mallGround,
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
          this.hud.setTip('Chez toi — E à la porte pour sortir');
        } else if (!inside && this.wasInsideHome) {
          this.exitHomeMode();
          this.exitHouseGrace = 2.2;
          this.hud.setTip('Dehors — joystick pour marcher · E à la porte pour rentrer');
        }
        this.wasInsideHome = inside;

        const inMall = !inside && isInsideMfoundiMall(p.x, p.z);
        if (inMall && !this.wasInsideMall) {
          this.hud.setTip('Mall — E au vendeur · escalier pour l’étage');
        }
        this.wasInsideMall = inMall;

        const inSanta = !inside && !inMall && isInsideSantaLucia(p.x, p.z);
        if (inSanta && !this.wasInsideSanta) {
          this.hud.setTip('Santa Lucia — E pour acheter · escalier à gauche');
        }
        if (this.santaRoot) {
          setSantaRoofVisible(this.santaRoot, !inSanta || this.homeView === 'shoulder');
        }
        this.wasInsideSanta = inSanta;

        const inVenue = !inside && !inMall && !inSanta ? venueAt(p.x, p.z) : null;
        if (inVenue && !inVenue.restricted && this.wasVenueId !== inVenue.id) {
          this.hud.setTip(inVenue.enterTip);
        }
        for (const v of VENUES) {
          const root = this.venueRoots.get(v.id);
          if (!root || !v.hideRoof) continue;
          const here = inVenue?.id === v.id;
          setNamedRoofVisible(root, !here || this.homeView === 'shoulder');
        }
        this.wasVenueId = inVenue?.id ?? null;

        this.cameraRig.update(
          this.player.object,
          dt,
          inside
            ? {
                isometric: true,
                homeView: this.furniture.enabled ? 'plan' : this.homeView,
                ...(this.homeView === 'plan' || this.furniture.enabled
                  ? { focusX: PLAYER_HOUSE.cx, focusZ: PLAYER_HOUSE.cz }
                  : {}),
                roomHalfW: PLAYER_HOUSE.interiorHalfW - 0.5,
                roomHalfD: PLAYER_HOUSE.interiorHalfD - 0.5,
                roomHeight: 2.5,
              }
            : (inMall || inSanta || !!inVenue) && this.homeView === 'shoulder'
              ? { distance: (inMall || inSanta) && p.y > 3 ? 5.5 : 6.2, lookHeight: 1.35 }
              : this.streetCamOpts(),
        );
        if (!busy) this.handleVehicleInteract();

        const district = findDistrictAt(p.x, p.z);
        const landmark = nearestLandmark(p.x, p.z, 70);
        const stand = this.taxis.nearestStand(p.x, p.z, 9);
        const saleCar = this.exitHouseGrace > 0 ? null : this.parked.nearestForSale(p.x, p.z, 5.2);
        const nearCar = this.exitHouseGrace > 0 ? null : this.parked.nearest(p.x, p.z, 5.5);
        const outsideDoor = nearOutsideDoor(
          p.x,
          p.z,
          PLAYER_HOUSE.doorOutside.x,
          PLAYER_HOUSE.doorOutside.z,
        );
        const spot = inside ? nearestHomeSpot(p.x, p.z, this.homeSpots) : null;
        const doorOpen = this.houseRoot ? isHomeDoorOpen(this.houseRoot) : false;
        const nearNpc = !inside ? this.pedestrians.nearest(p.x, p.z, 3.0) : null;
        const mallSpot = inMall ? nearestMallSpot(p.x, p.z, p.y) : null;
        const santaSpot = inSanta ? nearestSantaSpot(p.x, p.z, p.y) : null;
        const venueSpot = inVenue ? nearestVenueSpot(p.x, p.z) : null;
        const lifeSpot = !inside && !inMall && !inSanta && !inVenue ? nearestLifeSpot(p.x, p.z) : null;

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
          this.hud.setTip(`${this.busyLabel ?? labels[k] ?? '…'} · joystick pour arrêter`);
          this.hud.setPrompt(null);
        } else if (inside && this.furniture.isCarrying && !uiBlocking) {
          this.hud.setDistrict(PLAYER_HOUSE.name);
          this.hud.setTip('Glisse le meuble · lâche pour le poser · R tourne · Suppr range');
          this.hud.setPrompt(null);
        } else if (inside && spot && !uiBlocking) {
          this.hud.setDistrict(PLAYER_HOUSE.name);
          this.hud.setTip(tipForSpot(spot, doorOpen));
          this.hud.setPrompt(`<kbd>E</kbd> ${spot.kind === 'door' ? 'Sortir' : spot.label}`);
        } else if (inside && !uiBlocking) {
          this.hud.setDistrict(PLAYER_HOUSE.name);
          this.hud.setTip(
            this.furniture.enabled
              ? 'Mode meubles — maintiens le clic sur un meuble et glisse-le'
              : `${homeViewLabel(this.homeView)} — V change la vue · F pour les meubles`,
          );
          this.hud.setPrompt(null);
        } else if (outsideDoor && !uiBlocking) {
          this.hud.setDistrict(PLAYER_HOUSE.name);
          this.hud.setTip('E pour rentrer');
          this.hud.setPrompt('<kbd>E</kbd> Entrer');
        } else if (santaSpot && !uiBlocking) {
          this.hud.setDistrict(`Santa Lucia · ${santaSpot.name}`);
          this.hud.setTip(santaSpot.blurb);
          this.hud.setPrompt(`<kbd>E</kbd> Acheter · ${santaSpot.name}`);
        } else if (mallSpot && !uiBlocking) {
          this.hud.setDistrict(`Mfoundi Mall · ${mallSpot.name}`);
          if (mallSpot.kind === 'job') {
            this.hud.setTip(`Emploi sur place · ~${jobPay(mallSpot).toLocaleString('fr-FR')} FCFA`);
            this.hud.setPrompt('<kbd>E</kbd> Travailler · magasinier');
          } else {
            this.hud.setTip(mallSpot.blurb);
            this.hud.setPrompt(`<kbd>E</kbd> Acheter · ${mallSpot.name}`);
          }
        } else if (venueSpot && !inVenue?.restricted && !uiBlocking) {
          this.hud.setDistrict(`${inVenue!.name} · ${venueSpot.name}`);
          this.hud.setTip(venueSpot.blurb);
          const verb =
            venueSpot.kind === 'job'
              ? 'Travailler'
              : venueSpot.kind === 'ritual'
                ? venueSpot.price
                  ? `Entrer · ${venueSpot.price} FCFA`
                  : 'Participer'
                : 'Acheter';
          this.hud.setPrompt(`<kbd>E</kbd> ${verb} · ${venueSpot.name}`);
        } else if (inVenue && !inVenue.restricted && !uiBlocking) {
          this.hud.setDistrict(inVenue.name);
          this.hud.setTip(inVenue.enterTip);
          this.hud.setPrompt(null);
        } else if (inSanta && !uiBlocking) {
          const upstairs = santaFloorAt(p.y) === 1;
          this.hud.setDistrict(upstairs ? 'Santa Lucia · Étage' : 'Santa Lucia · RDC');
          this.hud.setTip(
            upstairs
              ? 'Étage — ménage et textile · E pour acheter'
              : 'RDC — boulangerie à droite · rayons garnis · escalier à gauche',
          );
          this.hud.setPrompt(null);
        } else if (inMall && !uiBlocking) {
          const upstairs = mallFloorAt(p.y) === 1;
          this.hud.setDistrict(upstairs ? 'Mfoundi Mall · Étage' : 'Mfoundi Mall · RDC');
          this.hud.setTip(
            upstairs
              ? 'Étage — Pharmacie, librairie, bijoux, chaussures, sport, opticien'
              : 'RDC — FREE DEAL, Pirate, Amani, Smile, JM · escalier vers l’étage',
          );
          this.hud.setPrompt(null);
        } else if (lifeSpot && !uiBlocking) {
          this.hud.setDistrict(lifeSpot.name);
          if (lifeSpot.kind === 'job') {
            this.hud.setTip(`Job · ~${jobPay(lifeSpot).toLocaleString('fr-FR')} FCFA`);
            this.hud.setPrompt(`<kbd>E</kbd> Travailler`);
          } else if (lifeSpot.kind === 'phone') {
            this.hud.setTip('Avenue Kennedy · smartphones & accessoires');
            this.hud.setPrompt(`<kbd>E</kbd> Boutique · ${lifeSpot.name}`);
          } else if (lifeSpot.kind === 'salon') {
            this.hud.setTip('Salon de coiffure · change ta coupe et tes habits');
            this.hud.setPrompt(`<kbd>E</kbd> Salon · changer de look`);
          } else {
            this.hud.setTip('Acheter nourriture / boisson');
            this.hud.setPrompt(`<kbd>E</kbd> Acheter · ${lifeSpot.name}`);
          }
        } else if (nearNpc && !uiBlocking) {
          const rel = this.social.get(nearNpc.name);
          this.hud.setDistrict(nearNpc.name);
          this.hud.setTip(this.social.label(rel.affinity));
          this.hud.setPrompt(`<kbd>E</kbd> Parler · ${nearNpc.name}`);
        } else if (saleCar && !uiBlocking) {
          const label = (saleCar.mesh.userData.saleLabel as string) || 'Voiture';
          const price = Number(saleCar.mesh.userData.salePrice) || 0;
          this.hud.setDistrict(label);
          this.hud.setTip('Concession · achète pour conduire');
          this.hud.setPrompt(
            `<kbd>E</kbd> Acheter · ${label} · ${price.toLocaleString('fr-FR')} FCFA`,
          );
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

    if (!this.aerial.active && !ride.riding) {
      this.updatePalaceSecurity(dt, driving);
    } else {
      this.fadePalaceTracers(dt);
    }

    const cullX = this.aerial.active ? this.engine.camera.position.x : p.x;
    const cullZ = this.aerial.active ? this.engine.camera.position.z : p.z;
    tickSignals(dt);
    this.parked.syncPlayerBlockers();
    if (!this.wasInsideHome) {
      this.pedestrians.update(dt, cullX, cullZ, this.clock.hourFloat);
      const car = this.parked.activeMesh;
      this.trafficObstacles[0]!.x = car ? car.position.x : p.x;
      this.trafficObstacles[0]!.z = car ? car.position.z : p.z;
      this.trafficObstacles[0]!.r = car ? 1.2 : 0.5;
      this.trafficObstacles.length = 1;
      for (const c of this.pedestrians.crossers) this.trafficObstacles.push(c);
      this.traffic.update(dt, cullX, cullZ);
      this.traffic.syncPlayerBlockers(this.collisions);
      this.taxis.syncPlayerBlockers(this.collisions);
      this.taxis.cull(cullX, cullZ);
      this.cityCull.update(dt, this.cityRoot, cullX, cullZ);
      this.chunks.update(dt, cullX, cullZ);
    }
    if (!this.aerial.active) this.engine.followShadows(p.x, p.z);
    this.cityMap.updatePlayer(p.x, p.z);
    this.density.update(dt, cullX, cullZ, this.aerial.active ? this.engine.camera.rotation.y : this.player.object.rotation.y);

    for (const part of this.spinParts) {
      if (part.name === 'rotor-tail') part.rotation.x += dt * 14;
      else part.rotation.y += dt * 9;
    }

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
    if (this.devPose) {
      const { x, z, h, pitch, yaw } = this.devPose;
      const cam = this.engine.camera;
      cam.position.set(x, h, z);
      cam.rotation.order = 'YXZ';
      cam.rotation.set((-pitch * Math.PI) / 180, (yaw * Math.PI) / 180, 0);
      cam.updateMatrixWorld();
      this.chunks.update(0, x, z);
      this.engine.followShadows(x, z);
    }
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
    if (save.look) {
      const before = loadLook().characterId;
      saveLook(save.look);
      if (loadLook().characterId !== before) {
        void mountRiggedPlayer(this.player.object, this.engine.renderer, loadLook().characterId);
      }
    }
    if (save.wardrobe) replaceWardrobe(save.wardrobe);
    if (save.fashionOwned) replaceOwned(save.fashionOwned);
    this.parked.applyOwned(save.ownedCars);
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
      look: loadLook(),
      wardrobe: loadWardrobe(),
      fashionOwned: ownedItems(),
      ownedCars: this.parked.serializeOwned(),
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
      this.releasePointerLock();
      return;
    }
    this.hud.hideTaxiMenu();
    this.audio.playUi();
    this.input.blockPointerLock = true;
    this.phone.show({
      onClose: () => {
        this.releasePointerLock();
      },
      onOpenMap: () => {
        this.phone.hide();
        this.toggleMap();
      },
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
      getDistrict: () => {
        const p = this.player.object.position;
        return findDistrictAt(p.x, p.z)?.name ?? 'Yaoundé';
      },
      getNearestPlace: () => {
        const p = this.player.object.position;
        return nearestLandmark(p.x, p.z, 220)?.name ?? 'Centre-ville';
      },
      destinations: this.taxis.destinations,
    });
  }

  private lookPausedFurniture = false;
  private readonly studio = new CharacterStudio();
  private lookSnapshot: PlayerLook | null = null;
  private creatorPose: 'idle' | 'walk' | 'run' | 'sit' = 'idle';
  private creatorTurn = 0;

  private lookMenu(): LookHandlers {
    return {
      onSex: (sex) => this.commitLook({ sex }),
      onCharacter: (characterId) => this.commitLook({ characterId }),
      onSkin: (skinId) => this.commitLook({ skinId }),
      onNose: (nose) => this.commitLook({ nose }, false),
      onNoseWidth: (noseWidth) => this.commitLook({ noseWidth }, false),
      onJaw: (jaw) => this.commitLook({ jaw }, false),
      onChin: (chin) => this.commitLook({ chin }, false),
      onEye: (eyeId) => this.commitLook({ eyeId }),
      onHair: (hairId) => this.commitLook({ hairId }),
      onBrow: (browId) => this.commitLook({ browId }),
      onHairStyle: (hairStyle) => this.commitLook({ hairStyle }),
      onHeight: (height) => this.commitLook({ height }, false),
      onShoulders: (shoulders) => this.commitLook({ shoulders }, false),
      onTorso: (torso) => this.commitLook({ torso }, false),
      onHips: (hips) => this.commitLook({ hips }, false),
      onArms: (arms) => this.commitLook({ arms }, false),
      onLegs: (legs) => this.commitLook({ legs }, false),
      onPreset: (id) => {
        if (applyPreset(id)) this.applySavedLook(true);
      },
      onOutfit: (id) => {
        const outfit = OUTFITS.find((item) => item.id === id);
        if (outfit) this.commitLook({ topId: outfit.topId, bottomId: outfit.bottomId, shoeId: outfit.shoeId });
      },
      onTop: (topId) => this.commitLook({ topId }),
      onBottom: (bottomId) => this.commitLook({ bottomId }),
      onShoes: (shoeId) => this.commitLook({ shoeId }),
      onSuit: (id) => this.commitLook({ topId: id, bottomId: id }),
      onDressPick: (dressId) => this.commitLook({ dressId }),
      onDressColor: (dressColor) => this.commitLook({ dressColor }),
      onView: (view) => this.cameraRig.snapCreator(view, this.player.object.rotation.y),
      onPose: (pose) => {
        const animator = this.player.object.userData.animator as
          | { setActivity: (kind: string | null) => void }
          | undefined;
        if (pose === 'turn') {
          this.creatorPose = 'walk';
          this.creatorTurn = 1.35;
          animator?.setActivity(null);
          return;
        }
        if (pose === 'sit') {
          this.creatorPose = 'sit';
          this.creatorTurn = 0;
          animator?.setActivity('tv');
          return;
        }
        this.creatorPose = pose;
        this.creatorTurn = 0;
        animator?.setActivity(null);
      },
      onRandom: () => {
        randomizeLook();
        this.applySavedLook(true);
      },
      onReset: () => {
        resetLook();
        this.applySavedLook(true);
      },
      onSaveOutfit: () => {
        const saved = addOutfit(`Tenue ${loadWardrobe().length + 1}`, loadLook());
        this.hud.notify(`${saved.name} enregistrée`);
        this.hud.showWardrobe();
      },
      onAccessory: (slot, id) => this.commitLook({ [SLOT_FIELDS[slot].id]: id } as Partial<PlayerLook>),
      onAccessoryColor: (slot, color) => {
        const key = SLOT_FIELDS[slot].color;
        if (key) this.commitLook({ [key]: color } as Partial<PlayerLook>);
      },
      onBuy: (ids) => this.buyFashion(ids),
      onBeard: (beardId) => this.commitLook({ beardId }),
      onLip: (lipId) => this.commitLook({ lipId }),
      onBlush: (blushId) => this.commitLook({ blushId }),
      onShadow: (shadowId) => this.commitLook({ shadowId }),
      onFreckles: (freckles) => this.commitLook({ freckles }),
      money: () => this.money,
      onEquipSaved: (id) => {
        const saved = outfitById(id);
        if (!saved) return;
        const missing = unownedAccessories(saved.look).length;
        saveLook(withoutUnowned(saved.look));
        if (missing > 0) this.hud.notify('Articles non achetés retirés de la tenue');
        this.applySavedLook(true);
        this.hud.notify(saved.name);
      },
      onRenameSaved: (id, name) => {
        renameOutfit(id, name);
        if (this.hud.isLookPanelOpen()) this.hud.showLookPanel(loadLook(), this.lookMenu());
      },
      onDeleteSaved: (id) => {
        deleteOutfit(id);
        if (this.hud.isLookPanelOpen()) this.hud.showLookPanel(loadLook(), this.lookMenu());
      },
      onDuplicateSaved: (id) => {
        const copy = duplicateOutfit(id);
        if (copy) this.hud.notify(`${copy.name} créée`);
        if (this.hud.isLookPanelOpen()) this.hud.showLookPanel(loadLook(), this.lookMenu());
      },
      onFavoriteSaved: (id) => {
        toggleFavoriteOutfit(id);
        if (this.hud.isLookPanelOpen()) this.hud.showLookPanel(loadLook(), this.lookMenu());
      },
      onCancel: () => this.closeCharacterLook(true),
      onConfirm: () => this.closeCharacterLook(false),
    };
  }

  private toggleCharacterLook(): void {
    if (this.pauseMenu.isOpen() || this.dialogue.isOpen()) return;
    if (this.parked.driving || this.aerial.active || this.taxis.isRiding()) return;
    if (this.hud.isLookPanelOpen()) {
      this.closeCharacterLook(false);
      return;
    }
    // You get changed at home or at a hair salon, not in the middle of the street.
    const p = this.player.object.position;
    const salon = nearestSalon(p.x, p.z);
    if (!this.wasInsideHome && !salon) {
      this.hud.notify('Change de look chez toi ou dans un salon de coiffure', 3600);
      return;
    }
    this.openCharacterLook(salon?.name);
  }

  private openCharacterLook(salonName?: string): void {
    this.audio.playUi();
    this.input.blockPointerLock = true;
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.furniture.enabled) {
      this.lookPausedFurniture = true;
      this.furniture.setEnabled(false);
    }
    const player = this.player.object;
    let yaw = player.rotation.y;
    if (this.wasInsideHome) {
      const dx = PLAYER_HOUSE.cx - player.position.x;
      const dz = PLAYER_HOUSE.cz - player.position.z;
      if (dx * dx + dz * dz > 0.2) yaw = Math.atan2(dx, dz);
    }
    player.rotation.y = yaw;
    this.lookSnapshot = loadLook();
    this.creatorPose = 'idle';
    this.creatorTurn = 0;
    this.studio.enter(this.engine.scene, player.position);
    this.cameraRig.beginCreatorView(yaw);
    this.hud.showLookPanel(loadLook(), this.lookMenu());
    this.hud.setTip(
      salonName
        ? `${salonName} — glisse pour tourner · molette zoome · Échap annule`
        : 'Glisse pour tourner · molette pour zoomer · Échap annule',
    );
  }

  private closeCharacterLook(restore = false): void {
    const snap = this.lookSnapshot;
    this.lookSnapshot = null;
    this.creatorPose = 'idle';
    this.creatorTurn = 0;
    this.hud.hideLookPanel();
    this.studio.exit(this.engine.scene);
    this.cameraRig.endCreatorView(this.wasInsideHome);
    if (this.lookPausedFurniture && this.wasInsideHome) {
      this.furniture.setEnabled(true);
    }
    this.lookPausedFurniture = false;
    this.releasePointerLock();
    if (restore && snap) {
      saveLook(snap);
      this.applySavedLook(false);
      this.hud.notify('Apparence précédente');
      return;
    }
    const look = loadLook();
    if (unownedAccessories(look).length > 0) {
      saveLook(withoutUnowned(look));
      this.applySavedLook(false);
      this.hud.notify('Personnage enregistré · articles essayés non achetés retirés');
    } else {
      this.hud.notify('Personnage enregistré');
    }
    this.saveGame(true);
  }

  private creatorFaceHeight(): number {
    const rig = this.player.object.getObjectByName('player-rig');
    const fit = rig?.userData.fit as { eyeY: number } | undefined;
    if (!rig || !fit) return 1.52;
    return rig.position.y + fit.eyeY * rig.scale.y;
  }

  private buyFashion(ids: string[]): void {
    const items = ids
      .map((id) => accessoryById(id) ?? dressById(id))
      .filter((item) => item && !isOwned(item.id));
    const total = items.reduce((sum, item) => sum + (item?.price ?? 0), 0);
    if (items.length === 0) return;
    if (total > this.money) {
      this.hud.notify('Pas assez de FCFA');
      return;
    }
    this.money -= total;
    for (const item of items) if (item) grantItem(item.id);
    this.hud.setMoney(this.money);
    this.audio.playUi();
    this.saveGame(true);
    this.hud.notify(`Acheté · ${total.toLocaleString('fr-FR')} FCFA`);
    if (this.hud.isLookPanelOpen()) this.hud.showLookPanel(loadLook(), this.lookMenu());
  }

  private commitLook(patch: Partial<PlayerLook>, refresh = true): void {
    chooseLook(patch);
    this.applySavedLook(refresh);
  }

  private applySavedLook(refresh: boolean): void {
    const next = loadLook();
    const avatar = this.player.object;
    const swap = next.characterId !== avatar.userData.characterId || avatar.userData.rigged !== true;
    if (refresh && this.hud.isLookPanelOpen()) this.hud.showLookPanel(next, this.lookMenu());
    if (!swap) {
      applyAppearance(avatar, next);
      return;
    }
    this.hud.setTip('Chargement du personnage…');
    void mountRiggedPlayer(avatar, this.engine.renderer, next.characterId).then((ok) => {
      if (!ok) {
        // No rig: tint the procedural avatar so the choice is still visible.
        applyAppearance(avatar, next);
        this.hud.notify('Ce personnage n’a pas pu être chargé');
      }
      else if (this.hud.isLookPanelOpen()) this.hud.setTip('Glisse pour tourner · molette pour zoomer · Échap annule');
      if (this.hud.isLookPanelOpen()) this.hud.showLookPanel(loadLook(), this.lookMenu());
    });
  }

  private togglePause(): void {
    if (this.hud.isLookPanelOpen()) {
      this.closeCharacterLook(true);
      return;
    }
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
      this.releasePointerLock();
      return;
    }
    this.audio.playUi();
    this.input.blockPointerLock = true;
    this.pauseMenu.show({
      onResume: () => {
        this.releasePointerLock();
      },
      onSave: () => this.saveGame(),
      onGraphics: (label: string) => {
        // a manual choice overrides the low-FPS safety drop for this session
        this.fpsAutoDropped = true;
        this.engine.applyLiveGraphics();
        this.onCityGraphicsChanged();
        this.hud.notify(`Graphismes · ${label}`);
      },
      getStats: () => {
        const s = this.perf.last;
        const c = this.chunks.stats();
        return {
          fps: this.hud.getFps(),
          calls: s?.calls ?? 0,
          triangles: s?.triangles ?? 0,
          chunks: `${c.base} quartiers (${c.detail} détaillés)`,
          npcs: this.pedestrians.drawn,
          vehicles: this.traffic.drawn,
        };
      },
      onQuitHint: () => {
        this.hud.notify('E interagir · P téléphone · Esc pause · M carte · V change la vue · F3 perfs · F4 densité');
      },
    });
  }

  /** City content that depends on settings (vegetation density) must be rebuilt. */
  private onCityGraphicsChanged(): void {
    if (Math.abs(GraphicsConfig.vegetationDensity - this.lastVegetation) > 0.01) {
      this.lastVegetation = GraphicsConfig.vegetationDensity;
      this.chunks.rebuildAll();
    }
    const p = this.player.object.position;
    this.traffic.setCount(TRAFFIC_BASE * GraphicsConfig.trafficDensity, p.x, p.z);
    this.pedestrians.setDensity(1.15 * GraphicsConfig.npcDensity);
  }

  private installDevHooks(): void {
    const w = window as unknown as Record<string, unknown>;
    w.__tp = (x: number, z: number, yaw = 0) => {
      this.player.object.position.set(x, 0, z);
      this.player.object.rotation.y = yaw;
      this.cameraRig.yaw = yaw;
      this.chunks.warm(x, z);
    };
    w.__traffic = this.traffic;
    w.__peds = this.pedestrians;
    w.__hour = (h: number | null) => {
      this.clock.debugHour = h;
      this.clock.syncFromYaounde();
      this.refreshDayNight();
    };
    w.__chunks = this.chunks;
    w.__weather = (wx: 'clear' | 'haze' | 'rain') => {
      this.clock.weather = wx;
      this.refreshDayNight();
    };
    /** Freeze the loop's camera and render a still from (x, h, z) with pitch/yaw in degrees. */
    w.__shot = (x: number, z: number, h: number, pitch: number, yaw: number) => {
      this.devPose = { x, z, h, pitch, yaw };
      this.chunks.warm(x, z);
      return new Promise<number>((resolve) => {
        let n = 0;
        const frame = () => {
          if (++n < 4) requestAnimationFrame(frame);
          else resolve(this.engine.renderer.info.render.calls);
        };
        requestAnimationFrame(frame);
      });
    };
    w.__unfreeze = () => {
      this.devPose = null;
    };
    w.__game = this;
  }

  private watchFps(dt: number): void {
    // background / unfocused tabs are throttled by the browser: that is not the GPU being slow
    // aerial overview is not representative of play; a single spike (chunk streaming after a jump) is not either
    if (document.hidden || !document.hasFocus() || this.aerial.active) {
      this.fpsWarnTimer = 0;
      this.fpsLowStreak = 0;
      return;
    }
    this.fpsWarnTimer += dt;
    if (this.fpsWarnTimer < 4) return;
    this.fpsWarnTimer = 0;
    const fps = this.hud.getFps();
    this.fpsLowStreak = fps > 0 && fps < 26 ? this.fpsLowStreak + 1 : 0;
    if (this.fpsLowStreak >= 3 && GraphicsConfig.quality !== 'low' && !this.fpsAutoDropped) {
      this.fpsAutoDropped = true;
      applyQuality('low');
      this.engine.applyLiveGraphics();
      this.onCityGraphicsChanged();
      this.hud.notify('FPS bas — graphismes en Bas pour cette session (Pause › Graphismes pour changer)');
    }
  }

  private endDialogue(): void {
    if (this.talkingNpc) {
      this.pedestrians.setPaused(this.talkingNpc, false);
      this.talkingNpc = null;
    }
    this.dialogue.hide();
    this.releasePointerLock();
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
      roleLabel(npc.role as NpcRole),
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
    this.setHomeView(this.homeView);
    this.setFurnitureMode(false);
    this.hud.setTip('Chez toi — E à la porte pour sortir · V change la vue');
  }

  /** 3/4, plan, shoulder — works at home and in the street. */
  private cycleHomeView(): void {
    if (this.aerial.active) return;
    const i = HOME_VIEWS.findIndex((v) => v.id === this.homeView);
    const next = HOME_VIEWS[(i + 1) % HOME_VIEWS.length]!;
    this.setHomeView(next.id);
    this.audio.playUi();
    if (this.wasInsideHome && this.furniture.enabled) {
      this.setFurnitureMode(false);
    }
    this.hud.setTip(
      this.wasInsideHome
        ? `${next.label} — molette pour zoomer · glisse pour tourner`
        : `${next.label} — V change la vue`,
    );
  }

  private setHomeView(view: HomeView): void {
    this.homeView = view;
    this.hud.setHomeView(view);
    if (this.wasInsideHome) {
      this.cameraRig.beginIndoorView(view);
      if (this.houseRoot) setHomeCeilingVisible(this.houseRoot, view === 'shoulder');
      return;
    }
    this.cameraRig.beginOutdoorView(view);
  }

  /** Follow-cam options for the street / mall / car when not in shoulder view. */
  private streetCamOpts(extra?: { distance?: number; lookHeight?: number }): {
    isometric?: boolean;
    homeView?: HomeView;
    outdoor?: boolean;
    distance?: number;
    lookHeight?: number;
  } | undefined {
    if (this.homeView === 'shoulder') return extra;
    return { isometric: true, homeView: this.homeView, outdoor: true, ...extra };
  }

  /** Shoulder view sits in the cabin; 3/4 and plan stay outside. */
  private updateDriveCamera(car: THREE.Object3D, dt: number): void {
    if (this.homeView === 'shoulder') {
      this.cameraRig.update(car, dt, { distance: 0.2, lookHeight: 1.16 });
      const cockpit = car.userData.cockpit as THREE.Object3D | undefined;
      if (cockpit) {
        cockpit.updateWorldMatrix(true, false);
        this.engine.camera.position.setFromMatrixPosition(cockpit.matrixWorld);
        this.cockpitLook.set(0.22, -0.08, 2.4);
        cockpit.localToWorld(this.cockpitLook);
        this.engine.camera.lookAt(this.cockpitLook);
        if (Math.abs(this.engine.camera.fov - 62) > 0.05) {
          this.engine.camera.fov = 62;
          this.engine.camera.updateProjectionMatrix();
        }
      }
      return;
    }
    this.cameraRig.update(car, dt, this.streetCamOpts({ distance: 11, lookHeight: 1.2 }));
  }

  /** Single place that keeps build mode, its button and the pointer lock in sync. */
  private setFurnitureMode(on: boolean): void {
    this.furniture.setEnabled(on);
    this.hud.setFurnitureMode(on);
    if (on) {
      this.input.blockPointerLock = true;
      if (document.pointerLockElement) document.exitPointerLock();
      this.cameraRig.beginIndoorView('plan');
      if (this.houseRoot) setHomeCeilingVisible(this.houseRoot, false);
      return;
    }
    this.releasePointerLock();
  }

  private refreshDayNight(): void {
    this.engine.applyDayNight(this.clock.sunFactor, this.clock.weather, this.clock.hourFloat);
    if (this.houseRoot) refreshHomeInteriorLook(this.houseRoot, this.engine.scene);
  }

  private exitHomeMode(): void {
    if (!this.houseRoot) return;
    this.furniture.setEnabled(false);
    this.hud.setFurnitureMode(false);
    this.hud.hideDecorShop();
    setHomeInteriorMode(this.houseRoot, this.cityRoot, this.engine.scene, false);
    this.hud.setHomeMode(false);
    this.cameraRig.beginOutdoorView(this.homeView);
    this.releasePointerLock();
  }

  private toggleFurniture(): void {
    if (!this.wasInsideHome) return;
    const next = !this.furniture.enabled;
    this.setFurnitureMode(next);
    if (next) {
      this.hud.setTip('Glisse un meuble · R tourne · Suppr range · F ou Finir pour terminer');
      this.audio.playUi();
      return;
    }
    this.setHomeView(this.homeView);
    this.hud.setTip('Chez toi — V change la vue · E agir · Meubles pour déplacer');
  }

  private onFurnitureMoved(id: string, pose: FurnPose, commit: boolean): void {
    this.homeDecor = {
      ...this.homeDecor,
      layout: { ...this.homeDecor.layout, [id]: pose },
    };
    if (this.houseRoot) syncHomeSpotsToFurniture(this.homeSpots, this.houseRoot);
    if (commit) saveHomeDecor(this.homeDecor);
  }

  private storeFurnitureItem(id: string): void {
    this.homeDecor = storeFurniture(this.homeDecor, id);
    this.applyDecor();
    this.audio.playUi();
    this.hud.setTip(`${FURN_LABELS[id] ?? 'Meuble'} rangé — Déco › Rangés pour le remettre`);
  }

  private restoreFurnitureItem(id: string): void {
    this.homeDecor = restoreFurniture(this.homeDecor, id);
    this.applyDecor();
    this.hud.refreshDecorShop(this.homeDecor);
    this.audio.playConfirm();
    this.hud.setTip(`${FURN_LABELS[id] ?? 'Meuble'} remis à sa place`);
  }

  private releasePointerLock(): void {
    if (this.furniture?.enabled) return;
    this.input.blockPointerLock = false;
  }

  private openDecorShop(): void {
    if (!this.wasInsideHome) return;
    this.audio.playUi();
    this.hud.showDecorShop(this.homeDecor, {
      onBuyItem: (id) => this.buyDecorItem(id),
      onBuyWall: (id) => this.buyWall(id),
      onBuyFloor: (id) => this.buyFloor(id),
      onRestore: (id) => this.restoreFurnitureItem(id),
      onResetLayout: () => {
        this.homeDecor = resetFurnitureLayout(this.homeDecor);
        this.applyDecor();
        this.hud.refreshDecorShop(this.homeDecor);
        this.audio.playConfirm();
        this.hud.setTip('Meubles remis à leur place d’origine');
      },
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
    applyHomeDecor(this.houseRoot, this.homeDecor, this.collisions);
    syncHomeSpotsToFurniture(this.homeSpots, this.houseRoot);
    this.furniture.dropSelection();
  }

  private openMallShop(spot: MallSpot): void {
    this.openCounterShop(spot.name, spot.offers ?? []);
  }

  private openSantaShop(spot: SantaSpot): void {
    this.openCounterShop(spot.name, spot.offers);
  }

  private useVenueSpot(spot: VenueSpot): void {
    if (VENUES.find((v) => v.id === spot.venueId)?.restricted) {
      this.hud.notify('Accès interdit — les militaires tiennent le périmètre');
      return;
    }
    if (spot.kind === 'job') {
      this.startJob(spot);
      return;
    }
    if (spot.kind === 'ritual') {
      const price = spot.price ?? 0;
      if (price > this.money) {
        this.hud.notify('Pas assez de FCFA');
        return;
      }
      if (price) this.money -= price;
      if (spot.boost) this.needs.applyBoost(spot.boost);
      this.hud.setMoney(this.money);
      this.hud.setNeeds(this.needs.snapshot(), this.needs.moodLabel());
      this.audio.playConfirm();
      this.hud.notify(price ? `${spot.name} · −${price.toLocaleString('fr-FR')} FCFA` : spot.name);
      this.hud.setTip(spot.blurb);
      return;
    }
    this.openCounterShop(spot.name, spot.offers ?? []);
  }

  private updatePalaceSecurity(dt: number, driving: boolean): void {
    this.fadePalaceTracers(dt);
    const p = this.player.object.position;
    const zone = palaceZone(p.x, p.z);
    if (zone === 'safe') {
      this.palaceWarned = false;
      this.palaceFireAcc = 0;
      return;
    }
    if (zone === 'warn') {
      this.palaceFireAcc = 0;
      if (!this.palaceWarned) {
        this.palaceWarned = true;
        this.hud.notify('Halte ! Zone militaire — reculez', 4200);
        this.audio.playUi();
      }
      this.hud.setDistrict('Etoudi · zone militaire');
      this.hud.setTip('Accès interdit — les militaires ouvrent le feu si tu forces');
      this.hud.setPrompt('⛔ Recule');
      return;
    }

    if (driving) this.parked.exit(this.player.object);
    this.palaceFireAcc += dt;
    this.hud.setDistrict('Palais · tirs');
    this.hud.setTip('Les militaires ouvrent le feu !');
    this.hud.setPrompt('⛔ Sors du périmètre');
    if (this.palaceFireAcc < 0.36) return;
    this.palaceFireAcc = 0;

    const downed = this.needs.takeDamage(16);
    this.audio.playShot();
    this.spawnPalaceTracers(p.x, p.y + 1.25, p.z);
    const eject = palaceEjectPos();
    const dx = eject.x - p.x;
    const dz = eject.z - p.z;
    const len = Math.hypot(dx, dz) || 1;
    p.x += (dx / len) * 4.8;
    p.z += (dz / len) * 4.8;
    this.hud.setNeeds(this.needs.snapshot(), this.needs.moodLabel());
    this.hud.notify('Les militaires ouvrent le feu !', 2000);
    if (downed || this.needs.health < 18) {
      p.x = eject.x;
      p.y = 0;
      p.z = eject.z;
      this.needs.health = Math.max(this.needs.health, 12);
      this.hud.setNeeds(this.needs.snapshot(), this.needs.moodLabel());
      this.hud.notify('Tu es évacué hors du périmètre', 4000);
    }
  }

  private spawnPalaceTracers(tx: number, ty: number, tz: number): void {
    this.clearPalaceTracers();
    const mat = new THREE.LineBasicMaterial({
      color: 0xffe082,
      transparent: true,
      opacity: 0.9,
    });
    for (const m of nearestPalaceMuzzles(tx, tz, 2)) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(m.x, m.y, m.z),
        new THREE.Vector3(tx, ty, tz),
      ]);
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      this.engine.scene.add(line);
      this.palaceTracers.push(line);
    }
    this.palaceTracerLife = 0.14;
  }

  private fadePalaceTracers(dt: number): void {
    if (!this.palaceTracers.length) return;
    this.palaceTracerLife -= dt;
    const fade = Math.max(0, this.palaceTracerLife / 0.14);
    for (const line of this.palaceTracers) {
      const mat = line.material as THREE.LineBasicMaterial;
      mat.opacity = 0.9 * fade;
    }
    if (this.palaceTracerLife <= 0) this.clearPalaceTracers();
  }

  private clearPalaceTracers(): void {
    for (const line of this.palaceTracers) {
      this.engine.scene.remove(line);
      line.geometry.dispose();
      const mat = line.material;
      if (!Array.isArray(mat)) mat.dispose();
    }
    this.palaceTracers.length = 0;
  }

  private openCounterShop(name: string, offers: ShopOffer[]): void {
    if (!offers.length) return;
    this.audio.playUi();
    this.hud.showShopMenu(
      name,
      offers,
      (id) => {
        const offer = offers.find((o) => o.id === id);
        if (!offer) return;
        this.buyLifeOffer(offer, `Achat · ${name}`);
      },
      () => undefined,
    );
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

  private buyLifeOffer(offer: ShopOffer, tip?: string): void {
    if (this.money < offer.price) {
      this.hud.notify('Pas assez de FCFA');
      return;
    }
    this.money -= offer.price;
    if (offer.item) this.needs.consume(offer.item);
    if (offer.boost) this.needs.applyBoost(offer.boost);
    else if (!offer.item) {
      this.needs.fun = Math.min(100, this.needs.fun + 18);
      this.needs.social = Math.min(100, this.needs.social + 8);
    }
    this.hud.setTip(tip ?? (offer.item ? 'Besoins améliorés — continue ta journée' : 'Achat téléphone · Avenue Kennedy'));
    this.hud.setMoney(this.money);
    this.hud.setNeeds(this.needs.snapshot(), this.needs.moodLabel());
    this.hud.hideShopMenu();
    this.audio.playConfirm();
    this.hud.notify(`${offer.label} · −${offer.price.toLocaleString('fr-FR')} FCFA`);
  }

  private startJob(spot: { id: string; name: string; x: number; z: number }): void {
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
    this.busyLabel = null;
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
      if (spot?.kind === 'clothes') {
        this.openCharacterLook();
        return;
      }
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
          if (spot.kind === 'door' && !isInsidePlayerHouse(this.player.object.position.x, this.player.object.position.z)) {
            this.exitHouseGrace = 2.2;
          }
          if (result.busySec) {
            this.homeBusy = result.busySec;
            this.pendingActivity = result.need ?? result.anim ?? null;
            this.busyLabel = result.busyLabel ?? null;
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

    const mall = nearestMallSpot(p.x, p.z, p.y);
    if (mall) {
      if (mall.kind === 'job') {
        this.startJob(mall);
        return;
      }
      this.openMallShop(mall);
      return;
    }
    if (isInsideMfoundiMall(p.x, p.z)) {
      this.hud.setTip('Approche un vendeur pour acheter, l’escalier pour l’étage, ou l’accueil pour travailler');
      return;
    }

    const santa = nearestSantaSpot(p.x, p.z, p.y);
    if (santa) {
      this.openSantaShop(santa);
      return;
    }
    if (isInsideSantaLucia(p.x, p.z)) {
      this.hud.setTip('Approche un rayon, la boulangerie, ou monte à l’étage');
      return;
    }

    const venueSpot = nearestVenueSpot(p.x, p.z);
    if (venueSpot) {
      this.useVenueSpot(venueSpot);
      return;
    }
    const venueHere = venueAt(p.x, p.z);
    if (venueHere?.restricted) {
      this.hud.notify('Accès interdit — recule');
      return;
    }
    if (venueHere) {
      this.hud.setTip('Approche un comptoir, l’autel ou un agent');
      return;
    }

    // City shops / jobs
    const life = nearestLifeSpot(p.x, p.z);
    if (life) {
      if (life.kind === 'job') {
        this.startJob(life);
        return;
      }
      if (life.kind === 'salon') {
        this.openCharacterLook(life.name);
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

    const sale = this.exitHouseGrace > 0 ? null : this.parked.nearestForSale(p.x, p.z, 5.2);
    if (sale) {
      const price = Number(sale.mesh.userData.salePrice) || 0;
      const label = (sale.mesh.userData.saleLabel as string) || 'Voiture';
      if (price > this.money) {
        this.hud.notify('Pas assez de FCFA');
        return;
      }
      this.money -= price;
      sale.mesh.userData.owned = true;
      sale.mesh.userData.driveable = true;
      this.hud.setMoney(this.money);
      this.audio.playConfirm();
      this.hud.notify(`Acheté · ${label} · −${price.toLocaleString('fr-FR')} FCFA`);
      this.hud.setTip('E pour monter et conduire');
      this.saveGame(true);
      return;
    }

    if (this.exitHouseGrace <= 0 && this.parked.tryEnter(this.player.object)) {
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

  private toggleMap(): void {
    if (this.taxis.isRiding()) return;
    if (this.parked.driving) return;
    if (this.cityMap.isOpen() || this.aerial.active) {
      this.closeMap();
      return;
    }
    this.hud.hideTaxiMenu();
    this.hud.hideDecorShop();
    this.taxis.closeMenu();
    if (this.phone.isOpen()) this.phone.hide();
    const p = this.player.object.position;
    if (this.wasInsideHome && this.houseRoot) {
      setHomeInteriorMode(this.houseRoot, this.cityRoot, this.engine.scene, false);
      this.mapLiftedHome = true;
    }
    this.aerial.enter(p.x, p.z);
    this.engine.setAerialBudget(true);
    this.input.blockPointerLock = true;
    this.cityMap.show(p.x, p.z, this.taxis.destinations, {
      onOrderRide: (dest) => {
        this.closeMap();
        this.orderRide(dest);
      },
      onClose: () => this.closeMap(),
    });
  }

  private closeMap(): void {
    if (this.aerial.active) {
      this.aerial.exit();
      this.engine.setAerialBudget(false);
      this.releasePointerLock();
    }
    if (this.cityMap.isOpen()) this.cityMap.hide();
    if (this.mapLiftedHome && this.houseRoot) {
      setHomeInteriorMode(this.houseRoot, this.cityRoot, this.engine.scene, true);
      this.mapLiftedHome = false;
    }
  }

  private pickMapGround(click: { clientX: number; clientY: number }): void {
    this.mapNdc.set((click.clientX / window.innerWidth) * 2 - 1, -(click.clientY / window.innerHeight) * 2 + 1);
    this.mapRay.setFromCamera(this.mapNdc, this.engine.camera);
    if (!this.mapRay.ray.intersectPlane(this.mapGround, this.mapHit)) return;
    this.cityMap.pickWorld(this.mapHit.x, this.mapHit.z);
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
