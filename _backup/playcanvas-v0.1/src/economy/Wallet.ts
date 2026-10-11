import { GameConfig } from '../game/GameConfig';

export class Wallet {
  private balance: number;

  constructor() {
    this.balance = this.load();
  }

  getBalance(): number {
    return this.balance;
  }

  canAfford(amount: number): boolean {
    return this.balance >= amount;
  }

  spend(amount: number): boolean {
    if (!this.canAfford(amount)) return false;
    this.balance -= amount;
    this.persist();
    return true;
  }

  earn(amount: number): void {
    this.balance += amount;
    this.persist();
  }

  format(): string {
    return `${this.balance.toLocaleString('fr-FR')} FCFA`;
  }

  private load(): number {
    try {
      const raw = localStorage.getItem(GameConfig.saveKeyMoney);
      if (raw == null) return GameConfig.startingBalanceFcfa;
      const n = Number(raw);
      return Number.isFinite(n) ? n : GameConfig.startingBalanceFcfa;
    } catch {
      return GameConfig.startingBalanceFcfa;
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(GameConfig.saveKeyMoney, String(this.balance));
    } catch {
      /* ignore quota */
    }
  }
}
