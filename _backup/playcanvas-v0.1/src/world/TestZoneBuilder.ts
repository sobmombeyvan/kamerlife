import * as pc from 'playcanvas';
import type { CollisionWorld } from './CollisionWorld';

/** Compact Mendong-inspired test block: road, sidewalks, shops, houses. */
export class TestZoneBuilder {
  constructor(
    private readonly app: pc.AppBase,
    private readonly collisions: CollisionWorld,
  ) {}

  build(): void {
    this.collisions.clear();
    this.createGround();
    this.createRoad();
    this.createSidewalks();
    this.createBuildings();
    this.createProps();
  }

  private createGround(): void {
    const ground = this.mesh('ground', 'box', 0.28, 0.55, 0.28);
    ground.setLocalScale(80, 0.2, 80);
    ground.setPosition(0, -0.1, 0);
    this.app.root.addChild(ground);
  }

  private createRoad(): void {
    this.roadSegment(0, 0, 36, 7);
    this.roadSegment(0, 0, 7, 36);

    this.laneMarking(0, 0.02, 0, 34, 0.12, true);
    // North-south center line
    const ns = this.mesh('lane-ns', 'box', 0.92, 0.85, 0.2);
    ns.setLocalScale(0.12, 0.02, 34);
    ns.setPosition(0, 0.05, 0);
    this.app.root.addChild(ns);

    for (let i = -3; i <= 3; i++) {
      this.stripe(i * 0.55, 0.03, 4.2, 0.35, 0.08, 1.4);
      this.stripe(4.2, 0.03, i * 0.55, 1.4, 0.08, 0.35);
    }
  }

  private roadSegment(x: number, z: number, sizeX: number, sizeZ: number): void {
    const road = this.mesh('road', 'box', 0.18, 0.18, 0.2);
    road.setLocalScale(sizeX, 0.08, sizeZ);
    road.setPosition(x, 0.04, z);
    this.app.root.addChild(road);
  }

  private laneMarking(x: number, y: number, z: number, sx: number, sy: number, dashed: boolean): void {
    if (!dashed) {
      const line = this.mesh('lane', 'box', 0.92, 0.85, 0.2);
      line.setLocalScale(sx, sy, 0.15);
      line.setPosition(x, y, z);
      this.app.root.addChild(line);
      return;
    }

    const count = Math.floor(sx / 2.2);
    for (let i = -count; i <= count; i++) {
      if (i === 0) continue;
      const dash = this.mesh('dash', 'box', 0.95, 0.95, 0.95);
      dash.setLocalScale(1.2, sy, 0.12);
      dash.setPosition(i * 2.2, y, z);
      this.app.root.addChild(dash);
    }
  }

  private stripe(x: number, y: number, z: number, sx: number, sy: number, sz: number): void {
    const s = this.mesh('stripe', 'box', 0.95, 0.95, 0.95);
    s.setLocalScale(sx, sy, sz);
    s.setPosition(x, y, z);
    this.app.root.addChild(s);
  }

  private createSidewalks(): void {
    const pads: Array<[number, number, number, number]> = [
      [0, 6.5, 36, 2.2],
      [0, -6.5, 36, 2.2],
      [6.5, 0, 2.2, 36],
      [-6.5, 0, 2.2, 36],
    ];
    for (const [x, z, sx, sz] of pads) {
      const walk = this.mesh('sidewalk', 'box', 0.72, 0.7, 0.66);
      walk.setLocalScale(sx, 0.16, sz);
      walk.setPosition(x, 0.08, z);
      this.app.root.addChild(walk);

      const towardRoadX = Math.abs(x) > Math.abs(z);
      const curb = this.mesh('curb', 'box', 0.45, 0.45, 0.48);
      curb.setLocalScale(towardRoadX ? 0.25 : sx, 0.22, towardRoadX ? sz : 0.25);
      curb.setPosition(
        towardRoadX ? x - Math.sign(x) * (sx / 2 - 0.1) : x,
        0.11,
        towardRoadX ? z : z - Math.sign(z) * (sz / 2 - 0.1),
      );
      this.app.root.addChild(curb);
    }
  }

  private createBuildings(): void {
    this.building(-12, 12, 6, 3.2, 7, 0.78, 0.55, 0.32, 'Maison familiale');
    this.building(12, 11, 5.5, 3.6, 5.5, 0.85, 0.35, 0.28, 'Boutique');
    this.building(13, -12, 6, 3, 5, 0.95, 0.75, 0.25, 'Snack');
    this.building(-13, -12, 7, 6.5, 6, 0.7, 0.72, 0.75, 'Immeuble');
    this.building(8, 14, 4, 2.6, 3.5, 0.2, 0.45, 0.55, 'Quincaillerie');
    this.building(-8, -15, 5, 3, 6, 0.9, 0.82, 0.7, 'Maison');
  }

  private building(
    x: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    r: number,
    g: number,
    b: number,
    name: string,
  ): void {
    const body = this.mesh(name, 'box', r, g, b);
    body.setLocalScale(sx, sy, sz);
    body.setPosition(x, sy / 2, z);
    this.app.root.addChild(body);

    const roof = this.mesh(`${name}-roof`, 'box', 0.35, 0.22, 0.15);
    roof.setLocalScale(sx + 0.4, 0.35, sz + 0.4);
    roof.setPosition(x, sy + 0.15, z);
    this.app.root.addChild(roof);

    const door = this.mesh(`${name}-door`, 'box', 0.25, 0.15, 0.1);
    door.setLocalScale(1.1, 2, 0.12);
    const faceZ = Math.abs(z) > Math.abs(x);
    door.setPosition(
      faceZ ? x : x + Math.sign(x || 1) * (sx / 2 + 0.05),
      1,
      faceZ ? z + Math.sign(z || 1) * (sz / 2 + 0.05) : z,
    );
    this.app.root.addChild(door);

    this.collisions.addBox(x, sy / 2, z, sx / 2, sy / 2, sz / 2);
  }

  private createProps(): void {
    for (const [x, z] of [
      [-5, -5],
      [5, -5],
      [-5, 5],
      [5, 5],
      [-18, 0],
      [18, 0],
    ] as const) {
      this.lamp(x, z);
    }

    for (const [x, z] of [
      [-18, 16],
      [18, 16],
      [-18, -16],
      [16, -18],
      [0, 18],
      [0, -18],
    ] as const) {
      this.tree(x, z);
    }

    const stall = this.mesh('etal', 'box', 0.9, 0.55, 0.15);
    stall.setLocalScale(2.5, 1.2, 1.4);
    stall.setPosition(10, 0.7, 7.8);
    this.app.root.addChild(stall);
    this.collisions.addBox(10, 0.7, 7.8, 1.25, 0.6, 0.7);

    const canopy = this.mesh('etal-toit', 'box', 0.15, 0.55, 0.35);
    canopy.setLocalScale(3, 0.12, 1.8);
    canopy.setPosition(10, 1.55, 7.8);
    this.app.root.addChild(canopy);
  }

  private lamp(x: number, z: number): void {
    const pole = this.mesh('lamp-pole', 'cylinder', 0.25, 0.25, 0.28);
    pole.setLocalScale(0.12, 3.2, 0.12);
    pole.setPosition(x, 1.6, z);
    this.app.root.addChild(pole);

    const head = this.mesh('lamp-head', 'box', 0.9, 0.85, 0.55);
    head.setLocalScale(0.5, 0.2, 0.35);
    head.setPosition(x, 3.25, z);
    this.app.root.addChild(head);

    this.collisions.addBox(x, 1.6, z, 0.15, 1.6, 0.15);
  }

  private tree(x: number, z: number): void {
    const trunk = this.mesh('trunk', 'cylinder', 0.4, 0.25, 0.12);
    trunk.setLocalScale(0.35, 1.8, 0.35);
    trunk.setPosition(x, 0.9, z);
    this.app.root.addChild(trunk);

    const foliage = this.mesh('foliage', 'sphere', 0.15, 0.55, 0.22);
    foliage.setLocalScale(2.4, 2.2, 2.4);
    foliage.setPosition(x, 2.6, z);
    this.app.root.addChild(foliage);

    this.collisions.addBox(x, 1.2, z, 0.4, 1.2, 0.4);
  }

  private mesh(
    name: string,
    type: 'box' | 'sphere' | 'cylinder',
    r: number,
    g: number,
    b: number,
  ): pc.Entity {
    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color(r, g, b);
    material.specular = new pc.Color(0.04, 0.04, 0.04);
    material.shininess = 12;
    material.useLighting = true;
    material.update();

    const entity = new pc.Entity(name);
    entity.addComponent('render', {
      type,
      material,
      castShadows: false,
      receiveShadows: false,
    });
    return entity;
  }
}
