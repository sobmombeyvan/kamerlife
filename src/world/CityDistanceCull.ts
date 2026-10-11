import type * as THREE from 'three';
import { WorldConfig } from '../config/WorldConfig';
import { GraphicsConfig } from '../config/GraphicsConfig';

const ALWAYS_ON = new Set(['terrain', 'roads', 'life-spots']);

/**
 * Hide far static city chunks past fog / load distance to cut draw calls.
 */
export class CityDistanceCull {
  private acc = 0;
  private cursor = 0;

  update(dt: number, cityRoot: THREE.Group, playerX: number, playerZ: number): void {
    this.acc += dt;
    if (this.acc < 0.35) return;
    this.acc = 0;

    const load =
      GraphicsConfig.quality === 'low'
        ? WorldConfig.loadDistance * 0.9
        : GraphicsConfig.quality === 'medium'
          ? WorldConfig.loadDistance * 1.15
          : WorldConfig.unloadDistance * 1.1;
    const loadSq = load * load;
    const children = cityRoot.children;
    const batch = 100;
    const n = children.length;
    if (!n) return;

    for (let i = 0; i < batch; i++) {
      const idx = (this.cursor + i) % n;
      const child = children[idx]!;
      if (ALWAYS_ON.has(child.name)) {
        child.visible = true;
        continue;
      }
      if (child.name.includes('player-house')) {
        child.visible = true;
        continue;
      }

      let cx = child.position.x;
      let cz = child.position.z;
      if (Math.abs(cx) < 0.01 && Math.abs(cz) < 0.01 && child.children.length) {
        const sample = child.children[0]!;
        cx = sample.position.x;
        cz = sample.position.z;
      }
      const ddx = cx - playerX;
      const ddz = cz - playerZ;
      child.visible = ddx * ddx + ddz * ddz < loadSq;
    }
    this.cursor = (this.cursor + batch) % n;
  }
}
