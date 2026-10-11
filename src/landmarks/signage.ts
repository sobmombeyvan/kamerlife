import * as THREE from 'three';
import { mat } from '../world/materials';

const textMatCache = new Map<string, THREE.MeshBasicMaterial>();

/** Simple colored board sign. */
export function addSignBoard(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  color: number,
  yaw = 0,
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  const board = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.18), mat(color));
  board.castShadow = true;
  g.add(board);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.3, height + 0.3, 0.08), mat(0x222222));
  frame.position.z = -0.08;
  g.add(frame);
  parent.add(g);
  return g;
}

/** Facade sign with readable text (canvas texture). */
export function addTextSign(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  title: string,
  opts?: {
    subtitle?: string;
    bg?: number;
    fg?: number;
    yaw?: number;
  },
): THREE.Group {
  const bg = opts?.bg ?? 0x10251f;
  const fg = opts?.fg ?? 0xffc857;
  const yaw = opts?.yaw ?? 0;
  const key = `${title}|${opts?.subtitle ?? ''}|${bg}|${fg}|${width}|${height}`;

  let material = textMatCache.get(key);
  if (!material) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = Math.max(128, Math.round(512 * (height / Math.max(width, 0.1))));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = `#${bg.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ffffff33';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    ctx.fillStyle = `#${fg.toString(16).padStart(6, '0')}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${opts?.subtitle ? 52 : 64}px Arial, sans-serif`;
    ctx.fillText(title.toUpperCase(), canvas.width / 2, opts?.subtitle ? canvas.height * 0.38 : canvas.height / 2, canvas.width - 40);

    if (opts?.subtitle) {
      ctx.font = `600 34px Arial, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(opts.subtitle.toUpperCase(), canvas.width / 2, canvas.height * 0.68, canvas.width - 40);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    material = new THREE.MeshBasicMaterial({ map: tex });
    textMatCache.set(key, material);
  }

  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  g.userData = { signText: title, subtitle: opts?.subtitle };
  const board = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.12), material);
  g.add(board);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.25, height + 0.25, 0.06), mat(0x1a1a1a));
  frame.position.z = -0.08;
  g.add(frame);
  parent.add(g);
  return g;
}

export function addLampPost(parent: THREE.Group, x: number, z: number): void {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5.2, 6), mat(0x3a4240));
  pole.position.set(x, 2.6, z);
  parent.add(pole);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat(0xffe8b0, 0.5));
  lamp.position.set(x, 5.1, z);
  parent.add(lamp);
}
