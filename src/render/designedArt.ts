import * as THREE from 'three';

export function hexColor(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

/** '#0f2a22' / 'rgb(1,2,3)' → 0x0f2a22 */
export function cssToRgb(css: string): number {
  const s = css.trim();
  if (s.startsWith('#')) {
    const h = s.slice(1);
    if (h.length === 3) return parseInt(h.split('').map((c) => c + c).join(''), 16);
    return parseInt(h.slice(0, 6), 16) || 0x10251f;
  }
  const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return ((Number(m[1]) & 255) << 16) | ((Number(m[2]) & 255) << 8) | (Number(m[3]) & 255);
  return 0x10251f;
}

function lighten(n: number, amt: number): string {
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

function darken(n: number, amt: number): string {
  return lighten(n, -amt);
}

function fillDuskSky(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#152a5c');
  g.addColorStop(0.28, '#3d4a8a');
  g.addColorStop(0.52, '#c45c2d');
  g.addColorStop(0.72, '#e8b84a');
  g.addColorStop(1, '#1a5c40');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(255,236,180,0.95)';
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.22, Math.min(w, h) * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,236,180,0.18)';
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.22, Math.min(w, h) * 0.16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.arc(w * 0.18, h * 0.14, w * 0.22, 0, Math.PI * 2);
  ctx.arc(w * 0.88, h * 0.32, w * 0.14, 0, Math.PI * 2);
  ctx.fill();
}

function fillHills(ctx: CanvasRenderingContext2D, w: number, h: number, y0: number): void {
  ctx.fillStyle = '#1a3d32';
  ctx.beginPath();
  ctx.moveTo(0, y0);
  ctx.quadraticCurveTo(w * 0.22, y0 - h * 0.12, w * 0.48, y0 - h * 0.04);
  ctx.quadraticCurveTo(w * 0.72, y0 + h * 0.04, w, y0 - h * 0.08);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  ctx.fillStyle = '#0f2a22';
  ctx.beginPath();
  ctx.moveTo(0, y0 + h * 0.08);
  ctx.quadraticCurveTo(w * 0.35, y0 - h * 0.02, w * 0.62, y0 + h * 0.1);
  ctx.quadraticCurveTo(w * 0.82, y0 + h * 0.16, w, y0 + h * 0.06);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
}

function flagDots(ctx: CanvasRenderingContext2D, x: number, y: number, d: number): void {
  (['#007a5e', '#ce1126', '#fcd116'] as const).forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x - i * (d + 5), y, d / 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Mall / street fascia: gradient plate, champagne chrome, tracked type. */
export function drawSignFace(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  title: string,
  subtitle: string | undefined,
  bg: number,
  fg: number,
): void {
  const fgHex = hexColor(fg);
  const chrome = '#d4af37';
  const grad = ctx.createLinearGradient(0, 0, w * 0.2, h);
  grad.addColorStop(0, lighten(bg, 32));
  grad.addColorStop(0.42, hexColor(bg));
  grad.addColorStop(1, darken(bg, 22));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const sheen = ctx.createLinearGradient(0, 0, w, h);
  sheen.addColorStop(0, 'rgba(255,255,255,0.16)');
  sheen.addColorStop(0.35, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);

  const bar = Math.max(8, Math.round(w * 0.012));
  ctx.fillStyle = chrome;
  ctx.fillRect(0, 0, bar, h);
  ctx.globalAlpha = 0.92;
  ctx.fillRect(bar, 0, w - bar, Math.max(3, Math.round(h * 0.04)));
  ctx.fillRect(bar, h - Math.max(3, Math.round(h * 0.04)), w - bar, Math.max(3, Math.round(h * 0.04)));
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = Math.max(1.5, h * 0.012);
  const inset = Math.max(10, Math.round(h * 0.1));
  ctx.strokeRect(inset + bar * 0.4, inset * 0.7, w - inset * 2 - bar * 0.4, h - inset * 1.4);

  const cx = w / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = Math.round(h * 0.08);
  ctx.shadowOffsetY = Math.round(h * 0.02);
  ctx.fillStyle = fgHex;
  const titlePx = subtitle ? Math.round(h * 0.32) : Math.round(h * 0.38);
  ctx.font = `800 ${titlePx}px "Segoe UI", system-ui, sans-serif`;
  ctx.letterSpacing = title.length < 18 ? `${Math.max(1, Math.round(h * 0.028))}px` : '0px';
  ctx.fillText(title.toUpperCase(), cx, subtitle ? h * 0.4 : h * 0.5, w - inset * 4);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.letterSpacing = '0px';

  if (subtitle) {
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = `600 ${Math.round(h * 0.15)}px "Segoe UI", system-ui, sans-serif`;
    ctx.letterSpacing = `${Math.max(1, Math.round(h * 0.04))}px`;
    ctx.fillText(subtitle.toUpperCase(), cx, h * 0.68, w - inset * 4);
    ctx.letterSpacing = '0px';
  }

  flagDots(ctx, w - inset - 4, h - Math.max(10, h * 0.12), Math.max(5, h * 0.05));
}

let iosMat: THREE.MeshBasicMaterial | null = null;
let macMat: THREE.MeshBasicMaterial | null = null;

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** iOS lock screen — dusk over Yaoundé hills. */
export function iphoneScreenMat(): THREE.MeshBasicMaterial {
  if (iosMat) return iosMat;
  const W = 384;
  const H = 768;
  const tex = canvasTex(W, H, (ctx) => {
    fillDuskSky(ctx, W, H);
    fillHills(ctx, W, H, 520);

    ctx.fillStyle = '#0a0a0c';
    roundRect(ctx, 148, 22, 88, 28, 14);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '600 22px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('9:41', 72, 42);
    ctx.font = '500 16px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('●●●●  100', 312, 42);

    ctx.font = '200 108px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('9:41', 192, 210);
    ctx.font = '500 22px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillText('mardi 13 octobre', 192, 248);

    ctx.font = '800 36px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.letterSpacing = '4px';
    ctx.fillText('YAOUNDÉ', 192, 430);
    ctx.letterSpacing = '0px';
    ctx.font = '600 16px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,236,180,0.92)';
    ctx.fillText('LIFE CITY', 192, 458);

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    roundRect(ctx, 142, 730, 100, 6, 3);
    ctx.fill();
  });
  iosMat = new THREE.MeshBasicMaterial({ map: tex });
  return iosMat;
}

/** macOS desktop — dusk wallpaper, menu bar, dock. */
export function macScreenMat(): THREE.MeshBasicMaterial {
  if (macMat) return macMat;
  const W = 960;
  const H = 600;
  const tex = canvasTex(W, H, (ctx) => {
    fillDuskSky(ctx, W, H);
    fillHills(ctx, W, H, 380);

    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.textAlign = 'center';
    ctx.font = '800 42px "Segoe UI", system-ui, sans-serif';
    ctx.letterSpacing = '8px';
    ctx.fillText('LIFE CITY', 480, 250);
    ctx.letterSpacing = '0px';
    ctx.font = '500 18px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText('Yaoundé  ·  237', 480, 278);

    ctx.fillStyle = 'rgba(18,22,26,0.55)';
    ctx.fillRect(0, 0, W, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('●  LIFE CITY    Finder    Fichier    Édition    Affichage', 14, 19);
    ctx.textAlign = 'right';
    ctx.fillText('jeu  18:52', W - 14, 19);

    ctx.fillStyle = 'rgba(20,24,28,0.5)';
    roundRect(ctx, 220, 530, 520, 52, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const cols = [
      ['#5ac8fa', 'Ph'],
      ['#ff3b30', 'Ms'],
      ['#34c759', 'Sf'],
      ['#ffcc00', 'Nt'],
      ['#af52de', 'St'],
      ['#ff9500', 'Mb'],
    ];
    cols.forEach(([c, label], i) => {
      const x = 268 + i * 76;
      ctx.fillStyle = c!;
      roundRect(ctx, x - 16, 540, 32, 32, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.font = '700 11px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label!, x, 561);
    });
  });
  macMat = new THREE.MeshBasicMaterial({ map: tex });
  return macMat;
}
