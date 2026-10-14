import * as THREE from 'three';
import { LIFE_SPOTS } from '../sim/LifeSpots';
import { mat } from './materials';
import { addTextSign } from '../landmarks/signage';

/** Small kiosk / job markers so life-sim spots are visible in the city. */
export function buildLifeSpotMarkers(root: THREE.Group): void {
  const group = new THREE.Group();
  group.name = 'life-spots';

  for (const s of LIFE_SPOTS) {
    const g = new THREE.Group();
    g.name = `life-${s.id}`;
    g.position.set(s.x, 0, s.z);

    const color =
      s.kind === 'job'
        ? 0x1565c0
        : s.kind === 'phone'
          ? 0xffc107
          : s.kind === 'drink'
            ? 0x0288d1
            : s.kind === 'shop'
              ? 0xef6c00
              : s.kind === 'salon'
                ? 0xad1457
                : 0xc62828;

    const stall = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 2.6), mat(color));
    stall.position.y = 1.2;
    g.add(stall);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.2, 3.2), mat(0x37474f));
    roof.position.y = 2.5;
    g.add(roof);

    const tag =
      s.kind === 'job' ? 'JOB' : s.kind === 'phone' ? 'TEL' : s.kind === 'salon' ? 'SALON' : 'SHOP';
    addTextSign(g, 0, 3.2, 1.4, 4.2, 0.7, tag, {
      subtitle: s.name.slice(0, 18),
      bg: 0x10251f,
      fg: 0xffc857,
    });

    group.add(g);
  }

  root.add(group);
}
