import type * as THREE from 'three';
import { createBuilding } from '../buildings/BuildingFactory';
import { overlapsRoad } from './RoadClearance';
import type { CollisionSystem } from './CollisionSystem';
import type { DistrictDef } from '../data/districts';
import type { PoiDef } from '../data/pois';
import { SPECIAL_POI_IDS } from '../landmarks/buildMajorLandmarks';
import { createBrandVehicle, pickParkedBrand } from '../vehicles/VehicleFactory';
import { isFree, occupyRect } from '../city/Occupancy';

/**
 * Named POI buildings and parked taxis. Generic district amenities (fuel stations, clinics,
 * schools, churches, stalls, warehouses) now come from the block planner, which places them
 * on proper frontage lots.
 */
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
    placeDistrictTaxis(root, d);
  }

  return count;
}

function placePoiCluster(root: THREE.Group, poi: PoiDef, collisions: CollisionSystem): number {
  let n = 0;
  const baseX = poi.position.x;
  const baseZ = poi.position.z;
  const w = poi.category === 'mall' ? 28 : poi.category === 'market' ? 14 : 16;
  const d = poi.category === 'mall' ? 20 : 12;

  const spot = findOffRoadSpot(baseX, baseZ, w / 2, d / 2);
  if (spot) {
    const kind =
      poi.category === 'mall' || poi.category === 'shop'
        ? 'shop'
        : poi.category === 'market'
          ? 'market'
          : poi.category === 'education' || poi.category === 'government'
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
          width: w,
          depth: d,
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
  }
  return n;
}

function placeDistrictTaxis(root: THREE.Group, d: DistrictDef): void {
  const rand = (i: number) => {
    const x = Math.sin(i * 12.9898 + d.center.x * 0.01) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 4; i++) {
    const ang = rand(i) * Math.PI * 2;
    const dist = 30 + rand(i + 3) * 50;
    const spot = findOffRoadSpot(d.center.x + Math.cos(ang) * dist, d.center.z + Math.sin(ang) * dist, 2.2, 2.2);
    if (!spot) continue;
    occupyRect(spot.x, spot.z, 2.6, 2.6, 'taxi');
    root.add(makeTaxi(spot.x, spot.z, ang));
  }
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
    const px = x + dx!;
    const pz = z + dz!;
    if (!overlapsRoad(px, pz, halfW, halfD) && isFree(px, pz, halfW, halfD, 1)) return { x: px, z: pz };
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
