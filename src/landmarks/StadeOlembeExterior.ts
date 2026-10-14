import * as THREE from 'three';
import type { CollisionSystem } from '../world/CollisionSystem';
import { addLampPost, addTextSign } from './signage';
import { createNpcAvatar } from '../pedestrians/NpcAvatar';
import { kitBox } from './interiorKit';
import { VENUES } from '../sim/VenueSpots';

/** Stade Olembé — pelouse marchable, tribunes, buvettes. */
export function buildStadeOlembe(collisions: CollisionSystem): THREE.Group {
  const v = VENUES.find((x) => x.id === 'olembe')!;
  const root = new THREE.Group();
  root.name = v.rootName;
  root.userData = { type: 'landmark', landmarkId: 'stade-olembe' };
  const { cx, cz } = v;

  kitBox(root, cx, 0.03, cz, 140, 0.06, 118, 0x3d4246);
  kitBox(root, cx, 0.05, cz, 78, 0.05, 118, 0x2e7d32);
  kitBox(root, cx, 0.07, cz, 68, 0.04, 105, 0x43a047);
  kitBox(root, cx, 0.09, cz, 0.18, 0.03, 105, 0xfafafa);
  kitBox(root, cx, 0.09, cz, 68, 0.03, 0.18, 0xfafafa);
  for (const z of [-26, 26]) kitBox(root, cx, 0.09, cz + z, 68, 0.03, 0.12, 0xfafafa);
  for (const side of [-1, 1] as const) {
    kitBox(root, cx, 1.15, cz + side * 52, 7.4, 2.2, 0.18, 0xfafafa, true, collisions);
    kitBox(root, cx - 3.6, 1.15, cz + side * 50.2, 0.18, 2.2, 3.4, 0xfafafa, true, collisions);
    kitBox(root, cx + 3.6, 1.15, cz + side * 50.2, 0.18, 2.2, 3.4, 0xfafafa, true, collisions);
  }

  for (let i = 0; i < 6; i++) {
    const y = 1.1 + i * 0.85;
    const inset = 36 + i * 1.15;
    kitBox(root, cx, y, cz - 58 - i * 0.2, 92, 0.7, 8.2, 0xb0bec5, true, collisions, 'walk');
    kitBox(root, cx, y, cz + 58 + i * 0.2, 92, 0.7, 8.2, 0xb0bec5, true, collisions, 'walk');
    kitBox(root, cx - inset, y, cz, 9, 0.7, 96, 0xb0bec5, true, collisions, 'walk');
    kitBox(root, cx + inset, y, cz, 9, 0.7, 96, 0xb0bec5, true, collisions, 'walk');
  }

  addTextSign(root, cx, 14.5, cz - 72, 28, 2.4, 'STADE OLEMBÉ', {
    subtitle: 'Paul Biya · Yaoundé',
    bg: 0x1b5e20,
    fg: 0xffc857,
  });

  for (const [lx, lz] of [
    [cx - 48, cz - 58],
    [cx + 48, cz - 58],
    [cx - 48, cz + 58],
    [cx + 48, cz + 58],
  ] as const) {
    kitBox(root, lx, 9, lz, 0.55, 18, 0.55, 0x90a4ae, true, collisions);
    kitBox(root, lx, 18.4, lz, 4.2, 0.35, 1.2, 0xfffde7);
  }

  kitBox(root, cx - 22, 0.55, cz + 28, 8, 1.05, 3.2, 0x37474f, true, collisions);
  addTextSign(root, cx - 22, 2.4, cz + 26.2, 6, 0.7, 'BUVETTE', { bg: 0xbf360c, fg: 0xffffff });
  const vendor = createNpcAvatar(850, 'vendor');
  vendor.position.set(cx - 22, 0, cz + 26.4);
  vendor.rotation.y = Math.PI;
  root.add(vendor);

  addLampPost(root, cx - 20, cz - 74);
  addLampPost(root, cx + 20, cz - 74);
  return root;
}
