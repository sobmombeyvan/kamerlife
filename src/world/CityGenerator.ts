import * as THREE from 'three';
import { DISTRICTS, nearestDistrict, type DistrictDef } from '../data/districts';
import { POIS } from '../data/pois';
import { WorldConfig } from '../config/WorldConfig';
import { createBuilding } from '../buildings/BuildingFactory';
import { buildLogicalCityRoads, buildRoadNetwork } from '../roads/RoadBuilder';
import { createPalmTree } from '../vegetation/TreeFactory';
import { mat } from './materials';
import type { CollisionSystem } from './CollisionSystem';
import { ROAD_GRID, lotsInCityFabric, overlapsRoad } from './RoadClearance';
import { addCityAmenities } from './CityAmenities';
import { buildTerrain } from './TerrainBuilder';
import { buildMajorLandmarks } from '../landmarks/buildMajorLandmarks';
import { pickDistrictBuilding, profileFor } from '../data/districtProfiles';
import { buildCentreVille } from './CentreVille';
import { HIGHWAY_HALF, SIDEWALK_FROM_CENTER_HIGHWAY } from '../roads/CityRoadPlan';
import { freezeStatic } from './freezeStatic';
import type { BuildingDetail } from '../buildings/BuildingFactory';
import { buildCityBillboards } from './CityBillboards';
import { buildLifeSpotMarkers } from './LifeSpotMarkers';
import { GraphicsConfig } from '../config/GraphicsConfig';

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashId(a: number, b: number): number {
  return ((a * 73856093) ^ (b * 19349663)) >>> 0;
}

export function generateLargeCity(scene: THREE.Scene, collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'yaounde-megacity';
  scene.add(root);
  collisions.clear();

  buildTerrain(root);
  // Logical road hierarchy: main cross highway + grid
  root.add(buildRoadNetwork(buildLogicalCityRoads()));

  let buildingCount = buildCentreVille(root, collisions);
  buildingCount += fillCityFabric(root, collisions);

  for (const district of DISTRICTS) {
    if (district.id === 'centre-ville') continue; // handled by CentreVille
    addDistrictSign(root, district);
    addDistrictPlaza(root, district);
  }

  buildingCount += addCityAmenities(root, DISTRICTS, POIS, collisions);

  const landmarkAnchors = buildMajorLandmarks(root, collisions);
  root.userData.landmarkAnchors = landmarkAnchors;

  root.add(
    buildRoadNetwork([{ id: 'airport-spur', axis: 'x', center: 1080, length: 220, width: 12 }]),
  );

  addStreetFurniture(root);
  buildLifeSpotMarkers(root);
  const ads = buildCityBillboards(root);

  freezeStatic(root);

  root.userData = { buildingCount, districtCount: DISTRICTS.length, landmarkAnchors, ads };
  console.info(`[CityGenerator] ~${buildingCount} bâtiments · ${ads} panneaux pub`);
  return root;
}

function buildingDetailAt(x: number, z: number): BuildingDetail {
  const d = Math.hypot(x, z);
  const q = GraphicsConfig.quality;
  if (q === 'low') {
    if (d < 220) return 'medium';
    return 'simple';
  }
  if (q === 'medium') {
    if (d < 280) return 'full';
    if (d < 620) return 'medium';
    return 'simple';
  }
  if (d < 380) return 'full';
  if (d < 780) return 'medium';
  return 'simple';
}

function fillCityFabric(root: THREE.Group, collisions: CollisionSystem): number {
  const outer =
    GraphicsConfig.quality === 'low'
      ? 900
      : GraphicsConfig.quality === 'medium'
        ? 1100
        : Math.min(1300, WorldConfig.worldHalfSize - 60);
  const lots = lotsInCityFabric(760, outer);
  let made = 0;
  const skipStride = GraphicsConfig.quality === 'low' ? 2 : GraphicsConfig.quality === 'medium' ? 1 : 0;
  let lotIndex = 0;

  for (const lot of lots) {
    lotIndex += 1;
    if (skipStride > 0 && lotIndex % (skipStride + 1) === 0) continue;
    // Leave centre to dedicated builder
    if (Math.hypot(lot.x, lot.z) < 70) continue;

    const district = nearestDistrict(lot.x, lot.z);
    const profile = profileFor(district, lot.x, lot.z);
    const rand = mulberry32(hashId(Math.floor(lot.x * 10), Math.floor(lot.z * 10)));
    const picked = pickDistrictBuilding(profile, rand, lot.maxHalf);
    if (!picked) continue;
    if (overlapsRoad(lot.x, lot.z, picked.w / 2, picked.d / 2)) continue;

    const toNS = Math.abs(((lot.x % ROAD_GRID) + ROAD_GRID) % ROAD_GRID - ROAD_GRID / 2);
    const toEW = Math.abs(((lot.z % ROAD_GRID) + ROAD_GRID) % ROAD_GRID - ROAD_GRID / 2);
    const yaw = toNS < toEW ? 0 : Math.PI / 2;

    root.add(
      createBuilding(
        {
          id: `${district.id}-b${made}`,
          name: `${district.name} · ${kindLabel(picked.kind)}`,
          x: lot.x,
          z: lot.z,
          width: picked.w,
          depth: picked.d,
          height: picked.h,
          color: picked.color,
          kind: picked.kind,
          districtId: district.id,
          yaw,
          detail: buildingDetailAt(lot.x, lot.z),
          // Solid for driveable cars — spatial hash keeps resolve cheap
          collide: true,
        },
        collisions,
      ),
    );
    made += 1;
  }
  return made;
}

function kindLabel(kind: string): string {
  const map: Record<string, string> = {
    flat: 'Immeuble',
    shop: 'Boutique',
    house: 'Maison',
    villa: 'Villa',
    market: 'Marché',
    office: 'Bureau',
    warehouse: 'Entrepôt',
    landmark: 'Équipement',
    fuel: 'Station',
    clinic: 'Clinique',
  };
  return map[kind] ?? kind;
}

function addDistrictSign(root: THREE.Group, d: DistrictDef): void {
  const profile = profileFor(d, d.center.x, d.center.z);
  const x = d.center.x + 18;
  const z = d.center.z + 18;
  if (overlapsRoad(x, z, 4, 1)) return;

  const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 5.2, 0.28), mat(0x333333));
  post.position.set(x, 2.6, z);
  root.add(post);
  const board = new THREE.Mesh(new THREE.BoxGeometry(8.5, 1.7, 0.16), mat(0x10251f));
  board.position.set(x, 5.0, z);
  root.add(board);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(8.0, 1.25, 0.1), mat(profile.accent));
  tip.position.set(x, 5.0, z + 0.14);
  root.add(tip);
  const ring = new THREE.Mesh(new THREE.RingGeometry(6, 7.2, 24), mat(profile.accent));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(d.center.x, 0.06, d.center.z);
  root.add(ring);
}

function addDistrictPlaza(root: THREE.Group, d: DistrictDef): void {
  const profile = profileFor(d, d.center.x, d.center.z);
  const px = d.center.x - 12;
  const pz = d.center.z + 10;
  if (overlapsRoad(px, pz, 8, 8)) return;

  if (profile.character === 'premium' || profile.character === 'institutional') {
    const lawn = new THREE.Mesh(new THREE.CylinderGeometry(14, 16, 0.08, 16), mat(0x5f8a52));
    lawn.position.set(px, 0.04, pz);
    root.add(lawn);
    root.add(createPalmTree(px + 6, pz - 4, 0.85, undefined));
    root.add(createPalmTree(px - 5, pz + 5, 0.75, undefined));
  } else if (profile.character === 'market') {
    for (let i = 0; i < 5; i++) {
      const stall = new THREE.Mesh(
        new THREE.BoxGeometry(3.5, 2.4, 2.8),
        mat([0xc34d38, 0xe4bb4e, 0x42876c, 0x477d9d, 0xff8a65][i]!),
      );
      stall.position.set(px + (i - 2) * 4.2, 1.2, pz);
      root.add(stall);
    }
  } else if (profile.character === 'student') {
    const court = new THREE.Mesh(new THREE.BoxGeometry(16, 0.08, 12), mat(0xb0bec5));
    court.position.set(px, 0.04, pz);
    root.add(court);
  } else if (profile.character === 'logistics') {
    const yard = new THREE.Mesh(new THREE.BoxGeometry(18, 0.08, 14), mat(0x78909c));
    yard.position.set(px, 0.04, pz);
    root.add(yard);
  } else {
    // Default neighbourhood plaza + kiosk ring
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(10, 11, 0.08, 14), mat(0x8d8578));
    plaza.position.set(px, 0.04, pz);
    root.add(plaza);
    for (let i = 0; i < 3; i++) {
      const stall = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 2.2, 2.6),
        mat([0xc34d38, 0xe4bb4e, 0x42876c][i]!),
      );
      stall.position.set(px + (i - 1) * 4, 1.1, pz + 8);
      if (!overlapsRoad(px + (i - 1) * 4, pz + 8, 1.6, 1.3)) root.add(stall);
    }
  }
}

const lampPoleGeo = new THREE.CylinderGeometry(0.08, 0.1, 5, 6);
const lampBulbGeo = new THREE.SphereGeometry(0.2, 6, 5);

function addStreetFurniture(root: THREE.Group): void {
  const walk = SIDEWALK_FROM_CENTER_HIGHWAY;
  const poleMat = mat(0x4d5653);
  const bulbMat = mat(0xffe4a4, 0.45);
  // Sparser lamps — only near centre where fog shows them
  for (let z = -480; z <= 480; z += 72) {
    if (Math.abs(z) < 45) continue;
    for (const side of [-1, 1] as const) {
      const x = side * walk;
      const pole = new THREE.Mesh(lampPoleGeo, poleMat);
      pole.position.set(x, 2.5, z);
      root.add(pole);
      const lamp = new THREE.Mesh(lampBulbGeo, bulbMat);
      lamp.position.set(x, 5.1, z);
      root.add(lamp);
    }
  }
  for (let x = -480; x <= 480; x += 72) {
    if (Math.abs(x) < 45) continue;
    for (const side of [-1, 1] as const) {
      const z = side * walk;
      const pole = new THREE.Mesh(lampPoleGeo, poleMat);
      pole.position.set(x, 2.5, z);
      root.add(pole);
      const lamp = new THREE.Mesh(lampBulbGeo, bulbMat);
      lamp.position.set(x, 5.1, z);
      root.add(lamp);
    }
  }

  for (let i = -432; i <= 432; i += 144) {
    if (Math.abs(i) < 50) continue;
    const side = HIGHWAY_HALF + 5;
    if (!overlapsRoad(side, i, 1, 1)) root.add(createPalmTree(side, i, 0.75, undefined));
    if (!overlapsRoad(-side, i, 1, 1)) root.add(createPalmTree(-side, i, 0.7, undefined));
  }
}
