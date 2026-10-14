import * as THREE from 'three';
import { accessoryColor } from '../PlayerLook';
import { ACCESSORIES, BUILT_HAIR, accessoryById, type BuiltHairId } from './catalog';
import { buildAccessory, disposeObject } from './accessories';
import { buildHair } from './builtHair';
import type { RigFit } from './fit';

/** Harper's idle measurements, used to stage thumbnails off the live rig. */
const STAGE: RigFit = {
  rest: {},
  skull: { cx: 0, cy: 1.555, cz: 0.061, rx: 0.09, ry: 0.101, rz: 0.092 },
  eyeY: 1.55,
  eyeFrontZ: 0.147,
  neckY: 1.402,
  neckZ: 0.021,
  chestY: 1.18,
  chestFrontZ: 0.12,
  chestBackZ: -0.1,
  shoulderX: 0.19,
  hipY: 0.9,
  hipFrontZ: 0.12,
  hipX: 0.17,
  shoulderTopY: 1.36,
  hand: new THREE.Vector3(-0.29, 0.873, 0.103),
  wrist: new THREE.Vector3(0.284, 0.904, 0.098),
  wristR: 0.028,
  forearm: new THREE.Vector3(0.21, -0.97, 0.15).normalize(),
};

const urls = new Map<string, string>();

function stageHead(): THREE.Group {
  const g = new THREE.Group();
  const s = STAGE.skull;
  const skin = new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.7 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), skin);
  head.position.set(0, s.cy - 0.01, s.cz + 0.006);
  head.scale.set(s.rx * 0.97, s.ry * 1.18, s.rz * 0.98);
  g.add(head);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.14, 20), skin);
  neck.position.set(0, STAGE.neckY + 0.02, STAGE.neckZ);
  g.add(neck);
  return g;
}

function snap(renderer: THREE.WebGLRenderer, subject: THREE.Object3D, withHead: boolean): string {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a2c26);
  const hemi = new THREE.HemisphereLight(0xfff4e5, 0x3d4a44, 1.35);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff0d8, 2.4);
  key.position.set(0.7, 1.1, 1.4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x88c5b0, 1.1);
  rim.position.set(-1.2, 0.4, -0.8);
  scene.add(rim);
  const floorY = withHead ? 1.28 : -0.02;
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 32),
    new THREE.MeshStandardMaterial({ color: 0x243830, roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  scene.add(floor);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.48, 48),
    new THREE.MeshBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.38, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = floorY + 0.004;
  scene.add(ring);
  const head = withHead ? stageHead() : null;
  if (head) scene.add(head);
  scene.add(subject);
  const box = new THREE.Box3().setFromObject(subject);
  if (head) box.expandByObject(head);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 12);
  const dir = new THREE.Vector3(0.48, 0.32, 1).normalize();
  camera.position.copy(center).addScaledVector(dir, size * 1.85);
  camera.lookAt(center);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  if (head) disposeObject(head);
  return url;
}

/** Renders every catalog thumbnail once, then frees the WebGL context. */
export function ensureThumbnails(): void {
  if (urls.size > 0) return;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return;
  }
  renderer.setSize(256, 256, false);
  renderer.setClearColor(0x1a2c26, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  for (const item of ACCESSORIES) {
    const obj = buildAccessory(item.id, STAGE, accessoryColor(item.id, 'origine'), 0.014);
    if (!obj) continue;
    const head = item.slot === 'hat' || item.slot === 'glasses' || item.slot === 'ears';
    urls.set(`acc-${item.id}`, snap(renderer, obj, head));
    disposeObject(obj);
  }
  for (const hair of BUILT_HAIR) {
    const obj = buildHair(hair.id, STAGE, 0x1c140f);
    urls.set(`hair-${hair.id}`, snap(renderer, obj, true));
    disposeObject(obj);
  }
  renderer.dispose();
  renderer.forceContextLoss();
}

export function accessoryThumb(id: string): string | null {
  return accessoryById(id) ? urls.get(`acc-${id}`) ?? null : null;
}

export function hairThumb(id: BuiltHairId): string | null {
  return urls.get(`hair-${id}`) ?? null;
}
