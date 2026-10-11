import type * as THREE from 'three';

/** Bake world matrices for static city meshes — skips per-frame matrix updates. */
export function freezeStatic(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    obj.matrixAutoUpdate = false;
  });
}
