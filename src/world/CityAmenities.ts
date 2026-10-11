import * as THREE from 'three';
import { createBuilding } from '../buildings/BuildingFactory';
import { createPalmTree } from '../vegetation/TreeFactory';
import { mat } from './materials';
import { overlapsRoad } from './RoadClearance';
import type { CollisionSystem } from './CollisionSystem';
import type { DistrictDef } from '../data/districts';
import type { PoiDef } from '../data/pois';
import { profileFor } from '../data/districtProfiles';
import { SPECIAL_POI_IDS } from '../landmarks/buildMajorLandmarks';
import { SIDEWALK_FROM_CENTER_HIGHWAY } from '../roads/CityRoadPlan';
import { createBrandVehicle, pickParkedBrand } from '../vehicles/VehicleFactory';

/** Taxis, marchés, stations, mobilier — placés hors chaussée. */
export function addCityAmenities(
  root: THREE.Group,
  districts: DistrictDef[],
  pois: PoiDef[],
  collisions: CollisionSystem,
): number {
  let count = 0;

  for (const poi of pois) {
    if (SPECIAL_POI_IDS.has(poi.id)) continue;
    count += placePoiCluster(root, poi, collisions);
  }

  for (const d of districts) {
    if (d.id === 'centre-ville') continue;
    count += placeDistrictExtras(root, d, collisions);
  }

  // Extra sidewalk pads beside main highway (visual continuity)
  const walk = SIDEWALK_FROM_CENTER_HIGHWAY;
  for (let z = -220; z <= 220; z += 10) {
    if (Math.abs(z) < 40) continue;
    for (const side of [-1, 1] as const) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 8), mat(0xc4bdb0));
      slab.position.set(side * walk, 0.05, z);
      slab.receiveShadow = true;
      root.add(slab);
    }
  }

  return count;
}

function placePoiCluster(root: THREE.Group, poi: PoiDef, collisions: CollisionSystem): number {
  let n = 0;
  const baseX = poi.position.x;
  const baseZ = poi.position.z;

  const spot = findOffRoadSpot(baseX, baseZ, 16, 12);
  if (spot) {
    const kind =
      poi.category === 'mall' || poi.category === 'shop'
        ? 'shop'
        : poi.category === 'market'
          ? 'market'
          : poi.category === 'education'
            ? 'landmark'
            : poi.category === 'government'
              ? 'landmark'
              : poi.category === 'health'
                ? 'clinic'
                : 'flat';

    root.add(
      createBuilding(
        {
          id: `poi-build-${poi.id}`,
          name: poi.name,
          x: spot.x,
          z: spot.z,
          width: poi.category === 'mall' ? 28 : poi.category === 'market' ? 14 : 16,
          depth: poi.category === 'mall' ? 20 : 12,
          height: poi.category === 'government' ? 14 : poi.category === 'mall' ? 10 : 7,
          color: poi.category === 'market' ? 0xd7a44d : 0xc9b29a,
          kind,
          districtId: poi.districtId,
          collide: true,
        },
        collisions,
      ),
    );
    n += 1;

    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.5, 0.2), mat(0x333333));
    post.position.set(spot.x, 1.75, spot.z + 8);
    root.add(post);
    const board = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 0.12), mat(0xffc857));
    board.position.set(spot.x, 3.4, spot.z + 8);
    root.add(board);
  }

  if (poi.category === 'market') {
    for (let i = 0; i < 8; i++) {
      const sx = baseX + (i % 4) * 8 - 12;
      const sz = baseZ + Math.floor(i / 4) * 9 + 18;
      if (overlapsRoad(sx, sz, 2.5, 2)) continue;
      root.add(
        createBuilding(
          {
            id: `${poi.id}-stall-${i}`,
            name: 'Étal',
            x: sx,
            z: sz,
            width: 5,
            depth: 4,
            height: 2.8,
            color: [0xc34d38, 0xe4bb4e, 0x42876c, 0x477d9d][i % 4]!,
            kind: 'market',
            collide: true,
          },
          collisions,
        ),
      );
      n += 1;
    }
  }

  return n;
}

function placeDistrictExtras(root: THREE.Group, d: DistrictDef, collisions: CollisionSystem): number {
  let n = 0;
  const profile = profileFor(d, d.center.x, d.center.z);
  const rand = (i: number) => {
    const x = Math.sin(i * 12.9898 + d.center.x * 0.01) * 43758.5453;
    return x - Math.floor(x);
  };

  // Fuel station
  {
    const spot = findOffRoadSpot(d.center.x + 40, d.center.z + 40, 10, 8);
    if (spot) {
      root.add(
        createBuilding(
          {
            id: `fuel-${d.id}`,
            name: `Station ${d.name}`,
            x: spot.x,
            z: spot.z,
            width: 10,
            depth: 8,
            height: 4,
            color: 0xffffff,
            kind: 'fuel',
            districtId: d.id,
            collide: true,
          },
          collisions,
        ),
      );
      n += 1;
    }
  }

  // Clinic / pharmacy
  if (d.density === 'dense' || d.density === 'urban' || d.density === 'residential') {
    const spot = findOffRoadSpot(d.center.x - 35, d.center.z + 28, 12, 10);
    if (spot) {
      root.add(
        createBuilding(
          {
            id: `clinic-${d.id}`,
            name: `Centre de santé ${d.name}`,
            x: spot.x,
            z: spot.z,
            width: 14,
            depth: 10,
            height: 5.5,
            color: 0xf5f5f5,
            kind: 'clinic',
            districtId: d.id,
            collide: true,
          },
          collisions,
        ),
      );
      n += 1;
    }
    const ph = findOffRoadSpot(d.center.x + 55, d.center.z - 20, 8, 6);
    if (ph) {
      root.add(
        createBuilding(
          {
            id: `pharma-${d.id}`,
            name: `Pharmacie ${d.name}`,
            x: ph.x,
            z: ph.z,
            width: 8,
            depth: 6,
            height: 4.5,
            color: 0xe8f5e9,
            kind: 'clinic',
            districtId: d.id,
            collide: true,
          },
          collisions,
        ),
      );
      n += 1;
    }
  }

  // Neighbourhood school (offset from hub center)
  {
    const spot = findOffRoadSpot(d.center.x - 50, d.center.z - 40, 14, 10);
    if (spot) {
      root.add(
        createBuilding(
          {
            id: `school-${d.id}`,
            name: `École ${d.name}`,
            x: spot.x,
            z: spot.z,
            width: 18,
            depth: 12,
            height: 5.5,
            color: 0xfff8e1,
            kind: 'landmark',
            districtId: d.id,
            collide: true,
          },
          collisions,
        ),
      );
      n += 1;
    }
  }

  // Church / temple
  {
    const spot = findOffRoadSpot(d.center.x + 48, d.center.z + 55, 10, 8);
    if (spot) {
      root.add(
        createBuilding(
          {
            id: `church-${d.id}`,
            name: `Lieu de culte ${d.name}`,
            x: spot.x,
            z: spot.z,
            width: 12,
            depth: 9,
            height: 7,
            color: 0xfafafa,
            kind: 'landmark',
            districtId: d.id,
            collide: true,
          },
          collisions,
        ),
      );
      n += 1;
    }
  }

  // Mini-market row for dense / market / residential
  if (
    profile.character === 'market' ||
    profile.character === 'residential_dense' ||
    d.density === 'dense'
  ) {
    for (let i = 0; i < 6; i++) {
      const sx = d.center.x - 60 + i * 8;
      const sz = d.center.z + 70;
      const spot = findOffRoadSpot(sx, sz, 3, 2.5);
      if (!spot) continue;
      root.add(
        createBuilding(
          {
            id: `stall-${d.id}-${i}`,
            name: 'Étal de quartier',
            x: spot.x,
            z: spot.z,
            width: 5,
            depth: 4,
            height: 2.8,
            color: [0xc34d38, 0xe4bb4e, 0x42876c, 0x477d9d, 0xff8a65, 0x8e24aa][i]!,
            kind: 'market',
            districtId: d.id,
            collide: true,
          },
          collisions,
        ),
      );
      n += 1;
    }
  }

  // Warehouse cluster for logistics
  if (profile.character === 'logistics') {
    for (let i = 0; i < 3; i++) {
      const spot = findOffRoadSpot(d.center.x - 45 + i * 18, d.center.z - 55, 8, 10);
      if (!spot) continue;
      root.add(
        createBuilding(
          {
            id: `wh-${d.id}-${i}`,
            name: `Entrepôt ${d.name}`,
            x: spot.x,
            z: spot.z,
            width: 14,
            depth: 12,
            height: 6,
            color: 0x78909c,
            kind: 'warehouse',
            districtId: d.id,
            collide: true,
          },
          collisions,
        ),
      );
      n += 1;
    }
  }

  // Corner shops ring
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + 0.4;
    const dist = 75 + rand(i) * 25;
    const spot = findOffRoadSpot(
      d.center.x + Math.cos(ang) * dist,
      d.center.z + Math.sin(ang) * dist,
      5,
      4,
    );
    if (!spot) continue;
    root.add(
      createBuilding(
        {
          id: `corner-${d.id}-${i}`,
          name: 'Boutique de coin',
          x: spot.x,
          z: spot.z,
          width: 7,
          depth: 6,
          height: 4.5,
          color: [0xd7a44d, 0xc34d38, 0x42876c, 0x477d9d][i]!,
          kind: 'shop',
          districtId: d.id,
          collide: true,
        },
        collisions,
      ),
    );
    n += 1;
  }

  // Parked taxis
  for (let i = 0; i < 4; i++) {
    const ang = rand(i) * Math.PI * 2;
    const dist = 30 + rand(i + 3) * 50;
    const tx = d.center.x + Math.cos(ang) * dist;
    const tz = d.center.z + Math.sin(ang) * dist;
    const spot = findOffRoadSpot(tx, tz, 2, 1.2);
    if (!spot) continue;
    root.add(makeTaxi(spot.x, spot.z, ang));
    n += 1;
  }

  // Courtyard trees
  for (let i = 0; i < 3; i++) {
    const ang = rand(i + 10) * Math.PI * 2;
    const dist = 35 + rand(i + 20) * 45;
    const x = d.center.x + Math.cos(ang) * dist;
    const z = d.center.z + Math.sin(ang) * dist;
    if (overlapsRoad(x, z, 1.5, 1.5)) continue;
    root.add(createPalmTree(x, z, 0.7 + rand(i) * 0.2, undefined));
  }

  return n;
}

function findOffRoadSpot(x: number, z: number, halfW: number, halfD: number): { x: number; z: number } | null {
  const tries = [
    [0, 0],
    [18, 0],
    [-18, 0],
    [0, 18],
    [0, -18],
    [22, 22],
    [-22, 16],
    [16, -22],
    [28, -8],
    [-28, 12],
    [8, 28],
    [-12, -28],
  ];
  for (const [dx, dz] of tries) {
    const px = x + dx;
    const pz = z + dz;
    if (!overlapsRoad(px, pz, halfW, halfD)) return { x: px, z: pz };
  }
  return null;
}

function makeTaxi(x: number, z: number, yaw: number): THREE.Group {
  const seed = Math.floor(Math.abs(x + z) * 10) % 40;
  const brand = seed % 4 === 0 ? 'taxi' : pickParkedBrand(seed);
  const g = createBrandVehicle(seed, brand);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  g.userData.driveable = true;
  g.userData.parkedCar = true;
  return g;
}
