import type { TaxiDestination } from '../vehicles/TaxiDestinations';
import { estimateFare } from '../vehicles/TaxiDestinations';

export type MapCallbacks = {
  onOrderRide: (dest: TaxiDestination) => void;
  onClose: () => void;
};

/**
 * Aerial-map chrome over the live city — the 3D camera is the map.
 */
export class CityMap {
  private readonly overlay: HTMLElement;
  private readonly fareEl: HTMLElement;
  private readonly hintEl: HTMLElement;
  private readonly goBtn: HTMLButtonElement;
  private open = false;
  private playerX = 0;
  private playerZ = 0;
  private destinations: TaxiDestination[] = [];
  private callbacks: MapCallbacks | null = null;
  private pending: TaxiDestination | null = null;

  constructor(parent: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.id = 'city-map';
    this.overlay.className = 'city-map hidden';
    this.overlay.innerHTML = `
      <div class="city-map-hud">
        <strong>Carte · Yaoundé</strong>
        <button type="button" id="map-close" aria-label="Fermer">✕</button>
      </div>
      <div class="city-map-dock">
        <p class="city-map-legend" id="map-hint">Survole la ville · clique pour un Yango</p>
        <p class="city-map-fare" id="map-fare">Clique le sol pour choisir où aller</p>
        <button type="button" class="map-go-btn" id="map-go" disabled>Yango · y aller</button>
      </div>
    `;
    parent.appendChild(this.overlay);
    this.fareEl = this.overlay.querySelector('#map-fare') as HTMLElement;
    this.hintEl = this.overlay.querySelector('#map-hint') as HTMLElement;
    this.goBtn = this.overlay.querySelector('#map-go') as HTMLButtonElement;
    this.overlay.querySelector('#map-close')!.addEventListener('click', () => this.hide());
    this.goBtn.addEventListener('click', () => this.confirmGo());
  }

  isOpen(): boolean {
    return this.open;
  }

  show(
    playerX: number,
    playerZ: number,
    destinations: TaxiDestination[],
    callbacks: MapCallbacks,
  ): void {
    this.playerX = playerX;
    this.playerZ = playerZ;
    this.destinations = destinations;
    this.callbacks = callbacks;
    this.open = true;
    this.pending = null;
    this.overlay.classList.remove('hidden');
    this.fareEl.textContent = 'Clique le sol pour choisir où aller';
    this.goBtn.disabled = true;
    this.hintEl.textContent = 'WASD survoler · molette zoom · glisser oriente · M fermer';
  }

  hide(): void {
    if (!this.open) return;
    this.open = false;
    this.overlay.classList.add('hidden');
    const cb = this.callbacks;
    this.callbacks = null;
    cb?.onClose();
  }

  updatePlayer(x: number, z: number): void {
    this.playerX = x;
    this.playerZ = z;
  }

  pickWorld(x: number, z: number): TaxiDestination {
    let best: TaxiDestination | null = null;
    let bestD = 90;
    for (const d of this.destinations) {
      const dist = Math.hypot(d.x - x, d.z - z);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    const dest: TaxiDestination = best ?? {
      id: `pin-${Math.round(x)}-${Math.round(z)}`,
      name: `Point · ${Math.round(x)}, ${Math.round(z)}`,
      x,
      z,
      fareFcfa: 800,
    };
    this.pending = dest;
    const fare = estimateFare(this.playerX, this.playerZ, dest);
    this.fareEl.textContent = `${dest.name} · ~${fare.toLocaleString('fr-FR')} FCFA`;
    this.goBtn.disabled = false;
    this.hintEl.textContent = 'Confirme avec Yango ou reclique ailleurs';
    return dest;
  }

  private confirmGo(): void {
    if (!this.pending || !this.callbacks) return;
    const dest = this.pending;
    const cb = this.callbacks;
    this.hide();
    cb.onOrderRide(dest);
  }
}
