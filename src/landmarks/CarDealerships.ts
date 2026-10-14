import * as THREE from 'three';
import type { CollisionSystem } from '../world/CollisionSystem';
import { createCatalogVehicle } from '../vehicles/buildVehicle';
import {
  ABN_COMMERCIAL,
  ABN_PASSENGER,
  ALPHA_STOCK,
  CAMI_STOCK,
  MERCEDES_STOCK,
  profileOf,
  type DealerStock,
} from '../vehicles/catalog';
import { addLampPost, addTextSign } from './signage';
import { addWalkableShell, kitBox } from './interiorKit';
import { createNpcAvatar } from '../pedestrians/NpcAvatar';
import { mat } from '../world/materials';

export type SaleInfo = DealerStock & { label: string };

export type DealerDef = {
  id: string;
  name: string;
  subtitle: string;
  x: number;
  z: number;
  color: number;
  accent: number;
  inventory: DealerStock[];
  commercial?: DealerStock[];
  luxury?: boolean;
};

export const DEALERSHIPS: DealerDef[] = [
  {
    id: 'cami',
    name: 'Cami Auto',
    subtitle: 'Toyota · Yaoundé',
    x: 180,
    z: 108,
    color: 0xc62828,
    accent: 0xffe082,
    inventory: CAMI_STOCK,
  },
  {
    id: 'alpha-motors',
    name: 'Alpha Motors',
    subtitle: 'Changan · Haval · GWM · MG',
    x: 252,
    z: 324,
    color: 0x1565c0,
    accent: 0xffc107,
    inventory: ALPHA_STOCK,
  },
  {
    id: 'mercedes',
    name: 'Mercedes-Benz',
    subtitle: 'Classe S · 4MATIC',
    x: 468,
    z: 324,
    color: 0x212121,
    accent: 0xcfd8dc,
    inventory: MERCEDES_STOCK,
    luxury: true,
  },
  {
    id: 'abn',
    name: 'ABN Motors',
    subtitle: 'Geely · utilitaires',
    x: 396,
    z: 36,
    color: 0x0d47a1,
    accent: 0xffc857,
    inventory: ABN_PASSENGER,
    commercial: ABN_COMMERCIAL,
  },
];

export function buildAllDealerships(collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'landmark-dealerships';
  for (const d of DEALERSHIPS) root.add(buildDealership(d, collisions));
  return root;
}

function buildDealership(d: DealerDef, collisions: CollisionSystem): THREE.Group {
  if (d.luxury) return buildMercedesShowroom(d, collisions);
  const root = new THREE.Group();
  root.name = `landmark-${d.id}`;
  root.userData = { type: 'landmark', landmarkId: d.id };
  const { x: cx, z: cz } = d;

  kitBox(root, cx, 0.04, cz + 6, 78, 0.08, 58, 0x3a3f42);
  addWalkableShell(root, collisions, {
    id: d.id,
    cx,
    cz: cz - 8,
    halfW: 14,
    halfD: 10,
    wallH: 4.4,
    roofY: 6.6,
    doorHalfW: 2.8,
    doorFace: 1,
    wall: 0xf5f5f5,
    floor: 0xcfd8dc,
    roof: d.color,
  });
  kitBox(root, cx, 5.4, cz - 8, 30, 0.9, 0.28, d.color);
  addTextSign(root, cx, 7.4, cz + 2.2, 16, 1.7, d.name, {
    subtitle: d.subtitle,
    bg: d.color,
    fg: d.accent,
  });

  placeLot(root, d.id, d.inventory, cx, cz + 14, 5.4, 2);
  if (d.commercial) {
    addTextSign(root, cx + 28, 3.2, cz + 8, 8, 1.1, 'Utilitaires', {
      subtitle: 'zone commerciale',
      bg: 0x37474f,
      fg: 0xffc857,
    });
    kitBox(root, cx + 28, 0.06, cz + 16, 22, 0.08, 16, 0x455a64);
    placeLot(root, d.id, d.commercial, cx + 28, cz + 16, 6.4, 1);
  }

  const vendor = createNpcAvatar(6000 + d.x, 'business');
  vendor.position.set(cx + 6, 0, cz + 2);
  vendor.rotation.y = Math.PI;
  root.add(vendor);

  addLampPost(root, cx - 22, cz + 22);
  addLampPost(root, cx + 22, cz + 22);
  return root;
}

function placeLot(
  root: THREE.Group,
  dealerId: string,
  stock: DealerStock[],
  cx: number,
  z0: number,
  stallW: number,
  rows: number,
): void {
  const perRow = Math.ceil(stock.length / rows);
  const lotW = perRow * stallW;
  stock.forEach((offer, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const px = cx - lotW / 2 + stallW * (col + 0.5);
    const pz = z0 + row * 8.2;
    const car = createCatalogVehicle(offer.vehicleId, 80 + i * 11 + offer.sku.length, 'full');
    const spec = profileOf(offer.vehicleId);
    car.position.set(px, 0, pz);
    car.rotation.y = Math.PI;
    car.userData.driveable = false;
    car.userData.forSale = true;
    car.userData.owned = false;
    car.userData.sku = offer.sku;
    car.userData.saleLabel = spec.label;
    car.userData.salePrice = offer.price;
    car.userData.dealerId = dealerId;
    car.userData.parkedCar = true;
    root.add(car);
  });
}

function buildMercedesShowroom(d: DealerDef, collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = `landmark-${d.id}`;
  root.userData = { type: 'landmark', landmarkId: d.id };
  const { x: cx, z: cz } = d;
  const halfW = 16;
  const halfD = 14;

  kitBox(root, cx, 0.04, cz, 48, 0.08, 42, 0x37474f);
  const marble = mat(0xeceff1, 0.28, 0.12);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 - 0.4, 0.08, halfD * 2 - 0.4), marble);
  floor.position.set(cx, 0.06, cz);
  floor.receiveShadow = true;
  root.add(floor);

  const glass = new THREE.MeshStandardMaterial({
    color: 0xcfd8dc,
    roughness: 0.06,
    metalness: 0.12,
    transparent: true,
    opacity: 0.22,
    envMapIntensity: 1.0,
    depthWrite: false,
  });
  const frame = mat(0x212121, 0.4, 0.4);
  const wallH = 5.2;
  const t = 0.08;
  const addGlassWall = (x: number, y: number, z: number, w: number, h: number, d: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glass);
    m.position.set(x, y, z);
    root.add(m);
    collisions.addBox(x, y, z, w / 2, h / 2, d / 2, 'merc-glass');
    const f = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, 0.08), 0.08, Math.max(d, 0.08)), frame);
    f.position.set(x, y + h / 2, z);
    root.add(f);
  };
  addGlassWall(cx, wallH / 2, cz - halfD, halfW * 2, wallH, t);
  addGlassWall(cx - halfW, wallH / 2, cz, t, wallH, halfD * 2);
  addGlassWall(cx + halfW, wallH / 2, cz, t, wallH, halfD * 2);
  addGlassWall(cx - 10, wallH / 2, cz + halfD, 12, wallH, t);
  addGlassWall(cx + 10, wallH / 2, cz + halfD, 12, wallH, t);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, 0.18, halfD * 2), mat(0xeceff1, 0.55, 0.08));
  roof.position.set(cx, 5.45, cz);
  roof.name = `${d.id}-roof`;
  roof.castShadow = true;
  root.add(roof);

  for (const ox of [-10, 0, 10]) {
    const lamp = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 1.4),
      new THREE.MeshStandardMaterial({
        color: 0xfff8e1,
        emissive: 0xfff3c4,
        emissiveIntensity: 1.15,
        roughness: 0.4,
      }),
    );
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(cx + ox, 5.28, cz);
    root.add(lamp);
  }

  addTextSign(root, cx, 6.6, cz + halfD + 0.4, 14, 1.4, d.name, {
    subtitle: d.subtitle,
    bg: 0x212121,
    fg: 0xcfd8dc,
  });

  d.inventory.forEach((offer, i) => {
    const px = cx + (i === 0 ? -6.5 : 6.5);
    const pz = cz + 1;
    kitBox(root, px, 0.05, pz, 7.2, 0.08, 9.2, 0xcfd8dc);
    const car = createCatalogVehicle(offer.vehicleId, 0, 'full');
    const spec = profileOf(offer.vehicleId);
    car.position.set(px, 0, pz);
    car.rotation.y = Math.PI;
    car.userData.driveable = false;
    car.userData.forSale = true;
    car.userData.owned = false;
    car.userData.sku = offer.sku;
    car.userData.saleLabel = spec.label;
    car.userData.salePrice = offer.price;
    car.userData.dealerId = d.id;
    car.userData.parkedCar = true;
    root.add(car);
  });

  const vendor = createNpcAvatar(6100, 'business');
  vendor.position.set(cx, 0, cz - 6);
  vendor.rotation.y = 0;
  root.add(vendor);
  addLampPost(root, cx - 20, cz + 16);
  addLampPost(root, cx + 20, cz + 16);
  return root;
}

export function nearestSaleCar(
  root: THREE.Object3D,
  x: number,
  z: number,
  maxDist = 5.2,
): THREE.Group | null {
  let best: THREE.Group | null = null;
  let bestD = maxDist;
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Group) || !obj.userData.forSale || obj.userData.owned) return;
    const d = Math.hypot(obj.position.x - x, obj.position.z - z);
    if (d < bestD) {
      bestD = d;
      best = obj;
    }
  });
  return best;
}
