import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { RigFit } from './fit';
import { knitTexture, strawTexture, waxTexture } from './textures';

type Build = (fit: RigFit, color: number, pad: number) => THREE.Group;

const std = (color: number, roughness = 0.8, metalness = 0, map?: THREE.Texture) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, map: map ?? null, side: THREE.DoubleSide });
const gold = () => std(0xd8aa45, 0.28, 1);
const silver = () => std(0xd9dee4, 0.24, 1);

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

/** Cylinder spanning two rig-space points. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const len = a.distanceTo(b);
  const m = mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

function tube(points: THREE.Vector3[], r: number, mat: THREE.Material, closed = false): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  return mesh(new THREE.TubeGeometry(curve, points.length * 10, r, 8, closed), mat);
}

/** Upper skull shell, sized to the measured head plus the hair under it. */
function dome(fit: RigFit, pad: number, baseY: number, thetaLength: number, mat: THREE.Material, extra = 1): THREE.Mesh {
  const s = fit.skull;
  const top = s.cy + s.ry;
  const m = mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, thetaLength), mat);
  m.position.set(0, baseY, s.cz);
  m.scale.set(s.rx * 1.06 + pad, (top - baseY + 0.006 + pad) * extra, s.rz * 1.04 + pad);
  return m;
}

const buildCap: Build = (fit, color, pad) => {
  const g = new THREE.Group();
  const s = fit.skull;
  const baseY = s.cy + 0.032;
  const mat = std(color, 0.85);
  g.add(dome(fit, pad, baseY, Math.PI / 2, mat));
  const ex = s.rx * 1.06 + pad;
  const ez = s.rz * 1.04 + pad;
  const shape = new THREE.Shape();
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI;
    const x = Math.cos(a) * ex * 0.92;
    const y = Math.sin(a) * (ez + 0.075);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let i = steps; i >= 0; i--) {
    const a = (i / steps) * Math.PI;
    shape.lineTo(Math.cos(a) * ex * 0.92, Math.sin(a) * ez * 0.96);
  }
  const brimGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.005, bevelEnabled: false, curveSegments: 2 });
  brimGeo.rotateX(Math.PI / 2);
  const brim = mesh(brimGeo, mat);
  brim.position.set(0, baseY + 0.004, s.cz);
  brim.rotation.x = 0.16;
  g.add(brim);
  const button = mesh(new THREE.SphereGeometry(0.008, 10, 8), mat);
  button.position.set(0, s.cy + s.ry + pad + 0.006, s.cz);
  g.add(button);
  return g;
};

const buildBeanie: Build = (fit, color, pad) => {
  const g = new THREE.Group();
  const s = fit.skull;
  const baseY = s.cy + 0.018;
  const mat = std(color, 1, 0, knitTexture());
  const knit = knitTexture();
  knit.repeat.set(10, 3);
  g.add(dome(fit, pad + 0.004, baseY, Math.PI / 2, mat, 1.14));
  const cuff = mesh(new THREE.CylinderGeometry(1, 1, 0.038, 40, 1, true), mat);
  cuff.position.set(0, baseY + 0.012, s.cz);
  cuff.scale.set(s.rx * 1.06 + pad + 0.011, 1, s.rz * 1.04 + pad + 0.011);
  g.add(cuff);
  return g;
};

const buildBucket: Build = (fit, color, pad) => {
  const g = new THREE.Group();
  const s = fit.skull;
  const baseY = s.cy + 0.03;
  const h = s.cy + s.ry + pad + 0.015 - baseY;
  const profile = [
    new THREE.Vector2(1.55, -0.045),
    new THREE.Vector2(1.3, -0.02),
    new THREE.Vector2(1.04, 0),
    new THREE.Vector2(1.0, h * 0.55),
    new THREE.Vector2(0.92, h * 0.95),
    new THREE.Vector2(0.55, h * 1.04),
    new THREE.Vector2(0.001, h * 1.06),
  ];
  const hat = mesh(new THREE.LatheGeometry(profile, 40), std(color, 0.9));
  hat.position.set(0, baseY, s.cz);
  hat.scale.set(s.rx * 1.06 + pad, 1, s.rz * 1.04 + pad);
  g.add(hat);
  return g;
};

const buildBeret: Build = (fit, color, pad) => {
  const g = new THREE.Group();
  const s = fit.skull;
  const mat = std(color, 0.95);
  const body = mesh(new THREE.SphereGeometry(1, 36, 18), mat);
  body.position.set(0.012, s.cy + s.ry * 0.78 + pad, s.cz - 0.005);
  body.scale.set(s.rx * 1.22 + pad, 0.045, s.rz * 1.2 + pad);
  body.rotation.z = -0.22;
  g.add(body);
  const band = mesh(new THREE.TorusGeometry(1, 0.06, 8, 40), mat);
  band.rotation.x = Math.PI / 2;
  band.position.set(0, s.cy + s.ry * 0.55 + pad * 0.6, s.cz);
  band.scale.set(s.rx * 0.98 + pad, s.rz * 0.97 + pad, 0.08);
  g.add(band);
  const stem = mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.012, 6), mat);
  stem.position.set(-0.004, s.cy + s.ry + pad + 0.03, s.cz);
  g.add(stem);
  return g;
};

const buildStraw: Build = (fit, color, pad) => {
  const g = new THREE.Group();
  const s = fit.skull;
  const baseY = s.cy + 0.034;
  const h = s.cy + s.ry + pad + 0.03 - baseY;
  const profile = [
    new THREE.Vector2(2.05, -0.012),
    new THREE.Vector2(1.6, 0.004),
    new THREE.Vector2(1.06, 0.006),
    new THREE.Vector2(1.02, h * 0.7),
    new THREE.Vector2(0.86, h),
    new THREE.Vector2(0.3, h * 0.92),
    new THREE.Vector2(0.001, h * 0.96),
  ];
  const straw = strawTexture();
  const hat = mesh(new THREE.LatheGeometry(profile, 48), std(color, 0.95, 0, straw));
  hat.position.set(0, baseY, s.cz);
  hat.scale.set(s.rx * 1.06 + pad, 1, s.rz * 1.04 + pad);
  g.add(hat);
  const ribbon = mesh(new THREE.CylinderGeometry(1.025, 1.04, 0.018, 48, 1, true), std(0x2b1d14, 0.6));
  ribbon.position.set(0, baseY + 0.016, s.cz);
  ribbon.scale.set(s.rx * 1.06 + pad, 1, s.rz * 1.04 + pad);
  g.add(ribbon);
  return g;
};

const buildWrap: Build = (fit, color, pad) => {
  const g = new THREE.Group();
  const s = fit.skull;
  const mat = std(0xffffff, 0.8, 0, waxTexture(color));
  const wrap = mesh(new THREE.SphereGeometry(1, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2 + 0.16), mat);
  wrap.position.set(0, s.cy, s.cz - 0.008);
  wrap.scale.set(s.rx * 1.1 + pad, s.ry * 1.42 + pad, s.rz * 1.12 + pad);
  wrap.rotation.x = -0.36;
  g.add(wrap);
  const knotY = s.cy + s.ry * 1.05;
  const knotZ = s.cz + s.rz * 0.72;
  for (const side of [-1, 1]) {
    const lobe = mesh(new THREE.SphereGeometry(1, 18, 12), mat);
    lobe.position.set(side * 0.03, knotY + 0.012, knotZ);
    lobe.scale.set(0.034, 0.022, 0.02);
    lobe.rotation.z = side * 0.6;
    g.add(lobe);
  }
  const knot = mesh(new THREE.SphereGeometry(0.017, 14, 10), mat);
  knot.position.set(0, knotY, knotZ + 0.008);
  g.add(knot);
  return g;
};

function lensFrame(width: number, height: number, radius: number): THREE.Shape {
  const s = new THREE.Shape();
  const w = width / 2;
  const h = height / 2;
  s.moveTo(-w + radius, -h);
  s.lineTo(w - radius, -h);
  s.quadraticCurveTo(w, -h, w, -h + radius);
  s.lineTo(w, h - radius);
  s.quadraticCurveTo(w, h, w - radius, h);
  s.lineTo(-w + radius, h);
  s.quadraticCurveTo(-w, h, -w, h - radius);
  s.lineTo(-w, -h + radius);
  s.quadraticCurveTo(-w, -h, -w + radius, -h);
  return s;
}

function glasses(fit: RigFit, round: boolean, frameColor: number): THREE.Group {
  const g = new THREE.Group();
  const s = fit.skull;
  const z = fit.eyeFrontZ + 0.016;
  const y = fit.eyeY + 0.002;
  const frame = round ? gold() : std(frameColor, 0.35, 0.1);
  const lens = new THREE.MeshPhysicalMaterial({
    color: round ? 0xdfe8ee : 0x1a1c20,
    roughness: 0.05,
    metalness: 0,
    transparent: true,
    opacity: round ? 0.18 : 0.82,
    clearcoat: 1,
    side: THREE.DoubleSide,
  });
  const cx = 0.034;
  for (const side of [-1, 1]) {
    if (round) {
      const rim = mesh(new THREE.TorusGeometry(0.021, 0.0017, 8, 32), frame);
      rim.position.set(side * cx, y, z);
      g.add(rim);
      const glass = mesh(new THREE.CircleGeometry(0.021, 28), lens);
      glass.position.set(side * cx, y, z);
      g.add(glass);
    } else {
      const outer = lensFrame(0.054, 0.038, 0.012);
      const hole = lensFrame(0.046, 0.03, 0.009);
      outer.holes.push(hole);
      const rimGeo = new THREE.ExtrudeGeometry(outer, { depth: 0.004, bevelEnabled: false, curveSegments: 6 });
      const rim = mesh(rimGeo, frame);
      rim.position.set(side * cx, y, z - 0.002);
      g.add(rim);
      const glass = mesh(new THREE.ShapeGeometry(hole, 6), lens);
      glass.position.set(side * cx, y, z);
      g.add(glass);
    }
    const hingeX = side * (cx + (round ? 0.022 : 0.027));
    const earX = side * (s.rx + 0.006);
    g.add(rod(new THREE.Vector3(hingeX, y + 0.004, z - 0.002), new THREE.Vector3(earX, y + 0.008, s.cz - 0.005), 0.0016, frame));
  }
  g.add(rod(new THREE.Vector3(-0.012, y + 0.006, z), new THREE.Vector3(0.012, y + 0.006, z), 0.0018, frame));
  return g;
}

const buildHoops: Build = (fit) => {
  const g = new THREE.Group();
  const s = fit.skull;
  for (const side of [-1, 1]) {
    const hoop = mesh(new THREE.TorusGeometry(0.012, 0.0016, 8, 28), gold());
    hoop.position.set(side * (s.rx - 0.008), fit.eyeY - 0.052, s.cz - 0.004);
    hoop.rotation.y = Math.PI / 2;
    g.add(hoop);
  }
  return g;
};

function chain(fit: RigFit, metal: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const baseY = fit.neckY - 0.035;
  const points: THREE.Vector3[] = [];
  const frontZ = Math.max(fit.neckZ + 0.07, fit.chestFrontZ - 0.035);
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    const c = Math.cos(t);
    const front = Math.max(0, c);
    points.push(
      new THREE.Vector3(
        Math.sin(t) * 0.074,
        baseY - 0.07 * Math.pow(front, 1.6),
        fit.neckZ + (c > 0 ? c * (frontZ - fit.neckZ) : c * 0.065),
      ),
    );
  }
  g.add(tube(points, 0.0022, metal, true));
  const pendant = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.003, 24), metal);
  pendant.rotation.x = Math.PI / 2 - 0.25;
  pendant.position.set(0, baseY - 0.085, frontZ + 0.006);
  g.add(pendant);
  return g;
}

const buildWatch: Build = (fit, color) => {
  const g = new THREE.Group();
  const r = fit.wristR + 0.004;
  const band = mesh(new THREE.CylinderGeometry(r, r, 0.016, 24, 1, true), std(color, 0.55));
  band.position.copy(fit.wrist);
  band.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), fit.forearm);
  g.add(band);
  const out = new THREE.Vector3(1, 0, 0).projectOnPlane(fit.forearm).normalize();
  const caseMesh = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.007, 24), silver());
  caseMesh.position.copy(fit.wrist).addScaledVector(out, r + 0.002);
  caseMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), out);
  g.add(caseMesh);
  const face = mesh(new THREE.CircleGeometry(0.0115, 24), std(0xf4f1e8, 0.2));
  face.position.copy(caseMesh.position).addScaledVector(out, 0.0037);
  face.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), out);
  g.add(face);
  return g;
};

const buildBackpack: Build = (fit, color) => {
  const g = new THREE.Group();
  const mat = std(color, 0.85);
  const h = 0.36;
  const d = 0.13;
  const cy = fit.chestY - 0.06;
  const backZ = fit.chestBackZ - 0.008;
  const body = mesh(new RoundedBoxGeometry(0.27, h, d, 4, 0.035), mat);
  body.position.set(0, cy, backZ - d / 2);
  g.add(body);
  const pocket = mesh(new RoundedBoxGeometry(0.2, 0.15, 0.04, 3, 0.015), mat);
  pocket.position.set(0, cy - 0.08, backZ - d - 0.012);
  g.add(pocket);
  const strap = std(0x1b1b1b, 0.7);
  const topY = fit.shoulderTopY + 0.012;
  for (const side of [-1, 1]) {
    const x = side * 0.085;
    g.add(
      tube(
        [
          new THREE.Vector3(x, cy + h / 2 - 0.03, backZ - 0.01),
          new THREE.Vector3(x, topY - 0.01, fit.neckZ - 0.06),
          new THREE.Vector3(side * 0.095, topY + 0.004, fit.neckZ),
          new THREE.Vector3(side * 0.1, topY - 0.05, fit.chestFrontZ + 0.012),
          new THREE.Vector3(side * 0.12, fit.chestY - 0.03, fit.chestFrontZ + 0.006),
        ],
        0.008,
        strap,
      ),
    );
  }
  return g;
};

const buildCrossbody: Build = (fit, color) => {
  const g = new THREE.Group();
  const mat = std(color, 0.5);
  const bagY = fit.hipY - 0.01;
  const bagZ = fit.hipFrontZ + 0.032;
  const bag = mesh(new RoundedBoxGeometry(0.2, 0.15, 0.055, 3, 0.02), mat);
  bag.position.set(-0.1, bagY, bagZ);
  bag.rotation.y = 0.2;
  g.add(bag);
  const midFront = (fit.chestFrontZ + fit.hipFrontZ) / 2 + 0.016;
  const topY = fit.shoulderTopY + 0.012;
  g.add(
    tube(
      [
        new THREE.Vector3(-0.19, bagY + 0.06, bagZ - 0.01),
        new THREE.Vector3(-0.12, (fit.chestY + fit.hipY) / 2, midFront),
        new THREE.Vector3(0, fit.chestY + 0.02, fit.chestFrontZ + 0.016),
        new THREE.Vector3(0.09, topY - 0.04, fit.chestFrontZ + 0.006),
        new THREE.Vector3(0.1, topY + 0.004, fit.neckZ),
        new THREE.Vector3(0.06, topY - 0.06, fit.chestBackZ - 0.012),
        new THREE.Vector3(-0.08, fit.chestY - 0.05, fit.chestBackZ - 0.014),
        new THREE.Vector3(-0.2, bagY + 0.06, bagZ - 0.08),
      ],
      0.006,
      std(0x1b1b1b, 0.6),
    ),
  );
  return g;
};

const buildHandbag: Build = (fit, color) => {
  const g = new THREE.Group();
  const mat = std(color, 0.42);
  const top = fit.hand.y - 0.11;
  const bag = mesh(new RoundedBoxGeometry(0.075, 0.17, 0.25, 3, 0.025), mat);
  bag.position.set(fit.hand.x, top - 0.085, fit.hand.z);
  g.add(bag);
  const handle = mesh(new THREE.TorusGeometry(0.07, 0.006, 8, 24, Math.PI), std(0x2a1a12, 0.5));
  handle.rotation.y = Math.PI / 2;
  handle.position.set(fit.hand.x, top, fit.hand.z);
  g.add(handle);
  const clasp = mesh(new THREE.BoxGeometry(0.006, 0.02, 0.03), gold());
  clasp.position.set(fit.hand.x - Math.sign(fit.hand.x) * 0.04, top - 0.03, fit.hand.z);
  g.add(clasp);
  return g;
};

const BUILDERS: Record<string, Build> = {
  casquette: buildCap,
  bonnet: buildBeanie,
  bob: buildBucket,
  beret: buildBeret,
  paille: buildStraw,
  foulard: buildWrap,
  soleil: (fit, color) => glasses(fit, false, color),
  rondes: (fit) => glasses(fit, true, 0xd8aa45),
  'sac-dos': buildBackpack,
  bandouliere: buildCrossbody,
  'sac-main': buildHandbag,
  montre: buildWatch,
  'chaine-or': (fit) => chain(fit, gold()),
  'chaine-argent': (fit) => chain(fit, silver()),
  creoles: buildHoops,
};

/** Builds the item in rig space. `pad` is the hair thickness a hat must clear. */
export function buildAccessory(id: string, fit: RigFit, color: number, pad: number): THREE.Group | null {
  const build = BUILDERS[id];
  if (!build) return null;
  const group = build(fit, color, pad);
  group.name = `accessory-${id}`;
  return group;
}

export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      const map = (mat as THREE.MeshStandardMaterial).map;
      if (map?.userData.owned) map.dispose();
      mat.dispose();
    }
  });
}
