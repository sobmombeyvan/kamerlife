import * as THREE from 'three';
import { DISTRICTS, type DistrictDef } from '../data/districts';
import { POIS } from '../data/pois';
import type { CollisionSystem } from './CollisionSystem';
import { overlapsRoad } from './RoadClearance';
import { addCityAmenities } from './CityAmenities';
import { buildTerrain } from './TerrainBuilder';
import { buildMajorLandmarks } from '../landmarks/buildMajorLandmarks';
import { profileFor } from '../data/districtProfiles';
import { buildCentreVille } from './CentreVille';
import { freezeStatic } from './freezeStatic';
import { buildLifeSpotMarkers } from './LifeSpotMarkers';
import { mat } from './materials';
import { CityPlan } from '../city/CityPlan';
import { CityChunks } from '../city/CityChunks';
import { setKitSink } from '../city/KitSink';
import { clearOccupancy, occupyRect } from '../city/Occupancy';
import { LANDMARK_FOOTPRINTS } from '../landmarks/LandmarkSites';
import { LIFE_SPOTS } from '../sim/LifeSpots';
import { buildTaxiDestinations, buildTaxiStands } from '../vehicles/TaxiDestinations';

export type CityBuild = { root: THREE.Group; plan: CityPlan; chunks: CityChunks };

/**
 * Builds the city: hand-placed landmarks and hubs first (they reserve their ground), then the
 * block planner fills every remaining block. Planned buildings, roads and street furniture
 * are rendered by CityChunks, which streams them around the camera.
 */
export function generateLargeCity(scene: THREE.Scene, collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'yaounde-megacity';
  scene.add(root);
  collisions.clear();
  clearOccupancy();

  buildTerrain(root);

  const plan = new CityPlan();
  reserveGameplaySpots();
  setKitSink({ plan, collisions });

  let buildingCount = buildCentreVille(root, collisions);
  for (const district of DISTRICTS) {
    if (district.id === 'centre-ville') continue;
    addDistrictSign(root, district);
  }
  buildingCount += addCityAmenities(root, DISTRICTS, POIS, collisions);
  const landmarkAnchors = buildMajorLandmarks(root, collisions);

  setKitSink(null);
  plan.generate(collisions);
  buildingCount += plan.buildingCount;

  buildLifeSpotMarkers(root);
  freezeStatic(root);

  const chunks = new CityChunks(plan, collisions);
  root.add(chunks.group);

  root.userData = { buildingCount, districtCount: DISTRICTS.length, landmarkAnchors, plan, chunks };
  console.info(`[CityGenerator] ~${buildingCount} bâtiments planifiés · ${plan.blocks.length} îlots`);
  return root;
}

/** Keep generated blocks off landmarks, life-sim spots, taxi stands and drop-off points. */
function reserveGameplaySpots(): void {
  for (const f of LANDMARK_FOOTPRINTS) occupyRect(f.x, f.z, f.halfW, f.halfD, `landmark:${f.id}`);
  for (const s of LIFE_SPOTS) occupyRect(s.x, s.z, s.radius + 2, s.radius + 2, `spot:${s.id}`);
  for (const t of buildTaxiStands()) occupyRect(t.x, t.z, 6, 6, `stand:${t.id}`);
  for (const d of buildTaxiDestinations()) occupyRect(d.x, d.z, 5, 5, `dest:${d.id}`);
  for (const [px, pz] of [
    [28, 28],
    [-28, 28],
    [28, -28],
    [-28, -28],
  ] as const) {
    occupyRect(px, pz, 11, 11, 'centre-plaza');
  }
}

function addDistrictSign(root: THREE.Group, d: DistrictDef): void {
  const profile = profileFor(d, d.center.x, d.center.z);
  const x = d.center.x + 18;
  const z = d.center.z + 18;
  if (overlapsRoad(x, z, 4, 1)) return;
  occupyRect(x, z, 4.5, 1.2, 'district-sign');

  const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 5.2, 0.28), mat(0x333333));
  post.position.set(x, 2.6, z);
  root.add(post);
  const board = new THREE.Mesh(new THREE.BoxGeometry(8.5, 1.7, 0.16), mat(0x10251f));
  board.position.set(x, 5.0, z);
  root.add(board);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(8.0, 1.25, 0.1), mat(profile.accent));
  tip.position.set(x, 5.0, z + 0.14);
  root.add(tip);
}
