import * as THREE from 'three';
import { setStudioAtmosphere } from '../render/atmosphere';

const HIDE_NAMES = [
  'yaounde-megacity',
  'landmark-player-house',
  'pedestrians',
  'traffic',
  'taxi-stands',
  'parked-cars',
  'sky-dome',
];

/**
 * Neutral preview room parented on the player.
 * The city stays loaded and hidden; it is not rebuilt.
 */
export class CharacterStudio {
  private readonly group = new THREE.Group();
  private readonly saved = new Map<THREE.Object3D, boolean>();
  private savedBackground: THREE.Color | THREE.Texture | null = null;
  private savedFog: THREE.Fog | THREE.FogExp2 | null = null;
  private active = false;

  constructor() {
    this.group.name = 'character-studio';

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.15, 40),
      new THREE.MeshBasicMaterial({ color: 0xc9c3b4 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.045;

    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.78, 0.9, 0.05, 36),
      new THREE.MeshStandardMaterial({ color: 0xb5aea2, roughness: 0.78, metalness: 0.02 }),
    );
    disc.position.y = -0.03;
    disc.castShadow = false;
    disc.receiveShadow = false;

    const backdrop = new THREE.Mesh(
      new THREE.CylinderGeometry(3.35, 3.35, 4.4, 32, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xd8d3c7, side: THREE.BackSide }),
    );
    backdrop.position.y = 1.75;

    const key = new THREE.DirectionalLight(0xfff6ea, 1.25);
    key.position.set(1.5, 3.1, 2.1);
    key.castShadow = false;
    const fill = new THREE.DirectionalLight(0xd5dbe6, 0.55);
    fill.position.set(-1.8, 2.2, -0.8);
    fill.castShadow = false;
    const target = new THREE.Object3D();
    target.position.set(0, 1.15, 0);
    key.target = target;
    fill.target = target;

    this.group.add(floor, disc, backdrop, key, fill, target);
  }

  enter(scene: THREE.Scene, anchor: THREE.Vector3): void {
    this.group.position.copy(anchor);
    if (!this.group.parent) scene.add(this.group);
    if (this.active) return;
    this.active = true;
    this.savedBackground = scene.background;
    this.savedFog = scene.fog;
    scene.background = new THREE.Color(0xd8d3c7);
    scene.fog = null;
    setStudioAtmosphere(true);
    this.saved.clear();
    for (const name of HIDE_NAMES) {
      const obj = scene.getObjectByName(name);
      if (!obj || obj === this.group) continue;
      this.saved.set(obj, obj.visible);
      obj.visible = false;
    }
  }

  follow(anchor: THREE.Vector3): void {
    if (!this.active) return;
    this.group.position.copy(anchor);
  }

  exit(scene: THREE.Scene): void {
    if (!this.active) return;
    this.active = false;
    scene.remove(this.group);
    for (const [obj, visible] of this.saved) obj.visible = visible;
    this.saved.clear();
    scene.background = this.savedBackground;
    scene.fog = this.savedFog;
    this.savedBackground = null;
    this.savedFog = null;
    setStudioAtmosphere(false);
  }
}
