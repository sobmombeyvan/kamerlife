import * as THREE from 'three';
import type { DecorItem } from './HomeDecor';
import {
  createStarterArt,
  createStarterBed,
  createStarterCoffeeTable,
  createStarterDining,
  createStarterFloorLamp,
  createStarterPlant,
  createStarterRug,
  createStarterSofa,
  createStarterTv,
} from './StarterFurniture';

const cache = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null;

/** Real 3D previews generated from the exact procedural furniture sold in the shop. */
export function decorThumbnail(item: DecorItem): string {
  const hit = cache.get(item.id);
  if (hit) return hit;
  const piece = previewPiece(item);
  if (!piece) return '';

  renderer ??= new THREE.WebGLRenderer({
    alpha: false,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(1);
  renderer.setSize(240, 150, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0xe8e1d5, 1);

  const scene = new THREE.Scene();
  const stage = new THREE.Group();
  stage.add(piece);
  scene.add(stage);
  scene.add(new THREE.HemisphereLight(0xfff8e9, 0x71685f, 2.2));
  const key = new THREE.DirectionalLight(0xffe8c7, 4);
  key.position.set(4, 7, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xb8d8ff, 1.5);
  fill.position.set(-4, 3, 2);
  scene.add(fill);

  piece.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(piece);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  piece.position.sub(center);
  stage.rotation.y = -0.48;

  const maxDim = Math.max(size.x, size.y, size.z, 0.4);
  const camera = new THREE.PerspectiveCamera(34, 240 / 150, 0.01, 100);
  camera.position.set(maxDim * 1.55, maxDim * 1.1, maxDim * 2.15);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);

  const url = renderer.domElement.toDataURL('image/webp', 0.86);
  cache.set(item.id, url);
  piece.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
  return url;
}

function previewPiece(item: DecorItem): THREE.Group | null {
  switch (item.slot) {
    case 'bed':
      return createStarterBed(item.color, item.accent ?? item.color);
    case 'sofa':
      return createStarterSofa(item.color, item.accent ?? item.color);
    case 'table':
      return createStarterCoffeeTable(item.color, item.variant === 'glass');
    case 'rug':
      return createStarterRug(item.color, item.accent ?? 0xe0b070);
    case 'tv':
      return createStarterTv(item.color, item.accent ?? 0x3a6ea5, item.variant === 'big');
    case 'plant':
      return createStarterPlant(item.color, item.variant === 'tall');
    case 'lamp':
      return createStarterFloorLamp(item.color, item.variant === 'design');
    case 'art':
      return createStarterArt(item.color, item.variant === 'yaounde');
    case 'dining':
      return createStarterDining(item.color, item.accent ?? 0x8a9a7b);
    default:
      return null;
  }
}
