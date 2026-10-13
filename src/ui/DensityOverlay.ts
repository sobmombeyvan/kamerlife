import type { CityPlan, Zone } from '../city/CityPlan';
import { CHUNK } from '../city/CityPlan';
import { ROAD_GRID } from '../roads/CityRoadPlan';

const ZONE_COLOR: Record<Zone, string> = {
  core: '#6d7fa8',
  market: '#c9853a',
  dense: '#a5674a',
  student: '#b35d7e',
  family: '#6f9a5a',
  premium: '#4f9c8f',
  logistics: '#7d7d7d',
  periurban: '#9c9a52',
  institutional: '#5c6fc4',
  airport: '#8a8aa0',
  fringe: '#4d6b3a',
};

const SIZE = 340;
/** Metres from the player to the panel edge. */
const RADIUS = 460;
const SPARSE = 0.1;

/**
 * Procedural-generation audit (F4): zoning, building footprints, trees and
 * per-block built coverage around the player. Blocks under 10 % coverage that
 * are not parks / pitches / sites are outlined in red.
 */
export class DensityOverlay {
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly info: HTMLElement;
  private visible = false;
  private timer = 0;

  constructor(
    parent: HTMLElement,
    private readonly plan: CityPlan,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'density-overlay hidden';
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.info = document.createElement('div');
    this.info.className = 'density-info';
    const legend = document.createElement('div');
    legend.className = 'density-legend';
    legend.innerHTML = (Object.keys(ZONE_COLOR) as Zone[])
      .map((z) => `<span><i style="background:${ZONE_COLOR[z]}"></i>${z}</span>`)
      .join('');
    this.root.append(this.canvas, this.info, legend);
    parent.appendChild(this.root);
    this.ctx = this.canvas.getContext('2d')!;
    window.addEventListener('keydown', this.onKey);
  }

  update(dt: number, px: number, pz: number, yaw: number): void {
    if (!this.visible) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.5;
    this.draw(px, pz, yaw);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
  }

  private draw(px: number, pz: number, yaw: number): void {
    const g = this.ctx;
    const k = SIZE / (RADIUS * 2);
    const sx = (x: number) => (x - px) * k + SIZE / 2;
    const sz = (z: number) => (z - pz) * k + SIZE / 2;
    g.fillStyle = '#2a2b2e';
    g.fillRect(0, 0, SIZE, SIZE);

    let blocks = 0;
    let buildings = 0;
    let trees = 0;
    let sparse = 0;
    let coverSum = 0;
    const c0x = Math.floor((px - RADIUS) / CHUNK);
    const c1x = Math.floor((px + RADIUS) / CHUNK);
    const c0z = Math.floor((pz - RADIUS) / CHUNK);
    const c1z = Math.floor((pz + RADIUS) / CHUNK);
    const fixedArea = new Map<string, number>();
    for (let cx = c0x - 1; cx <= c1x + 1; cx++) {
      for (let cz = c0z - 1; cz <= c1z + 1; cz++) {
        for (const p of this.plan.chunk(cx, cz).extras) {
          const key = `${Math.floor(p.x / ROAD_GRID)},${Math.floor(p.z / ROAD_GRID)}`;
          fixedArea.set(key, (fixedArea.get(key) ?? 0) + p.w * p.d);
        }
      }
    }
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cz = c0z; cz <= c1z; cz++) {
        const { blocks: list, extras } = this.plan.chunk(cx, cz);
        for (const b of list) {
          const x0 = b.gx + 9;
          const z0 = b.gz + 9;
          const span = ROAD_GRID - 18;
          g.fillStyle = ZONE_COLOR[b.zone];
          g.globalAlpha = 0.45;
          g.fillRect(sx(x0), sz(z0), span * k, span * k);
          g.globalAlpha = 1;

          let area = fixedArea.get(`${b.gx / ROAD_GRID},${b.gz / ROAD_GRID}`) ?? 0;
          g.fillStyle = '#ece6da';
          for (const p of b.buildings) {
            area += p.w * p.d;
            this.rect(p.x, p.z, p.w, p.d, p.yaw, sx, sz, k);
          }
          g.fillStyle = '#58c25a';
          for (const t of b.trees) g.fillRect(sx(t.x) - 1, sz(t.z) - 1, 2, 2);
          const open = b.specials.some((s) => s.kind === 'park' || s.kind === 'pitch' || s.kind === 'construction');
          const cover = area / (span * span);
          if (Math.abs(b.gx + ROAD_GRID / 2 - px) < RADIUS && Math.abs(b.gz + ROAD_GRID / 2 - pz) < RADIUS) {
            blocks++;
            buildings += b.buildings.length;
            trees += b.trees.length;
            coverSum += cover;
            if (cover < SPARSE && !open && b.zone !== 'fringe') {
              sparse++;
              g.strokeStyle = '#ff4040';
              g.lineWidth = 1.5;
              g.strokeRect(sx(x0), sz(z0), span * k, span * k);
            }
          }
        }
        g.fillStyle = '#ffd34d';
        for (const p of extras) this.rect(p.x, p.z, p.w, p.d, p.yaw, sx, sz, k);
      }
    }

    // player arrow
    g.save();
    g.translate(SIZE / 2, SIZE / 2);
    g.rotate(-yaw);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, 7);
    g.lineTo(-4, -4);
    g.lineTo(4, -4);
    g.closePath();
    g.fill();
    g.restore();

    const avg = blocks ? (coverSum / blocks) * 100 : 0;
    this.info.innerHTML = `
      <strong>Densité · F4</strong>
      <span>${blocks} îlots · ${buildings} bâtiments · ${trees} arbres (rayon ${RADIUS} m)</span>
      <span>Emprise bâtie moyenne ${avg.toFixed(1)} % · îlots clairsemés (&lt;${SPARSE * 100} %) : ${sparse}</span>
      <span>Ville : ${this.plan.blocks.length} îlots · ${this.plan.buildingCount} bâtiments</span>
      <em>blanc = bâti procédural · jaune = repères/fixes · vert = arbres</em>
    `;
  }

  private rect(
    x: number,
    z: number,
    w: number,
    d: number,
    yaw: number,
    sx: (x: number) => number,
    sz: (z: number) => number,
    k: number,
  ): void {
    const g = this.ctx;
    g.save();
    g.translate(sx(x), sz(z));
    g.rotate(-yaw);
    g.fillRect((-w / 2) * k, (-d / 2) * k, Math.max(1, w * k), Math.max(1, d * k));
    g.restore();
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.code !== 'F4') return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    event.preventDefault();
    this.visible = !this.visible;
    this.root.classList.toggle('hidden', !this.visible);
    this.timer = 0;
  };
}
