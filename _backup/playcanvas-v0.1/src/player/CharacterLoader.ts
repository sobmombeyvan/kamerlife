import * as pc from 'playcanvas';
import { GameConfig } from '../game/GameConfig';

export type LoadedCharacter = {
  entity: pc.Entity;
  /** True when the Mixamo/Soldier GLB loaded with anim clips. */
  hasAnimations: boolean;
  setLocomotion: (state: 'idle' | 'walk' | 'run') => void;
};

/**
 * Loads the human GLB. If loading fails, builds a temporary stylized humanoid
 * (multi-mesh, not a single primitive) so the prototype stays playable.
 * See public/assets/licenses/ATTRIBUTION.md for replacement instructions.
 */
export async function loadPlayerCharacter(app: pc.AppBase): Promise<LoadedCharacter> {
  try {
    const container = await loadContainer(app, GameConfig.playerModelUrl, 'player-model');
    return instantiateAnimatedCharacter(app, container);
  } catch (error) {
    console.warn('[CharacterLoader] GLB unavailable, using temporary humanoid.', error);
    return createTemporaryHumanoid(app);
  }
}

function loadContainer(app: pc.AppBase, url: string, name: string): Promise<pc.Asset> {
  return new Promise((resolve, reject) => {
    const existing = app.assets.find(name, 'container');
    if (existing) {
      if (existing.resource) {
        resolve(existing);
        return;
      }
      existing.ready((asset) => resolve(asset));
      existing.on('error', (err: string) => reject(new Error(err)));
      app.assets.load(existing);
      return;
    }

    const asset = new pc.Asset(name, 'container', { url });
    asset.ready((readyAsset) => resolve(readyAsset));
    asset.on('error', (err: string) => reject(new Error(err)));
    app.assets.add(asset);
    app.assets.load(asset);
  });
}

function instantiateAnimatedCharacter(app: pc.AppBase, containerAsset: pc.Asset): LoadedCharacter {
  const resource = containerAsset.resource as pc.ContainerResource;
  const entity = resource.instantiateRenderEntity({
    castShadows: true,
  });
  entity.name = 'player';
  entity.setLocalScale(1, 1, 1);

  let hasAnimations = false;
  let current: 'idle' | 'walk' | 'run' = 'idle';

  const byName = new Map<string, pc.AnimTrack>();
  for (const animAsset of resource.animations ?? []) {
    const track = animAsset.resource as pc.AnimTrack | undefined;
    if (!track) continue;
    byName.set(animAsset.name.toLowerCase(), track);
  }

  const idle = findTrack(byName, ['idle', 'standing']);
  const walk = findTrack(byName, ['walk', 'walking']);
  const run = findTrack(byName, ['run', 'running', 'sprint']);

  if (idle || walk || run) {
    entity.addComponent('anim', {
      activate: true,
      speed: 1,
    });
    const anim = entity.anim!;
    if (idle) anim.assignAnimation('idle', idle);
    if (walk) anim.assignAnimation('walk', walk);
    if (run) anim.assignAnimation('run', run);
    anim.baseLayer?.transition(idle ? 'idle' : walk ? 'walk' : 'run');
    hasAnimations = true;
  }

  app.root.addChild(entity);

  return {
    entity,
    hasAnimations,
    setLocomotion(state) {
      if (!hasAnimations || !entity.anim || state === current) return;
      current = state;
      const layer = entity.anim.baseLayer;
      if (!layer) return;
      if (state === 'idle' && idle) layer.transition('idle', 0.15);
      else if (state === 'walk' && walk) layer.transition('walk', 0.12);
      else if (state === 'run' && run) layer.transition('run', 0.1);
    },
  };
}

function findTrack(map: Map<string, pc.AnimTrack>, names: string[]): pc.AnimTrack | undefined {
  for (const name of names) {
    const hit = map.get(name);
    if (hit) return hit;
  }
  for (const [key, track] of map) {
    if (names.some((n) => key.includes(n))) return track;
  }
  return undefined;
}

export function createTemporaryHumanoid(app: pc.AppBase): LoadedCharacter {
  const root = new pc.Entity('player-temp');
  const skin = mat(0.62, 0.42, 0.28);
  const shirt = mat(0.15, 0.45, 0.75);
  const pants = mat(0.2, 0.22, 0.35);
  const shoes = mat(0.12, 0.12, 0.12);

  addPart(root, 'torso', 'box', 0, 1.15, 0, 0.45, 0.55, 0.25, shirt);
  addPart(root, 'head', 'sphere', 0, 1.65, 0, 0.28, 0.32, 0.28, skin);
  addPart(root, 'legL', 'box', -0.12, 0.45, 0, 0.16, 0.7, 0.18, pants);
  addPart(root, 'legR', 'box', 0.12, 0.45, 0, 0.16, 0.7, 0.18, pants);
  addPart(root, 'armL', 'box', -0.38, 1.15, 0, 0.14, 0.5, 0.14, skin);
  addPart(root, 'armR', 'box', 0.38, 1.15, 0, 0.14, 0.5, 0.14, skin);
  addPart(root, 'shoeL', 'box', -0.12, 0.08, 0.05, 0.18, 0.12, 0.28, shoes);
  addPart(root, 'shoeR', 'box', 0.12, 0.08, 0.05, 0.18, 0.12, 0.28, shoes);

  app.root.addChild(root);
  console.info(
    '[CharacterLoader] Temporary multi-mesh humanoid active. Place a licensed GLB at',
    GameConfig.playerModelUrl,
  );

  return {
    entity: root,
    hasAnimations: false,
    setLocomotion() {
      /* no clips on temporary mesh */
    },
  };
}

function addPart(
  parent: pc.Entity,
  name: string,
  type: 'box' | 'sphere',
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  material: pc.StandardMaterial,
): void {
  const part = new pc.Entity(name);
  part.addComponent('render', {
    type,
    material,
    castShadows: false,
  });
  part.setLocalPosition(x, y, z);
  part.setLocalScale(sx, sy, sz);
  parent.addChild(part);
}

function mat(r: number, g: number, b: number): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(r, g, b);
  m.update();
  return m;
}
