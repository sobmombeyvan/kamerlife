import * as THREE from 'three';
import { mat } from '../world/materials';

/** Cameroon flag: vertical green | red | yellow with yellow star on red. */
export function createCameroonFlagTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const ctx = c.getContext('2d')!;
  const w = c.width / 3;
  ctx.fillStyle = '#007A5E';
  ctx.fillRect(0, 0, w, c.height);
  ctx.fillStyle = '#CE1126';
  ctx.fillRect(w, 0, w, c.height);
  ctx.fillStyle = '#FCD116';
  ctx.fillRect(w * 2, 0, w, c.height);

  // Yellow 5-point star in centre of red band
  drawStar(ctx, c.width / 2, c.height / 2, 30, 12, '#FCD116');

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function addCameroonFlag(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  width = 4.2,
  height = 2.6,
  yaw = 0,
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  g.name = 'drapeau-cameroun';

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, y + height + 1, 8), mat(0xc0c0c0));
  pole.position.set(0, (y + height + 1) / 2 - y, 0);
  // Pole from ground: parent already at y, so pole goes up from ground via absolute helper
  g.add(pole);

  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({
      map: createCameroonFlagTexture(),
      side: THREE.DoubleSide,
      roughness: 0.75,
      metalness: 0.05,
    }),
  );
  cloth.position.set(width / 2 + 0.1, height / 2, 0);
  cloth.castShadow = true;
  g.add(cloth);

  // Finial
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mat(0xffd54f, 0.4, 0.6));
  ball.position.set(0, height + 0.35, 0);
  g.add(ball);

  parent.add(g);
  return g;
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

/** Flag on a full-height pole standing on the ground. */
export function addGroundFlagPole(
  parent: THREE.Group,
  x: number,
  z: number,
  poleHeight = 14,
  yaw = 0,
): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, poleHeight, 8), mat(0xb0bec5));
  pole.position.y = poleHeight / 2;
  g.add(pole);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 0.4, 10), mat(0x78909c));
  base.position.y = 0.2;
  g.add(base);

  const flagW = 5;
  const flagH = 3.1;
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(flagW, flagH),
    new THREE.MeshStandardMaterial({
      map: createCameroonFlagTexture(),
      side: THREE.DoubleSide,
      roughness: 0.7,
    }),
  );
  cloth.position.set(flagW / 2 + 0.15, poleHeight - flagH / 2 - 0.3, 0);
  cloth.castShadow = true;
  g.add(cloth);

  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat(0xffd54f, 0.35, 0.55));
  ball.position.y = poleHeight + 0.15;
  g.add(ball);

  parent.add(g);
}
