import * as THREE from 'three';

/**
 * Local frame for one building / prop: origin + yaw. Front of a building faces local +Z.
 */
export class Frame {
  constructor(
    public x = 0,
    public z = 0,
    public yaw = 0,
    public y = 0,
  ) {}

  get cos(): number {
    return Math.cos(this.yaw);
  }

  get sin(): number {
    return Math.sin(this.yaw);
  }

  /** Local (lx, ly, lz) → world. */
  apply(lx: number, ly: number, lz: number, out: number[]): void {
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    out[0] = this.x + lx * c + lz * s;
    out[1] = this.y + ly;
    out[2] = this.z - lx * s + lz * c;
  }

  dir(lx: number, lz: number, out: number[]): void {
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    out[0] = lx * c + lz * s;
    out[1] = 0;
    out[2] = -lx * s + lz * c;
  }

  child(lx: number, lz: number, yaw = 0, ly = 0): Frame {
    const p = [0, 0, 0];
    this.apply(lx, ly, lz, p);
    return new Frame(p[0]!, p[2]!, this.yaw + yaw, p[1]!);
  }
}

const tmpA = [0, 0, 0];
const tmpB = [0, 0, 0];
const tmpC = [0, 0, 0];
const tmpD = [0, 0, 0];
const tmpN = [0, 0, 0];
const color = new THREE.Color();

/**
 * Growable vertex-coloured geometry (position, normal, uv in metres, colour).
 * Used for kit details, roofs, props — many objects, one draw call per material.
 */
export class KitBatch {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  idx: number[] = [];

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  private vert(p: number[], n: number[], u: number, v: number, c: THREE.Color): void {
    this.pos.push(p[0]!, p[1]!, p[2]!);
    this.nor.push(n[0]!, n[1]!, n[2]!);
    this.uv.push(u, v);
    this.col.push(c.r, c.g, c.b);
  }

  /** Quad from 4 world points (counter-clockwise seen from the normal side). */
  quadWorld(a: number[], b: number[], c: number[], d: number[], hex: number, uw = 1, vh = 1): void {
    const ux = b[0]! - a[0]!;
    const uy = b[1]! - a[1]!;
    const uz = b[2]! - a[2]!;
    const vx = d[0]! - a[0]!;
    const vy = d[1]! - a[1]!;
    const vz = d[2]! - a[2]!;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    tmpN[0] = nx;
    tmpN[1] = ny;
    tmpN[2] = nz;
    color.setHex(hex);
    const base = this.vertexCount;
    this.vert(a, tmpN, 0, 0, color);
    this.vert(b, tmpN, uw, 0, color);
    this.vert(c, tmpN, uw, vh, color);
    this.vert(d, tmpN, 0, vh, color);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** Horizontal rect in frame-local (u = local x, v = local z) with world-planar UVs, facing up. */
  flat(f: Frame, u0: number, u1: number, v0: number, v1: number, y: number, hex: number): void {
    f.apply(u0, y, v0, tmpA);
    f.apply(u0, y, v1, tmpB);
    f.apply(u1, y, v1, tmpC);
    f.apply(u1, y, v0, tmpD);
    color.setHex(hex);
    tmpN[0] = 0;
    tmpN[1] = 1;
    tmpN[2] = 0;
    const base = this.vertexCount;
    for (const p of [tmpA, tmpB, tmpC, tmpD]) this.vert(p, tmpN, p[0]!, p[2]!, color);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** Flat disc (manholes, light pools use quads instead). */
  disc(x: number, y: number, z: number, r: number, hex: number, seg = 10): void {
    color.setHex(hex);
    tmpN[0] = 0;
    tmpN[1] = 1;
    tmpN[2] = 0;
    const base = this.vertexCount;
    tmpA[0] = x;
    tmpA[1] = y;
    tmpA[2] = z;
    this.vert(tmpA, tmpN, x, z, color);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      tmpA[0] = x + Math.cos(a) * r;
      tmpA[2] = z - Math.sin(a) * r;
      this.vert(tmpA, tmpN, tmpA[0], tmpA[2], color);
    }
    for (let i = 0; i < seg; i++) this.idx.push(base, base + 1 + i, base + 2 + i);
  }

  /** Triangle in frame-local coordinates (gable ends, hip roof ends). */
  tri(f: Frame, a: [number, number, number], b: [number, number, number], c: [number, number, number], hex: number): void {
    f.apply(...a, tmpA);
    f.apply(...b, tmpB);
    f.apply(...c, tmpC);
    const ux = tmpB[0]! - tmpA[0]!;
    const uy = tmpB[1]! - tmpA[1]!;
    const uz = tmpB[2]! - tmpA[2]!;
    const vx = tmpC[0]! - tmpA[0]!;
    const vy = tmpC[1]! - tmpA[1]!;
    const vz = tmpC[2]! - tmpA[2]!;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    tmpN[0] = nx;
    tmpN[1] = ny;
    tmpN[2] = nz;
    color.setHex(hex);
    const base = this.vertexCount;
    const lu = Math.hypot(ux, uy, uz);
    this.vert(tmpA, tmpN, 0, 0, color);
    this.vert(tmpB, tmpN, lu, 0, color);
    this.vert(tmpC, tmpN, (ux * vx + uy * vy + uz * vz) / (lu || 1), Math.hypot(vx, vy, vz), color);
    this.idx.push(base, base + 1, base + 2);
  }

  /** Axis-aligned box in a frame: centre (lx, ly, lz), full size (sx, sy, sz). */
  box(f: Frame, lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, hex: number, skipBottom = true): void {
    const x0 = lx - sx / 2;
    const x1 = lx + sx / 2;
    const y0 = ly - sy / 2;
    const y1 = ly + sy / 2;
    const z0 = lz - sz / 2;
    const z1 = lz + sz / 2;
    const P = (x: number, y: number, z: number, out: number[]) => f.apply(x, y, z, out);
    // +Z front
    P(x0, y0, z1, tmpA); P(x1, y0, z1, tmpB); P(x1, y1, z1, tmpC); P(x0, y1, z1, tmpD);
    this.quadWorld(tmpA, tmpB, tmpC, tmpD, hex, sx, sy);
    // -Z back
    P(x1, y0, z0, tmpA); P(x0, y0, z0, tmpB); P(x0, y1, z0, tmpC); P(x1, y1, z0, tmpD);
    this.quadWorld(tmpA, tmpB, tmpC, tmpD, hex, sx, sy);
    // +X
    P(x1, y0, z1, tmpA); P(x1, y0, z0, tmpB); P(x1, y1, z0, tmpC); P(x1, y1, z1, tmpD);
    this.quadWorld(tmpA, tmpB, tmpC, tmpD, hex, sz, sy);
    // -X
    P(x0, y0, z0, tmpA); P(x0, y0, z1, tmpB); P(x0, y1, z1, tmpC); P(x0, y1, z0, tmpD);
    this.quadWorld(tmpA, tmpB, tmpC, tmpD, hex, sz, sy);
    // top
    P(x0, y1, z1, tmpA); P(x1, y1, z1, tmpB); P(x1, y1, z0, tmpC); P(x0, y1, z0, tmpD);
    this.quadWorld(tmpA, tmpB, tmpC, tmpD, hex, sx, sz);
    if (!skipBottom) {
      P(x0, y0, z0, tmpA); P(x1, y0, z0, tmpB); P(x1, y0, z1, tmpC); P(x0, y0, z1, tmpD);
      this.quadWorld(tmpA, tmpB, tmpC, tmpD, hex, sx, sz);
    }
  }

  /** Vertical cylinder (or cone when rTop ≠ rBottom). */
  cylinder(f: Frame, lx: number, ly: number, lz: number, rBottom: number, rTop: number, h: number, hex: number, seg = 8, cap = true): void {
    color.setHex(hex);
    const c = [0, 0, 0];
    f.apply(lx, ly, lz, c);
    const base = this.vertexCount;
    const slope = (rBottom - rTop) / h;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const nl = Math.hypot(1, slope);
      tmpN[0] = ca / nl;
      tmpN[1] = slope / nl;
      tmpN[2] = sa / nl;
      tmpA[0] = c[0]! + ca * rBottom;
      tmpA[1] = c[1]!;
      tmpA[2] = c[2]! + sa * rBottom;
      this.vert(tmpA, tmpN, (i / seg) * Math.PI * 2 * rBottom, 0, color);
      tmpA[0] = c[0]! + ca * rTop;
      tmpA[1] = c[1]! + h;
      tmpA[2] = c[2]! + sa * rTop;
      this.vert(tmpA, tmpN, (i / seg) * Math.PI * 2 * rBottom, h, color);
    }
    for (let i = 0; i < seg; i++) {
      const a = base + i * 2;
      this.idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    if (cap && rTop > 0.001) {
      const centre = this.vertexCount;
      tmpN[0] = 0;
      tmpN[1] = 1;
      tmpN[2] = 0;
      tmpA[0] = c[0]!;
      tmpA[1] = c[1]! + h;
      tmpA[2] = c[2]!;
      this.vert(tmpA, tmpN, 0, 0, color);
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        tmpA[0] = c[0]! + Math.cos(a) * rTop;
        tmpA[2] = c[2]! + Math.sin(a) * rTop;
        this.vert(tmpA, tmpN, Math.cos(a) * rTop, Math.sin(a) * rTop, color);
      }
      for (let i = 0; i < seg; i++) this.idx.push(centre, centre + 2 + i, centre + 1 + i);
    }
  }

  /** Sloped plane between two world-height edges (roof sheets, ramps). */
  slab(f: Frame, corners: Array<[number, number, number]>, hex: number, uw = 1, vh = 1): void {
    f.apply(...corners[0]!, tmpA);
    f.apply(...corners[1]!, tmpB);
    f.apply(...corners[2]!, tmpC);
    f.apply(...corners[3]!, tmpD);
    this.quadWorld(tmpA, tmpB, tmpC, tmpD, hex, uw, vh);
  }

  /** Thin segment between two world points (cables, rails), as a flat ribbon facing up/sideways. */
  ribbon(a: number[], b: number[], width: number, hex: number): void {
    const dx = b[0]! - a[0]!;
    const dz = b[2]! - a[2]!;
    const l = Math.hypot(dx, dz) || 1;
    const px = (-dz / l) * width * 0.5;
    const pz = (dx / l) * width * 0.5;
    const A = [a[0]! - px, a[1]!, a[2]! - pz];
    const B = [b[0]! - px, b[1]!, b[2]! - pz];
    const C = [b[0]! + px, b[1]!, b[2]! + pz];
    const D = [a[0]! + px, a[1]!, a[2]! + pz];
    this.quadWorld(A, B, C, D, hex, l, width);
    const V = [a[0]!, a[1]! - width * 0.5, a[2]!];
    const W = [b[0]!, b[1]! - width * 0.5, b[2]!];
    const X = [b[0]!, b[1]! + width * 0.5, b[2]!];
    const Y = [a[0]!, a[1]! + width * 0.5, a[2]!];
    this.quadWorld(V, W, X, Y, hex, l, width);
  }

  build(uvScale = 1): THREE.BufferGeometry | null {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    const uv = new Float32Array(this.uv);
    if (uvScale !== 1) for (let i = 0; i < uv.length; i++) uv[i] = uv[i]! * uvScale;
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.vertexCount > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/**
 * Facade quads: uv = (bay, floor) repeat coordinates, aTile = atlas rect, aTint = wall paint,
 * aSeed = per-building random for lit windows.
 */
export class FacadeBatch {
  pos: number[] = [];
  nor: number[] = [];
  rep: number[] = [];
  tile: number[] = [];
  tint: number[] = [];
  seed: number[] = [];
  idx: number[] = [];

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  /**
   * Wall face in frame f: lower-left local corner (lx, ly, lz), running along local +X rotated by
   * faceYaw, width w, height h, tiled into `bays` × `floors` cells of atlas tile `tileRect`.
   */
  wall(
    f: Frame,
    faceYaw: number,
    lx: number,
    ly: number,
    lz: number,
    w: number,
    h: number,
    bays: number,
    floors: number,
    tileRect: readonly [number, number, number, number],
    tintHex: number,
    seed: number,
    floorOffset = 0,
  ): void {
    const c = Math.cos(faceYaw);
    const s = Math.sin(faceYaw);
    // face runs along (c, 0, -s) in local, normal is (s, 0, c)
    const corners: Array<[number, number, number, number, number]> = [
      [lx, ly, lz, 0, floorOffset],
      [lx + c * w, ly, lz - s * w, bays, floorOffset],
      [lx + c * w, ly + h, lz - s * w, bays, floorOffset + floors],
      [lx, ly + h, lz, 0, floorOffset + floors],
    ];
    color.setHex(tintHex);
    const n = [0, 0, 0];
    f.dir(s, c, n);
    const base = this.vertexCount;
    const p = [0, 0, 0];
    for (const [x, y, z, u, v] of corners) {
      f.apply(x, y, z, p);
      this.pos.push(p[0]!, p[1]!, p[2]!);
      this.nor.push(n[0]!, 0, n[2]!);
      this.rep.push(u, v);
      this.tile.push(tileRect[0], tileRect[1], tileRect[2], tileRect[3]);
      this.tint.push(color.r, color.g, color.b);
      this.seed.push(seed);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  build(): THREE.BufferGeometry | null {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aRep', new THREE.Float32BufferAttribute(this.rep, 2));
    g.setAttribute('aTile', new THREE.Float32BufferAttribute(this.tile, 4));
    g.setAttribute('aTint', new THREE.Float32BufferAttribute(this.tint, 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(this.seed, 1));
    g.setIndex(this.vertexCount > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
