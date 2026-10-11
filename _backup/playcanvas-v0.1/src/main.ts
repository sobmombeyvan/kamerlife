import './styles/game.css';
import { Game } from './game/Game';

async function boot(): Promise<void> {
  const appRoot = document.querySelector<HTMLElement>('#app');
  if (!appRoot) {
    throw new Error('#app root missing');
  }

  appRoot.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.id = 'game-canvas';
  appRoot.appendChild(canvas);

  const uiRoot = document.createElement('div');
  uiRoot.id = 'ui-root';
  appRoot.appendChild(uiRoot);

  const game = new Game(canvas, uiRoot);
  await game.start();
}

boot().catch((error) => {
  console.error('Failed to start LIFE CITY: YAOUNDÉ', error);
  const appRoot = document.querySelector('#app');
  if (appRoot) {
    const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
    appRoot.innerHTML = `<pre style="color:#fff;padding:24px;white-space:pre-wrap;font:14px/1.4 monospace">Erreur de démarrage LIFE CITY: YAOUNDÉ

${message}

Astuce: essayez Chrome/Edge à jour, et désactivez le blocage WebGL.</pre>`;
  }
});
