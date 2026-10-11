import type { MapDocument } from './types';
import { createSeedYaoundeMap } from './seedYaoundeMap';
import { createSeedBusinessDatabase, businessesToJson } from '../business/seedBusinesses';

const STORAGE_KEY = 'lifecity-map-document-v2';

export function cloneMap(doc: MapDocument): MapDocument {
  return structuredClone(doc);
}

export function normalizeMap(doc: MapDocument): MapDocument {
  if (!Array.isArray(doc.businesses)) doc.businesses = createSeedBusinessDatabase().businesses;
  if (!Array.isArray(doc.buildings)) doc.buildings = [];
  if (!Array.isArray(doc.landmarks)) doc.landmarks = [];
  if (!Array.isArray(doc.parks)) doc.parks = [];
  if (!Array.isArray(doc.rivers)) doc.rivers = [];
  return doc;
}

export function exportMapJson(doc: MapDocument): string {
  const copy = cloneMap(doc);
  copy.meta.updatedAt = new Date().toISOString();
  return JSON.stringify(copy, null, 2);
}

export function downloadMapJson(doc: MapDocument, filename = 'yaounde-city-map.json'): void {
  downloadText(exportMapJson(doc), filename);
}

export function downloadBusinessesJson(doc: MapDocument): void {
  const db = {
    version: 1 as const,
    currency: 'FCFA' as const,
    note: 'Exported from LIFE CITY map editor (Phase 1). Interiors/payments not included.',
    businesses: doc.businesses,
  };
  downloadText(businessesToJson(db), 'businesses.json');
}

function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseMapJson(text: string): MapDocument {
  const data = JSON.parse(text) as MapDocument;
  if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
    throw new Error('JSON carte invalide (nodes/edges manquants).');
  }
  data.version = 1;
  return normalizeMap(data);
}

export function saveMapLocal(doc: MapDocument): void {
  localStorage.setItem(STORAGE_KEY, exportMapJson(doc));
}

export function loadMapLocal(): MapDocument | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('lifecity-map-document-v1');
    if (!raw) return null;
    return parseMapJson(raw);
  } catch {
    return null;
  }
}

export function loadInitialMap(): MapDocument {
  return loadMapLocal() ?? createSeedYaoundeMap();
}

export function resetToSeed(): MapDocument {
  const seed = createSeedYaoundeMap();
  saveMapLocal(seed);
  return seed;
}
