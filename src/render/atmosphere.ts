import * as THREE from 'three';
import { GraphicsConfig } from '../config/GraphicsConfig';

export type Weather = 'clear' | 'haze' | 'rain';

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunColor;
uniform float uNight;
uniform float uCloud;
uniform float uTime;
varying vec3 vDir;

float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { s += noise(p) * a; p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float up = clamp(h, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(up, 0.5));
  col = mix(col, uGround, smoothstep(0.0, -0.08, h));

  float sd = max(dot(d, uSunDir), 0.0);
  float sunUp = smoothstep(-0.1, 0.05, uSunDir.y);
  col += uSunColor * (pow(sd, 6.0) * 0.28 + pow(sd, 40.0) * 0.35) * sunUp * (1.0 - uNight);
  col += uSunColor * smoothstep(0.9993, 0.9997, sd) * 12.0 * sunUp;

  float cloudMask = 0.0;
  if (h > 0.0) {
    vec2 p = d.xz / (h + 0.18) * 1.4 + vec2(uTime * 0.006, uTime * 0.002);
    float c = fbm(p * 1.2);
    cloudMask = smoothstep(0.62 - uCloud * 0.38, 0.98 - uCloud * 0.2, c) * smoothstep(0.0, 0.16, h);
    vec3 lit = mix(vec3(1.0), uSunColor, 0.25) * (0.9 - uCloud * 0.45);
    vec3 cc = mix(lit, uHorizon * 0.9, 0.35);
    cc += uSunColor * pow(sd, 5.0) * 0.5 * sunUp;
    cc = mix(cc, vec3(0.05, 0.07, 0.11), uNight * 0.92);
    col = mix(col, cc, cloudMask * 0.9);
  }
  if (uNight > 0.01 && h > 0.0) {
    vec3 cell = floor(d * 380.0);
    float r = hash3(cell);
    float tw = 0.65 + 0.35 * sin(uTime * 2.0 + r * 60.0);
    col += vec3(0.9, 0.95, 1.0) * step(0.9982, r) * tw * uNight * smoothstep(0.04, 0.35, h) * (1.0 - cloudMask);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const skyMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2).normalize() },
    uZenith: { value: new THREE.Color(0x3d7cc2) },
    uHorizon: { value: new THREE.Color(0xcfe0ea) },
    uGround: { value: new THREE.Color(0x8f8676) },
    uSunColor: { value: new THREE.Color(0xfff1d6) },
    uNight: { value: 0 },
    uCloud: { value: 0.3 },
    uTime: { value: 0 },
  },
  vertexShader: SKY_VERT,
  fragmentShader: SKY_FRAG,
  side: THREE.BackSide,
  depthWrite: false,
  depthTest: true,
  fog: false,
});

let sky: THREE.Mesh | null = null;
let lastSun = 0.92;
let lastWeather: Weather = 'clear';
let indoor = false;
let studio = false;
const sunDir = new THREE.Vector3(0.3, 0.8, 0.2).normalize();
const fogColor = new THREE.Color();

/** Keeps the day/night sky from replacing the character-studio backdrop. */
export function setStudioAtmosphere(active: boolean): void {
  studio = active;
}

export function setSkySunDirection(dir: THREE.Vector3): void {
  sunDir.copy(dir).normalize();
  skyMaterial.uniforms.uSunDir!.value.copy(sunDir);
}

export function tickSky(dt: number): void {
  skyMaterial.uniforms.uTime!.value += dt;
}

export function ensureSky(scene: THREE.Scene): THREE.Mesh {
  if (sky && sky.parent === scene) return sky;
  sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), skyMaterial);
  sky.name = 'sky-dome';
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  sky.scale.setScalar(400);
  scene.add(sky);
  return sky;
}

export function followSky(x: number, z: number): void {
  if (!sky || indoor) return;
  sky.position.set(x, 0, z);
}

export function fitSkyToCamera(cameraFar: number): void {
  if (!sky) return;
  sky.scale.setScalar(Math.max(90, cameraFar * 0.86));
}

export type SkyLook = {
  zenith: THREE.Color;
  horizon: THREE.Color;
  ground: THREE.Color;
  sun: THREE.Color;
  night: number;
  cloud: number;
};

const C = (hex: number) => new THREE.Color(hex);
const DAY = { zenith: C(0x3a78c0), horizon: C(0xc9dbe4), ground: C(0x8c8474), sun: C(0xfff0d8) };
const GOLD = { zenith: C(0x4e6fa6), horizon: C(0xf0a463), ground: C(0x7a5a44), sun: C(0xffa25a) };
const NIGHT = { zenith: C(0x03070f), horizon: C(0x16202e), ground: C(0x080b10), sun: C(0x6d86b5) };
const RAIN = { zenith: C(0x5f6d79), horizon: C(0x939ea6), ground: C(0x5c574f), sun: C(0xc8cdd2) };

/** Sky palette from sun elevation (sin) and weather. */
export function skyLookFor(sinElev: number, weather: Weather): SkyLook {
  const day = THREE.MathUtils.smoothstep(sinElev, -0.1, 0.32);
  const gold = (1 - THREE.MathUtils.smoothstep(sinElev, 0.04, 0.38)) * THREE.MathUtils.smoothstep(sinElev, -0.16, 0.0);
  const out: SkyLook = {
    zenith: NIGHT.zenith.clone().lerp(DAY.zenith, day),
    horizon: NIGHT.horizon.clone().lerp(DAY.horizon, day),
    ground: NIGHT.ground.clone().lerp(DAY.ground, day),
    sun: NIGHT.sun.clone().lerp(DAY.sun, day),
    night: 1 - day,
    cloud: weather === 'rain' ? 0.95 : weather === 'haze' ? 0.55 : 0.28,
  };
  out.zenith.lerp(GOLD.zenith, gold * 0.6);
  out.horizon.lerp(GOLD.horizon, gold * 0.85);
  out.ground.lerp(GOLD.ground, gold * 0.5);
  out.sun.lerp(GOLD.sun, gold);
  if (weather === 'rain') {
    out.zenith.lerp(RAIN.zenith, day * 0.85);
    out.horizon.lerp(RAIN.horizon, day * 0.85);
    out.ground.lerp(RAIN.ground, day * 0.6);
    out.sun.lerp(RAIN.sun, 0.6);
  } else if (weather === 'haze') {
    out.horizon.lerp(C(0xd9d2c4), day * 0.6);
    out.zenith.lerp(C(0x7ea2c4), day * 0.4);
  }
  return out;
}

export function applyOutdoorAtmosphere(scene: THREE.Scene, sunFactor: number, weather: Weather): void {
  if (studio) return;
  indoor = false;
  lastSun = sunFactor;
  lastWeather = weather;
  const dome = ensureSky(scene);
  dome.visible = true;
  const look = skyLookFor(sunDir.y, weather);
  const u = skyMaterial.uniforms;
  u.uZenith!.value.copy(look.zenith);
  u.uHorizon!.value.copy(look.horizon);
  u.uGround!.value.copy(look.ground);
  u.uSunColor!.value.copy(look.sun);
  u.uNight!.value = look.night;
  u.uCloud!.value = look.cloud;

  fogColor.copy(look.horizon).lerp(look.zenith, 0.12);
  scene.background = fogColor.clone();
  scene.environmentIntensity = GraphicsConfig.reflections ? 0.35 + (1 - look.night) * 0.55 : 0;
  const fog = scene.fog instanceof THREE.Fog ? scene.fog : new THREE.Fog(fogColor, GraphicsConfig.fogNear, GraphicsConfig.fogFar);
  fog.color.copy(fogColor);
  const rainy = weather === 'rain' ? 0.6 : weather === 'haze' ? 0.8 : 1;
  fog.near = GraphicsConfig.fogNear * rainy;
  fog.far = GraphicsConfig.fogFar * rainy;
  scene.fog = fog;
}

export function restoreOutdoorAtmosphere(scene: THREE.Scene): void {
  applyOutdoorAtmosphere(scene, lastSun, lastWeather);
}

export function applyIndoorAtmosphere(scene: THREE.Scene): void {
  indoor = true;
  if (sky) sky.visible = false;
  scene.background = new THREE.Color(0x3d3428);
  scene.environmentIntensity = 0.4;
  scene.fog = new THREE.Fog(0x3d3428, 40, 90);
}

export function isIndoorAtmosphere(): boolean {
  return indoor;
}
