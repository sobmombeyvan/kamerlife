import type { MapDocument, MapEdge, MapNode } from './types';

export type ConnectivityReport = {
  ok: boolean;
  nodeCount: number;
  edgeCount: number;
  components: number;
  orphanNodes: string[];
  danglingEdges: string[];
  largestComponentRatio: number;
  messages: string[];
};

export function nodeMap(doc: MapDocument): Map<string, MapNode> {
  return new Map(doc.nodes.map((n) => [n.id, n]));
}

export function adjacency(doc: MapDocument): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const n of doc.nodes) adj.set(n.id, []);
  for (const e of doc.edges) {
    if (!adj.has(e.from) || !adj.has(e.to)) continue;
    adj.get(e.from)!.push(e.to);
    adj.get(e.to)!.push(e.from);
  }
  return adj;
}

export function validateConnectivity(doc: MapDocument): ConnectivityReport {
  const ids = new Set(doc.nodes.map((n) => n.id));
  const danglingEdges: string[] = [];
  for (const e of doc.edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) danglingEdges.push(e.id);
  }

  const adj = adjacency(doc);
  const orphanNodes = [...adj.entries()].filter(([, nbs]) => nbs.length === 0).map(([id]) => id);

  const seen = new Set<string>();
  const components: string[][] = [];
  for (const n of doc.nodes) {
    if (seen.has(n.id)) continue;
    const stack = [n.id];
    const comp: string[] = [];
    seen.add(n.id);
    while (stack.length) {
      const cur = stack.pop()!;
      comp.push(cur);
      for (const nb of adj.get(cur) ?? []) {
        if (!seen.has(nb)) {
          seen.add(nb);
          stack.push(nb);
        }
      }
    }
    components.push(comp);
  }

  components.sort((a, b) => b.length - a.length);
  const largest = components[0]?.length ?? 0;
  const ratio = doc.nodes.length ? largest / doc.nodes.length : 0;
  const messages: string[] = [];

  if (components.length > 1) {
    messages.push(`${components.length} composantes disjointes — la plus grande couvre ${(ratio * 100).toFixed(0)}% des nœuds.`);
  }
  if (orphanNodes.length) messages.push(`${orphanNodes.length} nœud(s) isolé(s).`);
  if (danglingEdges.length) messages.push(`${danglingEdges.length} arête(s) invalide(s).`);
  if (components.length === 1 && orphanNodes.length === 0) {
    messages.push('Réseau connecté : tous les nœuds sont joignables.');
  }

  return {
    ok: components.length === 1 && danglingEdges.length === 0 && orphanNodes.length === 0,
    nodeCount: doc.nodes.length,
    edgeCount: doc.edges.length,
    components: components.length,
    orphanNodes,
    danglingEdges,
    largestComponentRatio: ratio,
    messages,
  };
}

export function findIntersections(doc: MapDocument): MapNode[] {
  const adj = adjacency(doc);
  return doc.nodes.filter((n) => (adj.get(n.id)?.length ?? 0) >= 3 || n.kind === 'roundabout');
}

export function edgeLength(doc: MapDocument, edge: MapEdge): number {
  const a = doc.nodes.find((n) => n.id === edge.from);
  const b = doc.nodes.find((n) => n.id === edge.to);
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function nextId(prefix: string, existing: string[]): string {
  let i = existing.length + 1;
  let id = `${prefix}_${i}`;
  const set = new Set(existing);
  while (set.has(id)) {
    i += 1;
    id = `${prefix}_${i}`;
  }
  return id;
}
