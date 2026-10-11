export type RelationEntry = {
  chats: number;
  affinity: number; // 0–100
};

/** Lightweight Sims-style relationship memory (by NPC name). */
export class SocialMemory {
  private readonly map = new Map<string, RelationEntry>();

  get(name: string): RelationEntry {
    return this.map.get(name) ?? { chats: 0, affinity: 20 };
  }

  chat(name: string, bonus = 12): RelationEntry {
    const cur = this.get(name);
    const next: RelationEntry = {
      chats: cur.chats + 1,
      affinity: Math.min(100, cur.affinity + bonus),
    };
    this.map.set(name, next);
    return next;
  }

  label(affinity: number): string {
    if (affinity >= 80) return 'Meilleur ami';
    if (affinity >= 55) return 'Ami';
    if (affinity >= 35) return 'Connaissance';
    return 'Étranger';
  }

  serialize(): Record<string, RelationEntry> {
    const out: Record<string, RelationEntry> = {};
    for (const [k, v] of this.map) out[k] = v;
    return out;
  }

  load(data: Record<string, RelationEntry> | undefined): void {
    this.map.clear();
    if (!data) return;
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v.affinity === 'number') {
        this.map.set(k, {
          chats: v.chats ?? 0,
          affinity: Math.max(0, Math.min(100, v.affinity)),
        });
      }
    }
  }
}
