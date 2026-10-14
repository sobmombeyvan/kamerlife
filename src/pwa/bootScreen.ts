const BOOT_ID = 'boot';

export function setBoot(label: string, ratio: number): void {
  const status = document.querySelector('#boot-status');
  const fill = document.querySelector<HTMLElement>('#boot-fill');
  if (status) status.textContent = label;
  if (fill) fill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
}

export function hideBoot(): void {
  const boot = document.getElementById(BOOT_ID);
  if (!boot) return;
  boot.classList.add('boot-done');
  window.setTimeout(() => boot.classList.add('boot-gone'), 420);
}

/** Keeps the loader on screen and offers a reload. Does not invent a second game. */
export function showBootError(error: unknown): void {
  const boot = document.getElementById(BOOT_ID);
  boot?.classList.remove('boot-done', 'boot-gone');
  const status = document.querySelector('#boot-status');
  const note = document.querySelector('#boot-note');
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (status) {
    status.textContent = offline
      ? 'Pas de réseau. KAMERLIFE s’ouvre hors ligne seulement si cette version est déjà en cache sur l’appareil.'
      : 'KAMERLIFE n’a pas pu démarrer.';
  }
  if (note) note.textContent = error instanceof Error ? error.message : String(error);
  if (boot && !boot.querySelector('[data-boot-retry]')) {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.dataset.bootRetry = '1';
    retry.textContent = 'Réessayer';
    retry.addEventListener('click', () => window.location.reload());
    boot.querySelector('#boot-card')?.appendChild(retry);
  }
}
