import * as THREE from 'three';
import { GraphicsConfig } from '../config/GraphicsConfig';

type Weather = 'clear' | 'haze' | 'rain';

const skyCanvas = document.createElement('canvas');
skyCanvas.width = 4;
skyCanvas.height = 256;
const skyTexture = new THREE.CanvasTexture(skyCanvas);
skyTexture.colorSpace = THREE.SRGBColorSpace;
skyTexture.magFilter = THREE.LinearFilter;
skyTexture.minFilter = THREE.LinearFilter;

const skyMaterial = new THREE.MeshBasicMaterial({
  map: skyTexture,
  side: THREE.BackSide,
  fog: false,
  depthWrite: false,
});

let sky: THREE.Mesh | null = null;
let lastKey = '';
let lastSun = 0.92;
let lastWeather: Weather = 'clear';
let indoor = false;

export function ensureSky(scene: THREE.Scene): THREE.Mesh {
  if (sky && sky.parent === scene) return sky;
  sky = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), skyMaterial);
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

export function applyOutdoorAtmosphere(scene: THREE.Scene, sunFactor: number, weather: Weather): void {
  indoor = false;
  lastSun = sunFactor;
  lastWeather = weather;
  const dome = ensureSky(scene);
  dome.visible = true;
  const horizon = paintSky(sunFactor, weather);
  scene.background = new THREE.Color(horizon);
  scene.environmentIntensity = sunFactor < 0.35 ? 0.22 : sunFactor < 0.7 ? 0.4 : 0.55;
  const fog = scene.fog instanceof THREE.Fog ? scene.fog : new THREE.Fog(horizon, GraphicsConfig.fogNear, GraphicsConfig.fogFar);
  fog.color.setHex(horizon);
  fog.near = GraphicsConfig.fogNear;
  fog.far = GraphicsConfig.fogFar;
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
  scene.fog = new THREE.Fog(0x3d3428, 18, 42);
}

function paintSky(sunFactor: number, weather: Weather): number {
  let zenith = '#7eb4d6';
  let mid = '#c5dde6';
  let horizon = '#d7c4a4';
  let ground = '#b7a07a';
  let horizonHex = 0xd7c4a4;

  if (sunFactor < 0.35) {
    zenith = '#101826';
    mid = '#1a2838';
    horizon = '#243246';
    ground = '#141c16';
    horizonHex = 0x243246;
  } else if (sunFactor < 0.7) {
    zenith = '#8eabcc';
    mid = '#e0a06a';
    horizon = '#e39a62';
    ground = '#a86a42';
    horizonHex = 0xe39a62;
  }

  if (weather === 'rain') {
    zenith = '#6d7c88';
    mid = '#8b98a2';
    horizon = '#9aa6ae';
    ground = '#6e675c';
    horizonHex = 0x9aa6ae;
  } else if (weather === 'haze' && sunFactor >= 0.7) {
    horizon = '#d8d0c2';
    ground = '#c2b49a';
    horizonHex = 0xd8d0c2;
  }

  const key = `${zenith}|${mid}|${horizon}|${ground}`;
  if (key === lastKey) return horizonHex;
  lastKey = key;
  const ctx = skyCanvas.getContext('2d');
  if (!ctx) return horizonHex;
  const g = ctx.createLinearGradient(0, 0, 0, skyCanvas.height);
  g.addColorStop(0, zenith);
  g.addColorStop(0.42, mid);
  g.addColorStop(0.52, horizon);
  g.addColorStop(1, ground);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, skyCanvas.width, skyCanvas.height);
  skyTexture.needsUpdate = true;
  return horizonHex;
}
