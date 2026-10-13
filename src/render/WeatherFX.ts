import * as THREE from 'three';
import { CityUniforms } from './nightState';

const BOX = 70;
const HEIGHT = 36;

/**
 * Rain streaks in a box that follows the camera, animated entirely on the GPU (one draw call),
 * plus the road wetness that builds up while it rains and dries slowly afterwards.
 */
export class WeatherFX {
  readonly object: THREE.LineSegments;
  private readonly uniforms = {
    uTime: { value: 0 },
    uRain: { value: 0 },
    uCam: { value: new THREE.Vector3() },
    uNight: CityUniforms.uNight,
  };
  /** 0–1 smoothed rain strength. */
  rain = 0;

  constructor(scene: THREE.Scene, drops = 5200) {
    const pos = new Float32Array(drops * 2 * 3);
    const seed = new Float32Array(drops * 2);
    const end = new Float32Array(drops * 2);
    for (let i = 0; i < drops; i++) {
      const x = Math.random() * BOX;
      const y = Math.random() * HEIGHT;
      const z = Math.random() * BOX;
      const r = Math.random();
      for (let k = 0; k < 2; k++) {
        pos.set([x, y, z], (i * 2 + k) * 3);
        seed[i * 2 + k] = r;
        end[i * 2 + k] = k;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uRain; uniform vec3 uCam;
        attribute float aSeed; attribute float aEnd;
        varying float vA;
        void main() {
          float speed = 17.0 + aSeed * 6.0;
          vec3 p = position;
          p.y = mod(p.y - uTime * speed, ${HEIGHT.toFixed(1)});
          // wrap the box around the camera so the rain never ends
          vec3 o = uCam - vec3(${(BOX / 2).toFixed(1)}, ${(HEIGHT * 0.35).toFixed(1)}, ${(BOX / 2).toFixed(1)});
          p.x = o.x + mod(p.x - o.x, ${BOX.toFixed(1)});
          p.z = o.z + mod(p.z - o.z, ${BOX.toFixed(1)});
          p.y += o.y;
          // streak: the second vertex trails along the fall direction (slight wind slant)
          p += aEnd * vec3(0.09, 0.62 + aSeed * 0.3, 0.05);
          vA = step(aSeed, uRain) * (0.18 + 0.22 * aEnd);
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uNight;
        varying float vA;
        void main() {
          if (vA < 0.01) discard;
          vec3 c = mix(vec3(0.78, 0.82, 0.88), vec3(0.42, 0.47, 0.56), uNight);
          gl_FragColor = vec4(c, vA);
        }`,
    });
    this.object = new THREE.LineSegments(geo, mat);
    this.object.name = 'weather-rain';
    this.object.frustumCulled = false;
    this.object.renderOrder = 10;
    this.object.visible = false;
    scene.add(this.object);
  }

  /** `raining` from the game clock; `outdoors` false hides the rain inside buildings. */
  update(dt: number, camera: THREE.Camera, raining: boolean, outdoors: boolean): void {
    const target = raining ? 1 : 0;
    // rain sets in over ~8 s and stops over ~5 s
    this.rain += (target - this.rain) * Math.min(1, dt * (raining ? 0.13 : 0.2));
    if (Math.abs(this.rain - target) < 0.002) this.rain = target;
    // roads soak in ~40 s of rain and dry in ~3 minutes
    const wet = CityUniforms.uWet;
    wet.value = raining ? Math.min(1, wet.value + dt / 40) : Math.max(0, wet.value - dt / 180);

    this.uniforms.uTime.value += dt;
    this.uniforms.uRain.value = this.rain;
    camera.getWorldPosition(this.uniforms.uCam.value);
    this.object.visible = outdoors && this.rain > 0.01;
  }
}
