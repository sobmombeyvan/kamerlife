import * as THREE from 'three';
import type { CollisionSystem } from '../world/CollisionSystem';
import { FRONT_DOOR, HOME_SHELL } from './homeLayout';
import { HomeKit } from './homeKit';
import type { OutfitId } from '../player/PlayerOutfits';
import type { NeedActivity } from '../sim/PlayerNeeds';

export type HomeSpotKind =
  | 'door'
  | 'sleep'
  | 'cook'
  | 'tv'
  | 'wash'
  | 'clothes'
  | 'decor'
  | 'toilet'
  | 'basin'
  | 'fridge'
  | 'dine';

export type HomeSpot = {
  id: string;
  kind: HomeSpotKind;
  x: number;
  z: number;
  radius: number;
  label: string;
  /** Furniture id the spot follows when moved in build mode. */
  follow?: string;
  yaw?: number;
  /** Followed piece is stored away. */
  disabled?: boolean;
};

export type HomeActionResult = {
  tip: string;
  busySec?: number;
  outfitId?: OutfitId;
  /** Avatar pose while busy. */
  anim?: 'sleep' | 'cook' | 'tv' | 'wash' | 'clothes';
  /** Needs effect when the action ends (defaults to the pose). */
  need?: NeedActivity;
  busyLabel?: string;
  snapX?: number;
  snapZ?: number;
  faceYaw?: number;
};

const DOOR_DYNAMIC_ID = 'player-house-door';

/** Interaction spots in world space. Furniture-bound spots are re-synced from the decor layer. */
export function getHomeSpots(cx: number, cz: number): HomeSpot[] {
  const frontZ = cz + HOME_SHELL.innerD / 2;
  return [
    { id: 'door', kind: 'door', x: cx + FRONT_DOOR.x, z: frontZ - 0.7, radius: 1.5, label: 'Porte d’entrée' },
    { id: 'sleep', kind: 'sleep', x: cx - 6.75, z: cz - 3.4, radius: 1.75, label: 'Lit · dormir', follow: 'bed', yaw: Math.PI / 2 },
    { id: 'tv', kind: 'tv', x: cx + 4.2, z: cz + 3.9, radius: 1.5, label: 'Canapé · s’asseoir, télé', follow: 'sofa', yaw: Math.PI / 2 },
    { id: 'dine', kind: 'dine', x: cx - 0.7, z: cz - 4.3, radius: 1.25, label: 'Table · s’asseoir', follow: 'dining', yaw: 0 },
    { id: 'cook', kind: 'cook', x: cx + 6.3, z: cz - 5.75, radius: 1.1, label: 'Cuisinière · cuisiner' },
    { id: 'fridge', kind: 'fridge', x: cx + 0.95, z: cz - 5.85, radius: 0.95, label: 'Frigo · boire' },
    { id: 'wash', kind: 'wash', x: cx - 7.3, z: cz + 2.3, radius: 0.85, label: 'Douche' },
    { id: 'toilet', kind: 'toilet', x: cx - 5.6, z: cz + 2.55, radius: 0.7, label: 'Toilettes' },
    { id: 'basin', kind: 'basin', x: cx - 5.35, z: cz + 1.5, radius: 0.7, label: 'Lavabo' },
    { id: 'clothes', kind: 'clothes', x: cx - 3.35, z: cz - 5.5, radius: 1.15, label: 'Armoire · tenues' },
  ];
}

/** Spots bound to furniture follow the piece (or switch off while it is stored). */
export function syncHomeSpotsToFurniture(spots: HomeSpot[], houseRoot: THREE.Object3D): void {
  const layer = houseRoot.getObjectByName('home-decor-layer');
  for (const spot of spots) {
    if (!spot.follow) continue;
    const piece = layer?.getObjectByName(`furn-${spot.follow}`);
    spot.disabled = !piece;
    if (!piece) continue;
    spot.x = piece.position.x;
    spot.z = piece.position.z;
    spot.yaw = piece.rotation.y;
  }
}

export function nearestHomeSpot(x: number, z: number, spots: HomeSpot[]): HomeSpot | null {
  let best: HomeSpot | null = null;
  let bestD = Infinity;
  for (const s of spots) {
    if (s.disabled) continue;
    const d = Math.hypot(s.x - x, s.z - z);
    if (d <= s.radius && d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

export function tipForSpot(spot: HomeSpot, doorOpen: boolean): string {
  switch (spot.kind) {
    case 'door':
      return doorOpen ? 'E = fermer la porte' : 'E = ouvrir la porte (pour sortir / entrer)';
    case 'sleep':
      return 'E = dormir (énergie ↑ · heure Yaoundé réelle)';
    case 'cook':
      return 'E = cuisiner (faim ↓)';
    case 'tv':
      return 'E = s’asseoir et regarder la télé (fun ↑)';
    case 'wash':
      return 'E = douche (hygiène ↑)';
    case 'toilet':
      return 'E = toilettes (hygiène ↑)';
    case 'basin':
      return 'E = se laver les mains et le visage';
    case 'fridge':
      return 'E = boisson fraîche (soif ↓)';
    case 'dine':
      return 'E = s’asseoir à table (repos)';
    case 'clothes':
      return 'E ou C = choisir femme, homme, peau et tenue';
    default:
      return 'E = interagir';
  }
}

/** Front door leaf on a hinge pivot. Starts closed (collision box in the gap). */
export function createHomeDoor(
  interior: THREE.Group,
  collisions: CollisionSystem,
  doorX: number,
  doorZ: number,
  floorY: number,
  doorW: number,
  doorH: number,
): THREE.Group {
  const pivot = new THREE.Group();
  pivot.name = 'home-door-pivot';
  pivot.position.set(doorX - doorW / 2, floorY, doorZ);
  interior.add(pivot);

  const k = new HomeKit();
  const wood = 0x6a4630;
  k.soft('wood', doorW / 2, doorH / 2, 0, doorW, doorH, 0.055, 0.008, wood);
  for (const side of [-1, 1]) {
    const z = side * 0.029;
    for (const y of [0.45, 1.05, 1.65]) k.box('wood', doorW * 0.42, y, z, doorW * 0.6, 0.012, 0.004, 0x553723);
    k.box('glass', doorW * 0.84, doorH * 0.55, z * 0.2, 0.12, doorH * 0.7, 0.06, 0xbcd6de);
    k.box('chrome', doorW - 0.1, 1.02, side * 0.05, 0.03, 0.03, 0.05, 0xd6c79a);
    k.box('chrome', doorW - 0.16, 1.02, side * 0.075, 0.14, 0.022, 0.022, 0xd6c79a);
    k.box('chrome', doorW - 0.1, 0.9, side * 0.03, 0.04, 0.08, 0.004, 0xd6c79a);
  }
  const leaf = k.group('home-door-leaf');
  pivot.add(leaf);

  pivot.userData.open = false;
  pivot.userData.doorW = doorW;
  pivot.userData.cx = doorX;
  pivot.userData.frontZ = doorZ;
  pivot.userData.floorY = floorY;
  pivot.userData.doorH = doorH;

  setHomeDoorOpen(pivot, collisions, false);
  return pivot;
}

export function setHomeDoorOpen(doorPivot: THREE.Object3D, collisions: CollisionSystem, open: boolean): void {
  doorPivot.userData.open = open;
  // Hinge on the left: closed = 0, open swings into the hall.
  doorPivot.rotation.y = open ? 1.6 : 0;
  doorPivot.updateMatrix();
  doorPivot.updateMatrixWorld(true);

  const cx = doorPivot.userData.cx as number;
  const frontZ = doorPivot.userData.frontZ as number;
  const floorY = doorPivot.userData.floorY as number;
  const doorH = doorPivot.userData.doorH as number;
  const doorW = doorPivot.userData.doorW as number;

  if (open) {
    collisions.clearDynamicBox(DOOR_DYNAMIC_ID);
  } else {
    collisions.setDynamicBox(DOOR_DYNAMIC_ID, cx, floorY + doorH / 2, frontZ, doorW / 2, doorH / 2, 0.18);
  }
}

export function isHomeDoorOpen(houseRoot: THREE.Object3D): boolean {
  const pivot = houseRoot.getObjectByName('home-door-pivot');
  return !!pivot?.userData.open;
}

export function toggleHomeDoor(houseRoot: THREE.Object3D, collisions: CollisionSystem): boolean {
  const pivot = houseRoot.getObjectByName('home-door-pivot');
  if (!pivot) return false;
  const next = !pivot.userData.open;
  setHomeDoorOpen(pivot, collisions, next);
  return next;
}

export function runHomeAction(
  kind: HomeSpotKind,
  player: THREE.Object3D,
  houseRoot: THREE.Object3D,
  collisions: CollisionSystem,
  spot?: HomeSpot,
): HomeActionResult | null {
  const sx = spot?.x ?? player.position.x;
  const sz = spot?.z ?? player.position.z;
  const yaw = spot?.yaw ?? 0;
  const fwdX = Math.sin(yaw);
  const fwdZ = Math.cos(yaw);

  switch (kind) {
    case 'door': {
      const open = toggleHomeDoor(houseRoot, collisions);
      return {
        tip: open ? 'Porte ouverte — tu peux sortir ou entrer' : 'Porte fermée — ouvre-la pour sortir',
      };
    }
    case 'sleep':
      // Lie on the back, feet toward the foot of the bed
      return {
        tip: 'Bonne nuit… le temps avance',
        busySec: 4.2,
        anim: 'sleep',
        busyLabel: 'Dort… (nuit qui passe)',
        snapX: sx + fwdX * 0.88,
        snapZ: sz + fwdZ * 0.88,
        faceYaw: yaw,
      };
    case 'cook':
      return {
        tip: 'Tu prépares un bon ndolé…',
        busySec: 3.2,
        anim: 'cook',
        busyLabel: 'Cuisine…',
        snapX: sx,
        snapZ: sz,
        faceYaw: Math.PI,
      };
    case 'fridge':
      return {
        tip: 'Une boisson bien fraîche',
        busySec: 1.8,
        anim: 'cook',
        need: 'drink',
        busyLabel: 'Prend une boisson…',
        snapX: sx,
        snapZ: sz,
        faceYaw: Math.PI,
      };
    case 'tv': {
      setTvOn(houseRoot, 4);
      return {
        tip: 'Tu te poses sur le canapé devant la télé…',
        busySec: 3.6,
        anim: 'tv',
        busyLabel: 'Regarde la télé…',
        snapX: sx + fwdX * 0.12,
        snapZ: sz + fwdZ * 0.12,
        faceYaw: yaw,
      };
    }
    case 'dine':
      return {
        tip: 'Une pause à table',
        busySec: 2.6,
        anim: 'tv',
        need: 'rest',
        busyLabel: 'Assis à table…',
        snapX: sx - fwdX * 0.58,
        snapZ: sz - fwdZ * 0.58,
        faceYaw: yaw,
      };
    case 'wash':
      return {
        tip: 'Douche chaude… hygiène au max',
        busySec: 3.2,
        anim: 'wash',
        busyLabel: 'Sous la douche…',
        snapX: sx,
        snapZ: sz + 0.68,
        faceYaw: -Math.PI / 2,
      };
    case 'toilet':
      return {
        tip: 'Petit passage aux toilettes',
        busySec: 2.4,
        anim: 'tv',
        need: 'toilet',
        busyLabel: 'Aux toilettes…',
        snapX: sx,
        snapZ: sz + 0.6,
        faceYaw: Math.PI,
      };
    case 'basin':
      return {
        tip: 'Mains et visage propres',
        busySec: 2.0,
        anim: 'wash',
        need: 'basin',
        busyLabel: 'Se lave au lavabo…',
        snapX: sx + 0.1,
        snapZ: sz,
        faceYaw: Math.PI / 2,
      };
    case 'clothes':
      return {
        tip: 'Choisis femme ou homme, la peau et la tenue',
      };
    default:
      return null;
  }
}

function setTvOn(houseRoot: THREE.Object3D, seconds: number): void {
  const screen = houseRoot.getObjectByName('tv-screen') as THREE.Mesh | undefined;
  const material = screen?.material;
  if (!(material instanceof THREE.MeshStandardMaterial)) return;
  material.color.setHex(0x1a2a3a);
  material.emissiveIntensity = 0.9;
  window.setTimeout(() => {
    material.color.setHex(0x050608);
    material.emissiveIntensity = 0.06;
  }, seconds * 1000);
}

/** Outside doorstep interact zone (enter house). */
export function nearOutsideDoor(x: number, z: number, doorX: number, doorZ: number): boolean {
  return Math.hypot(x - doorX, z - doorZ) < 2.6;
}
