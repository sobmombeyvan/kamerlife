import * as THREE from 'three';
import { GraphicsConfig, rendererPowerPreference } from '../config/GraphicsConfig';
import {
  applyOutdoorAtmosphere,
  fitSkyToCamera,
  followSky,
  isIndoorAtmosphere,
  setSkySunDirection,
  skyMaterial,
  tickSky,
  type Weather,
} from '../render/atmosphere';
import { setSurfaceAnisotropy } from '../render/surfaces';
import { PostFX } from '../render/PostFX';
import { CityUniforms } from '../render/nightState';
import { HorizonHills } from '../render/HorizonHills';
import { WeatherFX } from '../render/WeatherFX';

const DEG = Math.PI / 180;

export class Engine {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly clock = new THREE.Clock();
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly post: PostFX;
  readonly hills: HorizonHills;
  /** Off while the character studio / home interior own the frame. */
  hillsEnabled = true;
  private readonly sunTarget = new THREE.Object3D();
  private readonly sunDir = new THREE.Vector3(0.3, 0.8, 0.2).normalize();
  private readonly pmrem: THREE.PMREMGenerator;
  private readonly envScene = new THREE.Scene();
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private envKey = '';
  private night = 0;
  private lastDelta = 0.016;
  private weather: Weather = 'clear';
  readonly weatherFx: WeatherFX;

  constructor(canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, GraphicsConfig.cameraFar);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: GraphicsConfig.antialias && !GraphicsConfig.postFx,
      powerPreference: rendererPowerPreference(),
      stencil: false,
      depth: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.info.autoReset = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = GraphicsConfig.toneMappingExposure;
    this.renderer.shadowMap.enabled = GraphicsConfig.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    setSurfaceAnisotropy(this.renderer.capabilities.getMaxAnisotropy());

    this.hemi = new THREE.HemisphereLight(0xc5d7e4, 0x6a6248, 0.7);
    this.scene.add(this.hemi);

    this.scene.add(this.sunTarget);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    this.sun.position.set(-40, 80, 30);
    this.sun.target = this.sunTarget;
    this.scene.add(this.sun);

    const envSky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), skyMaterial);
    envSky.scale.setScalar(50);
    this.envScene.add(envSky);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);

    this.hills = new HorizonHills(this.scene);
    this.weatherFx = new WeatherFX(this.scene);
    this.post = new PostFX(this.renderer, this.scene, this.camera);
    this.applyLiveGraphics();
    this.applyDayNight(1, 'clear', 11);

    this.resize();
    window.addEventListener('resize', this.resize);
    canvas.addEventListener(
      'webglcontextlost',
      (ev) => {
        ev.preventDefault();
      },
      false,
    );
    canvas.addEventListener(
      'webglcontextrestored',
      () => {
        this.applyLiveGraphics();
      },
      false,
    );
  }

  get nightAmount(): number {
    return this.night;
  }

  /** Keep shadow frustum around the player, snapped to shadow texels to stop shimmering. */
  followShadows(x: number, z: number): void {
    followSky(x, z);
    if (!GraphicsConfig.shadows) return;
    const texel = (GraphicsConfig.shadowExtent * 2) / GraphicsConfig.shadowMapSize;
    const sx = Math.round(x / texel) * texel;
    const sz = Math.round(z / texel) * texel;
    this.sunTarget.position.set(sx, 0, sz);
    this.sun.position.set(sx + this.sunDir.x * 120, this.sunDir.y * 120, sz + this.sunDir.z * 120);
    this.sunTarget.updateMatrixWorld();
  }

  setAerialBudget(on: boolean): void {
    this.hillsEnabled = !on;
    if (on) {
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.0));
      this.renderer.shadowMap.enabled = false;
      this.sun.castShadow = false;
    } else {
      this.applyLiveGraphics();
    }
  }

  private pixelRatio(): number {
    return Math.min(devicePixelRatio, GraphicsConfig.maxPixelRatio) * GraphicsConfig.renderScale;
  }

  /** Hot-apply GraphicsConfig after a settings change (no engine rebuild). */
  applyLiveGraphics(): void {
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.shadowMap.enabled = GraphicsConfig.shadows;
    this.renderer.shadowMap.type = GraphicsConfig.shadowSoft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.sun.castShadow = GraphicsConfig.shadows;
    this.sun.shadow.mapSize.set(GraphicsConfig.shadowMapSize, GraphicsConfig.shadowMapSize);
    this.sun.shadow.radius = GraphicsConfig.shadowRadius;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    const extent = GraphicsConfig.shadowExtent;
    const cam = this.sun.shadow.camera;
    cam.left = -extent;
    cam.right = extent;
    cam.top = extent;
    cam.bottom = -extent;
    cam.near = 1;
    cam.far = 260;
    cam.updateProjectionMatrix();
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      (this.sun.shadow as { map: THREE.WebGLRenderTarget | null }).map = null;
    }
    this.camera.far = GraphicsConfig.cameraFar;
    this.camera.updateProjectionMatrix();
    fitSkyToCamera(this.camera.far);
    this.renderer.toneMappingExposure = GraphicsConfig.toneMappingExposure;
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = GraphicsConfig.fogNear;
      this.scene.fog.far = GraphicsConfig.fogFar;
    }
    this.envKey = '';
    if (!GraphicsConfig.reflections) this.scene.environment = null;
    this.post.configure();
    this.resize();
  }

  /**
   * Day/night: sun direction from Yaoundé clock hour (≈4°N, sun nearly overhead at noon,
   * rising in the east +X and setting west −X), sky palette, fog, reflections, emissive night.
   */
  applyDayNight(sunFactor: number, weather: Weather, hour?: number): void {
    const h = hour ?? (sunFactor > 0.9 ? 12 : sunFactor < 0.2 ? 0 : 7);
    const t = (h - 6.1) / 12.2;
    const elev = Math.sin(t * Math.PI) * 78 * DEG;
    const azimuth = t * Math.PI;
    const dir = new THREE.Vector3(Math.cos(azimuth) * Math.cos(elev), Math.sin(elev), 0.22 * Math.cos(elev));
    if (t < 0 || t > 1) {
      // Night: below-horizon sun keeps the sky dark; moonlight comes from high south-west.
      dir.set(Math.cos(azimuth) * 0.4, -0.25 - Math.abs(Math.sin(t * Math.PI)) * 0.3, 0.2);
    }
    dir.normalize();
    this.sunDir.copy(dir);
    setSkySunDirection(dir);

    const sinE = dir.y;
    const day = THREE.MathUtils.smoothstep(sinE, -0.08, 0.3);
    const golden = (1 - THREE.MathUtils.smoothstep(sinE, 0.05, 0.4)) * THREE.MathUtils.smoothstep(sinE, -0.1, 0.02);
    this.night = 1 - day;
    const wx = weather === 'rain' ? 0.45 : weather === 'haze' ? 0.75 : 1;
    this.weather = weather;

    if (day > 0.02) {
      const lightDir = dir.y > 0.08 ? dir : new THREE.Vector3(dir.x, 0.08, dir.z).normalize();
      this.sunDir.copy(lightDir);
      this.sun.intensity = (0.25 + day * 2.35) * wx;
      this.sun.color.setHex(0xfff2dc).lerp(new THREE.Color(0xff9a52), golden * 0.85);
    } else {
      this.sunDir.set(-0.35, 0.82, 0.45).normalize();
      this.sun.intensity = 0.32;
      this.sun.color.setHex(0x8ea6d4);
    }
    this.hemi.intensity = 0.16 + day * 0.62;
    this.hemi.color.setHex(day > 0.3 ? 0xc5d7e4 : 0x5a6f96);
    this.hemi.groundColor.setHex(day > 0.3 ? 0x6a6248 : 0x1c1a1e);
    this.renderer.toneMappingExposure = GraphicsConfig.toneMappingExposure * (1 + this.night * 0.25);

    CityUniforms.uNight.value = THREE.MathUtils.smoothstep(this.night, 0.35, 0.85);
    this.post.setNight(this.night);

    if (isIndoorAtmosphere()) return;
    applyOutdoorAtmosphere(this.scene, sunFactor, weather);
    fitSkyToCamera(this.camera.far);
    this.refreshEnvironment(weather);
  }

  private refreshEnvironment(weather: Weather): void {
    if (!GraphicsConfig.reflections) {
      this.scene.environment = null;
      return;
    }
    const key = `${Math.round(this.night * 12)}|${weather}`;
    if (key === this.envKey) return;
    this.envKey = key;
    const prev = this.envTarget;
    this.envTarget = this.pmrem.fromScene(this.envScene, 0.02, 0.1, 100);
    this.scene.environment = this.envTarget.texture;
    prev?.dispose();
  }

  resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setSize(w, h, false);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.post.setSize(size.x, size.y);
  };

  render(): void {
    // count the whole frame (composer passes, shadow map), not just the last render call
    this.renderer.info.reset();
    tickSky(this.lastDelta);
    CityUniforms.uTime.value += this.lastDelta;
    this.hills.update(this.camera, this.scene.fog, this.night, !isIndoorAtmosphere() && this.hillsEnabled);
    this.weatherFx.update(this.lastDelta, this.camera, this.weather === 'rain', !isIndoorAtmosphere() && this.hillsEnabled);
    if (!this.post.render(this.lastDelta)) this.renderer.render(this.scene, this.camera);
  }

  getDelta(): number {
    this.lastDelta = Math.min(this.clock.getDelta(), 0.05);
    return this.lastDelta;
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.envTarget?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
  }
}
