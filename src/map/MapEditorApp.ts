import { MapCamera2D } from './MapCamera2D';
import { MapRenderer2D } from './MapRenderer2D';
import { MapEditor, type EditorTool } from './MapEditor';
import {
  downloadMapJson,
  downloadBusinessesJson,
  loadInitialMap,
  resetToSeed,
  saveMapLocal,
  parseMapJson,
} from './MapIO';
import type { RoadClass } from './types';
import { BUSINESS_CATEGORY_LABELS, type BusinessCategory } from '../business/types';

export class MapEditorApp {
  private readonly cam = new MapCamera2D();
  private readonly editor: MapEditor;
  private readonly renderer: MapRenderer2D;
  private readonly statusEl: HTMLElement;
  private readonly reportEl: HTMLElement;
  private readonly inspectorEl: HTMLElement;
  private panning = false;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private spaceDown = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly uiRoot: HTMLElement,
  ) {
    this.editor = new MapEditor(loadInitialMap());
    this.renderer = new MapRenderer2D(canvas, this.cam);
    this.buildUi();
    this.statusEl = uiRoot.querySelector('#map-status') as HTMLElement;
    this.reportEl = uiRoot.querySelector('#map-report') as HTMLElement;
    this.inspectorEl = uiRoot.querySelector('#biz-inspector') as HTMLElement;
    this.bindCanvas();
    this.bindKeys();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.refreshReport();
    this.refreshInspector();
    this.setStatus('Phase 1 — carte seed + commerces. Interiors/paiements non implémentés.');
    requestAnimationFrame(this.frame);
  }

  private frame = (): void => {
    this.renderer.render(
      this.editor.doc,
      this.editor.layers,
      this.editor.selectedNodeId,
      this.editor.selectedEdgeId,
      this.editor.selectedBusinessId,
    );
    requestAnimationFrame(this.frame);
  };

  private resize(): void {
    const dpr = Math.min(devicePixelRatio, 2);
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
  }

  private buildUi(): void {
    const catOptions = Object.entries(BUSINESS_CATEGORY_LABELS)
      .map(([k, v]) => `<option value="${k}">${v}</option>`)
      .join('');

    this.uiRoot.innerHTML = `
      <aside class="map-panel">
        <div class="map-brand">
          <strong>LIFE CITY</strong>
          <small>Éditeur carte 2D · Phase 1</small>
        </div>
        <section>
          <h3>Outils</h3>
          <div class="tool-grid" id="tools">
            <button data-tool="pan">Pan</button>
            <button data-tool="select" class="active">Select</button>
            <button data-tool="add-node">+ Nœud</button>
            <button data-tool="connect">Connecter</button>
            <button data-tool="add-business">+ Commerce</button>
            <button data-tool="delete">Suppr.</button>
          </div>
          <label class="field">Type de route
            <select id="road-class">
              <option value="highway">Autoroute</option>
              <option value="primary" selected>Principale</option>
              <option value="secondary">Secondaire</option>
              <option value="local">Locale</option>
              <option value="path">Piste</option>
              <option value="rail">Voie ferrée</option>
            </select>
          </label>
          <label class="field">Catégorie commerce
            <select id="biz-category">${catOptions}</select>
          </label>
        </section>
        <section>
          <h3>Commerce sélectionné</h3>
          <div id="biz-inspector" class="report">Aucun</div>
        </section>
        <section>
          <h3>Calques</h3>
          <div class="layer-list" id="layers"></div>
          <label class="field">Opacité référence
            <input id="ref-opacity" type="range" min="0" max="100" value="35" />
          </label>
        </section>
        <section>
          <h3>Fichier</h3>
          <div class="btn-col">
            <button id="btn-save">Sauver local</button>
            <button id="btn-export">Exporter carte JSON</button>
            <button id="btn-export-biz">Exporter businesses.json</button>
            <button id="btn-import">Importer JSON</button>
            <button id="btn-reset">Reset seed</button>
            <button id="btn-validate">Valider réseau</button>
            <a class="link-btn" href="?mode=3d">Aperçu 3D (ancien)</a>
          </div>
          <input id="file-import" type="file" accept="application/json,.json" hidden />
        </section>
        <section>
          <h3>Réseau</h3>
          <p id="map-report" class="report"></p>
        </section>
        <p id="map-status" class="status"></p>
        <p class="help">Molette = zoom · Espace+glisser = pan · Ctrl+Z undo · Commerces = données Phase 1 (pas d’intérieur 3D)</p>
      </aside>
    `;

    const layersEl = this.uiRoot.querySelector('#layers') as HTMLElement;
    const layerKeys: Array<[keyof typeof this.editor.layers, string]> = [
      ['reference', 'Image référence'],
      ['districts', 'Quartiers'],
      ['roads', 'Routes'],
      ['parks', 'Parcs'],
      ['rivers', 'Rivières'],
      ['buildings', 'Bâtiments'],
      ['landmarks', 'POI'],
      ['businesses', 'Commerces'],
      ['debug', 'Debug réseau'],
    ];
    for (const [key, label] of layerKeys) {
      const id = `layer-${key}`;
      const row = document.createElement('label');
      row.className = 'check';
      row.innerHTML = `<input type="checkbox" id="${id}" ${this.editor.layers[key] ? 'checked' : ''}/> ${label}`;
      layersEl.appendChild(row);
      row.querySelector('input')!.addEventListener('change', (ev) => {
        this.editor.layers[key] = (ev.target as HTMLInputElement).checked;
        this.refreshReport();
      });
    }

    this.uiRoot.querySelector('#tools')!.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button[data-tool]') as HTMLButtonElement | null;
      if (!btn) return;
      const tool = btn.dataset.tool as EditorTool;
      this.editor.setTool(tool);
      this.uiRoot.querySelectorAll('#tools button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      this.setStatus(`Outil : ${tool}`);
    });

    (this.uiRoot.querySelector('#road-class') as HTMLSelectElement).addEventListener('change', (e) => {
      this.editor.roadClass = (e.target as HTMLSelectElement).value as RoadClass;
    });

    (this.uiRoot.querySelector('#biz-category') as HTMLSelectElement).addEventListener('change', (e) => {
      this.editor.businessCategory = (e.target as HTMLSelectElement).value as BusinessCategory;
    });

    (this.uiRoot.querySelector('#ref-opacity') as HTMLInputElement).addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value) / 100;
      this.editor.setReferenceOpacity(v);
    });

    this.uiRoot.querySelector('#btn-save')!.addEventListener('click', () => {
      saveMapLocal(this.editor.doc);
      this.setStatus('Carte sauvegardée dans localStorage.');
    });
    this.uiRoot.querySelector('#btn-export')!.addEventListener('click', () => {
      downloadMapJson(this.editor.doc);
      this.setStatus('Carte JSON exportée.');
    });
    this.uiRoot.querySelector('#btn-export-biz')!.addEventListener('click', () => {
      downloadBusinessesJson(this.editor.doc);
      this.setStatus('businesses.json exporté (données uniquement).');
    });
    this.uiRoot.querySelector('#btn-reset')!.addEventListener('click', () => {
      if (!confirm('Recharger la carte seed (écrase la sauvegarde locale) ?')) return;
      this.editor.doc = resetToSeed();
      this.editor.selectedBusinessId = null;
      this.editor.selectedNodeId = null;
      this.editor.selectedEdgeId = null;
      this.refreshReport();
      this.refreshInspector();
      this.setStatus('Seed rechargé.');
    });
    this.uiRoot.querySelector('#btn-validate')!.addEventListener('click', () => {
      this.refreshReport();
      this.setStatus(this.editor.connectivitySummary());
    });

    const fileInput = this.uiRoot.querySelector('#file-import') as HTMLInputElement;
    this.uiRoot.querySelector('#btn-import')!.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        this.editor.pushUndo();
        this.editor.doc = parseMapJson(text);
        saveMapLocal(this.editor.doc);
        this.refreshReport();
        this.refreshInspector();
        this.setStatus(`Import OK : ${file.name}`);
      } catch (err) {
        this.setStatus(`Import échoué : ${String(err)}`);
      }
      fileInput.value = '';
    });
  }

  private bindCanvas(): void {
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.12 : 0.9;
      this.cam.zoomAt(e.offsetX * this.dpr(), e.offsetY * this.dpr(), this.canvas.width, this.canvas.height, factor);
    }, { passive: false });

    this.canvas.addEventListener('pointerdown', (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      const world = this.screenToWorld(e);

      if (e.button === 1 || e.button === 2 || this.editor.tool === 'pan' || this.spaceDown) {
        this.panning = true;
        return;
      }

      if (this.editor.tool === 'select') {
        const biz = this.editor.hitBusiness(world.x, world.z);
        if (biz) {
          this.editor.selectedBusinessId = biz;
          this.editor.selectedNodeId = null;
          this.editor.selectedEdgeId = null;
          this.editor.beginDrag();
          this.dragging = true;
          this.refreshInspector();
          this.setStatus(`Commerce : ${this.editor.getSelectedBusiness()?.name ?? biz}`);
          return;
        }
        const hit = this.editor.hitNode(world.x, world.z);
        if (hit) {
          this.editor.selectedNodeId = hit;
          this.editor.selectedEdgeId = null;
          this.editor.selectedBusinessId = null;
          this.editor.beginDrag();
          this.dragging = true;
          this.refreshInspector();
          this.setStatus(`Nœud ${hit}`);
          return;
        }
      }

      const msg = this.editor.onClickWorld(world.x, world.z);
      if (msg) this.setStatus(msg);
      this.refreshReport();
      this.refreshInspector();
    });

    this.canvas.addEventListener('pointermove', (e) => {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      if (this.panning) {
        this.cam.panScreen(dx * this.dpr(), dy * this.dpr());
        return;
      }
      if (this.dragging) {
        const world = this.screenToWorld(e);
        this.editor.dragSelected(world.x, world.z);
        if (this.editor.selectedBusinessId) this.refreshInspector();
      }
    });

    this.canvas.addEventListener('pointerup', () => {
      this.panning = false;
      this.dragging = false;
      this.refreshReport();
    });
  }

  private bindKeys(): void {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        this.spaceDown = true;
        e.preventDefault();
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) this.editor.redo();
        else this.editor.undo();
        this.refreshReport();
        this.refreshInspector();
        this.setStatus(e.shiftKey ? 'Redo' : 'Undo');
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault();
        saveMapLocal(this.editor.doc);
        this.setStatus('Sauvé');
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyE') {
        e.preventDefault();
        downloadMapJson(this.editor.doc);
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.spaceDown = false;
    });
  }

  private screenToWorld(e: PointerEvent): { x: number; z: number } {
    const rect = this.canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * this.dpr();
    const sy = (e.clientY - rect.top) * this.dpr();
    return this.cam.screenToWorld(sx, sy, this.canvas.width, this.canvas.height);
  }

  private dpr(): number {
    return this.canvas.width / window.innerWidth;
  }

  private setStatus(msg: string): void {
    this.statusEl.textContent = msg;
  }

  private refreshReport(): void {
    const r = this.editor.getConnectivity();
    const d = this.editor.doc;
    this.reportEl.textContent = [
      r.ok ? '✓ Réseau connecté' : '⚠ Réseau incomplet',
      `${r.nodeCount} nœuds / ${r.edgeCount} arêtes`,
      `${d.districts.length} quartiers · ${d.businesses.length} commerces`,
      `${r.components} composante(s)`,
      ...r.messages,
    ].join('\n');
    this.reportEl.classList.toggle('ok', r.ok);
    this.reportEl.classList.toggle('bad', !r.ok);
  }

  private refreshInspector(): void {
    const b = this.editor.getSelectedBusiness();
    if (!b) {
      this.inspectorEl.innerHTML = '<span class="muted">Sélectionnez un commerce (calque Commerces).</span>';
      return;
    }
    const products = b.products
      .map((p) => `${p.name}: ${p.priceFcfa.toLocaleString('fr-FR')} FCFA`)
      .join('<br/>') || '(aucun produit)';
    this.inspectorEl.innerHTML = `
      <label class="field">Nom
        <input id="insp-name" type="text" value="${escapeAttr(b.name)}" />
      </label>
      <label class="field">Catégorie
        <select id="insp-cat">${Object.entries(BUSINESS_CATEGORY_LABELS)
          .map(([k, v]) => `<option value="${k}" ${k === b.category ? 'selected' : ''}>${v}</option>`)
          .join('')}</select>
      </label>
      <p><strong>Quartier:</strong> ${b.districtId}</p>
      <p><strong>Pos:</strong> ${b.x}, ${b.z}</p>
      <p><strong>Horaires:</strong> ${b.hours.open}–${b.hours.close}</p>
      <p><strong>Interaction (données):</strong> ${b.interaction}</p>
      <p><strong>Fictif:</strong> ${b.fictional ? 'oui' : 'non'}${b.landmarkReal ? ' · landmark' : ''}</p>
      <p class="products"><strong>Produits (FCFA):</strong><br/>${products}</p>
      ${b.notes ? `<p class="muted">${escapeHtml(b.notes)}</p>` : ''}
      <p class="muted">Phase 1 — pas d’intérieur 3D ni paiement.</p>
    `;

    const nameEl = this.inspectorEl.querySelector('#insp-name') as HTMLInputElement;
    const catEl = this.inspectorEl.querySelector('#insp-cat') as HTMLSelectElement;
    nameEl.addEventListener('change', () => {
      this.editor.updateSelectedBusiness({ name: nameEl.value.trim() || b.name });
      this.setStatus('Nom commerce mis à jour');
    });
    catEl.addEventListener('change', () => {
      this.editor.updateSelectedBusiness({ category: catEl.value as BusinessCategory });
      this.refreshInspector();
      this.setStatus('Catégorie mise à jour');
    });
  }
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
