import * as THREE from 'three';

/**
 * Yaoundé's ring of green hills on the horizon (Mont Fébé, Mbankolo, Nkolondom…), drawn as two
 * camera-following silhouette bands just inside the far plane, tinted from the fog colour so
 * they read as aerial perspective rather than solid scenery.
 */
function ringGeometry(seed: number, segments: number, hMin: number, hMax: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const phases = Array.from({ length: 5 }, (_, i) => Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453 % (Math.PI * 2));
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    let n = 0;
    n += Math.sin(a * 3 + phases[0]!) * 0.35;
    n += Math.sin(a * 7 + phases[1]!) * 0.25;
    n += Math.sin(a * 13 + phases[2]!) * 0.15;
    n += Math.max(0, Math.sin(a * 2 + phases[3]!)) * 0.45;
    n += Math.sin(a * 23 + phases[4]!) * 0.06;
    const h = hMin + (hMax - hMin) * THREE.MathUtils.clamp(0.5 + n * 0.6, 0, 1);
    const x = Math.cos(a);
    const z = Math.sin(a);
    pos.push(x, -0.03, z, x, h, z);
    col.push(1, 1, 1, 0.82, 0.86, 0.84);
  }
  for (let i = 0; i < segments; i++) {
    const b = i * 2;
    idx.push(b, b + 1, b + 3, b, b + 3, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

export class HorizonHills {
  readonly group = new THREE.Group();
  private readonly farMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide });
  private readonly nearMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide });
  private readonly far: THREE.Mesh;
  private readonly near: THREE.Mesh;
  private readonly tint = new THREE.Color();
  private readonly green = new THREE.Color(0x2f4a2c);

  constructor(scene: THREE.Scene) {
    this.group.name = 'horizon-hills';
    this.far = new THREE.Mesh(ringGeometry(3, 160, 0.03, 0.11), this.farMat);
    this.near = new THREE.Mesh(ringGeometry(11, 128, 0.015, 0.06), this.nearMat);
    this.near.scale.setScalar(0.9);
    this.far.renderOrder = -1;
    this.near.renderOrder = -1;
    this.far.frustumCulled = false;
    this.near.frustumCulled = false;
    this.group.add(this.far, this.near);
    scene.add(this.group);
  }

  update(camera: THREE.PerspectiveCamera, fog: THREE.Fog | THREE.FogExp2 | null, night: number, visible: boolean): void {
    this.group.visible = visible && !!fog;
    if (!this.group.visible || !fog) return;
    const r = camera.far * 0.93;
    this.group.position.set(camera.position.x, 0, camera.position.z);
    this.group.scale.setScalar(r);
    const light = 1 - night * 0.75;
    this.tint.copy(this.green).multiplyScalar(light);
    this.farMat.color.copy(fog.color).lerp(this.tint, 0.22);
    this.nearMat.color.copy(fog.color).lerp(this.tint, 0.4);
  }
}
