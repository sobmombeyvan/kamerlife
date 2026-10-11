import type { MapDocument, MapLayers, RoadClass } from './types';
import { DEFAULT_LAYERS, ROAD_WIDTH } from './types';
import type { Business, BusinessCategory } from '../business/types';
import { cloneMap } from './MapIO';
import { nextId, validateConnectivity } from './MapGraph';

export type EditorTool = 'pan' | 'select' | 'add-node' | 'connect' | 'add-business' | 'delete';

export class MapEditor {
  doc: MapDocument;
  layers: MapLayers = { ...DEFAULT_LAYERS };
  tool: EditorTool = 'select';
  roadClass: RoadClass = 'secondary';
  businessCategory: BusinessCategory = 'grocery';
  selectedNodeId: string | null = null;
  selectedEdgeId: string | null = null;
  selectedBusinessId: string | null = null;
  connectFromId: string | null = null;
  private undoStack: MapDocument[] = [];
  private redoStack: MapDocument[] = [];

  constructor(initial: MapDocument) {
    this.doc = initial;
  }

  pushUndo(): void {
    this.undoStack.push(cloneMap(this.doc));
    if (this.undoStack.length > 40) this.undoStack.shift();
    this.redoStack = [];
    this.doc.meta.updatedAt = new Date().toISOString();
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(cloneMap(this.doc));
    this.doc = prev;
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(cloneMap(this.doc));
    this.doc = next;
  }

  setTool(tool: EditorTool): void {
    this.tool = tool;
    this.connectFromId = null;
  }

  setReferenceOpacity(opacity: number): void {
    this.doc.reference.opacity = Math.min(1, Math.max(0, opacity));
  }

  hitNode(wx: number, wz: number, radius = 80): string | null {
    let best: string | null = null;
    let bestD = radius;
    for (const n of this.doc.nodes) {
      const d = Math.hypot(n.x - wx, n.z - wz);
      if (d < bestD) {
        bestD = d;
        best = n.id;
      }
    }
    return best;
  }

  hitEdge(wx: number, wz: number, threshold = 60): string | null {
    const byId = new Map(this.doc.nodes.map((n) => [n.id, n]));
    let best: string | null = null;
    let bestD = threshold;
    for (const e of this.doc.edges) {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) continue;
      const d = distToSegment(wx, wz, a.x, a.z, b.x, b.z);
      if (d < bestD) {
        bestD = d;
        best = e.id;
      }
    }
    return best;
  }

  hitBusiness(wx: number, wz: number, radius = 120): string | null {
    let best: string | null = null;
    let bestD = radius;
    for (const b of this.doc.businesses) {
      const d = Math.hypot(b.x - wx, b.z - wz);
      if (d < bestD) {
        bestD = d;
        best = b.id;
      }
    }
    return best;
  }

  districtAt(wx: number, wz: number): string {
    let best = 'centre-ville';
    let bestD = Infinity;
    for (const d of this.doc.districts) {
      const c = centroid(d.polygon);
      const dist = Math.hypot(c.x - wx, c.z - wz);
      if (dist < bestD) {
        bestD = dist;
        best = d.id;
      }
    }
    return best;
  }

  getSelectedBusiness(): Business | null {
    if (!this.selectedBusinessId) return null;
    return this.doc.businesses.find((b) => b.id === this.selectedBusinessId) ?? null;
  }

  updateSelectedBusiness(patch: Partial<Business>): void {
    const b = this.getSelectedBusiness();
    if (!b) return;
    this.pushUndo();
    Object.assign(b, patch);
  }

  onClickWorld(wx: number, wz: number): string {
    if (this.tool === 'pan') return 'Pan — glisser pour déplacer';

    if (this.tool === 'add-node') {
      this.pushUndo();
      const id = nextId('n', this.doc.nodes.map((n) => n.id));
      this.doc.nodes.push({ id, x: Math.round(wx), z: Math.round(wz), kind: 'junction' });
      this.clearSelection();
      this.selectedNodeId = id;
      return `Nœud ${id} ajouté`;
    }

    if (this.tool === 'add-business') {
      this.pushUndo();
      const id = nextId('biz', this.doc.businesses.map((b) => b.id));
      const districtId = this.districtAt(wx, wz);
      const b: Business = {
        id,
        name: `Nouveau commerce ${id}`,
        category: this.businessCategory,
        districtId,
        x: Math.round(wx),
        z: Math.round(wz),
        fictional: true,
        signColor: '#ffc857',
        hours: { open: '08:00', close: '20:00', days: [1, 2, 3, 4, 5, 6] },
        products: [{ id: 'item1', name: 'Article', priceFcfa: 1000, category: this.businessCategory }],
        interaction: 'menu',
        notes: 'Phase 1 — données uniquement, pas d’intérieur 3D.',
      };
      this.doc.businesses.push(b);
      this.clearSelection();
      this.selectedBusinessId = id;
      return `Commerce placé : ${b.name} (${districtId})`;
    }

    if (this.tool === 'select') {
      const biz = this.hitBusiness(wx, wz);
      if (biz) {
        this.clearSelection();
        this.selectedBusinessId = biz;
        const b = this.getSelectedBusiness();
        return `Commerce : ${b?.name ?? biz}`;
      }
      const node = this.hitNode(wx, wz);
      if (node) {
        this.clearSelection();
        this.selectedNodeId = node;
        return `Nœud sélectionné : ${node}`;
      }
      const edge = this.hitEdge(wx, wz);
      if (edge) {
        this.clearSelection();
        this.selectedEdgeId = edge;
        return `Route sélectionnée : ${edge}`;
      }
      this.clearSelection();
      return 'Sélection vidée';
    }

    if (this.tool === 'connect') {
      const node = this.hitNode(wx, wz);
      if (!node) return 'Clique un nœud pour connecter';
      if (!this.connectFromId) {
        this.connectFromId = node;
        this.selectedNodeId = node;
        return `Départ : ${node} — cliquez l’arrivée`;
      }
      if (this.connectFromId === node) {
        this.connectFromId = null;
        return 'Connexion annulée';
      }
      const exists = this.doc.edges.some(
        (e) =>
          (e.from === this.connectFromId && e.to === node) ||
          (e.from === node && e.to === this.connectFromId),
      );
      if (exists) {
        this.connectFromId = null;
        return 'Ces nœuds sont déjà reliés';
      }
      this.pushUndo();
      const id = nextId('e', this.doc.edges.map((e) => e.id));
      this.doc.edges.push({
        id,
        from: this.connectFromId,
        to: node,
        roadClass: this.roadClass,
        width: ROAD_WIDTH[this.roadClass],
      });
      this.selectedEdgeId = id;
      this.connectFromId = null;
      return `Route ${id} créée (${this.roadClass})`;
    }

    if (this.tool === 'delete') {
      const biz = this.hitBusiness(wx, wz);
      if (biz) {
        this.pushUndo();
        this.doc.businesses = this.doc.businesses.filter((b) => b.id !== biz);
        this.selectedBusinessId = null;
        return `Commerce ${biz} supprimé`;
      }
      const node = this.hitNode(wx, wz);
      if (node) {
        this.pushUndo();
        this.doc.nodes = this.doc.nodes.filter((n) => n.id !== node);
        this.doc.edges = this.doc.edges.filter((e) => e.from !== node && e.to !== node);
        this.selectedNodeId = null;
        return `Nœud ${node} et routes liées supprimés`;
      }
      const edge = this.hitEdge(wx, wz);
      if (edge) {
        this.pushUndo();
        this.doc.edges = this.doc.edges.filter((e) => e.id !== edge);
        this.selectedEdgeId = null;
        return `Route ${edge} supprimée`;
      }
      return 'Rien à supprimer ici';
    }

    return '';
  }

  dragSelected(wx: number, wz: number): void {
    if (this.tool !== 'select') return;
    if (this.selectedNodeId) {
      const n = this.doc.nodes.find((x) => x.id === this.selectedNodeId);
      if (n) {
        n.x = Math.round(wx);
        n.z = Math.round(wz);
      }
      return;
    }
    if (this.selectedBusinessId) {
      const b = this.getSelectedBusiness();
      if (b) {
        b.x = Math.round(wx);
        b.z = Math.round(wz);
        b.districtId = this.districtAt(wx, wz);
      }
    }
  }

  beginDrag(): void {
    if (this.tool === 'select' && (this.selectedNodeId || this.selectedBusinessId)) this.pushUndo();
  }

  connectivitySummary(): string {
    return validateConnectivity(this.doc).messages.join(' ');
  }

  getConnectivity() {
    return validateConnectivity(this.doc);
  }

  private clearSelection(): void {
    this.selectedNodeId = null;
    this.selectedEdgeId = null;
    this.selectedBusinessId = null;
  }
}

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const abx = bx - ax;
  const abz = bz - az;
  const lenSq = abx * abx + abz * abz;
  if (lenSq < 1e-6) return Math.hypot(px - ax, pz - az);
  let t = ((px - ax) * abx + (pz - az) * abz) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * abx), pz - (az + t * abz));
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
