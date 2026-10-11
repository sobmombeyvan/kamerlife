import * as THREE from 'three';
import type { CollisionSystem } from '../world/CollisionSystem';
import { HOME_SHELL } from './homeLayout';
import { applyPlayerOutfit, cyclePlayerOutfit, type OutfitId } from '../player/PlayerOutfits';

export type HomeSpotKind = 'door' | 'sleep' | 'cook' | 'tv' | 'wash' | 'clothes' | 'decor';

export type HomeSpot = {
  id: string;
  kind: HomeSpotKind;
  x: number;
  z: number;
  radius: number;
  label: string;
};

export type HomeActionResult = {
  tip: string;
  busySec?: number;
  outfitId?: OutfitId;
  /** Play procedural avatar animation while busy. */
  anim?: 'sleep' | 'cook' | 'tv' | 'wash' | 'clothes';
  snapX?: number;
  snapZ?: number;
  faceYaw?: number;
};

const DOOR_DYNAMIC_ID = 'player-house-door';

/** Interaction radii around furniture / door. */
export function getHomeSpots(cx: number, cz: number): HomeSpot[] {
  const { innerD } = HOME_SHELL;
  const frontZ = cz + innerD / 2;
  return [
    { id: 'door', kind: 'door', x: cx, z: frontZ - 0.4, radius: 2.2, label: 'Porte' },
    { id: 'sleep', kind: 'sleep', x: cx - 5.2, z: cz - 0.8, radius: 2.0, label: 'Lit' },
    { id: 'cook', kind: 'cook', x: cx + 3.2, z: cz - 5.2, radius: 1.8, label: 'Cuisine' },
    { id: 'tv', kind: 'tv', x: cx + 4.0, z: cz - 1.2, radius: 2.0, label: 'Télé' },
    { id: 'wash', kind: 'wash', x: cx - 5.8, z: cz + 4.8, radius: 1.8, label: 'Douche' },
    { id: 'clothes', kind: 'clothes', x: cx - 6.4, z: cz - 4.6, radius: 1.8, label: 'Armoire' },
  ];
}

export function nearestHomeSpot(x: number, z: number, spots: HomeSpot[]): HomeSpot | null {
  let best: HomeSpot | null = null;
  let bestD = Infinity;
  for (const s of spots) {
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
      return 'E = télé (fun ↑)';
    case 'wash':
      return 'E = douche (hygiène ↑)';
    case 'clothes':
      return 'E = s’habiller (style ↑)';
    default:
      return 'E = interagir';
  }
}

/** Build swinging door leaf + sync closed collision. Starts closed. */
export function createHomeDoor(
  interior: THREE.Group,
  collisions: CollisionSystem,
  cx: number,
  cz: number,
  floorY: number,
  wallH: number,
): THREE.Group {
  const { innerD } = HOME_SHELL;
  const frontZ = cz + innerD / 2;
  const doorW = 2.2;
  const doorH = wallH - 0.25;

  const pivot = new THREE.Group();
  pivot.name = 'home-door-pivot';
  pivot.position.set(cx - doorW / 2, floorY, frontZ);
  interior.add(pivot);

  const leaf = new THREE.Mesh(
    new THREE.BoxGeometry(doorW, doorH, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.75, flatShading: true }),
  );
  leaf.name = 'home-door-leaf';
  leaf.position.set(doorW / 2, doorH / 2, 0);
  leaf.castShadow = true;
  pivot.add(leaf);

  // Handle
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.25, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xffc857, metalness: 0.4, roughness: 0.4 }),
  );
  handle.position.set(doorW - 0.25, doorH * 0.5, 0.08);
  pivot.add(handle);

  pivot.userData.open = false;
  pivot.userData.doorW = doorW;
  pivot.userData.cx = cx;
  pivot.userData.frontZ = frontZ;
  pivot.userData.floorY = floorY;
  pivot.userData.doorH = doorH;

  setHomeDoorOpen(pivot, collisions, false);
  return pivot;
}

export function setHomeDoorOpen(
  doorPivot: THREE.Object3D,
  collisions: CollisionSystem,
  open: boolean,
): void {
  doorPivot.userData.open = open;
  // Hinge on left: closed = 0, open inward = -100°
  doorPivot.rotation.y = open ? -1.75 : 0;

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

  switch (kind) {
    case 'door': {
      const open = toggleHomeDoor(houseRoot, collisions);
      return {
        tip: open
          ? 'Porte ouverte — tu peux sortir ou entrer'
          : 'Porte fermée — ouvre-la pour sortir',
      };
    }
    case 'sleep':
      return {
        tip: 'Bonne nuit… le temps avance',
        busySec: 4.2,
        anim: 'sleep',
        snapX: sx,
        snapZ: sz,
        faceYaw: Math.PI,
      };
    case 'cook':
      return {
        tip: 'Tu prépares un bon plat camerounais…',
        busySec: 3.2,
        anim: 'cook',
        snapX: sx,
        snapZ: sz + 0.55,
        faceYaw: Math.PI,
      };
    case 'tv': {
      pulseTv(houseRoot);
      return {
        tip: 'Tu te détends devant la télé…',
        busySec: 3.6,
        anim: 'tv',
        snapX: sx,
        snapZ: sz + 1.6,
        faceYaw: Math.PI,
      };
    }
    case 'wash':
      return {
        tip: 'Douche chaude… hygiène au max',
        busySec: 3.2,
        anim: 'wash',
        snapX: sx,
        snapZ: sz,
        faceYaw: 0,
      };
    case 'clothes': {
      const outfit = cyclePlayerOutfit(player);
      return {
        tip: `Tu changes… ${outfit.name}`,
        busySec: 1.8,
        anim: 'clothes',
        outfitId: outfit.id,
        snapX: sx + 0.6,
        snapZ: sz,
        faceYaw: Math.PI / 2,
      };
    }
    default:
      return null;
  }
}

function pulseTv(houseRoot: THREE.Object3D): void {
  houseRoot.traverse((o) => {
    if (o.name === 'furn-tv') {
      o.traverse((c) => {
        if (c instanceof THREE.Mesh && c.material instanceof THREE.MeshStandardMaterial) {
          if (c.material.opacity < 1) {
            c.material.emissive = new THREE.Color(0x44aaff);
            c.material.emissiveIntensity = 0.8;
            window.setTimeout(() => {
              if (c.material instanceof THREE.MeshStandardMaterial) {
                c.material.emissiveIntensity = 0.15;
              }
            }, 2600);
          }
        }
      });
    }
  });
}

/** Outside doorstep interact zone (enter house). */
export function nearOutsideDoor(x: number, z: number, doorX: number, doorZ: number): boolean {
  return Math.hypot(x - doorX, z - doorZ) < 3.2;
}

export { applyPlayerOutfit };
