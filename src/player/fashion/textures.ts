import * as THREE from 'three';

const cache = new Map<string, THREE.CanvasTexture>();

function make(key: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, repeat = 1): THREE.CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d')!;
  draw(g, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

/** Seeded so every rebuild of the same item looks identical. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const css = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;

/** Wax print: concentric motifs on the chosen base color. */
export function waxTexture(hex: number): THREE.CanvasTexture {
  const tex = make(`wax-${hex}`, 256, (g, s) => {
    g.fillStyle = css(hex);
    g.fillRect(0, 0, s, s);
    const cell = s / 4;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const cx = x * cell + cell / 2 + (y % 2 ? cell / 2 : 0);
        const cy = y * cell + cell / 2;
        for (const [r, color] of [
          [cell * 0.42, '#1a120c'],
          [cell * 0.32, '#f2b632'],
          [cell * 0.2, '#ffffff'],
          [cell * 0.1, '#1a120c'],
        ] as const) {
          g.beginPath();
          g.arc(cx % s, cy, r, 0, Math.PI * 2);
          g.fillStyle = color;
          g.fill();
        }
      }
    }
    g.strokeStyle = 'rgba(26,18,12,0.55)';
    g.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      g.beginPath();
      g.moveTo(0, i * cell * 0.5);
      g.lineTo(s, i * cell * 0.5 + cell * 0.25);
      g.stroke();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function knitTexture(): THREE.CanvasTexture {
  return make('knit', 128, (g, s) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 8) {
      const grad = g.createLinearGradient(x, 0, x + 8, 0);
      grad.addColorStop(0, '#9a9a9a');
      grad.addColorStop(0.5, '#ffffff');
      grad.addColorStop(1, '#9a9a9a');
      g.fillStyle = grad;
      g.fillRect(x, 0, 8, s);
    }
  });
}

export function strawTexture(): THREE.CanvasTexture {
  const tex = make('straw', 128, (g, s) => {
    g.fillStyle = '#e9d6a8';
    g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 6) {
      for (let x = 0; x < s; x += 12) {
        g.fillStyle = (x / 12 + y / 6) % 2 ? '#c9ae72' : '#f5e6c0';
        g.fillRect(x + (y % 12 ? 6 : 0), y, 10, 4);
      }
    }
  }, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Grey strand detail, multiplied by the hair color. Twisted for locs, zigzag for braids. */
export function strandTexture(kind: 'locs' | 'braid' | 'curl'): THREE.CanvasTexture {
  return make(`strand-${kind}`, 128, (g, s) => {
    g.fillStyle = '#d8d8d8';
    g.fillRect(0, 0, s, s);
    const rand = rng(kind.length * 977);
    if (kind === 'curl') {
      for (let i = 0; i < 900; i++) {
        const x = rand() * s;
        const y = rand() * s;
        g.strokeStyle = rand() < 0.5 ? '#6e6e6e' : '#ffffff';
        g.lineWidth = 1.2;
        g.beginPath();
        g.arc(x, y, 2 + rand() * 3, rand() * 6, rand() * 6 + 3);
        g.stroke();
      }
      return;
    }
    const step = kind === 'braid' ? 16 : 10;
    for (let y = -s; y < s * 2; y += step) {
      g.strokeStyle = '#7a7a7a';
      g.lineWidth = kind === 'braid' ? 4 : 3;
      g.beginPath();
      if (kind === 'braid') {
        g.moveTo(0, y);
        g.lineTo(s / 2, y + step / 2);
        g.lineTo(s, y);
      } else {
        g.moveTo(0, y);
        g.lineTo(s, y + s * 0.5);
      }
      g.stroke();
    }
    for (let i = 0; i < 500; i++) {
      g.fillStyle = rand() < 0.5 ? 'rgba(90,90,90,0.5)' : 'rgba(255,255,255,0.5)';
      g.fillRect(rand() * s, rand() * s, 1, 3);
    }
  });
}

/** Alpha map of short hair strokes for beards, sparse for stubble. */
export function beardAlpha(dense: boolean): THREE.CanvasTexture {
  return make(`beard-${dense}`, 256, (g, s) => {
    g.fillStyle = dense ? '#5a5a5a' : '#000000';
    g.fillRect(0, 0, s, s);
    const rand = rng(dense ? 41 : 7);
    const count = dense ? 9000 : 5000;
    for (let i = 0; i < count; i++) {
      const x = rand() * s;
      const y = rand() * s;
      g.strokeStyle = dense ? '#ffffff' : `rgba(255,255,255,${0.5 + rand() * 0.5})`;
      g.lineWidth = dense ? 1.4 : 1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rand() - 0.5) * 2, y + (dense ? 4 : 1.5));
      g.stroke();
    }
  }, dense ? 6 : 8);
}

export function dotsAlpha(): THREE.CanvasTexture {
  return make('dots', 256, (g, s) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, s, s);
    const rand = rng(99);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(255,255,255,${0.45 + rand() * 0.5})`;
      g.beginPath();
      g.arc(rand() * s, rand() * s, 1 + rand() * 2.2, 0, Math.PI * 2);
      g.fill();
    }
  }, 5);
}
