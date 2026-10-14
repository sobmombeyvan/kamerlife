import { hideBoot, setBoot, showBootError } from './pwa/bootScreen';
import { mountPwaBanners, startPwaShell } from './pwa/pwaShell';

const params = new URLSearchParams(window.location.search);
/** Default launches the 3D open world; use ?mode=map for the 2D editor. */
const mode = params.get('mode') ?? '3d';

async function boot(): Promise<void> {
  startPwaShell();
  const appRoot = document.querySelector<HTMLElement>('#app');
  if (!appRoot) throw new Error('#app missing');
  appRoot.innerHTML = '';

  if (mode === '3d') {
    if (navigator.onLine === false) {
      setBoot('Pas de réseau — ouverture du cache local si cette version y est déjà.', 0.04);
    } else {
      setBoot('Ouverture de KAMERLIFE…', 0.06);
    }
    await import('./styles/main.css');
    const { GameApp } = await import('./core/GameApp');
    const canvas = document.createElement('canvas');
    canvas.id = 'game-canvas';
    appRoot.appendChild(canvas);
    const uiRoot = document.createElement('div');
    uiRoot.id = 'ui-root';
    appRoot.appendChild(uiRoot);
    const game = new GameApp(canvas, uiRoot);
    if (import.meta.env.DEV) (window as unknown as { __game: unknown }).__game = game;
    await game.start((label, ratio) => setBoot(label, ratio));
    hideBoot();
    mountPwaBanners();
    return;
  }

  await import('./styles/map-editor.css');
  const { MapEditorApp } = await import('./map/MapEditorApp');
  const canvas = document.createElement('canvas');
  canvas.id = 'map-canvas';
  appRoot.appendChild(canvas);
  const uiRoot = document.createElement('div');
  uiRoot.id = 'map-ui';
  appRoot.appendChild(uiRoot);
  new MapEditorApp(canvas, uiRoot);
  hideBoot();
  mountPwaBanners();
}

boot().catch((error) => {
  console.error(error);
  showBootError(error);
});
