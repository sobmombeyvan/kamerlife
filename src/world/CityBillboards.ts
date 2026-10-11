import * as THREE from 'three';
import { addTextSign } from '../landmarks/signage';
import { ROAD_GRID, HIGHWAY_HALF, SIDEWALK_FROM_CENTER_HIGHWAY } from '../roads/CityRoadPlan';
import { overlapsRoad } from './RoadClearance';
import { overlapsLandmarkFootprint } from '../landmarks/LandmarkSites';
import { WorldConfig } from '../config/WorldConfig';
import { mat } from './materials';

type Ad = { title: string; subtitle: string; bg: number; fg: number };

const ADS: Ad[] = [
  { title: 'MTN', subtitle: 'MoMo · Partout', bg: 0xffcc00, fg: 0x1a1a1a },
  { title: 'Orange', subtitle: 'Money · Yaoundé', bg: 0xff6600, fg: 0xffffff },
  { title: 'Guinness', subtitle: 'Made of Black', bg: 0x1a1a1a, fg: 0xd4af37 },
  { title: 'Castel', subtitle: 'Bière du Cameroun', bg: 0x0d47a1, fg: 0xffffff },
  { title: 'Brasseries', subtitle: '33 Export', bg: 0xb71c1c, fg: 0xffeb3b },
  { title: 'TotalEnergies', subtitle: 'Stations · YDE', bg: 0xe10600, fg: 0xffffff },
  { title: 'Canal+', subtitle: 'Live · Foot', bg: 0x000000, fg: 0x00a3e0 },
  { title: 'Jumia', subtitle: 'Livraison rapide', bg: 0xf68b1e, fg: 0xffffff },
  { title: 'Express Union', subtitle: 'Transfert d’argent', bg: 0x1565c0, fg: 0xffffff },
  { title: 'TravelPoint', subtitle: 'YDE → DLA', bg: 0x10251f, fg: 0xffc857 },
  { title: 'Santa Lucia', subtitle: 'Prix bas', bg: 0xffffff, fg: 0xc62828 },
  { title: 'LIFE CITY', subtitle: 'Yaoundé 237', bg: 0x1b5e20, fg: 0xffc857 },
  { title: 'Socatur', subtitle: 'Bus urbain', bg: 0x0d47a1, fg: 0xffc107 },
  { title: 'Camtel', subtitle: 'Fibre · 4G', bg: 0x00695c, fg: 0xffffff },
  { title: 'UBA', subtitle: 'Banque · FCFA', bg: 0xe65100, fg: 0xffffff },
];

/**
 * Roadside advertising boards across the city grid.
 * Each board is its own group (positioned) so distance cull works.
 */
export function buildCityBillboards(root: THREE.Group): number {
  let count = 0;
  const half = Math.min(960, WorldConfig.worldHalfSize - 80);
  const walk = SIDEWALK_FROM_CENTER_HIGHWAY + 1.5;

  for (let z = -half; z <= half; z += ROAD_GRID * 2) {
    if (Math.abs(z) < 50) continue;
    for (const side of [-1, 1] as const) {
      const x = side * (HIGHWAY_HALF + 6);
      if (placeBoard(root, x, z, side > 0 ? -Math.PI / 2 : Math.PI / 2, count)) count += 1;
    }
  }
  for (let x = -half; x <= half; x += ROAD_GRID * 2) {
    if (Math.abs(x) < 50) continue;
    for (const side of [-1, 1] as const) {
      const z = side * (HIGHWAY_HALF + 6);
      if (placeBoard(root, x, z, side > 0 ? Math.PI : 0, count)) count += 1;
    }
  }

  for (let gx = -half; gx <= half; gx += ROAD_GRID * 2) {
    for (let gz = -half; gz <= half; gz += ROAD_GRID * 2) {
      if (Math.abs(gx) < 40 && Math.abs(gz) < 40) continue;
      const x = gx + walk * 0.55;
      const z = gz + walk * 0.55;
      if (placeBoard(root, x, z, Math.PI / 4, count, true)) count += 1;
    }
  }

  return count;
}

function placeBoard(
  parent: THREE.Group,
  x: number,
  z: number,
  yaw: number,
  index: number,
  tall = false,
): boolean {
  if (overlapsRoad(x, z, 1.2, 1.2)) return false;
  if (overlapsLandmarkFootprint(x, z, 2.5, 2.5)) return false;

  const ad = ADS[index % ADS.length]!;
  const w = tall ? 7.5 : 5.5;
  const h = tall ? 4.2 : 2.8;
  const poleH = tall ? 3.2 : 2.4;

  const g = new THREE.Group();
  g.name = `billboard-${index}`;
  g.position.set(x, 0, z);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, poleH, 6), mat(0x37474f));
  pole.position.set(0, poleH / 2, 0);
  g.add(pole);

  addTextSign(g, 0, poleH + h / 2, 0, w, h, ad.title, {
    subtitle: ad.subtitle,
    bg: ad.bg,
    fg: ad.fg,
    yaw,
  });
  parent.add(g);
  return true;
}
