/**
 * Provisional district catalogue — LARGE dense open-world layout.
 * Positions are game-world placeholders (not verified GPS).
 */
export type DistrictDef = {
  id: string;
  name: string;
  center: { x: number; z: number };
  radius: number;
  geoStatus: 'provisional' | 'osm-pending' | 'verified';
  density: 'dense' | 'urban' | 'residential' | 'campus' | 'villa' | 'periurban';
  notes?: string;
};

/** Radii enlarged so districts overlap → less empty space between quartiers. */
export const DISTRICTS: DistrictDef[] = [
  { id: 'centre-ville', name: 'Centre-ville', center: { x: 0, z: 0 }, radius: 340, density: 'dense', geoStatus: 'provisional' },
  { id: 'poste-centrale', name: 'Poste centrale', center: { x: 160, z: -120 }, radius: 240, density: 'urban', geoStatus: 'provisional' },
  { id: 'avenue-kennedy', name: 'Avenue Kennedy', center: { x: 100, z: 216 }, radius: 260, density: 'urban', geoStatus: 'provisional' },
  { id: 'mfoundi', name: 'Mfoundi / Marché central', center: { x: -120, z: 120 }, radius: 260, density: 'dense', geoStatus: 'provisional' },
  { id: 'mokolo', name: 'Mokolo', center: { x: -420, z: -140 }, radius: 300, density: 'dense', geoStatus: 'provisional' },
  { id: 'briqueterie', name: 'Briqueterie', center: { x: -320, z: 160 }, radius: 270, density: 'dense', geoStatus: 'provisional' },
  { id: 'cite-verte', name: 'Cité Verte', center: { x: -280, z: -40 }, radius: 250, density: 'residential', geoStatus: 'provisional' },
  { id: 'melen', name: 'Melen', center: { x: -220, z: 360 }, radius: 280, density: 'residential', geoStatus: 'provisional' },
  { id: 'mendong', name: 'Mendong', center: { x: -520, z: 480 }, radius: 320, density: 'residential', geoStatus: 'provisional' },
  { id: 'biyem-assi', name: 'Biyem-Assi', center: { x: -380, z: 620 }, radius: 300, density: 'dense', geoStatus: 'provisional' },
  { id: 'simbock', name: 'Simbock', center: { x: -600, z: 700 }, radius: 280, density: 'periurban', geoStatus: 'provisional' },
  { id: 'nkolbisson', name: 'Nkolbisson', center: { x: -680, z: 160 }, radius: 280, density: 'periurban', geoStatus: 'provisional' },
  { id: 'bastos', name: 'Bastos', center: { x: 320, z: 300 }, radius: 300, density: 'villa', geoStatus: 'provisional' },
  { id: 'nlongkak', name: 'Nlongkak', center: { x: 240, z: 80 }, radius: 250, density: 'urban', geoStatus: 'provisional' },
  { id: 'nsam', name: 'Nsam', center: { x: 400, z: 180 }, radius: 250, density: 'residential', geoStatus: 'provisional' },
  { id: 'essos', name: 'Essos', center: { x: 460, z: -80 }, radius: 280, density: 'residential', geoStatus: 'provisional' },
  { id: 'ngousso', name: 'Ngousso', center: { x: 600, z: -160 }, radius: 270, density: 'residential', geoStatus: 'provisional' },
  { id: 'messassi', name: 'Messassi', center: { x: 700, z: 140 }, radius: 260, density: 'periurban', geoStatus: 'provisional' },
  { id: 'awae', name: 'Awaé', center: { x: 820, z: 40 }, radius: 260, density: 'periurban', geoStatus: 'provisional' },
  { id: 'obili', name: 'Obili', center: { x: -80, z: -240 }, radius: 250, density: 'residential', geoStatus: 'provisional' },
  { id: 'ngoa-ekelle', name: 'Ngoa-Ekellé', center: { x: -160, z: -380 }, radius: 320, density: 'campus', geoStatus: 'provisional' },
  { id: 'mvog-ada', name: 'Mvog-Ada', center: { x: 260, z: -280 }, radius: 270, density: 'urban', geoStatus: 'provisional' },
  { id: 'mvan', name: 'Mvan', center: { x: 380, z: -380 }, radius: 260, density: 'urban', geoStatus: 'provisional' },
  { id: 'ekounou', name: 'Ekounou', center: { x: 540, z: -320 }, radius: 280, density: 'residential', geoStatus: 'provisional' },
  { id: 'mimboman', name: 'Mimboman', center: { x: 760, z: -400 }, radius: 270, density: 'periurban', geoStatus: 'provisional' },
  { id: 'etoudi', name: "Etoudi / Palais de l'Unité", center: { x: 140, z: -620 }, radius: 320, density: 'villa', geoStatus: 'provisional' },
  { id: 'emana', name: 'Emana', center: { x: -160, z: -700 }, radius: 270, density: 'periurban', geoStatus: 'provisional' },
  { id: 'olembe', name: 'Olembe', center: { x: 60, z: -860 }, radius: 300, density: 'periurban', geoStatus: 'provisional' },
  { id: 'odza', name: 'Odza', center: { x: 620, z: 460 }, radius: 320, density: 'villa', geoStatus: 'provisional' },
  { id: 'ahala', name: 'Ahala', center: { x: 160, z: 560 }, radius: 290, density: 'residential', geoStatus: 'provisional' },
  {
    id: 'nsimalen',
    name: 'Nsimalen (aéroport)',
    center: { x: 216, z: 1080 },
    radius: 260,
    density: 'periurban',
    geoStatus: 'provisional',
    notes: 'Game-world airport district on southern edge.',
  },
];

export function findDistrictAt(x: number, z: number): DistrictDef | null {
  let best: DistrictDef | null = null;
  let bestDist = Infinity;
  for (const d of DISTRICTS) {
    const dist = Math.hypot(x - d.center.x, z - d.center.z);
    if (dist <= d.radius && dist < bestDist) {
      best = d;
      bestDist = dist;
    }
  }
  return best;
}

/** Always returns the nearest district (used to style gap fabric between radii). */
export function nearestDistrict(x: number, z: number): DistrictDef {
  let best = DISTRICTS[0]!;
  let bestDist = Infinity;
  for (const d of DISTRICTS) {
    const dist = Math.hypot(x - d.center.x, z - d.center.z);
    if (dist < bestDist) {
      best = d;
      bestDist = dist;
    }
  }
  return best;
}
