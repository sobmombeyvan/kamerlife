import type { MapDocument, MapLayers } from './types';
import { ROAD_COLORS } from './types';
import type { MapCamera2D } from './MapCamera2D';
import { findIntersections } from './MapGraph';

export class MapRenderer2D {
  private refImage: HTMLImageElement | null = null;
  private refLoaded = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly cam: MapCamera2D,
  ) {
    const img = new Image();
    img.src = '/maps/reference-map.png';
    img.onload = () => {
      this.refImage = img;
      this.refLoaded = true;
    };
  }

  render(
    doc: MapDocument,
    layers: MapLayers,
    selectedNodeId: string | null,
    selectedEdgeId: string | null,
    selectedBusinessId: string | null = null,
  ): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1b2a24';
    ctx.fillRect(0, 0, w, h);

    if (layers.reference && this.refLoaded && this.refImage) {
      this.drawReference(ctx, doc, w, h);
    }

    if (layers.districts) this.drawDistricts(ctx, doc, w, h, layers.debug);
    if (layers.parks) this.drawParks(ctx, doc, w, h);
    if (layers.rivers) this.drawRivers(ctx, doc, w, h);
    if (layers.buildings) this.drawBuildings(ctx, doc, w, h);
    if (layers.roads) this.drawRoads(ctx, doc, w, h, selectedEdgeId, layers.debug);
    if (layers.landmarks) this.drawLandmarks(ctx, doc, w, h);
    if (layers.businesses) this.drawBusinesses(ctx, doc, w, h, selectedBusinessId);
    if (layers.debug) this.drawDebug(ctx, doc, w, h, selectedNodeId);

    this.drawHud(ctx, w, h, doc);
  }

  private drawReference(ctx: CanvasRenderingContext2D, doc: MapDocument, w: number, h: number): void {
    if (!this.refImage) return;
    const hw = doc.reference.worldWidth / 2;
    const hh = doc.reference.worldHeight / 2;
    const tl = this.cam.worldToScreen(-hw, -hh, w, h);
    const br = this.cam.worldToScreen(hw, hh, w, h);
    ctx.save();
    ctx.globalAlpha = doc.reference.opacity;
    ctx.drawImage(this.refImage, tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    ctx.restore();
  }

  private drawDistricts(ctx: CanvasRenderingContext2D, doc: MapDocument, w: number, h: number, debug: boolean): void {
    for (const d of doc.districts) {
      if (d.polygon.length < 3) continue;
      ctx.beginPath();
      d.polygon.forEach((p, i) => {
        const s = this.cam.worldToScreen(p.x, p.z, w, h);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.closePath();
      ctx.fillStyle = hexAlpha(d.color, 0.18);
      ctx.fill();
      if (debug) {
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const c = centroid(d.polygon);
      const sc = this.cam.worldToScreen(c.x, c.z, w, h);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(d.name, sc.x, sc.y);
    }
  }

  private drawParks(ctx: CanvasRenderingContext2D, doc: MapDocument, w: number, h: number): void {
    for (const p of doc.parks) {
      ctx.beginPath();
      p.polygon.forEach((pt, i) => {
        const s = this.cam.worldToScreen(pt.x, pt.z, w, h);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.closePath();
      ctx.fillStyle = 'rgba(46, 125, 50, 0.35)';
      ctx.fill();
    }
  }

  private drawRivers(ctx: CanvasRenderingContext2D, doc: MapDocument, w: number, h: number): void {
    for (const r of doc.rivers) {
      if (r.path.length < 2) continue;
      ctx.beginPath();
      r.path.forEach((p, i) => {
        const s = this.cam.worldToScreen(p.x, p.z, w, h);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.strokeStyle = '#4fc3f7';
      ctx.lineWidth = Math.max(2, r.width / this.cam.scale);
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  private drawBuildings(ctx: CanvasRenderingContext2D, doc: MapDocument, w: number, h: number): void {
    for (const b of doc.buildings) {
      const s = this.cam.worldToScreen(b.x, b.z, w, h);
      const pw = b.width / this.cam.scale;
      const ph = b.depth / this.cam.scale;
      ctx.fillStyle = 'rgba(80, 80, 90, 0.75)';
      ctx.fillRect(s.x - pw / 2, s.y - ph / 2, pw, ph);
    }
  }

  private drawRoads(
    ctx: CanvasRenderingContext2D,
    doc: MapDocument,
    w: number,
    h: number,
    selectedEdgeId: string | null,
    debug: boolean,
  ): void {
    const byId = new Map(doc.nodes.map((n) => [n.id, n]));
    for (const e of doc.edges) {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) continue;
      const sa = this.cam.worldToScreen(a.x, a.z, w, h);
      const sb = this.cam.worldToScreen(b.x, b.z, w, h);
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.strokeStyle = e.id === selectedEdgeId ? '#ffffff' : ROAD_COLORS[e.roadClass];
      ctx.lineWidth = Math.max(1.5, e.width / this.cam.scale);
      if (e.roadClass === 'rail') ctx.setLineDash([6, 4]);
      else if (e.roadClass === 'path') ctx.setLineDash([3, 3]);
      else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (debug && this.cam.scale < 10) {
        const mx = (sa.x + sb.x) / 2;
        const my = (sa.y + sb.y) / 2;
        ctx.fillStyle = '#cfd8dc';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(e.roadClass[0]!.toUpperCase(), mx, my - 4);
      }
    }
  }

  private drawLandmarks(ctx: CanvasRenderingContext2D, doc: MapDocument, w: number, h: number): void {
    for (const lm of doc.landmarks) {
      const s = this.cam.worldToScreen(lm.x, lm.z, w, h);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffc857';
      ctx.fill();
      ctx.strokeStyle = '#10251f';
      ctx.stroke();
      if (this.cam.scale < 14) {
        ctx.fillStyle = '#ffe082';
        ctx.font = '10px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(lm.name, s.x + 8, s.y + 3);
      }
    }
  }

  private drawBusinesses(
    ctx: CanvasRenderingContext2D,
    doc: MapDocument,
    w: number,
    h: number,
    selectedBusinessId: string | null,
  ): void {
    for (const b of doc.businesses ?? []) {
      const s = this.cam.worldToScreen(b.x, b.z, w, h);
      const selected = b.id === selectedBusinessId;
      ctx.fillStyle = b.signColor || '#90caf9';
      ctx.strokeStyle = selected ? '#ffffff' : '#10251f';
      ctx.lineWidth = selected ? 2.5 : 1;
      ctx.beginPath();
      ctx.rect(s.x - 7, s.y - 7, 14, 14);
      ctx.fill();
      ctx.stroke();
      if (this.cam.scale < 16 || selected) {
        ctx.fillStyle = selected ? '#fff' : '#e3f2fd';
        ctx.font = selected ? 'bold 11px system-ui' : '10px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(b.name, s.x + 10, s.y + 3);
      }
    }
  }

  private drawDebug(
    ctx: CanvasRenderingContext2D,
    doc: MapDocument,
    w: number,
    h: number,
    selectedNodeId: string | null,
  ): void {
    const intersections = new Set(findIntersections(doc).map((n) => n.id));
    for (const n of doc.nodes) {
      const s = this.cam.worldToScreen(n.x, n.z, w, h);
      const isSel = n.id === selectedNodeId;
      const isX = intersections.has(n.id);
      ctx.beginPath();
      if (n.kind === 'roundabout') {
        ctx.arc(s.x, s.y, isSel ? 8 : 6, 0, Math.PI * 2);
        ctx.strokeStyle = isSel ? '#fff' : '#ef5350';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.arc(s.x, s.y, isSel ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = isSel ? '#fff' : isX ? '#ff7043' : '#90caf9';
        ctx.fill();
      }
      if (n.name && this.cam.scale < 12) {
        ctx.fillStyle = '#e0f2f1';
        ctx.font = '10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(n.name, s.x, s.y - 10);
      }
    }
  }

  private drawHud(ctx: CanvasRenderingContext2D, w: number, _h: number, doc: MapDocument): void {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(12, 12, 320, 54);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('LIFE CITY — Éditeur carte 2D', 22, 32);
    ctx.font = '11px system-ui';
    ctx.fillStyle = '#b2dfdb';
    ctx.fillText(
      `${doc.nodes.length} nœuds · ${doc.edges.length} routes · ${doc.businesses.length} commerces · ${doc.districts.length} quartiers · ${this.cam.scale.toFixed(1)} m/px`,
      22,
      50,
    );

    // scale bar ~1km
    const barMeters = 1000;
    const barPx = barMeters / this.cam.scale;
    ctx.fillStyle = '#fff';
    ctx.fillRect(w - 40 - barPx, 28, barPx, 4);
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText('1 km', w - 40, 24);
  }
}

function centroid(poly: Array<{ x: number; z: number }>): { x: number; z: number } {
  let x = 0;
  let z = 0;
  for (const p of poly) {
    x += p.x;
    z += p.z;
  }
  return { x: x / poly.length, z: z / poly.length };
}

function hexAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}
