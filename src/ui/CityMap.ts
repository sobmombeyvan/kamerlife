import * as THREE from 'three';
import { DISTRICTS } from '../data/districts';
import { LANDMARK_FOOTPRINTS } from '../landmarks/LandmarkSites';
import type { TaxiDestination } from '../vehicles/TaxiDestinations';
import { estimateFare } from '../vehicles/TaxiDestinations';
import { WorldConfig } from '../config/WorldConfig';
import { HIGHWAY_EW_Z, HIGHWAY_NS_X, ROAD_GRID } from '../roads/CityRoadPlan';

export type MapCallbacks = {
  onOrderRide: (dest: TaxiDestination) => void;
  onClose: () => void;
};

/**
 * Interactive 3D city map — click anywhere to take a taxi there.
 */
export class CityMap {
  private readonly overlay: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly fareEl: HTMLElement;
  private readonly hintEl: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly ground: THREE.Mesh;
  private readonly playerMarker: THREE.Group;
  private readonly hoverPin: THREE.Mesh;
  private readonly destGroup = new THREE.Group();
  private open = false;
  private playerX = 0;
  private playerZ = 0;
  private destinations: TaxiDestination[] = [];
  private callbacks: MapCallbacks | null = null;
  private animId = 0;
  private viewHalf = 900;
  private pending: TaxiDestination | null = null;
  private drag: { x: number; y: number; ox: number; oz: number } | null = null;
  private camTarget = new THREE.Vector2(0, 0);

  constructor(parent: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.id = 'city-map';
    this.overlay.className = 'city-map hidden';
    this.overlay.innerHTML = `
      <div class="city-map-card city-map-card-3d">
        <div class="city-map-head">
          <strong>Carte 3D · Yaoundé</strong>
          <button type="button" id="map-close" aria-label="Fermer">✕</button>
        </div>
        <canvas id="map-canvas-3d"></canvas>
        <p class="city-map-legend" id="map-hint">Clique pour aller · glisse pour explorer · molette zoom</p>
        <p class="city-map-fare" id="map-fare">Sélectionne une destination</p>
        <div class="city-map-actions">
          <button type="button" class="map-go-btn" id="map-go" disabled>Yango · y aller</button>
        </div>
      </div>
    `;
    parent.appendChild(this.overlay);
    this.canvas = this.overlay.querySelector('#map-canvas-3d') as HTMLCanvasElement;
    this.fareEl = this.overlay.querySelector('#map-fare') as HTMLElement;
    this.hintEl = this.overlay.querySelector('#map-hint') as HTMLElement;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'low-power',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x1a2830, 1);

    const aspect = 1;
    this.camera = new THREE.OrthographicCamera(
      -this.viewHalf * aspect,
      this.viewHalf * aspect,
      this.viewHalf,
      -this.viewHalf,
      1,
      5000,
    );
    this.camera.position.set(0, 1200, 0);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, 0);

    this.scene.fog = new THREE.Fog(0x1a2830, 800, 2200);
    const hemi = new THREE.HemisphereLight(0xb8d4ff, 0x3d5c4a, 1.1);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d6, 0.85);
    sun.position.set(200, 400, 100);
    this.scene.add(sun);

    const groundGeo = new THREE.PlaneGeometry(WorldConfig.worldHalfSize * 2.2, WorldConfig.worldHalfSize * 2.2);
    this.ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshLambertMaterial({ color: 0x3d6b4f }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.buildCityMesh();
    this.scene.add(this.destGroup);

    this.playerMarker = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(10, 10, 4, 16),
      new THREE.MeshBasicMaterial({ color: 0x42a5f5 }),
    );
    disc.position.y = 2;
    this.playerMarker.add(disc);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(14, 18, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 4;
    this.playerMarker.add(ring);
    this.scene.add(this.playerMarker);

    this.hoverPin = new THREE.Mesh(
      new THREE.ConeGeometry(8, 22, 8),
      new THREE.MeshBasicMaterial({ color: 0xffc857 }),
    );
    this.hoverPin.rotation.x = Math.PI;
    this.hoverPin.position.y = 18;
    this.hoverPin.visible = false;
    this.scene.add(this.hoverPin);

    this.overlay.querySelector('#map-close')!.addEventListener('click', () => this.hide());
    this.overlay.querySelector('#map-go')!.addEventListener('click', () => this.confirmGo());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.viewHalf = THREE.MathUtils.clamp(this.viewHalf + e.deltaY * 0.35, 220, 1400);
        this.syncCamera();
      },
      { passive: false },
    );
  }

  isOpen(): boolean {
    return this.open;
  }

  show(
    playerX: number,
    playerZ: number,
    destinations: TaxiDestination[],
    callbacks: MapCallbacks,
  ): void {
    this.playerX = playerX;
    this.playerZ = playerZ;
    this.destinations = destinations;
    this.callbacks = callbacks;
    this.open = true;
    this.pending = null;
    this.camTarget.set(playerX, playerZ);
    this.overlay.classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
    this.resize();
    this.refreshDestMarkers();
    this.updatePlayer(playerX, playerZ);
    this.fareEl.textContent = 'Clique sur la carte pour choisir où aller';
    (this.overlay.querySelector('#map-go') as HTMLButtonElement).disabled = true;
    this.hintEl.textContent = 'Clique pour aller · glisse pour explorer · molette zoom';
    cancelAnimationFrame(this.animId);
    const loop = () => {
      if (!this.open) return;
      this.playerMarker.rotation.y += 0.02;
      this.renderer.render(this.scene, this.camera);
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  hide(): void {
    if (!this.open) return;
    this.open = false;
    this.overlay.classList.add('hidden');
    cancelAnimationFrame(this.animId);
    this.callbacks?.onClose();
  }

  updatePlayer(x: number, z: number): void {
    this.playerX = x;
    this.playerZ = z;
    this.playerMarker.position.set(x, 0, z);
    if (this.open && !this.drag) {
      // gentle follow only at open — keep user's pan
    }
  }

  private confirmGo(): void {
    if (!this.pending || !this.callbacks) return;
    const dest = this.pending;
    const cb = this.callbacks;
    this.hide();
    cb.onOrderRide(dest);
  }

  private resize(): void {
    const w = Math.min(720, window.innerWidth * 0.92);
    const h = Math.min(520, window.innerHeight * 0.62);
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.renderer.setSize(w, h, false);
    this.syncCamera();
  }

  private syncCamera(): void {
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    this.camera.left = -this.viewHalf * aspect;
    this.camera.right = this.viewHalf * aspect;
    this.camera.top = this.viewHalf;
    this.camera.bottom = -this.viewHalf;
    this.camera.position.set(this.camTarget.x, 1200, this.camTarget.y);
    this.camera.lookAt(this.camTarget.x, 0, this.camTarget.y);
    this.camera.updateProjectionMatrix();
  }

  private buildCityMesh(): void {
    const roads = new THREE.Group();
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x2a2e32 });
    const hwyMat = new THREE.MeshLambertMaterial({ color: 0x1c2024 });
    const half = WorldConfig.worldHalfSize;

    // Highways
    const hwyNS = new THREE.Mesh(new THREE.BoxGeometry(28, 1.2, half * 2), hwyMat);
    hwyNS.position.set(HIGHWAY_NS_X, 0.6, 0);
    roads.add(hwyNS);
    const hwyEW = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 1.2, 28), hwyMat);
    hwyEW.position.set(0, 0.6, HIGHWAY_EW_Z);
    roads.add(hwyEW);

    for (let v = -half; v <= half; v += ROAD_GRID) {
      if (Math.abs(v) < 0.5) continue;
      const avenue = Math.abs(v) % (ROAD_GRID * 2) === 0;
      const w = avenue ? 14 : 9;
      const ns = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, half * 2), roadMat);
      ns.position.set(v, 0.4, 0);
      roads.add(ns);
      const ew = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.8, w), roadMat);
      ew.position.set(0, 0.4, v);
      roads.add(ew);
    }
    this.scene.add(roads);

    // District pads
    for (const d of DISTRICTS) {
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(d.radius * 0.12, d.radius * 0.14, 2, 12),
        new THREE.MeshLambertMaterial({ color: 0x4a7a62, transparent: true, opacity: 0.45 }),
      );
      pad.position.set(d.center.x, 1, d.center.z);
      this.scene.add(pad);
    }

    // Landmark extrusions
    for (const lm of LANDMARK_FOOTPRINTS) {
      if (lm.id.startsWith('hub-')) continue;
      const h =
        lm.id.includes('airport')
          ? 40
          : lm.id.includes('kennedy')
            ? 14
            : lm.id.includes('hopital')
              ? 28
              : lm.id.includes('eglise')
                ? 36
                : lm.id.includes('mosquee')
                  ? 32
                  : 18;
      const color =
        lm.id === 'hopital-central'
          ? 0xef5350
          : lm.id === 'eglise-cathedrale'
            ? 0xffecb3
            : lm.id === 'mosquee-centrale'
              ? 0x66bb6a
              : lm.id.includes('kennedy')
                ? 0xffc107
                : lm.id === 'player-house'
                  ? 0xffc857
                  : 0x90a4ae;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(16, lm.halfW * 1.2), h, Math.max(16, lm.halfD * 1.2)),
        new THREE.MeshLambertMaterial({ color }),
      );
      box.position.set(lm.x, h / 2, lm.z);
      this.scene.add(box);
    }
  }

  private refreshDestMarkers(): void {
    while (this.destGroup.children.length) {
      this.destGroup.remove(this.destGroup.children[0]!);
    }
    const mat = new THREE.MeshBasicMaterial({ color: 0xff8a65 });
    for (const d of this.destinations) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 8), mat);
      m.position.set(d.x, 10, d.z);
      m.userData.destId = d.id;
      this.destGroup.add(m);
    }
  }

  private pickWorld(e: PointerEvent): { x: number; z: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.ground);
    if (!hits.length) return null;
    const p = hits[0]!.point;
    return { x: p.x, z: p.z };
  }

  private onPointerDown(e: PointerEvent): void {
    this.canvas.setPointerCapture(e.pointerId);
    this.drag = {
      x: e.clientX,
      y: e.clientY,
      ox: this.camTarget.x,
      oz: this.camTarget.y,
    };
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.drag) {
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      if (Math.hypot(dx, dy) > 4) {
        const scale = (this.viewHalf * 2) / this.canvas.height;
        this.camTarget.x = this.drag.ox - dx * scale;
        this.camTarget.y = this.drag.oz - dy * scale;
        this.syncCamera();
      }
      return;
    }
    const w = this.pickWorld(e);
    if (!w) {
      this.hoverPin.visible = false;
      return;
    }
    this.hoverPin.visible = true;
    this.hoverPin.position.set(w.x, 18, w.z);
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.drag) return;
    const moved = Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y);
    this.drag = null;
    if (moved > 8) return; // was a pan

    const w = this.pickWorld(e);
    if (!w) return;

    // Snap to nearest known destination if close, else free pin
    let best: TaxiDestination | null = null;
    let bestD = 90;
    for (const d of this.destinations) {
      const dist = Math.hypot(d.x - w.x, d.z - w.z);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }

    const dest: TaxiDestination = best ?? {
      id: `pin-${Math.round(w.x)}-${Math.round(w.z)}`,
      name: `Point · ${Math.round(w.x)}, ${Math.round(w.z)}`,
      x: w.x,
      z: w.z,
      fareFcfa: 800,
    };

    this.pending = dest;
    this.hoverPin.visible = true;
    this.hoverPin.position.set(dest.x, 18, dest.z);
    (this.hoverPin.material as THREE.MeshBasicMaterial).color.setHex(0xff5252);

    const fare = estimateFare(this.playerX, this.playerZ, dest);
    this.fareEl.textContent = `${dest.name} · ~${fare.toLocaleString('fr-FR')} FCFA`;
    (this.overlay.querySelector('#map-go') as HTMLButtonElement).disabled = false;
    this.hintEl.textContent = 'Confirme avec Yango ou reclique ailleurs';
  }
}
