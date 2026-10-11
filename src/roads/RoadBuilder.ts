import * as THREE from 'three';
import { mat } from '../world/materials';
import { WorldConfig } from '../config/WorldConfig';
import { surfaceMat } from '../render/surfaces';
import { bakeAndMerge } from '../render/mergeStatic';
import {
  HIGHWAY_EW_Z,
  HIGHWAY_NS_X,
  HIGHWAY_WIDTH,
  ROAD_GRID,
  isHighwayAxisX,
  isHighwayAxisZ,
  roadHalfAtX,
  roadHalfAtZ,
} from './CityRoadPlan';
import { landmarkGapsForRoad, openSpans } from './RoadGaps';

export type RoadSegmentDef = {
  id: string;
  axis: 'x' | 'z';
  /** Fixed cross-axis coordinate (x for NS, z for EW). */
  center: number;
  length: number;
  width?: number;
  /** Along-axis midpoint (z for NS, x for EW). Default 0. */
  mid?: number;
};

const geoBox = new THREE.BoxGeometry(1, 1, 1);
geoBox.userData.shared = true;

/** Painted roads + sidewalks with clearer Cameroon urban markings. */
export function buildRoadNetwork(segments: RoadSegmentDef[]): THREE.Group {
  const root = new THREE.Group();
  root.name = 'roads';
  const roadMat = surfaceMat('asphalt', 0x3a4046);
  const hwyMat = surfaceMat('asphalt', 0x2e3338);
  const shoulderMat = surfaceMat('asphalt', 0x4a5158, 0.9, 0.02);
  const curbMat = surfaceMat('concrete', 0xb7aa96);
  const walkMat = surfaceMat('sidewalk', 0xd5cdc0);
  const yellowMat = mat(0xf5c842);
  const whiteMat = mat(0xf7f4ec);
  const redMat = mat(0xc62828);

  for (const seg of segments) {
    const w = seg.width ?? 12;
    const mid = seg.mid ?? 0;
    const highway = w >= 22;
    const avenue = !highway && w >= 14;
    const asphalt = highway ? hwyMat : roadMat;
    const group = new THREE.Group();
    group.name = seg.id;
    const halfLen = seg.length / 2;

    if (seg.axis === 'z') {
      addStrip(group, asphalt, seg.center, 0.032, mid, w, 0.07, seg.length, true);
      for (const side of [-1, 1]) {
        addStrip(group, shoulderMat, seg.center + side * (w / 2 - 0.85), 0.036, mid, 0.9, 0.05, seg.length, true);
        addStrip(group, walkMat, seg.center + side * (w / 2 + 1.75), 0.055, mid, 3.1, 0.09, seg.length, true);
        addStrip(group, curbMat, seg.center + side * (w / 2 + 0.4), 0.09, mid, 0.5, 0.14, seg.length, false);
      }
      for (const side of [-1, 1]) {
        addStrip(group, whiteMat, seg.center + side * (w / 2 - 0.35), 0.082, mid, 0.16, 0.02, seg.length, false);
      }
      if (highway) {
        addStrip(group, yellowMat, seg.center - 0.28, 0.088, mid, 0.2, 0.02, seg.length, false);
        addStrip(group, yellowMat, seg.center + 0.28, 0.088, mid, 0.2, 0.02, seg.length, false);
        addLaneDashesZ(group, whiteMat, seg.center, [-7.5, -3.8, 3.8, 7.5], mid, halfLen, 28, 5);
      } else if (avenue) {
        addStrip(group, yellowMat, seg.center, 0.084, mid, 0.18, 0.02, seg.length, false);
        addLaneDashesZ(group, whiteMat, seg.center, [-3.2, 3.2], mid, halfLen, 26, 4);
      } else {
        addStrip(group, whiteMat, seg.center, 0.082, mid, 0.11, 0.02, seg.length, false);
      }
    } else {
      addStrip(group, asphalt, mid, 0.032, seg.center, seg.length, 0.07, w, true);
      for (const side of [-1, 1]) {
        addStrip(group, shoulderMat, mid, 0.036, seg.center + side * (w / 2 - 0.85), seg.length, 0.05, 0.9, true);
        addStrip(group, walkMat, mid, 0.055, seg.center + side * (w / 2 + 1.75), seg.length, 0.09, 3.1, true);
        addStrip(group, curbMat, mid, 0.09, seg.center + side * (w / 2 + 0.4), seg.length, 0.14, 0.5, false);
      }
      for (const side of [-1, 1]) {
        addStrip(group, whiteMat, mid, 0.082, seg.center + side * (w / 2 - 0.35), seg.length, 0.02, 0.16, false);
      }
      if (highway) {
        addStrip(group, yellowMat, mid, 0.088, seg.center - 0.28, seg.length, 0.02, 0.2, false);
        addStrip(group, yellowMat, mid, 0.088, seg.center + 0.28, seg.length, 0.02, 0.2, false);
        addLaneDashesX(group, whiteMat, seg.center, [-7.5, -3.8, 3.8, 7.5], mid, halfLen, 28, 5);
      } else if (avenue) {
        addStrip(group, yellowMat, mid, 0.084, seg.center, seg.length, 0.02, 0.18, false);
        addLaneDashesX(group, whiteMat, seg.center, [-3.2, 3.2], mid, halfLen, 26, 4);
      } else {
        addStrip(group, whiteMat, mid, 0.082, seg.center, seg.length, 0.02, 0.11, false);
      }
    }

    bakeAndMerge(group);
    root.add(group);
  }

  addPedestrianCrossings(root, whiteMat, redMat);
  void WorldConfig;
  return root;
}

function addLaneDashesZ(
  group: THREE.Group,
  whiteMat: THREE.Material,
  centerX: number,
  lanes: number[],
  mid: number,
  halfSpan: number,
  step: number,
  dashLen: number,
): void {
  const z0 = mid - halfSpan;
  const z1 = mid + halfSpan;
  for (const lane of lanes) {
    for (let z = z0; z < z1; z += step) {
      addStrip(group, whiteMat, centerX + lane, 0.086, z, 0.12, 0.02, dashLen, false);
    }
  }
}

function addLaneDashesX(
  group: THREE.Group,
  whiteMat: THREE.Material,
  centerZ: number,
  lanes: number[],
  mid: number,
  halfSpan: number,
  step: number,
  dashLen: number,
): void {
  const x0 = mid - halfSpan;
  const x1 = mid + halfSpan;
  for (const lane of lanes) {
    for (let x = x0; x < x1; x += step) {
      addStrip(group, whiteMat, x, 0.086, centerZ + lane, dashLen, 0.02, 0.12, false);
    }
  }
}

function addPedestrianCrossings(
  root: THREE.Group,
  whiteMat: THREE.Material,
  redMat: THREE.Material,
): void {
  const gap = 1.35;
  const mid = ROAD_GRID * 0.5;

  addZebra(root, whiteMat, HIGHWAY_NS_X, mid, 'z', HIGHWAY_WIDTH);
  addZebra(root, whiteMat, HIGHWAY_NS_X, -mid, 'z', HIGHWAY_WIDTH);
  addZebra(root, whiteMat, mid, HIGHWAY_EW_Z, 'x', HIGHWAY_WIDTH);
  addZebra(root, whiteMat, -mid, HIGHWAY_EW_Z, 'x', HIGHWAY_WIDTH);
  addStopLine(root, redMat, HIGHWAY_NS_X, mid - HIGHWAY_WIDTH / 2 - 1.2, 'z', HIGHWAY_WIDTH);
  addStopLine(root, redMat, mid - HIGHWAY_WIDTH / 2 - 1.2, HIGHWAY_EW_Z, 'x', HIGHWAY_WIDTH);

  const avenues = [
    -ROAD_GRID * 6,
    -ROAD_GRID * 4,
    -ROAD_GRID * 2,
    ROAD_GRID * 2,
    ROAD_GRID * 4,
    ROAD_GRID * 6,
  ];
  for (const a of avenues) {
    const ewHalf = roadHalfAtZ(a);
    addZebra(root, whiteMat, HIGHWAY_NS_X, a - ewHalf - gap, 'z', HIGHWAY_WIDTH);
    addZebra(root, whiteMat, HIGHWAY_NS_X, a + ewHalf + gap, 'z', HIGHWAY_WIDTH);
    const nsHalf = roadHalfAtX(a);
    addZebra(root, whiteMat, a - nsHalf - gap, HIGHWAY_EW_Z, 'x', HIGHWAY_WIDTH);
    addZebra(root, whiteMat, a + nsHalf + gap, HIGHWAY_EW_Z, 'x', HIGHWAY_WIDTH);
  }

  // Extra urban crossings near player house / centre band
  for (const z of [ROAD_GRID, -ROAD_GRID, ROAD_GRID * 1.5]) {
    addZebra(root, whiteMat, HIGHWAY_NS_X + 72, z, 'z', 16);
  }
  bakeAndMerge(root);
}

/** Default city road set — split so asphalt never cuts through landmarks. */
export function buildLogicalCityRoads(): RoadSegmentDef[] {
  const half = WorldConfig.worldHalfSize;
  const segs: RoadSegmentDef[] = [];

  const pushSplit = (
    idBase: string,
    axis: 'x' | 'z',
    center: number,
    width: number,
  ): void => {
    const gaps = landmarkGapsForRoad(axis, center);
    const spans = openSpans(half, gaps);
    let i = 0;
    for (const span of spans) {
      if (span.length < 10) continue;
      segs.push({
        id: `${idBase}-${i++}`,
        axis,
        center,
        mid: span.mid,
        length: span.length,
        width,
      });
    }
  };

  pushSplit('hwy-ns', 'z', HIGHWAY_NS_X, HIGHWAY_WIDTH);
  pushSplit('hwy-ew', 'x', HIGHWAY_EW_Z, HIGHWAY_WIDTH);

  for (let v = -half; v <= half; v += ROAD_GRID) {
    if (isHighwayAxisX(v)) continue;
    const avenue = Math.abs(v) % (ROAD_GRID * 2) === 0;
    pushSplit(`ns-x${v}`, 'z', v, avenue ? 16 : 11);
  }
  for (let v = -half; v <= half; v += ROAD_GRID) {
    if (isHighwayAxisZ(v)) continue;
    const avenue = Math.abs(v) % (ROAD_GRID * 2) === 0;
    pushSplit(`ew-z${v}`, 'x', v, avenue ? 16 : 11);
  }

  return segs;
}

function addStrip(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  receiveShadow: boolean,
): void {
  const m = new THREE.Mesh(geoBox, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.receiveShadow = receiveShadow;
  m.castShadow = false;
  parent.add(m);
}

function addZebra(
  root: THREE.Group,
  whiteMat: THREE.Material,
  x: number,
  z: number,
  roadAxis: 'x' | 'z',
  roadWidth: number,
): void {
  const pitch = 0.78;
  const thickness = 0.42;
  const bandDepth = 3.8;
  const across = Math.max(roadWidth - 0.8, 8);
  const count = Math.max(5, Math.round(bandDepth / pitch));
  const start = -((count - 1) * pitch) / 2;

  for (let i = 0; i < count; i++) {
    const off = start + i * pitch;
    if (roadAxis === 'z') {
      addStrip(root, whiteMat, x, 0.092, z + off, across, 0.03, thickness, false);
    } else {
      addStrip(root, whiteMat, x + off, 0.092, z, thickness, 0.03, across, false);
    }
  }
}

function addStopLine(
  root: THREE.Group,
  matCol: THREE.Material,
  x: number,
  z: number,
  roadAxis: 'x' | 'z',
  roadWidth: number,
): void {
  const across = Math.max(roadWidth - 1.2, 7);
  if (roadAxis === 'z') {
    addStrip(root, matCol, x, 0.093, z, across, 0.03, 0.35, false);
  } else {
    addStrip(root, matCol, x, 0.093, z, 0.35, 0.03, across, false);
  }
}
