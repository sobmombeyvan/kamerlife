import * as pc from 'playcanvas';
import { GameConfig } from './GameConfig';
import { InputManager } from '../input/InputManager';
import { CollisionWorld } from '../world/CollisionWorld';
import { TestZoneBuilder } from '../world/TestZoneBuilder';
import { ThirdPersonCamera } from '../player/ThirdPersonCamera';
import { loadPlayerCharacter, createTemporaryHumanoid } from '../player/CharacterLoader';
import { PlayerController } from '../player/PlayerController';
import { HUD } from '../ui/HUD';
import { MobileControls } from '../ui/MobileControls';

export class Game {
  private app!: pc.AppBase;
  private input!: InputManager;
  private collisions!: CollisionWorld;
  private camera!: ThirdPersonCamera;
  private player!: PlayerController;
  private hud!: HUD;
  private escapeWasDown = false;
  private balance = GameConfig.startingBalanceFcfa;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly uiRoot: HTMLElement,
  ) {}

  async start(): Promise<void> {
    this.sizeCanvas();

    // WebGL2 first: WebGPU frequently hangs on some Windows/D3D12 setups.
    const device = await this.createDevice();

    const options = new pc.AppOptions();
    options.graphicsDevice = device;
    options.componentSystems = [
      pc.RenderComponentSystem,
      pc.CameraComponentSystem,
      pc.LightComponentSystem,
      pc.AnimComponentSystem,
    ];
    options.resourceHandlers = [
      pc.TextureHandler,
      pc.ContainerHandler,
      pc.JsonHandler,
      pc.BinaryHandler,
    ];

    this.app = new pc.AppBase(this.canvas);
    this.app.init(options);
    this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    this.app.scene.ambientLight = new pc.Color(
      GameConfig.ambientColor.r,
      GameConfig.ambientColor.g,
      GameConfig.ambientColor.b,
    );

    window.addEventListener('resize', () => {
      this.sizeCanvas();
      this.app.resizeCanvas();
    });

    this.createLights();
    this.input = new InputManager(this.canvas);
    this.collisions = new CollisionWorld();
    new TestZoneBuilder(this.app, this.collisions).build();

    this.hud = new HUD(this.uiRoot);
    new MobileControls(this.uiRoot, this.input);
    this.camera = new ThirdPersonCamera(this.app, this.input, this.collisions);

    // Start immediately with a visible humanoid so the scene is never blank
    // while the GLB loads (or if WebGPU/GLB fails).
    const bootstrap = createTemporaryHumanoid(this.app);
    this.player = new PlayerController(bootstrap, this.input, this.camera, this.collisions);

    this.app.on('update', (dt: number) => this.update(dt));
    this.app.start();
    this.app.resizeCanvas();
    this.hud.setHint('Zone test chargée · Chargement du personnage…');

    void this.upgradeCharacter();
  }

  private async createDevice(): Promise<pc.GraphicsDevice> {
    try {
      return await pc.createGraphicsDevice(this.canvas, {
        deviceTypes: [pc.DEVICETYPE_WEBGL2],
        antialias: true,
      });
    } catch (webglError) {
      console.warn('[Game] WebGL2 failed, trying WebGPU fallback', webglError);
      return await pc.createGraphicsDevice(this.canvas, {
        deviceTypes: [pc.DEVICETYPE_WEBGPU, pc.DEVICETYPE_WEBGL2],
        antialias: true,
      });
    }
  }

  private sizeCanvas(): void {
    const parent = this.canvas.parentElement;
    const w = parent?.clientWidth || window.innerWidth || 800;
    const h = parent?.clientHeight || window.innerHeight || 600;
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
  }

  private async upgradeCharacter(): Promise<void> {
    try {
      const character = await loadPlayerCharacter(this.app);
      const pos = this.player.entity.getPosition().clone();
      const angles = this.player.entity.getEulerAngles().clone();

      this.player.entity.destroy();
      this.player = new PlayerController(character, this.input, this.camera, this.collisions);
      this.player.entity.setPosition(pos);
      this.player.entity.setEulerAngles(angles);

      this.hud.setHint(
        character.hasAnimations
          ? 'Personnage animé chargé · ZQSD pour marcher, clic pour la souris'
          : 'Humanoid temporaire · Placez un GLB dans public/assets/characters/',
      );
    } catch (error) {
      console.warn('[Game] Character upgrade failed, keeping temporary humanoid', error);
      this.hud.setHint('Humanoid temporaire · GLB non chargé — vous pouvez quand même jouer');
    }
  }

  private createLights(): void {
    const sun = new pc.Entity('sun');
    sun.addComponent('light', {
      type: 'directional',
      color: new pc.Color(GameConfig.sunColor.r, GameConfig.sunColor.g, GameConfig.sunColor.b),
      intensity: 1.25,
      castShadows: false,
    });
    sun.setEulerAngles(35, 40, 0);
    this.app.root.addChild(sun);

    const fill = new pc.Entity('fill');
    fill.addComponent('light', {
      type: 'directional',
      color: new pc.Color(0.55, 0.65, 0.8),
      intensity: 0.45,
      castShadows: false,
    });
    fill.setEulerAngles(10, -120, 0);
    this.app.root.addChild(fill);
  }

  private update(dt: number): void {
    const escapeDown = this.input.isEscapePressed();
    if (escapeDown && !this.escapeWasDown) {
      this.hud.toggleMenu();
    }
    this.escapeWasDown = escapeDown;

    if (this.hud.isMenuOpen()) {
      return;
    }

    this.player.update(dt);
    this.camera.update(this.player.entity, dt);

    if (this.input.consumeInteract()) {
      this.hud.setHint('Interaction prête — aucun objet interactif en Phase 1');
    }

    this.hud.setBalance(this.balance);
  }
}
