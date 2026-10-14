import { createNpcAvatar } from '../pedestrians/NpcAvatar';

/** Police / gendarme on duty (commissariat, street posts). */
export function createPoliceOfficer(seed = 0) {
  const root = createNpcAvatar(8000 + seed, 'police');
  root.name = `police-${seed}`;
  root.userData.role = 'police';
  return root;
}

/** BIR / army post — Palais de l’Unité. */
export function createMilitaryGuard(seed = 0) {
  const root = createNpcAvatar(12000 + seed, 'military');
  root.name = `military-${seed}`;
  root.userData.role = 'military';
  root.userData.landmark = 'palais-etoudi';
  return root;
}
