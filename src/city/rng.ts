export type Rand = () => number;

export function mulberry32(seed: number): Rand {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(a: number, b: number, salt = 0): number {
  let h = Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(salt | 0, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function pick<T>(r: Rand, list: readonly T[]): T {
  return list[Math.floor(r() * list.length) % list.length]!;
}

export function range(r: Rand, lo: number, hi: number): number {
  return lo + r() * (hi - lo);
}

export function weighted<K extends string>(r: Rand, mix: Partial<Record<K, number>>): K {
  const entries = Object.entries(mix) as Array<[K, number]>;
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let v = r() * total;
  for (const [k, w] of entries) {
    v -= w;
    if (v <= 0) return k;
  }
  return entries[0]![0];
}
