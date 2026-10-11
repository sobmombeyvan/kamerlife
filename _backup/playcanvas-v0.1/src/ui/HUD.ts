import { GameConfig } from '../game/GameConfig';

export class HUD {
  private readonly root: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly balance: HTMLElement;
  private menuOpen = false;
  private readonly menu: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="brand">
          <span class="brand-title">${GameConfig.title}</span>
          <span class="brand-meta">Phase 1 · ${GameConfig.version}</span>
        </div>
        <div class="balance" id="hud-balance"></div>
      </div>
      <div class="hud-hint" id="hud-hint"></div>
      <div class="hud-menu hidden" id="hud-menu">
        <h2>Pause</h2>
        <p>Prototype jouable — zone test inspirée de Mendong.</p>
        <ul>
          <li>ZQSD / WASD : marcher</li>
          <li>Shift : courir</li>
          <li>Espace : sauter</li>
          <li>Souris : caméra (clic pour verrouiller)</li>
          <li>E : interagir (préparé)</li>
          <li>Échap : menu</li>
        </ul>
        <p class="menu-note">Prochaine phase : maison + meubles.</p>
      </div>
    `;
    parent.appendChild(this.root);
    this.hint = this.root.querySelector('#hud-hint') as HTMLElement;
    this.balance = this.root.querySelector('#hud-balance') as HTMLElement;
    this.menu = this.root.querySelector('#hud-menu') as HTMLElement;
    this.setBalance(GameConfig.startingBalanceFcfa);
    this.setHint('Cliquez pour capturer la souris · Explorez le carrefour');
  }

  setBalance(fcfa: number): void {
    this.balance.textContent = `${fcfa.toLocaleString('fr-FR')} FCFA`;
  }

  setHint(text: string): void {
    this.hint.textContent = text;
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
    this.menu.classList.toggle('hidden', !this.menuOpen);
  }

  isMenuOpen(): boolean {
    return this.menuOpen;
  }
}
