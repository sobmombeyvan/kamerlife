import type * as THREE from 'three';
import type { CollisionSystem } from '../world/CollisionSystem';
import { buildMfoundiMallExterior } from './MfoundiMallExterior';
import { buildSantaLuciaExterior } from './SantaLuciaExterior';
import { buildNsimalenAirportExterior } from './NsimalenAirportExterior';
import { buildTravelPointCentreExterior } from './TravelPointExterior';
import { buildPalaisEtoudiExterior } from './PalaisEtoudiExterior';
import { buildAgenceVoyageMvan } from './AgenceVoyageMvan';
import { buildDistrictAnchors } from './DistrictAnchors';
import { buildAllDistrictHubs } from './DistrictHubs';
import { buildPlayerHouse } from './PlayerHouse';
import { buildHopitalCentralExterior } from './HopitalCentralExterior';
import { buildEgliseCathedraleExterior } from './EgliseCathedraleExterior';
import { buildMosqueeExterieur } from './MosqueeExterieur';
import { buildAvenueKennedyPhoneStrip } from './AvenueKennedyPhoneStrip';
import { LANDMARK_FOOTPRINTS } from './LandmarkSites';

/** Builds Phase 1 major landmark exteriors. Returns sidewalk spawn anchors. */
export function buildMajorLandmarks(
  root: THREE.Group,
  collisions: CollisionSystem,
): Array<{ x: number; z: number; landmarkId: string }> {
  root.add(buildPlayerHouse(collisions));
  root.add(buildMfoundiMallExterior(collisions));
  root.add(buildSantaLuciaExterior(collisions));
  root.add(buildNsimalenAirportExterior(collisions));
  root.add(buildTravelPointCentreExterior(collisions));
  root.add(buildPalaisEtoudiExterior(collisions));
  root.add(buildAgenceVoyageMvan(collisions));
  root.add(buildHopitalCentralExterior(collisions));
  root.add(buildEgliseCathedraleExterior(collisions));
  root.add(buildMosqueeExterieur(collisions));
  root.add(buildAvenueKennedyPhoneStrip(collisions));
  buildDistrictAnchors(root, collisions);
  buildAllDistrictHubs(root, collisions);

  const anchors: Array<{ x: number; z: number; landmarkId: string }> = [];
  for (const f of LANDMARK_FOOTPRINTS) {
    // Sidewalk rings around plaza edges for pedestrians
    const edge = [
      { x: f.x - f.halfW + 4, z: f.z - f.halfD + 2 },
      { x: f.x + f.halfW - 4, z: f.z - f.halfD + 2 },
      { x: f.x - f.halfW + 4, z: f.z + f.halfD - 2 },
      { x: f.x + f.halfW - 4, z: f.z + f.halfD - 2 },
      { x: f.x, z: f.z - f.halfD + 3 },
      { x: f.x, z: f.z + f.halfD - 3 },
    ];
    for (const p of edge) anchors.push({ ...p, landmarkId: f.id });
  }
  return anchors;
}

export const SPECIAL_POI_IDS = new Set([
  'player-house',
  'mfoundi-mall',
  'santa-lucia',
  'nsimalen-airport',
  'travelpoint-centre',
  'etoudi-palais',
  'palais-etoudi',
  'agence-voyage-mvan',
  'universite-ngoa-ekelle',
  'uy1-ngoa',
  'marche-mokolo',
  'habitations-essos',
  'habitations-mendong',
  'palais-odza',
  'biyem-assi-cite-ecole',
  'hopital-central',
  'eglise-cathedrale',
  'mosquee-centrale',
  'avenue-kennedy-phones',
  'avenue-kennedy-phones-n',
]);
