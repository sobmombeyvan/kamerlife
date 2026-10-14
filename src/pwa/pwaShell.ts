type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'kamerlife-pwa-install-dismissed';

let deferredInstall: BeforeInstallPromptEvent | null = null;
let updateApply: (() => void) | null = null;
let reloadOnControl = false;
let bannerHost: HTMLElement | null = null;
let offline = typeof navigator !== 'undefined' && navigator.onLine === false;

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/i.test(ua) || iPadOs;
}

function installDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function dismissInstall(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* storage full — hide for this session only */
  }
  deferredInstall = null;
  renderBanners();
}

export function startPwaShell(): void {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstall = event as BeforeInstallPromptEvent;
    renderBanners();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    dismissInstall();
  });
  window.addEventListener('online', () => {
    offline = false;
    renderBanners();
  });
  window.addEventListener('offline', () => {
    offline = true;
    renderBanners();
  });

  if (!import.meta.env.PROD) return;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadOnControl) {
      reloadOnControl = false;
      window.location.reload();
      return;
    }
    // First install: reload once so the worker actually sees the scripts and can cache them.
    try {
      if (sessionStorage.getItem('kamerlife-sw-ready') === '1') return;
      sessionStorage.setItem('kamerlife-sw-ready', '1');
    } catch {
      return;
    }
    window.location.reload();
  });

  const register = (): void => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
      const watch = (worker: ServiceWorker | null): void => {
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state !== 'installed') return;
          if (navigator.serviceWorker.controller) {
            updateApply = () => {
              reloadOnControl = true;
              worker.postMessage({ type: 'SKIP_WAITING' });
            };
            renderBanners();
            return;
          }
          worker.postMessage({ type: 'SKIP_WAITING' });
        });
      };
      watch(reg.installing);
      if (reg.waiting && navigator.serviceWorker.controller) {
        const waiting = reg.waiting;
        updateApply = () => {
          reloadOnControl = true;
          waiting.postMessage({ type: 'SKIP_WAITING' });
        };
        renderBanners();
      }
      reg.addEventListener('updatefound', () => watch(reg.installing));
    }).catch((error) => {
      console.warn('[pwa] service worker non enregistré', error);
    });
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

export function mountPwaBanners(): void {
  if (bannerHost) return;
  bannerHost = document.createElement('div');
  bannerHost.id = 'pwa-banners';
  document.body.appendChild(bannerHost);
  renderBanners();
}

function renderBanners(): void {
  if (!bannerHost) return;
  bannerHost.replaceChildren();
  if (updateApply) bannerHost.appendChild(updateCard());
  if (offline) bannerHost.appendChild(offlineCard());
  const install = installCard();
  if (install) bannerHost.appendChild(install);
}

function updateCard(): HTMLElement {
  const card = cardShell();
  const text = document.createElement('p');
  text.textContent = 'Une mise à jour de KAMERLIFE est prête. L’appliquer recharge la page.';
  const row = document.createElement('div');
  row.className = 'pwa-row';
  const apply = button('Mettre à jour', () => updateApply?.());
  apply.classList.add('primary');
  const later = button('Plus tard', () => {
    updateApply = null;
    renderBanners();
  });
  row.append(apply, later);
  card.append(text, row);
  return card;
}

function offlineCard(): HTMLElement {
  const card = cardShell();
  const text = document.createElement('p');
  text.textContent =
    'Pas de réseau. La partie déjà en mémoire continue. Le hors-ligne complet n’est disponible que pour les fichiers déjà mis en cache sur cet appareil.';
  card.append(text);
  return card;
}

function installCard(): HTMLElement | null {
  if (isStandalone() || installDismissed()) return null;
  if (deferredInstall) return androidCard();
  if (isIos()) return iosCard();
  return null;
}

function androidCard(): HTMLElement {
  const card = cardShell();
  const text = document.createElement('p');
  text.textContent = 'Installer KAMERLIFE sur l’écran d’accueil.';
  const row = document.createElement('div');
  row.className = 'pwa-row';
  const install = button('Installer', () => {
    const prompt = deferredInstall;
    if (!prompt) return;
    void prompt.prompt().then(() => prompt.userChoice).then((choice) => {
      deferredInstall = null;
      if (choice.outcome === 'dismissed') dismissInstall();
      else renderBanners();
    }).catch(() => {
      deferredInstall = null;
      renderBanners();
    });
  });
  install.classList.add('primary');
  row.append(install, button('Plus tard', dismissInstall));
  card.append(text, row);
  return card;
}

function iosCard(): HTMLElement {
  const card = cardShell();
  const text = document.createElement('p');
  text.textContent =
    'Sur iPhone : touche Partager dans Safari, puis « Sur l’écran d’accueil ». Le nom affiché est Kamerlife.';
  card.append(text, button('Compris', dismissInstall));
  return card;
}

function cardShell(): HTMLElement {
  const card = document.createElement('section');
  card.className = 'pwa-card';
  const title = document.createElement('strong');
  title.textContent = 'KAMERLIFE';
  card.append(title);
  return card;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}
