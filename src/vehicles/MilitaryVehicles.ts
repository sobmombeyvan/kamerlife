import * as THREE from 'three';
import { mat } from '../world/materials';

const olive = mat(0x4a5c32, 0.78, 0.08);
const oliveDark = mat(0x2f3d22, 0.8, 0.06);
const iron = mat(0x2a2a28, 0.45, 0.35);
const rubber = mat(0x1a1c1e, 0.92, 0.04);
const glass = new THREE.MeshStandardMaterial({
  color: 0x1a2830,
  roughness: 0.12,
  metalness: 0.35,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
});

function box(
  g: THREE.Group,
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

/** Main battle tank — display only. Faces local +Z. */
export function createTank(seed = 0): THREE.Group {
  const g = new THREE.Group();
  g.name = `tank-${seed}`;
  box(g, 3.4, 1.15, 7.2, olive, 0, 1.05, 0);
  box(g, 3.55, 0.22, 7.4, oliveDark, 0, 0.48, 0);
  box(g, 2.4, 0.95, 3.1, olive, 0, 1.85, -0.35);
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.7, 12), olive);
  turret.position.set(0, 2.45, -0.2);
  turret.castShadow = true;
  g.add(turret);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 4.4, 8), iron);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 2.5, 2.35);
  g.add(barrel);
  box(g, 0.55, 0.35, 0.7, iron, 0, 2.85, -0.15);
  for (const side of [-1, 1] as const) {
    box(g, 0.55, 0.85, 7.0, rubber, side * 1.7, 0.55, 0);
    for (let i = -2; i <= 2; i++) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.38, 10), iron);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 1.7, 0.42, i * 1.35);
      g.add(wheel);
    }
  }
  g.userData.driveable = false;
  g.userData.label = 'Char de combat';
  return g;
}

/** Utility truck in kaki. */
export function createArmyTruck(seed = 0): THREE.Group {
  const g = new THREE.Group();
  g.name = `army-truck-${seed}`;
  box(g, 2.35, 1.15, 7.4, olive, 0, 1.15, 0);
  box(g, 2.2, 1.35, 2.4, oliveDark, 0, 2.15, 2.2);
  box(g, 2.05, 0.7, 1.1, glass, 0, 2.35, 3.15);
  box(g, 2.2, 1.55, 4.4, olive, 0, 2.05, -1.15);
  for (const z of [-2.2, 2.15] as const) {
    for (const x of [-1.05, 1.05] as const) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.38, 10), rubber);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.48, z);
      g.add(wheel);
    }
  }
  g.userData.driveable = false;
  g.userData.label = 'Camion militaire';
  return g;
}

/** Light helicopter on a pad. Main + tail rotors in userData.rotors. */
export function createHelicopter(seed = 0): THREE.Group {
  const g = new THREE.Group();
  g.name = `heli-${seed}`;
  box(g, 1.7, 1.35, 6.4, olive, 0, 1.55, 0.2);
  box(g, 1.55, 0.7, 1.6, glass, 0, 1.85, 2.55);
  box(g, 0.35, 0.35, 5.2, oliveDark, 0, 1.85, -5.2);
  box(g, 0.18, 1.15, 0.18, oliveDark, 0, 2.45, -7.6);
  const skid = (x: number) => {
    box(g, 0.12, 0.12, 5.2, iron, x, 0.42, 0.3);
    box(g, 0.08, 0.7, 0.08, iron, x, 0.75, 1.4);
    box(g, 0.08, 0.7, 0.08, iron, x, 0.75, -0.9);
  };
  skid(-0.85);
  skid(0.85);

  const main = new THREE.Group();
  main.name = 'rotor-main';
  main.position.set(0, 2.55, 0.1);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 8), iron);
  main.add(hub);
  for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 6.4), oliveDark);
    blade.rotation.y = a;
    main.add(blade);
  }
  g.add(main);

  const tail = new THREE.Group();
  tail.name = 'rotor-tail';
  tail.position.set(0.22, 2.55, -7.55);
  const tHub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 8), iron);
  tHub.rotation.z = Math.PI / 2;
  tail.add(tHub);
  for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.04, 0.12), oliveDark);
    blade.rotation.z = a;
    tail.add(blade);
  }
  g.add(tail);

  g.userData.driveable = false;
  g.userData.label = 'Hélicoptère';
  g.userData.rotors = [main, tail];
  return g;
}
