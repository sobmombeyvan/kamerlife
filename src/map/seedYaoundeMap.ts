import type { DistrictPoly, LandmarkDef, MapDocument, MapEdge, MapNode, ParkDef, RiverDef, RoadClass } from './types';
import { ROAD_WIDTH } from './types';
import { createSeedBusinessDatabase } from '../business/seedBusinesses';

/**
 * Seed map inspired by docs/reference-map.png (NOT geographically accurate).
 * Coordinate system: metres, origin at Centre-ville, +X east, +Z south.
 */
export function createSeedYaoundeMap(): MapDocument {
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const nid = (id: string, x: number, z: number, kind: MapNode['kind'] = 'junction', name?: string) => {
    nodes.push({ id, x, z, kind, name });
    return id;
  };
  const eid = (id: string, from: string, to: string, roadClass: RoadClass, name?: string) => {
    edges.push({ id, from, to, roadClass, width: ROAD_WIDTH[roadClass], name });
  };

  // --- Ring A (inner) around Centre-ville ---
  const ringA = [
    nid('ra_n', 0, -900, 'roundabout', 'Rond-point Nord'),
    nid('ra_ne', 700, -650, 'roundabout'),
    nid('ra_e', 950, 0, 'roundabout', 'Rond-point Est'),
    nid('ra_se', 700, 650, 'roundabout'),
    nid('ra_s', 0, 900, 'roundabout', 'Rond-point Sud'),
    nid('ra_sw', -700, 650, 'roundabout'),
    nid('ra_w', -950, 0, 'roundabout', 'Rond-point Ouest'),
    nid('ra_nw', -700, -650, 'roundabout'),
  ];
  linkLoop(ringA, 'primary', 'Anneau intérieur', eid);

  // Centre hub
  const hub = nid('hub', 0, 0, 'roundabout', 'Centre-ville');
  for (const id of ringA) eid(`spoke_${id}`, hub, id, 'primary');

  // --- Ring B (mid) ---
  const ringB = [
    nid('rb_n', 0, -2200, 'roundabout'),
    nid('rb_ne', 1700, -1600, 'roundabout'),
    nid('rb_e', 2400, 0, 'roundabout'),
    nid('rb_se', 1700, 1600, 'roundabout'),
    nid('rb_s', 0, 2300, 'roundabout'),
    nid('rb_sw', -1700, 1600, 'roundabout'),
    nid('rb_w', -2400, 0, 'roundabout'),
    nid('rb_nw', -1700, -1600, 'roundabout'),
  ];
  linkLoop(ringB, 'primary', 'Anneau médian', eid);
  // Connect rings A→B
  const pairsAB: Array<[string, string]> = [
    ['ra_n', 'rb_n'],
    ['ra_ne', 'rb_ne'],
    ['ra_e', 'rb_e'],
    ['ra_se', 'rb_se'],
    ['ra_s', 'rb_s'],
    ['ra_sw', 'rb_sw'],
    ['ra_w', 'rb_w'],
    ['ra_nw', 'rb_nw'],
  ];
  for (const [a, b] of pairsAB) eid(`ab_${a}_${b}`, a, b, 'primary');

  // --- Outer highway (partial ring + exits) ---
  const ringC = [
    nid('rc_n', 200, -4200, 'roundabout', 'Échangeur Nord'),
    nid('rc_ne', 3200, -3000, 'roundabout'),
    nid('rc_e', 4800, 200, 'roundabout', 'Vers Soa'),
    nid('rc_se', 3600, 3200, 'roundabout'),
    nid('rc_s', 200, 4500, 'roundabout', 'Vers Mbalmayo'),
    nid('rc_sw', -3200, 3200, 'roundabout'),
    nid('rc_w', -5000, 200, 'roundabout', 'Vers Douala'),
    nid('rc_nw', -3200, -3000, 'roundabout', 'Vers Bafoussam'),
  ];
  linkLoop(ringC, 'highway', 'Périphérique', eid);
  const pairsBC: Array<[string, string]> = [
    ['rb_n', 'rc_n'],
    ['rb_ne', 'rc_ne'],
    ['rb_e', 'rc_e'],
    ['rb_se', 'rc_se'],
    ['rb_s', 'rc_s'],
    ['rb_sw', 'rc_sw'],
    ['rb_w', 'rc_w'],
    ['rb_nw', 'rc_nw'],
  ];
  for (const [a, b] of pairsBC) eid(`bc_${a}_${b}`, a, b, 'highway');

  // District hubs (connected into the network)
  const bastos = nid('d_bastos', 200, -2800, 'roundabout', 'Bastos');
  eid('e_bastos_rb', bastos, 'rb_n', 'primary');
  eid('e_bastos_rc', bastos, 'rc_n', 'secondary');

  const etoudi = nid('d_etoudi', 1600, -3600, 'roundabout', 'Etoudi');
  eid('e_etoudi_rc', etoudi, 'rc_ne', 'primary');
  eid('e_etoudi_bastos', etoudi, bastos, 'secondary');

  const mendong = nid('d_mendong', -400, -4600, 'junction', 'Mendong');
  eid('e_mendong_rc', mendong, 'rc_n', 'primary');

  const mokolo = nid('d_mokolo', -600, -400, 'roundabout', 'Mokolo');
  eid('e_mokolo_hub', mokolo, hub, 'primary');
  eid('e_mokolo_raw', mokolo, 'ra_w', 'secondary');
  eid('e_mokolo_ras', mokolo, 'ra_sw', 'local');

  const biye = nid('d_biyemassi', -3200, 400, 'roundabout', 'Biyem-Assi');
  eid('e_biye_rb', biye, 'rb_w', 'primary');
  eid('e_biye_rc', biye, 'rc_w', 'secondary');

  const mvan = nid('d_mvan', -2400, -2200, 'roundabout', 'Mvan');
  eid('e_mvan_rb', mvan, 'rb_nw', 'primary');
  eid('e_mvan_rc', mvan, 'rc_nw', 'secondary');
  eid('e_mvan_biye', mvan, biye, 'secondary');

  const essos = nid('d_essos', 3400, 600, 'roundabout', 'Essos');
  eid('e_essos_rb', essos, 'rb_e', 'primary');
  eid('e_essos_rc', essos, 'rc_e', 'secondary');

  const nlong = nid('d_nlongkak', 2200, -400, 'roundabout', 'Nlongkak');
  eid('e_nlong_rae', nlong, 'ra_e', 'primary');
  eid('e_nlong_essos', nlong, essos, 'secondary');
  eid('e_nlong_rb', nlong, 'rb_e', 'local');

  const ngousso = nid('d_ngousso', 3000, 2400, 'roundabout', 'Ngousso');
  eid('e_ngousso_rb', ngousso, 'rb_se', 'primary');
  eid('e_ngousso_rc', ngousso, 'rc_se', 'secondary');
  eid('e_ngousso_essos', ngousso, essos, 'secondary');

  const odza = nid('d_odza', 3800, -2800, 'roundabout', 'Odza');
  eid('e_odza_rc', odza, 'rc_ne', 'primary');
  eid('e_odza_essos', odza, essos, 'secondary');

  const ngoa = nid('d_ngoa', 2000, 800, 'roundabout', 'Ngoa-Ekellé');
  eid('e_ngoa_rase', ngoa, 'ra_se', 'primary');
  eid('e_ngoa_nlong', ngoa, nlong, 'secondary');
  eid('e_ngoa_ngousso', ngoa, ngousso, 'local');

  const mvogada = nid('d_mvogada', 260, -280, 'roundabout', 'Mvog-Ada');
  eid('e_mvogada_ras', mvogada, 'ra_s', 'primary');
  eid('e_mvogada_rbs', mvogada, 'rb_s', 'secondary');

  const melen = nid('d_melen', -220, 360, 'roundabout', 'Melen');
  eid('e_melen_raw', melen, 'ra_w', 'primary');
  eid('e_melen_biye', melen, biye, 'secondary');

  const simbock = nid('d_simbock', -600, 700, 'roundabout', 'Simbock');
  eid('e_simbock_biye', simbock, biye, 'primary');
  eid('e_simbock_rc', simbock, 'rc_sw', 'secondary');

  const ekounou = nid('d_ekounou', 540, -320, 'roundabout', 'Ekounou');
  eid('e_ekounou_nlong', ekounou, nlong, 'primary');
  eid('e_ekounou_mvogada', ekounou, mvogada, 'secondary');

  const nsam = nid('d_nsam', 400, 180, 'roundabout', 'Nsam');
  eid('e_nsam_rae', nsam, 'ra_e', 'primary');
  eid('e_nsam_nlong', nsam, nlong, 'local');

  const emana = nid('d_emana', -160, -700, 'roundabout', 'Emana');
  eid('e_emana_ras', emana, 'ra_s', 'primary');
  eid('e_emana_rbs', emana, 'rb_s', 'secondary');

  const nkol = nid('d_nkolbisson', -680, 160, 'roundabout', 'Nkolbisson');
  eid('e_nkol_biye', nkol, biye, 'primary');
  eid('e_nkol_rc', nkol, 'rc_w', 'secondary');

  const awae = nid('d_awae', 820, 40, 'roundabout', 'Awaé');
  eid('e_awae_essos', awae, essos, 'primary');
  eid('e_awae_rc', awae, 'rc_e', 'secondary');

  // Local street grids (connected to district hubs)
  addLocalGrid(nodes, edges, 'cv', 0, 0, 3, 3, 280, 'ra_n', hub);
  addLocalGrid(nodes, edges, 'ba', 200, -2800, 2, 2, 320, bastos, bastos);
  addLocalGrid(nodes, edges, 'mk', -600, -400, 2, 2, 260, mokolo, mokolo);
  addLocalGrid(nodes, edges, 'by', -3200, 400, 3, 2, 300, biye, biye);
  addLocalGrid(nodes, edges, 'es', 3400, 600, 2, 2, 300, essos, essos);
  addLocalGrid(nodes, edges, 'nl', 2200, -400, 2, 2, 260, nlong, nlong);
  addLocalGrid(nodes, edges, 'ng', 2000, 800, 2, 2, 280, ngoa, ngoa);
  addLocalGrid(nodes, edges, 'od', 3800, -2800, 2, 2, 320, odza, odza);
  addLocalGrid(nodes, edges, 'et', 1600, -3600, 2, 1, 300, etoudi, etoudi);
  addLocalGrid(nodes, edges, 'md', -400, -4600, 2, 2, 300, mendong, mendong);
  addLocalGrid(nodes, edges, 'mv', -2400, -2200, 2, 2, 300, mvan, mvan);
  addLocalGrid(nodes, edges, 'gs', 3000, 2400, 2, 2, 300, ngousso, ngousso);
  addLocalGrid(nodes, edges, 'ma', 260, -280, 2, 2, 240, mvogada, mvogada);
  addLocalGrid(nodes, edges, 'me', -220, 360, 2, 2, 240, melen, melen);
  addLocalGrid(nodes, edges, 'si', -600, 700, 2, 2, 260, simbock, simbock);
  addLocalGrid(nodes, edges, 'ek', 540, -320, 2, 2, 240, ekounou, ekounou);
  addLocalGrid(nodes, edges, 'nm', 400, 180, 2, 2, 220, nsam, nsam);
  addLocalGrid(nodes, edges, 'em', -160, -700, 2, 2, 240, emana, emana);
  addLocalGrid(nodes, edges, 'nk', -680, 160, 2, 2, 240, nkol, nkol);
  addLocalGrid(nodes, edges, 'aw', 820, 40, 2, 2, 240, awae, awae);

  const bizDb = createSeedBusinessDatabase();
  const now = new Date().toISOString();
  return {
    version: 1,
    name: 'LIFE CITY Yaoundé — Carte 2D Phase 1',
    units: 'meters',
    reference: {
      imageUrl: '/maps/reference-map.png',
      worldWidth: 14000,
      worldHeight: 11000,
      opacity: 0.35,
      note: 'Inspiration visuelle uniquement — pas de précision GPS.',
    },
    nodes,
    edges,
    districts: createDistricts(),
    landmarks: createLandmarks(),
    parks: createParks(),
    rivers: createRivers(),
    buildings: createBuildingStubs(),
    businesses: bizDb.businesses,
    meta: {
      createdAt: now,
      updatedAt: now,
      source: 'docs/reference-map.png + businesses seed (Phase 1)',
    },
  };
}

function linkLoop(
  ids: string[],
  roadClass: RoadClass,
  name: string,
  eid: (id: string, from: string, to: string, roadClass: RoadClass, name?: string) => void,
): void {
  for (let i = 0; i < ids.length; i++) {
    const a = ids[i]!;
    const b = ids[(i + 1) % ids.length]!;
    eid(`loop_${name}_${i}`, a, b, roadClass, name);
  }
}

function addLocalGrid(
  nodes: MapNode[],
  edges: MapEdge[],
  prefix: string,
  cx: number,
  cz: number,
  cols: number,
  rows: number,
  spacing: number,
  attachA: string,
  attachB: string,
): void {
  const grid: string[][] = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      const id = `${prefix}_g_${r}_${c}`;
      const x = cx + (c - (cols - 1) / 2) * spacing;
      const z = cz + (r - (rows - 1) / 2) * spacing;
      nodes.push({ id, x, z, kind: 'junction' });
      grid[r]![c] = id;
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = grid[r]![c]!;
      if (c + 1 < cols) {
        edges.push({
          id: `${prefix}_h_${r}_${c}`,
          from: id,
          to: grid[r]![c + 1]!,
          roadClass: 'local',
          width: ROAD_WIDTH.local,
        });
      }
      if (r + 1 < rows) {
        edges.push({
          id: `${prefix}_v_${r}_${c}`,
          from: id,
          to: grid[r + 1]![c]!,
          roadClass: 'local',
          width: ROAD_WIDTH.local,
        });
      }
    }
  }
  const mid = grid[Math.floor(rows / 2)]![Math.floor(cols / 2)]!;
  edges.push({
    id: `${prefix}_attach_a`,
    from: mid,
    to: attachA,
    roadClass: 'secondary',
    width: ROAD_WIDTH.secondary,
  });
  if (attachB !== attachA) {
    edges.push({
      id: `${prefix}_attach_b`,
      from: mid,
      to: attachB,
      roadClass: 'local',
      width: ROAD_WIDTH.local,
    });
  }
}

function poly(cx: number, cz: number, rx: number, rz: number): Array<{ x: number; z: number }> {
  return [
    { x: cx - rx, z: cz - rz },
    { x: cx + rx, z: cz - rz },
    { x: cx + rx, z: cz + rz },
    { x: cx - rx, z: cz + rz },
  ];
}

/** The 20 playable districts from the Phase 1 brief. */
function createDistricts(): DistrictPoly[] {
  return [
    { id: 'centre-ville', name: 'Centre-ville', polygon: poly(0, 0, 1100, 1100), color: '#5c6bc0', zone: 'center' },
    { id: 'bastos', name: 'Bastos', polygon: poly(200, -2800, 1200, 1000), color: '#8e24aa', zone: 'commercial' },
    { id: 'mokolo', name: 'Mokolo', polygon: poly(-600, -400, 900, 800), color: '#00897b', zone: 'mixed' },
    { id: 'mendong', name: 'Mendong', polygon: poly(-400, -4600, 1300, 1000), color: '#ef6c00', zone: 'residential' },
    { id: 'biyem-assi', name: 'Biyem-Assi', polygon: poly(-3200, 400, 1400, 1200), color: '#fb8c00', zone: 'residential' },
    { id: 'mvan', name: 'Mvan', polygon: poly(-2400, -2200, 1100, 1000), color: '#5e35b1', zone: 'mixed' },
    { id: 'essos', name: 'Essos', polygon: poly(3400, 600, 1200, 1100), color: '#039be5', zone: 'residential' },
    { id: 'nlongkak', name: 'Nlongkak', polygon: poly(2200, -400, 900, 800), color: '#ec407a', zone: 'mixed' },
    { id: 'ngousso', name: 'Ngousso', polygon: poly(3000, 2400, 1100, 1000), color: '#7cb342', zone: 'residential' },
    { id: 'etoudi', name: 'Etoudi', polygon: poly(1600, -3600, 1100, 900), color: '#43a047', zone: 'government' },
    { id: 'ngoa-ekelle', name: 'Ngoa-Ekellé', polygon: poly(2000, 800, 1000, 900), color: '#e53935', zone: 'campus' },
    { id: 'mvog-ada', name: 'Mvog-Ada', polygon: poly(260, -280, 900, 800), color: '#8d6e63', zone: 'mixed' },
    { id: 'melen', name: 'Melen', polygon: poly(-220, 360, 900, 800), color: '#26a69a', zone: 'residential' },
    { id: 'simbock', name: 'Simbock', polygon: poly(-600, 700, 1000, 900), color: '#7cb342', zone: 'periurban' },
    { id: 'odza', name: 'Odza', polygon: poly(3800, -2800, 1200, 1100), color: '#ff7043', zone: 'periurban' },
    { id: 'ekounou', name: 'Ekounou', polygon: poly(540, -320, 900, 800), color: '#42a5f5', zone: 'residential' },
    { id: 'nsam', name: 'Nsam', polygon: poly(400, 180, 800, 700), color: '#78909c', zone: 'mixed' },
    { id: 'emana', name: 'Emana', polygon: poly(-160, -700, 900, 800), color: '#ab47bc', zone: 'residential' },
    { id: 'nkolbisson', name: 'Nkolbisson', polygon: poly(-680, 160, 1000, 900), color: '#66bb6a', zone: 'periurban' },
    { id: 'awae', name: 'Awaé', polygon: poly(820, 40, 900, 800), color: '#29b6f6', zone: 'residential' },
  ];
}

function createLandmarks(): LandmarkDef[] {
  return [
    { id: 'lm_poste', name: 'Poste centrale', x: 180, z: -120, category: 'landmark', districtId: 'centre-ville' },
    { id: 'lm_mfoundi', name: 'Mfoundi Mall', x: -108, z: 180, category: 'mall', districtId: 'centre-ville' },
    { id: 'lm_santa_lucia', name: 'Santa Lucia Grand Supermarket', x: 36, z: 36, category: 'shop', districtId: 'centre-ville' },
    { id: 'lm_travelpoint', name: 'TravelPoint Cameroon', x: -36, z: -36, category: 'travel', districtId: 'centre-ville' },
    { id: 'lm_marche', name: 'Marché central', x: -120, z: 280, category: 'market', districtId: 'centre-ville' },
    { id: 'lm_mokolo', name: 'Marché Mokolo', x: -700, z: -350, category: 'market', districtId: 'mokolo' },
    { id: 'lm_palais', name: "Palais de l'Unité", x: 1700, z: -3700, category: 'government', districtId: 'etoudi' },
    { id: 'lm_uy1', name: 'Université de Yaoundé I', x: 2100, z: 900, category: 'education', districtId: 'ngoa-ekelle' },
    { id: 'lm_febe', name: 'Mont Fébé', x: -800, z: -3200, category: 'park', districtId: 'bastos' },
    { id: 'lm_olembe', name: 'Olembe (Stade)', x: 4200, z: 3600, category: 'stadium' },
    {
      id: 'lm_airport',
      name: 'Aéroport International de Yaoundé-Nsimalen',
      x: 216,
      z: 1080,
      category: 'airport',
      districtId: 'centre-ville',
    },
  ];
}

function createParks(): ParkDef[] {
  return [
    { id: 'pk_febe', name: 'Forêt Mont Fébé', polygon: poly(-800, -3200, 900, 700) },
    { id: 'pk_centre', name: 'Jardin central', polygon: poly(0, 0, 220, 220) },
    { id: 'pk_bastos', name: 'Espaces verts Bastos', polygon: poly(600, -2600, 500, 400) },
  ];
}

function createRivers(): RiverDef[] {
  return [
    {
      id: 'rv_mfoundi',
      name: 'Cours d’eau (schéma)',
      width: 18,
      path: [
        { x: -4200, z: -1800 },
        { x: -2200, z: -400 },
        { x: -400, z: 200 },
        { x: 800, z: 900 },
        { x: 2400, z: 1800 },
        { x: 4000, z: 2600 },
      ],
    },
  ];
}

function createBuildingStubs(): Array<{ id: string; name: string; x: number; z: number; width: number; depth: number; districtId?: string }> {
  const stubs = [];
  const spots: Array<[string, number, number, string]> = [
    ['b_admin', 120, -80, 'centre-ville'],
    ['b_mall', -220, 160, 'centre-ville'],
    ['b_uy1', 2100, 900, 'ngoa-ekelle'],
    ['b_palais', 1700, -3700, 'etoudi'],
    ['b_marche_mokolo', -700, -350, 'mokolo'],
  ];
  for (const [id, x, z, districtId] of spots) {
    stubs.push({ id, name: id, x, z, width: 80, depth: 60, districtId });
  }
  return stubs;
}
