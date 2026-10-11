import * as THREE from 'three';
import { GraphicsConfig } from '../config/GraphicsConfig';
import {
  applyOutdoorAtmosphere,
  fitSkyToCamera,
  followSky,
} from '../render/atmosphere';
import { setSurfaceAnisotropy } from '../render/surfaces';

export class Engine {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly clock = new THREE.Clock();
  readonly sun: THREE.DirectionalLight;
  private readonly sunTarget = new THREE.Object3D();

  constructor(canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, GraphicsConfig.cameraFar);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: GraphicsConfig.antialias,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = GraphicsConfig.toneMappingExposure;
    this.renderer.shadowMap.enabled = GraphicsConfig.shadows;
    this.renderer.shadowMap.type = GraphicsConfig.shadowSoft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    setSurfaceAnisotropy(this.renderer.capabilities.getMaxAnisotropy());

    const hemi = new THREE.HemisphereLight(0xc5d7e4, 0x6a6248, 0.72);
    this.scene.add(hemi);

    this.sunTarget.position.set(0, 0, 0);
    this.scene.add(this.sunTarget);

    this.sun = new THREE.DirectionalLight(0xfff1d6, 1.7);
    this.sun.position.set(-40, 80, 30);
    this.sun.target = this.sunTarget;
    this.scene.add(this.sun);
    this.applyLiveGraphics();
    applyOutdoorAtmosphere(this.scene, 0.92, 'clear');

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.HemisphereLight(0xb7d4ea, 0x8a7a58, 0.6));
    const envSky = new THREE.Mesh(
      new THREE.SphereGeometry(30, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x9ec8de, side: THREE.BackSide }),
    );
    envScene.add(envSky);
    const envGround = new THREE.Mesh(
      new THREE.CircleGeometry(30, 16),
      new THREE.MeshBasicMaterial({ color: 0x7a7358 }),
    );
    envGround.rotation.x = -Math.PI / 2;
    envScene.add(envGround);
    const envSun = new THREE.Mesh(
      new THREE.SphereGeometry(3, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff6d2 }),
    );
    envSun.position.set(-10, 16, 8);
    envScene.add(envSun);
    this.scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  /** Keep shadow frustum around the player for useful local shadows. */
  followShadows(x: number, z: number): void {
    followSky(x, z);
    if (!GraphicsConfig.shadows) return;
    this.sunTarget.position.set(x, 0, z);
    this.sun.position.set(x - 45, 90, z + 25);
    this.sunTarget.updateMatrixWorld();
  }

  setAerialBudget(on: boolean): void {
    if (on) {
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.0));
      this.renderer.shadowMap.enabled = false;
      this.sun.castShadow = false;
    } else {
      this.applyLiveGraphics();
    }
  }

  /** Hot-apply GraphicsConfig after quality change (no engine rebuild). */
  applyLiveGraphics(): void {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, GraphicsConfig.maxPixelRatio));
    this.renderer.shadowMap.enabled = GraphicsConfig.shadows;
    this.renderer.shadowMap.type = GraphicsConfig.shadowSoft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.sun.castShadow = GraphicsConfig.shadows;
    this.sun.shadow.mapSize.set(GraphicsConfig.shadowMapSize, GraphicsConfig.shadowMapSize);
    this.sun.shadow.radius = GraphicsConfig.shadowRadius;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.035;
    const extent = GraphicsConfig.shadowExtent;
    this.sun.shadow.camera.left = -extent;
    this.sun.shadow.camera.right = extent;
    this.sun.shadow.camera.top = extent;
    this.sun.shadow.camera.bottom = -extent;
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 180;
    this.sun.shadow.camera.updateProjectionMatrix();
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      // three.js recreates the map on next shadow render
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  }

  /** Day/night sun intensity + sky / fog. */
  applyDayNight(sunFactor: number, weather: 'clear' | 'haze' | 'rain'): void {
    const base = 1.7 * sunFactor;
    this.sun.intensity = weather === 'rain' ? base * 0.55 : weather === 'haze' ? base * 0.78 : base;
    const hemi = this.scene.children.find((c) => c instanceof THREE.HemisphereLight) as
      | THREE.HemisphereLight
      | undefined;
    if (hemi) hemi.intensity = 0.38 + sunFactor * 0.42;
    if (sunFactor < 0.35) this.sun.color.setHex(0x8fa8c8);
    else if (sunFactor < 0.7) this.sun.color.setHex(0xffb074);
    else this.sun.color.setHex(0xfff1d6);
    applyOutdoorAtmosphere(this.scene, sunFactor, weather);
    fitSkyToCamera(this.camera.far);
  }

  resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, GraphicsConfig.maxPixelRatio));
    this.renderer.setSize(w, h, false);
  };

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  getDelta(): number {
    return Math.min(this.clock.getDelta(), 0.05);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }
}
