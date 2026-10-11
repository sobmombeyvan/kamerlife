import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

/**
 * Load a GLB/GLTF. Returns null if the file is missing or invalid.
 * Callers must keep their procedural fallback — this never invents a mesh.
 */
export async function loadGlb(url: string): Promise<THREE.Group | null> {
  try {
    const gltf = await loader.loadAsync(url);
    gltf.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return gltf.scene;
  } catch (error) {
    console.warn(`[assets] modèle introuvable ou illisible: ${url}`, error);
    return null;
  }
}
