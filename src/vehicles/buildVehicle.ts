import * as THREE from 'three';
import { profileOf, type VehicleId, type VehicleProfile, type FrontKind } from './catalog';
import {
  addBadge,
  addContactShadow,
  addDoorQr,
  addInterior,
  addMesh,
  addMirrors,
  addPlate,
  addWheels,
  boxGeo,
  carPaint,
  cylGeo,
  glassMat,
  kitMats,
  makeLightSet,
  tintedGlass,
  type LightSet,
  type VehicleDetail,
} from './CarKit';

export function createCatalogVehicle(
  id: VehicleId,
  seed: number,
  detail: VehicleDetail = 'street',
): THREE.Group {
  const p = profileOf(id);
  const color = p.colors[seed % p.colors.length]!;
  const paint = carPaint(color, { luxury: p.luxury, street: detail === 'street' });
  const root = new THREE.Group();
  root.name = p.id;
  const chassis = new THREE.Group();
  chassis.name = 'chassis';
  root.add(chassis);

  const lights = makeLightSet(detail === 'full');
  buildBody(chassis, p, paint, detail);
  addWindows(chassis, p);
  addFront(chassis, p, lights, paint);
  addRear(chassis, p, lights, paint);
  addMirrors(chassis, p.width * 0.52, p.clearance + 0.85 + p.roofH * 0.35, p.cabinZ + p.cabinL * 0.32);
  addPlate(chassis, p.clearance + 0.32, -p.length * 0.5 + 0.04);
  addPlate(chassis, p.clearance + 0.32, p.length * 0.5 - 0.04);
  addBadge(
    chassis,
    p.badge,
    p.badgeBg,
    p.badgeFg,
    0,
    p.clearance + 0.72,
    p.length * 0.5 - 0.02,
    Math.min(1.15, p.width * 0.55),
    0.18,
  );
  if (p.roofRails) addRoofRails(chassis, p);
  if (p.spare) addSpare(chassis, p);
  if (p.slidingDoor) addSlidingDoor(chassis, p, paint);
  if (detail === 'full') addInterior(chassis, p);
  if (p.id === 'yango') addYangoMarks(chassis, p);
  if (p.id === 'yellow-taxi') addTaxiMarks(chassis, p);

  const wheels = addWheels(root, p, detail);
  addContactShadow(root, p);

  const cockpit = new THREE.Object3D();
  cockpit.position.set(-0.22, p.clearance + 1.05, p.cabinZ - p.cabinL * 0.12);
  root.add(cockpit);

  root.userData.driveable = true;
  root.userData.brand = legacyBrand(p.id);
  root.userData.vehicleId = p.id;
  root.userData.label = p.label;
  root.userData.halfLength = p.length * 0.5;
  root.userData.halfWidth = p.width * 0.5;
  root.userData.wheelRadius = p.wheelR;
  root.userData.steerWheels = wheels.steer;
  root.userData.spinWheels = wheels.spin;
  root.userData.chassis = chassis;
  root.userData.cockpit = cockpit;
  root.userData.headMat = lights.head;
  root.userData.brakeMat = lights.brake;
  root.userData.reverseMat = lights.reverse;
  root.userData.indicatorMat = lights.indicator;
  root.userData.detail = detail;
  root.userData.modelSource = 'procedural';
  return root;
}

function legacyBrand(id: VehicleId): string {
  if (id === 'yango') return 'taxi';
  if (id === 'yellow-taxi') return 'yellow-taxi';
  if (id === 'prado' || id === 'lc300' || id === 'fortuner') return 'prado';
  if (id === 's450' || id === 's580') return 'mercedes';
  if (id === 'mg7') return 'tesla';
  if (id === 'cs55' || id === 'unik' || id === 'coolray') return 'jetour';
  return 'car';
}

function buildBody(
  g: THREE.Group,
  p: VehicleProfile,
  paint: THREE.Material,
  _detail: VehicleDetail,
): void {
  const half = p.length * 0.5;
  const y0 = p.clearance;
  const rockerH = 0.1;
  const bodyH =
    p.kind === 'van' || p.kind === 'bus' || p.kind === 'truck'
      ? 0.55
      : p.kind === 'ladder' || p.kind === 'suv' || p.kind === 'pickup'
        ? 0.58
        : 0.42;
  addMesh(g, boxGeo(p.width * 0.96, rockerH, p.length * 0.9), kitMats.darkTrim(), 0, y0 + 0.04, 0);
  addMesh(g, boxGeo(p.width, bodyH, p.length * 0.94), paint, 0, y0 + rockerH + bodyH * 0.5, 0);

  const hoodY = y0 + rockerH + bodyH + 0.05;
  const hoodPitch =
    p.kind === 'fastback' || p.kind === 'sedan' ? 0.14 : p.kind === 'hatch' ? 0.1 : 0.06;
  const hoodZ = half - p.hoodL * 0.5 - 0.06;
  addMesh(g, boxGeo(p.width * 0.92, 0.08, p.hoodL), paint, 0, hoodY, hoodZ, { rx: hoodPitch });

  addArch(g, p, paint, p.track, p.wheelbase * 0.5);
  addArch(g, p, paint, -p.track, p.wheelbase * 0.5);
  addArch(g, p, paint, p.track, -p.wheelbase * 0.5);
  addArch(g, p, paint, -p.track, -p.wheelbase * 0.5);

  const cabinY = y0 + rockerH + bodyH + p.roofH * 0.45;
  if (p.kind === 'pickup') {
    addMesh(g, boxGeo(p.width * 0.9, p.roofH, p.cabinL), paint, 0, cabinY, p.cabinZ);
    addPickupBed(g, p, paint);
  } else if (p.kind === 'truck') {
    addMesh(g, boxGeo(p.width * 0.92, p.roofH + 0.2, p.cabinL), paint, 0, cabinY + 0.1, p.cabinZ);
    addTruckCargo(g, p, paint);
  } else if (p.kind === 'van' || p.kind === 'bus') {
    addMesh(g, boxGeo(p.width * 0.96, p.roofH, p.cabinL), paint, 0, cabinY, p.cabinZ);
    addMesh(g, boxGeo(p.width * 0.92, 0.08, p.cabinL * 0.98), kitMats.darkTrim(), 0, cabinY + p.roofH * 0.52, p.cabinZ);
  } else {
    const cabinW = p.kind === 'fastback' ? p.width * 0.86 : p.width * 0.9;
    addMesh(g, boxGeo(cabinW, p.roofH, p.cabinL), paint, 0, cabinY, p.cabinZ);
    if (p.kind === 'sedan') {
      const trunkZ = -half + p.trunkL * 0.5 + 0.08;
      addMesh(g, boxGeo(p.width * 0.9, 0.28, p.trunkL), paint, 0, y0 + rockerH + bodyH + 0.08, trunkZ);
    }
    if (p.kind === 'fastback') {
      addMesh(
        g,
        boxGeo(p.width * 0.82, p.roofH * 0.7, p.trunkL),
        paint,
        0,
        cabinY - 0.08,
        -half + p.trunkL * 0.45,
        { rx: 0.32 },
      );
    }
  }

  addMesh(g, boxGeo(0.04, 0.08, p.cabinL * 0.7), kitMats.darkTrim(), p.width * 0.46, y0 + bodyH * 0.7, p.cabinZ);
  addMesh(g, boxGeo(0.04, 0.08, p.cabinL * 0.7), kitMats.darkTrim(), -p.width * 0.46, y0 + bodyH * 0.7, p.cabinZ);
  addMesh(g, boxGeo(0.06, 0.04, 0.14), kitMats.chrome(), p.width * 0.48, y0 + bodyH * 0.85, p.cabinZ + 0.2);
  addMesh(g, boxGeo(0.06, 0.04, 0.14), kitMats.chrome(), -p.width * 0.48, y0 + bodyH * 0.85, p.cabinZ + 0.2);

  addMesh(g, boxGeo(p.width * 0.98, 0.16, 0.22), kitMats.darkTrim(), 0, y0 + 0.22, half - 0.06);
  addMesh(g, boxGeo(p.width * 0.98, 0.16, 0.22), kitMats.darkTrim(), 0, y0 + 0.22, -half + 0.06);

  if (p.kind === 'ladder' || p.kind === 'pickup' || p.kind === 'truck') {
    addMesh(g, boxGeo(0.08, y0 + 0.08, p.length * 0.7), kitMats.darkTrim(), 0.22, y0 * 0.45, 0, { cast: false });
    addMesh(g, boxGeo(0.08, y0 + 0.08, p.length * 0.7), kitMats.darkTrim(), -0.22, y0 * 0.45, 0, { cast: false });
  }
}

function addArch(g: THREE.Group, p: VehicleProfile, paint: THREE.Material, x: number, z: number): void {
  const bulge = p.kind === 'ladder' || p.kind === 'pickup' || p.kind === 'truck' ? 0.14 : 0.08;
  addMesh(
    g,
    boxGeo(0.22, p.wheelR * 1.35, p.wheelR * 2.15),
    paint,
    x + Math.sign(x) * bulge,
    p.wheelR + 0.08,
    z,
  );
}

function addPickupBed(g: THREE.Group, p: VehicleProfile, paint: THREE.Material): void {
  const half = p.length * 0.5;
  const bedZ = -half + p.trunkL * 0.5 + 0.08;
  const y = p.clearance + 0.55;
  addMesh(g, boxGeo(p.width * 0.88, 0.06, p.trunkL), kitMats.darkTrim(), 0, y, bedZ);
  addMesh(g, boxGeo(0.06, 0.42, p.trunkL), paint, p.width * 0.42, y + 0.2, bedZ);
  addMesh(g, boxGeo(0.06, 0.42, p.trunkL), paint, -p.width * 0.42, y + 0.2, bedZ);
  addMesh(g, boxGeo(p.width * 0.88, 0.4, 0.08), paint, 0, y + 0.18, -half + 0.1);
  addMesh(g, boxGeo(p.width * 0.7, 0.05, p.trunkL * 0.9), kitMats.brushed(), 0, y + 0.42, bedZ);
}

function addTruckCargo(g: THREE.Group, p: VehicleProfile, paint: THREE.Material): void {
  const half = p.length * 0.5;
  const boxZ = -half + p.trunkL * 0.5 + 0.15;
  addMesh(g, boxGeo(p.width * 0.98, 1.85, p.trunkL), paint, 0, p.clearance + 1.15, boxZ);
  addMesh(g, boxGeo(p.width * 0.9, 0.08, p.trunkL * 0.92), kitMats.darkTrim(), 0, p.clearance + 2.1, boxZ);
  addMesh(g, boxGeo(p.width * 1.02, 0.12, 0.12), kitMats.chrome(), 0, p.clearance + 0.55, -half);
}

function addWindows(g: THREE.Group, p: VehicleProfile): void {
  const gl = p.luxury ? glassMat() : tintedGlass();
  const y = p.clearance + 0.55 + (p.kind === 'van' || p.kind === 'bus' ? 1.05 : 0.72);
  const h = p.kind === 'van' || p.kind === 'bus' ? p.roofH * 0.55 : p.roofH * 0.62;
  const half = p.length * 0.5;
  const windshieldZ = p.cabinZ + p.cabinL * 0.48;
  const pitch = p.kind === 'fastback' ? -0.55 : p.kind === 'ladder' || p.kind === 'van' ? -0.28 : -0.42;
  addMesh(g, boxGeo(p.width * 0.82, h, 0.05), gl, 0, y, windshieldZ, { rx: pitch });
  const rearZ = p.kind === 'pickup' || p.kind === 'truck' ? p.cabinZ - p.cabinL * 0.48 : -half + 0.22;
  const rearPitch = p.kind === 'fastback' ? 0.55 : p.kind === 'hatch' ? 0.42 : 0.12;
  addMesh(g, boxGeo(p.width * 0.78, h * 0.9, 0.05), gl, 0, y - 0.02, rearZ, { rx: rearPitch });
  const sideL = p.kind === 'van' || p.kind === 'bus' ? p.cabinL * 0.82 : p.cabinL * 0.7;
  addMesh(g, boxGeo(0.04, h * 0.85, sideL), gl, p.width * 0.46, y - 0.04, p.cabinZ);
  addMesh(g, boxGeo(0.04, h * 0.85, sideL), gl, -p.width * 0.46, y - 0.04, p.cabinZ);
  addMesh(g, boxGeo(0.05, h * 1.05, 0.06), kitMats.darkTrim(), p.width * 0.46, y - 0.02, p.cabinZ + 0.05);
  addMesh(g, boxGeo(0.05, h * 1.05, 0.06), kitMats.darkTrim(), -p.width * 0.46, y - 0.02, p.cabinZ + 0.05);
}

function addFront(g: THREE.Group, p: VehicleProfile, lights: LightSet, paint: THREE.Material): void {
  const z = p.length * 0.5 - 0.04;
  const y = p.clearance + 0.55;
  const style: FrontKind = p.front;
  if (style === 'mercedes') {
    addMesh(g, boxGeo(p.width * 0.62, 0.42, 0.08), kitMats.chrome(), 0, y + 0.08, z);
    addMesh(g, boxGeo(0.04, 0.38, 0.06), kitMats.darkTrim(), 0, y + 0.08, z + 0.03);
    lamp(g, lights.head, 0.55, y + 0.12, z, 0.48, 0.1, 0.07);
    addMesh(g, boxGeo(p.width * 0.5, 0.04, 0.05), kitMats.chrome(), 0, y - 0.18, z);
  } else if (style === 'toyota-lc') {
    addMesh(g, boxGeo(p.width * 0.72, 0.52, 0.1), kitMats.chrome(), 0, y + 0.1, z);
    addMesh(g, boxGeo(p.width * 0.64, 0.44, 0.06), kitMats.darkTrim(), 0, y + 0.1, z + 0.03);
    lamp(g, lights.head, 0.72, y + 0.16, z, 0.32, 0.16, 0.08);
    addMesh(g, boxGeo(p.width * 0.9, 0.18, 0.16), kitMats.darkTrim(), 0, p.clearance + 0.28, z);
  } else if (style === 'toyota-prado' || style === 'tank' || style === 'haval') {
    addMesh(g, boxGeo(p.width * 0.58, 0.48, 0.1), kitMats.darkTrim(), 0, y + 0.12, z);
    addMesh(g, boxGeo(p.width * 0.5, 0.08, 0.06), kitMats.chrome(), 0, y + 0.28, z + 0.03);
    lamp(g, lights.head, 0.68, y + 0.14, z, 0.28, 0.2, 0.08);
    addMesh(g, boxGeo(p.width * 0.92, 0.22, 0.2), kitMats.darkTrim(), 0, p.clearance + 0.3, z);
    if (style === 'tank') {
      addMesh(g, boxGeo(0.18, 0.12, 0.22), kitMats.darkTrim(), 0.55, p.clearance + 0.42, z + 0.04);
      addMesh(g, boxGeo(0.18, 0.12, 0.22), kitMats.darkTrim(), -0.55, p.clearance + 0.42, z + 0.04);
    }
  } else if (style === 'changan' || style === 'unik') {
    addMesh(g, boxGeo(p.width * 0.55, 0.28, 0.08), kitMats.darkTrim(), 0, y + 0.02, z);
    lamp(g, lights.head, 0.62, y + 0.18, z, style === 'unik' ? 0.58 : 0.42, 0.08, 0.07);
    addMesh(g, boxGeo(p.width * 0.8, 0.05, 0.05), lights.head, 0, y + 0.28, z);
  } else if (style === 'geely-sport' || style === 'mg-sport') {
    addMesh(g, boxGeo(p.width * 0.48, 0.22, 0.08), kitMats.darkTrim(), 0, y, z);
    lamp(g, lights.head, 0.58, y + 0.1, z, 0.4, 0.1, 0.07);
    addMesh(g, boxGeo(p.width * 0.7, 0.04, 0.05), kitMats.chrome(), 0, y - 0.16, z);
  } else if (style === 'geely-family' || style === 'toyota-suv') {
    addMesh(g, boxGeo(p.width * 0.6, 0.36, 0.08), kitMats.darkTrim(), 0, y + 0.06, z);
    addMesh(g, boxGeo(p.width * 0.52, 0.05, 0.05), kitMats.chrome(), 0, y + 0.22, z + 0.02);
    lamp(g, lights.head, 0.64, y + 0.12, z, 0.36, 0.12, 0.07);
  } else if (style === 'toyota-van' || style === 'truck') {
    addMesh(g, boxGeo(p.width * 0.7, 0.55, 0.1), kitMats.darkTrim(), 0, y + 0.25, z);
    lamp(g, lights.head, 0.7, y + 0.05, z, 0.28, 0.16, 0.08);
    addMesh(g, boxGeo(p.width * 0.5, 0.22, 0.08), paint, 0, y + 0.55, z);
  } else if (style === 'yango') {
    addMesh(g, boxGeo(p.width * 0.5, 0.22, 0.08), carPaint(0xe30613, { street: true }), 0, y, z);
    lamp(g, lights.head, 0.52, y + 0.08, z, 0.36, 0.12, 0.07);
  } else if (style === 'taxi') {
    addMesh(g, boxGeo(p.width * 0.5, 0.2, 0.08), kitMats.darkTrim(), 0, y, z);
    lamp(g, lights.head, 0.52, y + 0.08, z, 0.34, 0.12, 0.07);
  } else {
    addMesh(g, boxGeo(p.width * 0.48, 0.22, 0.08), kitMats.darkTrim(), 0, y, z);
    lamp(g, lights.head, 0.54, y + 0.08, z, 0.34, 0.11, 0.07);
  }
  lamp(g, lights.indicator, p.width * 0.42, y - 0.08, z, 0.12, 0.06, 0.05);
}

function addRear(g: THREE.Group, p: VehicleProfile, lights: LightSet, _paint: THREE.Material): void {
  const z = -p.length * 0.5 + 0.04;
  const y = p.clearance + 0.58;
  if (p.front === 'mercedes') {
    lamp(g, lights.brake, 0.62, y + 0.08, z, 0.5, 0.08, 0.06);
    addMesh(g, boxGeo(p.width * 0.7, 0.04, 0.05), kitMats.chrome(), 0, y - 0.12, z);
  } else if (p.kind === 'pickup' || p.kind === 'truck') {
    lamp(g, lights.brake, 0.7, y - 0.05, z, 0.28, 0.1, 0.06);
  } else if (p.kind === 'fastback') {
    lamp(g, lights.brake, 0.55, y + 0.18, z, 0.55, 0.08, 0.05);
  } else {
    lamp(g, lights.brake, 0.58, y + 0.06, z, 0.36, 0.12, 0.06);
  }
  addMesh(g, boxGeo(0.16, 0.08, 0.05), lights.reverse, 0.18, y - 0.12, z, { cast: false });
  addMesh(g, boxGeo(0.16, 0.08, 0.05), lights.reverse, -0.18, y - 0.12, z, { cast: false });
  lamp(g, lights.indicator, p.width * 0.4, y - 0.1, z, 0.1, 0.06, 0.05);
}

function lamp(
  g: THREE.Group,
  mat: THREE.Material,
  spread: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
): void {
  addMesh(g, boxGeo(w, h, d), mat, -spread, y, z, { cast: false });
  addMesh(g, boxGeo(w, h, d), mat, spread, y, z, { cast: false });
}

function addRoofRails(g: THREE.Group, p: VehicleProfile): void {
  const y = p.clearance + 0.7 + p.roofH + 0.12;
  addMesh(g, boxGeo(0.05, 0.04, p.cabinL * 0.85), kitMats.darkTrim(), 0.42, y, p.cabinZ);
  addMesh(g, boxGeo(0.05, 0.04, p.cabinL * 0.85), kitMats.darkTrim(), -0.42, y, p.cabinZ);
}

function addSpare(g: THREE.Group, p: VehicleProfile): void {
  const spare = new THREE.Mesh(cylGeo(p.wheelR * 0.95, 0.16, 12), kitMats.rubber());
  spare.rotation.x = Math.PI / 2;
  spare.position.set(0, p.clearance + 0.85, -p.length * 0.5 - 0.08);
  spare.castShadow = true;
  g.add(spare);
}

function addSlidingDoor(g: THREE.Group, p: VehicleProfile, paint: THREE.Material): void {
  addMesh(
    g,
    boxGeo(0.05, p.roofH * 0.85, p.cabinL * 0.42),
    paint,
    p.width * 0.49,
    p.clearance + 0.95,
    p.cabinZ - 0.15,
  );
  addMesh(
    g,
    boxGeo(0.04, 0.06, p.cabinL * 0.38),
    kitMats.chrome(),
    p.width * 0.52,
    p.clearance + 1.15,
    p.cabinZ - 0.15,
  );
}

function addYangoMarks(g: THREE.Group, p: VehicleProfile): void {
  const red = carPaint(0xe30613, { street: true });
  addMesh(g, boxGeo(0.28, 0.48, p.length * 0.94), red, 0, p.clearance + 0.55, 0);
  addMesh(g, boxGeo(0.5, 0.16, 0.7), red, 0, p.clearance + 1.55, p.cabinZ);
}

function addTaxiMarks(g: THREE.Group, p: VehicleProfile): void {
  addMesh(g, boxGeo(p.width, 0.06, p.length * 0.96), kitMats.darkTrim(), 0, p.clearance + 0.28, 0);
  addMesh(g, boxGeo(0.55, 0.18, 0.28), carPaint(0xffeb3b, { street: true }), 0, p.clearance + 1.55, p.cabinZ);
  addDoorQr(g, p.width * 0.51, p.clearance + 0.85, p.cabinZ + 0.15);
  addDoorQr(g, -p.width * 0.51, p.clearance + 0.85, p.cabinZ + 0.15);
}
