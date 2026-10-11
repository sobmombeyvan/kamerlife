import * as THREE from 'three';
import { mat } from '../world/materials';
import type { CollisionSystem } from '../world/CollisionSystem';
import { createBuilding } from '../buildings/BuildingFactory';
import { addLampPost, addTextSign } from './signage';
import { overlapsRoad } from '../world/RoadClearance';

type PhoneShop = {
  id: string;
  name: string;
  subtitle: string;
  x: number;
  z: number;
  color: number;
  signBg: number;
  signFg: number;
};

/** Boutiques téléphones le long d’Avenue Kennedy (Yaoundé). */
// Positions stay inside cell interiors (off road axes at 0 / 72 / 144 / 216).
const SHOPS: PhoneShop[] = [
  { id: 'ak-mtn', name: 'MTN Mobile Shop', subtitle: 'Forfaits · Smartphones', x: 30, z: 198, color: 0xffcc00, signBg: 0xffcc00, signFg: 0x1a1a1a },
  { id: 'ak-orange', name: 'Orange Boutique', subtitle: 'Téléphones · MoMo', x: 48, z: 198, color: 0xff6600, signBg: 0xff6600, signFg: 0xffffff },
  { id: 'ak-tecno', name: 'Tecno Store', subtitle: 'Spark · Camon', x: 96, z: 198, color: 0x00a3e0, signBg: 0x0d47a1, signFg: 0xffffff },
  { id: 'ak-infinix', name: 'Infinix Corner', subtitle: 'Hot · Note', x: 112, z: 198, color: 0x000000, signBg: 0x111111, signFg: 0x00e676 },
  { id: 'ak-samsung', name: 'Samsung Partner', subtitle: 'Galaxy · Accessoires', x: 128, z: 198, color: 0x1565c0, signBg: 0x0d47a1, signFg: 0xffffff },
  { id: 'ak-iphone', name: 'iBox Kennedy', subtitle: 'iPhone · reconditionné', x: 160, z: 198, color: 0x37474f, signBg: 0x212121, signFg: 0xe0e0e0 },
  { id: 'ak-access', name: 'Accessoires 237', subtitle: 'Coques · Chargeurs', x: 176, z: 198, color: 0x6a1b9a, signBg: 0x4a148c, signFg: 0xffc857 },
  // Opposite sidewalk
  { id: 'ak-camtel', name: 'Camtel Point', subtitle: 'Fibre · 4G · Tél', x: 36, z: 234, color: 0x00695c, signBg: 0x004d40, signFg: 0xffffff },
  { id: 'ak-nexttel', name: 'YooMee / Next', subtitle: 'Data · Mobiles', x: 52, z: 234, color: 0xc62828, signBg: 0xb71c1c, signFg: 0xffffff },
  { id: 'ak-phone-city', name: 'Phone City', subtitle: 'Tous les modèles', x: 100, z: 234, color: 0x0277bd, signBg: 0x01579b, signFg: 0xffc857 },
  { id: 'ak-gsm', name: 'GSM Express', subtitle: 'Déblocage · Réparation', x: 118, z: 234, color: 0x455a64, signBg: 0x263238, signFg: 0x80cbc4 },
  { id: 'ak-mobile-plus', name: 'Mobile Plus', subtitle: 'Neuf & occasion', x: 168, z: 234, color: 0xe65100, signBg: 0xbf360c, signFg: 0xffffff },
];

/**
 * Commercial phone-shop strip on Avenue Kennedy.
 */
export function buildAvenueKennedyPhoneStrip(collisions: CollisionSystem): THREE.Group {
  const root = new THREE.Group();
  root.name = 'landmark-avenue-kennedy-phones';
  root.userData = {
    type: 'landmark',
    landmarkId: 'avenue-kennedy-phones',
    districtId: 'avenue-kennedy',
    phase: 1,
  };

  // Avenue sidewalk plaza
  const plazaS = new THREE.Mesh(new THREE.BoxGeometry(160, 0.06, 22), mat(0x8d8578));
  plazaS.position.set(100, 0.03, 198);
  plazaS.receiveShadow = true;
  root.add(plazaS);
  const plazaN = new THREE.Mesh(new THREE.BoxGeometry(150, 0.06, 20), mat(0x8d8578));
  plazaN.position.set(100, 0.03, 234);
  plazaN.receiveShadow = true;
  root.add(plazaN);

  addTextSign(root, 100, 5.5, 188, 22, 2.2, 'Avenue Kennedy', {
    subtitle: 'Boutiques téléphones',
    bg: 0x10251f,
    fg: 0xffc857,
  });

  for (const shop of SHOPS) {
    if (overlapsRoad(shop.x, shop.z, 5, 4)) continue;
    const faceSouth = shop.z < 216;
    root.add(
      createBuilding(
        {
          id: shop.id,
          name: shop.name,
          x: shop.x,
          z: shop.z,
          width: 12,
          depth: 9,
          height: 6.5 + (shop.id.length % 3),
          color: shop.color === 0xffcc00 || shop.color === 0xff6600 ? 0xf5f5f5 : shop.color,
          kind: 'shop',
          districtId: 'avenue-kennedy',
          yaw: faceSouth ? 0 : Math.PI,
          collide: true,
          detail: 'full',
        },
        collisions,
      ),
    );

    const signZ = faceSouth ? shop.z + 5.2 : shop.z - 5.2;
    addTextSign(root, shop.x, 4.6, signZ, 10.5, 1.5, shop.name, {
      subtitle: shop.subtitle,
      bg: shop.signBg,
      fg: shop.signFg,
      yaw: faceSouth ? 0 : Math.PI,
    });

    // Phone display window glow
    const window = new THREE.Mesh(
      new THREE.BoxGeometry(6, 2.2, 0.15),
      new THREE.MeshStandardMaterial({
        color: 0x81d4fa,
        emissive: 0x2288cc,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.55,
      }),
    );
    window.position.set(shop.x, 2.4, signZ);
    root.add(window);

    // Small phone pedestal props
    for (let i = 0; i < 3; i++) {
      const phone = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.7, 0.08), mat(0x212121));
      phone.position.set(shop.x - 1.2 + i * 1.2, 1.15, signZ + (faceSouth ? -0.4 : 0.4));
      root.add(phone);
    }
  }

  addLampPost(root, 30, 198);
  addLampPost(root, 150, 198);
  addLampPost(root, 40, 234);
  addLampPost(root, 140, 234);

  return root;
}

export const AVENUE_KENNEDY_PHONE_SPOTS = SHOPS.map((s) => ({
  id: s.id,
  name: s.name,
  x: s.x,
  z: s.z + (s.z < 216 ? 6 : -6),
}));
