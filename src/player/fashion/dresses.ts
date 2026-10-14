import * as THREE from 'three';
import type { ClothId } from '../PlayerLook';
import type { RigFit } from './fit';
import { waxTexture } from './textures';

export type DressCut = 'bustier' | 'bretelles' | 'dos-nu' | 'epaules';

export type DressDef = {
  id: string;
  name: string;
  detail: string;
  cut: DressCut;
  /** Hem height as a fraction of the hip height: 0.1 brushes the floor. */
  hem: number;
  /** Hem width relative to the hips. 1 is a straight cut. */
  flare: number;
  /** Where the flare starts, between the hips (0) and the hem (1). */
  breakAt: number;
  fabric: 'satin' | 'mat' | 'wax';
  /** FCFA; starter dresses are free and always owned. */
  price: number;
  starter: boolean;
  baseColor: ClothId;
};

/**
 * Procedural dresses for the female characters. Every entry is built from the
 * measured rig in `buildDress`, so there is no missing mesh to load.
 */
export const DRESSES: DressDef[] = [
  {
    id: 'robe-moulante',
    name: 'Robe moulante',
    detail: 'Bustier, coupe près du corps',
    cut: 'bustier',
    hem: 0.5,
    flare: 1.05,
    breakAt: 0.85,
    fabric: 'satin',
    price: 0,
    starter: true,
    baseColor: 'noir',
  },
  {
    id: 'robe-cocktail',
    name: 'Robe cocktail',
    detail: 'Bretelles fines, jupe évasée',
    cut: 'bretelles',
    hem: 0.56,
    flare: 1.45,
    breakAt: 0.25,
    fabric: 'satin',
    price: 0,
    starter: true,
    baseColor: 'bordeaux',
  },
  {
    id: 'robe-sirene',
    name: 'Robe sirène',
    detail: 'Ajustée puis évasée au mollet',
    cut: 'bustier',
    hem: 0.12,
    flare: 1.9,
    breakAt: 0.72,
    fabric: 'satin',
    price: 38000,
    starter: false,
    baseColor: 'prune',
  },
  {
    id: 'robe-soiree',
    name: 'Robe de soirée',
    detail: 'Dos nu, tombé long',
    cut: 'dos-nu',
    hem: 0.1,
    flare: 1.5,
    breakAt: 0.1,
    fabric: 'satin',
    price: 45000,
    starter: false,
    baseColor: 'dore',
  },
  {
    id: 'robe-wax',
    name: 'Robe wax',
    detail: 'Pagne imprimé, épaules couvertes',
    cut: 'epaules',
    hem: 0.3,
    flare: 1.35,
    breakAt: 0.3,
    fabric: 'wax',
    price: 22000,
    starter: false,
    baseColor: 'terre',
  },
  {
    id: 'robe-courte',
    name: 'Robe courte',
    detail: 'Mini, décolleté, bretelles',
    cut: 'bretelles',
    hem: 0.72,
    flare: 1.18,
    breakAt: 0.35,
    fabric: 'satin',
    price: 0,
    starter: true,
    baseColor: 'rouge',
  },
];

export function dressById(id: string | null | undefined): DressDef | undefined {
  return DRESSES.find((d) => d.id === id);
}

type Ring = { y: number; rx: number; rz: number; cz: number };

const SEG = 28;

/** Lofts an elliptical tube through rings, closed at the bottom. */
function shell(rings: Ring[], mat: THREE.Material): THREE.Mesh {
  const pos: number[] = [];
  const index: number[] = [];
  for (const ring of rings) {
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      pos.push(Math.sin(a) * ring.rx, ring.y, ring.cz + Math.cos(a) * ring.rz);
    }
  }
  const stride = SEG + 1;
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < SEG; i++) {
      const a = r * stride + i;
      index.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1);
    }
  }
  // Hem disc, so a low camera does not look up inside the skirt.
  const last = rings[rings.length - 1]!;
  const centre = pos.length / 3;
  pos.push(0, last.y, last.cz);
  for (let i = 0; i < SEG; i++) {
    const a = (rings.length - 1) * stride + i;
    index.push(centre, a + 1, a);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.renderOrder = 2;
  return mesh;
}

function strap(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, mat: THREE.Material): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3([a, b, c], false, 'centripetal');
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.009, 6), mat);
}

function fabricMaterial(def: DressDef, color: number): THREE.MeshStandardMaterial {
  if (def.fabric === 'wax') {
    // The print carries its own colors, so the base tint stays neutral.
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      map: waxTexture(color),
      side: THREE.FrontSide,
    });
  }
  if (def.fabric === 'satin') {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.26,
      metalness: 0.22,
      side: THREE.FrontSide,
    });
  }
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, side: THREE.FrontSide });
}

/** Builds the dress in rig space, ready to attach to the lower spine. */
export function buildDress(def: DressDef, fit: RigFit, color: number): THREE.Group {
  const g = new THREE.Group();
  g.name = `dress-${def.id}`;
  const mat = fabricMaterial(def, color);

  // Chest stays inside the arms; hips sit just outside the trousers.
  const chestRz = (fit.chestFrontZ - fit.chestBackZ) / 2 + 0.016;
  const chestCz = (fit.chestFrontZ + fit.chestBackZ) / 2;
  const chestRx = fit.shoulderX * 0.62;
  const hipRx = 0.255;
  const hipRz = 0.125;
  const hipCz = fit.hipFrontZ - hipRz + 0.03;
  const waistY = fit.hipY + (fit.chestY - fit.hipY) * 0.5;
  const waistRx = 0.2;
  const waistRz = 0.11;
  const waistCz = (hipCz + chestCz) / 2;
  const covered = def.cut === 'epaules';
  const strapped = def.cut === 'bretelles' || def.cut === 'dos-nu';
  const topY = covered ? fit.chestY + 0.16 : strapped ? fit.chestY + 0.02 : fit.chestY - 0.03;

  const rings: Ring[] = [
    { y: topY, rx: chestRx * (covered ? 0.92 : 0.78), rz: chestRz * 0.72, cz: chestCz + 0.01 },
    { y: fit.chestY + 0.04, rx: chestRx * 1.05, rz: chestRz * 1.02, cz: chestCz + 0.018 },
    { y: waistY, rx: waistRx, rz: waistRz, cz: waistCz },
    { y: fit.hipY, rx: hipRx, rz: hipRz, cz: hipCz },
  ];

  // Skirt: straight to the break point, then flared out to the hem.
  const hemY = fit.hipY * def.hem;
  const drop = fit.hipY - hemY;
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const y = fit.hipY - drop * t;
    const spread = t <= def.breakAt ? 0 : (t - def.breakAt) / (1 - def.breakAt);
    // Follow the thigh in before the break, then open out to the hem.
    const k = (1 - 0.07 * Math.min(t / Math.max(def.breakAt, 0.2), 1)) + (def.flare - 1) * spread * spread;
    rings.push({ y, rx: hipRx * k, rz: hipRz * k, cz: hipCz });
  }
  const body = shell(rings, mat);
  body.name = 'dress-shell';
  g.add(body);

  if (def.cut === 'bretelles' || def.cut === 'dos-nu') {
    const back = def.cut === 'dos-nu' ? fit.chestY - 0.02 : topY - 0.01;
    for (const side of [-1, 1]) {
      g.add(
        strap(
          new THREE.Vector3(side * chestRx * 0.55, topY - 0.012, chestCz + chestRz * 0.82),
          new THREE.Vector3(side * 0.088, fit.shoulderTopY + 0.004, fit.neckZ),
          new THREE.Vector3(side * chestRx * 0.6, back, chestCz - chestRz * 0.85),
          mat,
        ),
      );
    }
  }
  if (def.cut === 'epaules') {
    for (const side of [-1, 1]) {
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.046, 0.09, 14, 1, true), mat);
      sleeve.position.set(side * (chestRx * 0.96), topY - 0.045, chestCz);
      sleeve.rotation.z = side * 0.22;
      g.add(sleeve);
    }
  }
  return g;
}
