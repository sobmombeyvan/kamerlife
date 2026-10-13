import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { N8AOPass } from 'n8ao';
import { GraphicsConfig } from '../config/GraphicsConfig';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uContrast: { value: 1.06 },
    uSaturation: { value: 1.04 },
    uLift: { value: new THREE.Vector3(0.0, 0.0, 0.006) },
    uGain: { value: new THREE.Vector3(1.0, 0.99, 0.97) },
    uVignette: { value: 0.22 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uContrast;
    uniform float uSaturation;
    uniform vec3 uLift;
    uniform vec3 uGain;
    uniform float uVignette;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb * uGain + uLift * (1.0 - c.rgb);
      col = (col - 0.5) * uContrast + 0.5;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSaturation);
      vec2 q = vUv - 0.5;
      col *= 1.0 - uVignette * smoothstep(0.25, 0.85, dot(q, q) * 2.2);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};

/**
 * Optional composer chain. When post-processing is off the engine renders directly
 * (renderer tone mapping), so Low pays nothing for this module.
 */
export class PostFX {
  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private ao: N8AOPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  private grade: ShaderPass | null = null;
  private key = '';
  private night = 0;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
  ) {}

  get enabled(): boolean {
    return this.composer !== null;
  }

  /** Rebuild the chain when relevant settings change. */
  configure(): void {
    const g = GraphicsConfig;
    const key = `${g.postFx}|${g.ao}|${g.antialias}|${g.quality}`;
    if (key === this.key) return;
    this.key = key;
    this.disposeChain();
    if (!g.postFx) return;

    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: g.antialias ? 4 : 0,
    });
    const composer = new EffectComposer(this.renderer, target);
    composer.setPixelRatio(1);
    composer.setSize(size.x, size.y);

    if (!g.ao) {
      this.renderPass = new RenderPass(this.scene, this.camera);
      composer.addPass(this.renderPass);
    } else {
      // N8AOPass renders the beauty pass itself and replaces RenderPass.
      const ao = new N8AOPass(this.scene, this.camera, size.x, size.y);
      ao.configuration.aoRadius = 2.2;
      ao.configuration.distanceFalloff = 0.9;
      ao.configuration.intensity = 2.2;
      ao.configuration.halfRes = g.quality !== 'ultra';
      ao.configuration.depthAwareUpsampling = true;
      ao.configuration.gammaCorrection = false;
      ao.setQualityMode(g.quality === 'ultra' ? 'Medium' : 'Low');
      composer.addPass(ao);
      this.ao = ao;
    }

    const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.25, 0.4, 0.92);
    composer.addPass(bloom);
    this.bloom = bloom;

    composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    composer.addPass(this.grade);
    this.composer = composer;
    this.setNight(this.night);
  }

  /** 0 day → 1 night: bloom picks up emissive windows and lamps after dusk. */
  setNight(night: number): void {
    this.night = night;
    if (this.bloom) {
      this.bloom.strength = 0.12 + night * 0.55;
      this.bloom.threshold = night > 0.5 ? 0.7 : 0.95;
      this.bloom.radius = 0.45;
    }
    if (this.grade) {
      const u = this.grade.uniforms;
      u.uContrast!.value = 1.05 + night * 0.04;
      u.uSaturation!.value = 1.05 - night * 0.1;
      (u.uLift!.value as THREE.Vector3).set(0, 0.002 * night, 0.006 + night * 0.012);
      (u.uGain!.value as THREE.Vector3).set(1.0, 0.99, 0.965 + night * 0.05);
    }
    if (this.ao) this.ao.configuration.intensity = 2.2 - night * 0.9;
  }

  setSize(w: number, h: number): void {
    this.composer?.setSize(w, h);
    this.ao?.setSize(w, h);
  }

  render(dt: number): boolean {
    if (!this.composer) return false;
    this.composer.render(dt);
    return true;
  }

  private disposeChain(): void {
    if (!this.composer) return;
    for (const pass of this.composer.passes) {
      (pass as { dispose?: () => void }).dispose?.();
    }
    this.composer.renderTarget1.dispose();
    this.composer.renderTarget2.dispose();
    this.composer = null;
    this.renderPass = null;
    this.ao = null;
    this.bloom = null;
    this.grade = null;
  }
}
