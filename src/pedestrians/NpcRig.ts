import * as THREE from 'three';
import { applyHairStyle, instantiateNpcRig, type PlayerAnimator } from '../player/PlayerRig';
import { applyLookMaterials, type CharacterId } from '../player/PlayerLook';
import { mat } from '../world/materials';
import type { NpcRole } from './roles';
import { roleOutfit } from './roles';

/** Extra Mixamo clones blow the GPU (white screen). Street crowd stays instanced. */
const CAPS: Record<CharacterId, number> = { sam: 0, maya: 0, harper: 0 };

export type NpcPaint = {
  characterId: CharacterId;
  role: NpcRole;
  seed: number;
};

export async function mountNpcAvatar(root: THREE.Group, seed: number, role: NpcRole): Promise<void> {
  const look = roleOutfit(role, seed);
  const model = await instantiateNpcRig(look.characterId);
  if (!model) return;
  for (const child of [...root.children]) root.remove(child);
  dressNpc(model, look.characterId, role, seed);
  root.add(model);
  root.userData.animator = model.userData.animator;
  root.userData.rigged = true;
}

function dressNpc(model: THREE.Group, characterId: CharacterId, role: NpcRole, seed: number): void {
  ensureExtras(model, characterId);
  const look = roleOutfit(role, seed);
  applyLookMaterials(model, look);
  applyHairStyle(model, look.hairStyle);
  toggleNamed(model, 'npc-police-cap', role === 'police' || role === 'security');
  toggleNamed(model, 'npc-vendor-tray', role === 'vendor');
}

function toggleNamed(model: THREE.Object3D, name: string, on: boolean): void {
  const obj = model.getObjectByName(name);
  if (obj) obj.visible = on;
}

function ensureExtras(model: THREE.Group, _characterId: CharacterId): void {
  if (!model.getObjectByName('npc-police-cap')) {
    const head = model.getObjectByName('head') ?? model.getObjectByName('Head');
    const cap = new THREE.Group();
    cap.name = 'npc-police-cap';
    const white = mat(0xf5f5f5, 0.55, 0.05);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 12), mat(0x1a1a1a));
    brim.position.y = 0.02;
    cap.add(brim);
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.07, 12), white);
    dome.position.y = 0.06;
    cap.add(dome);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.025, 12), mat(0xce1126));
    band.position.y = 0.035;
    cap.add(band);
    cap.visible = false;
    if (head) {
      cap.position.set(0, 0.12, 0.02);
      head.add(cap);
    } else {
      cap.position.set(0, 1.72, 0.02);
      model.add(cap);
    }
  }
  if (!model.getObjectByName('npc-vendor-tray')) {
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.28), mat(0x6d4c41, 0.8, 0));
    tray.name = 'npc-vendor-tray';
    tray.position.set(0.28, 0.92, 0.12);
    tray.visible = false;
    model.add(tray);
  }
}

type Body = {
  model: THREE.Group;
  characterId: CharacterId;
  ped: unknown;
};

/** Nearby street NPCs share Harper / Maya / Sam clones. */
export class NpcRigPool {
  private readonly bodies: Body[] = [];
  private ready = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly renderer?: THREE.WebGLRenderer,
  ) {}

  async load(): Promise<void> {
    const ids: CharacterId[] = [];
    (Object.keys(CAPS) as CharacterId[]).forEach((id) => {
      for (let i = 0; i < CAPS[id]; i++) ids.push(id);
    });
    const cloned = await Promise.all(ids.map((id) => instantiateNpcRig(id, this.renderer)));
    cloned.forEach((model, i) => {
      if (!model) return;
      const id = ids[i]!;
      ensureExtras(model, id);
      model.visible = false;
      this.scene.add(model);
      this.bodies.push({ model, characterId: id, ped: null });
    });
    this.ready = this.bodies.length > 0;
  }

  get loaded(): boolean {
    return this.ready;
  }

  release(ped: unknown): void {
    for (const b of this.bodies) {
      if (b.ped !== ped) continue;
      b.ped = null;
      b.model.visible = false;
    }
  }

  sync<T extends { look: NpcPaint; mesh: THREE.Group; speed: number }>(
    hero: T[],
    movingOf: (p: T) => boolean,
    dt: number,
  ): Set<T> {
    const attached = new Set<T>();
    if (!this.ready) return attached;
    const wanted = new Set(hero);
    for (const b of this.bodies) {
      if (b.ped && !wanted.has(b.ped as T)) {
        b.ped = null;
        b.model.visible = false;
      }
    }
    for (const p of hero) {
      let body = this.bodies.find((b) => b.ped === p);
      if (body && body.characterId !== p.look.characterId) {
        body.ped = null;
        body.model.visible = false;
        body = undefined;
      }
      if (!body) {
        body =
          this.bodies.find((b) => !b.ped && b.characterId === p.look.characterId) ??
          this.bodies.find((b) => !b.ped);
        if (!body) continue;
        body.ped = p;
        dressNpc(body.model, p.look.characterId, p.look.role, p.look.seed);
      }
      body.model.visible = true;
      body.model.position.copy(p.mesh.position);
      body.model.rotation.y = p.mesh.rotation.y;
      const animator = body.model.userData.animator as PlayerAnimator | undefined;
      animator?.setLocomotion(movingOf(p), false, dt, p.speed);
      attached.add(p);
    }
    return attached;
  }
}
