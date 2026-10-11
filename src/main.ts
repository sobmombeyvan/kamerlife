const params = new URLSearchParams(window.location.search);
/** Default launches the 3D open world; use ?mode=map for the 2D editor. */
const mode = params.get('mode') ?? '3d';

async function boot(): Promise<void> {
  const appRoot = document.querySelector<HTMLElement>('#app');
  if (!appRoot) throw new Error('#app missing');
  appRoot.innerHTML = '';

  if (mode === '3d') {
    await import('./styles/main.css');
    const { GameApp } = await import('./core/GameApp');
    const canvas = document.createElement('canvas');
    canvas.id = 'game-canvas';
    appRoot.appendChild(canvas);
    const uiRoot = document.createElement('div');
    uiRoot.id = 'ui-root';
    appRoot.appendChild(uiRoot);
    new GameApp(canvas, uiRoot).start();
    return;
  }

  // Default: 2D map / road editor (foundation for the 3D city)
  await import('./styles/map-editor.css');
  const { MapEditorApp } = await import('./map/MapEditorApp');
  const canvas = document.createElement('canvas');
  canvas.id = 'map-canvas';
  appRoot.appendChild(canvas);
  const uiRoot = document.createElement('div');
  uiRoot.id = 'map-ui';
  appRoot.appendChild(uiRoot);
  new MapEditorApp(canvas, uiRoot);
}

boot().catch((error) => {
  console.error(error);
  const app = document.querySelector('#app');
  if (app) {
    app.innerHTML = `<pre style="padding:24px;color:#fff;white-space:pre-wrap">Erreur:\n${String(error)}</pre>`;
  }
});
