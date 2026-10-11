import * as THREE from 'three';
import { mat } from '../world/materials';
import type { CollisionSystem } from '../world/CollisionSystem';
import { addLampPost, addTextSign } from './signage';
import { getLandmark } from './LandmarkSites';

/** Église / cathédrale — landmark religieux respectueux. */
export function buildEgliseCathedraleExterior(collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'landmark-eglise-cathedrale';
  const site = getLandmark('eglise-cathedrale');
  const cx = site.x;
  const cz = site.z;
  root.userData = {
    type: 'landmark',
    landmarkId: 'eglise-cathedrale',
    phase: 1,
  };

  const yard = new THREE.Mesh(new THREE.BoxGeometry(48, 0.06, 42), mat(0x6b8f5e));
  yard.position.set(cx, 0.03, cz);
  yard.receiveShadow = true;
  root.add(yard);

  const path = new THREE.Mesh(new THREE.BoxGeometry(4, 0.07, 16), mat(0xbcaaa4));
  path.position.set(cx, 0.06, cz + 12);
  root.add(path);

  // Nave
  const nave = new THREE.Mesh(new THREE.BoxGeometry(22, 10, 28), mat(0xf5f0e6));
  nave.position.set(cx, 5.1, cz - 2);
  nave.castShadow = true;
  nave.receiveShadow = true;
  root.add(nave);

  // Pitched roof
  const roof = new THREE.Mesh(new THREE.ConeGeometry(16, 6, 4), mat(0x5d4037));
  roof.rotation.y = Math.PI / 4;
  roof.position.set(cx, 13.2, cz - 2);
  root.add(roof);

  // Bell tower
  const tower = new THREE.Mesh(new THREE.BoxGeometry(6, 18, 6), mat(0xefebe9));
  tower.position.set(cx - 10, 9.1, cz + 8);
  tower.castShadow = true;
  root.add(tower);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(3.2, 7, 4), mat(0x8d6e63));
  spire.rotation.y = Math.PI / 4;
  spire.position.set(cx - 10, 21.5, cz + 8);
  root.add(spire);
  // Cross
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.8, 0.35), mat(0xffc857));
  crossV.position.set(cx - 10, 25.8, cz + 8);
  root.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.35), mat(0xffc857));
  crossH.position.set(cx - 10, 25.2, cz + 8);
  root.add(crossH);

  // Rose window
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.2, 16), mat(0x5c6bc0, 0.55));
  rose.rotation.x = Math.PI / 2;
  rose.position.set(cx, 7.5, cz + 12.1);
  root.add(rose);

  // Door
  const door = new THREE.Mesh(new THREE.BoxGeometry(3.2, 5.2, 0.25), mat(0x4e342e));
  door.position.set(cx, 2.7, cz + 12.05);
  root.add(door);

  // Side arched windows
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.2, 1.6), mat(0x7986cb, 0.45));
      win.position.set(cx + side * 11.1, 5.5, cz - 10 + i * 5.5);
      root.add(win);
    }
  }

  addTextSign(root, cx + 2, 11.2, cz + 12.3, 16, 1.4, 'Cathédrale', {
    subtitle: 'Paroisse de Yaoundé',
    bg: 0x3e2723,
    fg: 0xffecb3,
  });

  // Garden palms / benches
  for (const [bx, bz] of [
    [cx - 16, cz + 14],
    [cx + 16, cz + 14],
    [cx + 14, cz - 14],
  ] as const) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 0.7), mat(0x6d4c41));
    bench.position.set(bx, 0.35, bz);
    root.add(bench);
  }

  addLampPost(root, cx - 14, cz + 16);
  addLampPost(root, cx + 14, cz + 16);

  collisions.addBox(cx, 5.1, cz - 2, 12, 5.5, 15);
  collisions.addBox(cx - 10, 9.1, cz + 8, 3.5, 9.5, 3.5);

  return root;
}
