import * as THREE from 'three';
import { mat } from '../world/materials';
import type { CollisionSystem } from '../world/CollisionSystem';
import { createBuilding } from '../buildings/BuildingFactory';
import { addLampPost, addTextSign } from './signage';
import { createPalmTree } from '../vegetation/TreeFactory';
import { overlapsRoad } from '../world/RoadClearance';

/**
 * District hero landmarks — game placements, exteriors only.
 * Nsimalen airport is built separately.
 */

export function buildUniversiteNgoaEkelle(collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'landmark-universite-ngoa';
  const cx = -160;
  const cz = -400;
  root.userData = { landmarkId: 'universite-ngoa-ekelle', districtId: 'ngoa-ekelle' };

  const campus = new THREE.Mesh(new THREE.BoxGeometry(70, 0.08, 55), mat(0x6b8f5e));
  campus.position.set(cx, 0.04, cz);
  root.add(campus);

  // Main amphitheatre / admin
  root.add(
    createBuilding(
      {
        id: 'uy1-admin',
        name: 'Université de Yaoundé I',
        x: cx,
        z: cz - 6,
        width: 32,
        depth: 18,
        height: 12,
        color: 0xeceff1,
        kind: 'landmark',
        districtId: 'ngoa-ekelle',
        collide: true,
      },
      collisions,
    ),
  );

  // Faculty blocks
  for (const [dx, dz, name] of [
    [-22, 10, 'Faculté A'],
    [22, 10, 'Faculté B'],
    [-22, -18, 'Bibliothèque'],
    [22, -18, 'Amphi 200'],
  ] as const) {
    root.add(
      createBuilding(
        {
          id: `uy1-${dx}-${dz}`,
          name,
          x: cx + dx,
          z: cz + dz,
          width: 16,
          depth: 12,
          height: 7 + Math.abs(dx) * 0.05,
          color: 0xc8e6c9,
          kind: 'landmark',
          districtId: 'ngoa-ekelle',
          collide: true,
        },
        collisions,
      ),
    );
  }

  addTextSign(root, cx, 13.2, cz + 4, 28, 2.2, 'Université Yaoundé I', {
    subtitle: 'Ngoa-Ekellé',
    bg: 0xb71c1c,
    fg: 0xffffff,
  });
  root.add(createPalmTree(cx - 12, cz + 18, 0.9, undefined));
  root.add(createPalmTree(cx + 14, cz + 16, 0.85, undefined));

  const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 12), mat(0xe53935, 0.65));
  marker.position.set(cx, 0.1, cz + 20);
  marker.userData = { landmarkId: 'universite-ngoa-ekelle' };
  root.add(marker);
  return root;
}

export function buildMarcheMokolo(collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'landmark-marche-mokolo';
  const cx = -420;
  const cz = -150;
  root.userData = { landmarkId: 'marche-mokolo', districtId: 'mokolo' };

  const ground = new THREE.Mesh(new THREE.BoxGeometry(72, 0.08, 56), mat(0x8d6e63));
  ground.position.set(cx, 0.04, cz);
  root.add(ground);

  // Covered market halls
  for (let row = 0; row < 3; row++) {
    const hall = new THREE.Mesh(new THREE.BoxGeometry(56, 4.5, 10), mat(0xd7a44d));
    hall.position.set(cx, 2.25, cz - 16 + row * 14);
    hall.castShadow = true;
    root.add(hall);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(58, 0.35, 12), mat(0xc34d38));
    roof.position.set(cx, 4.8, cz - 16 + row * 14);
    root.add(roof);
  }

  // Dense stalls
  const colors = [0xc34d38, 0xe4bb4e, 0x42876c, 0x477d9d, 0xff8a65, 0x8e24aa];
  let n = 0;
  for (let i = 0; i < 28; i++) {
    const sx = cx - 28 + (i % 7) * 9;
    const sz = cz - 22 + Math.floor(i / 7) * 12;
    if (overlapsRoad(sx, sz, 2, 2)) continue;
    root.add(
      createBuilding(
        {
          id: `mokolo-stall-${n++}`,
          name: 'Étal Mokolo',
          x: sx,
          z: sz,
          width: 5.5,
          depth: 4.5,
          height: 2.8,
          color: colors[i % colors.length]!,
          kind: 'market',
          districtId: 'mokolo',
          collide: true,
        },
        collisions,
      ),
    );
  }

  addTextSign(root, cx, 7.6, cz + 24, 24, 2.0, 'Marché Mokolo', {
    subtitle: 'Textiles · Vivres',
    bg: 0x00897b,
    fg: 0xffc857,
    yaw: Math.PI,
  });
  return root;
}

export function buildHabitationsEssos(collisions: CollisionSystem): THREE.Group {
  return buildHousingEstate('essos', 460, -80, collisions, {
    title: 'Cité Essos',
    flats: 10,
    houses: 8,
    colorFlat: 0xa9b8b2,
    colorHouse: 0xe1c7a0,
  });
}

export function buildHabitationsMendong(collisions: CollisionSystem): THREE.Group {
  return buildHousingEstate('mendong', -520, 480, collisions, {
    title: 'Lotissement Mendong',
    flats: 6,
    houses: 14,
    colorFlat: 0xc4a882,
    colorHouse: 0xf0e0c8,
  });
}

export function buildPalaisOdza(collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'landmark-palais-odza';
  const cx = 620;
  const cz = 460;
  root.userData = { landmarkId: 'palais-odza', districtId: 'odza' };

  const lawn = new THREE.Mesh(new THREE.BoxGeometry(80, 0.08, 60), mat(0x5a8a4e));
  lawn.position.set(cx, 0.04, cz);
  root.add(lawn);

  // Several luxury "palais" / villas
  const palaces: Array<[number, number, number, number]> = [
    [0, -8, 22, 11],
    [-28, 8, 16, 8],
    [28, 10, 16, 8],
    [-18, 22, 14, 7],
    [20, -22, 15, 7.5],
    [0, 20, 18, 9],
  ];
  palaces.forEach(([dx, dz, w, h], i) => {
    root.add(
      createBuilding(
        {
          id: `odza-palais-${i}`,
          name: `Palais Odza ${i + 1}`,
          x: cx + dx,
          z: cz + dz,
          width: w,
          depth: w * 0.75,
          height: h,
          color: [0xf5f5f5, 0xffecb3, 0xe8eaf6, 0xdce775, 0xb39ddb, 0x80cbc4][i]!,
          kind: 'villa',
          districtId: 'odza',
          yaw: (i % 2) * 0.2,
          collide: true,
        },
        collisions,
      ),
    );
    root.add(createPalmTree(cx + dx + 8, cz + dz + 6, 0.8 + i * 0.03, undefined));
  });

  addTextSign(root, cx, 5.8, cz + 28, 20, 1.8, 'Palais Odza', {
    subtitle: 'Résidences',
    bg: 0x8e24aa,
    fg: 0xffc857,
    yaw: Math.PI,
  });
  return root;
}

export function buildBiyemAssiCiteEcole(collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'landmark-biyem-assi-cite';
  const cx = -380;
  const cz = 620;
  root.userData = { landmarkId: 'biyem-assi-cite-ecole', districtId: 'biyem-assi' };

  const pad = new THREE.Mesh(new THREE.BoxGeometry(75, 0.08, 58), mat(0x7a7164));
  pad.position.set(cx, 0.04, cz);
  root.add(pad);

  // Large apartment blocks
  for (let i = 0; i < 8; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    root.add(
      createBuilding(
        {
          id: `by-flat-${i}`,
          name: `Immeuble Biyem-Assi ${i + 1}`,
          x: cx - 24 + col * 16,
          z: cz - 16 + row * 18,
          width: 13,
          depth: 11,
          height: 12 + (i % 3) * 3,
          color: [0xd9b18b, 0xc98558, 0xa9b8b2, 0xb96e50][i % 4]!,
          kind: 'flat',
          districtId: 'biyem-assi',
          collide: true,
        },
        collisions,
      ),
    );
  }

  // School complex
  root.add(
    createBuilding(
      {
        id: 'by-ecole-main',
        name: 'École Biyem-Assi',
        x: cx + 8,
        z: cz + 18,
        width: 28,
        depth: 14,
        height: 6.5,
        color: 0xfff8e1,
        kind: 'landmark',
        districtId: 'biyem-assi',
        collide: true,
      },
      collisions,
    ),
  );
  root.add(
    createBuilding(
      {
        id: 'by-ecole-annexe',
        name: 'Annexe scolaire',
        x: cx - 18,
        z: cz + 20,
        width: 16,
        depth: 10,
        height: 5,
        color: 0xe3f2fd,
        kind: 'landmark',
        districtId: 'biyem-assi',
        collide: true,
      },
      collisions,
    ),
  );

  // School yard
  const yard = new THREE.Mesh(new THREE.BoxGeometry(20, 0.06, 12), mat(0xb0bec5));
  yard.position.set(cx + 8, 0.08, cz + 30);
  root.add(yard);

  addTextSign(root, cx + 8, 7.8, cz + 26, 18, 1.5, 'École Biyem-Assi', {
    bg: 0x1565c0,
    fg: 0xffffff,
    yaw: Math.PI,
  });
  addTextSign(root, cx, 9.8, cz - 26, 22, 1.7, 'Cité Biyem-Assi', {
    bg: 0xfb8c00,
    fg: 0xffffff,
  });
  for (let i = -2; i <= 2; i++) addLampPost(root, cx + i * 12, cz + 32);
  return root;
}

function buildHousingEstate(
  districtId: string,
  cx: number,
  cz: number,
  collisions: CollisionSystem,
  opts: { title: string; flats: number; houses: number; colorFlat: number; colorHouse: number },
): THREE.Group {
  const root = new THREE.Group();
  root.name = `landmark-habitations-${districtId}`;
  root.userData = { landmarkId: `habitations-${districtId}`, districtId };

  const ground = new THREE.Mesh(new THREE.BoxGeometry(70, 0.08, 55), mat(0x7a7164));
  ground.position.set(cx, 0.04, cz);
  root.add(ground);

  for (let i = 0; i < opts.flats; i++) {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const x = cx - 24 + col * 12;
    const z = cz - 18 + row * 14;
    if (overlapsRoad(x, z, 5, 5)) continue;
    root.add(
      createBuilding(
        {
          id: `${districtId}-flat-${i}`,
          name: `Immeuble ${opts.title}`,
          x,
          z,
          width: 10,
          depth: 9,
          height: 9 + (i % 4) * 2,
          color: opts.colorFlat,
          kind: 'flat',
          districtId,
          collide: true,
        },
        collisions,
      ),
    );
  }

  for (let i = 0; i < opts.houses; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = cx - 20 + col * 14;
    const z = cz + 8 + row * 12;
    if (overlapsRoad(x, z, 4, 4)) continue;
    root.add(
      createBuilding(
        {
          id: `${districtId}-house-${i}`,
          name: `Maison ${opts.title}`,
          x,
          z,
          width: 8,
          depth: 7,
          height: 4 + (i % 3),
          color: opts.colorHouse,
          kind: 'house',
          districtId,
          collide: true,
        },
        collisions,
      ),
    );
  }

  addTextSign(root, cx, 5.8, cz + 26, 16, 1.5, opts.title, {
    bg: 0x37474f,
    fg: 0xffffff,
    yaw: Math.PI,
  });
  return root;
}

/** Register all district hero landmarks. */
export function buildDistrictAnchors(root: THREE.Group, collisions: CollisionSystem): void {
  root.add(buildUniversiteNgoaEkelle(collisions));
  root.add(buildMarcheMokolo(collisions));
  root.add(buildHabitationsEssos(collisions));
  root.add(buildHabitationsMendong(collisions));
  root.add(buildPalaisOdza(collisions));
  root.add(buildBiyemAssiCiteEcole(collisions));
}

// Hubs for remaining quartiers are built via buildAllDistrictHubs in buildMajorLandmarks.
