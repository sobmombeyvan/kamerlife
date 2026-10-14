export type NeedsState = {
  health: number;
  stamina: number;
  hunger: number;
  thirst: number;
  energy: number;
  hygiene: number;
  fun: number;
  social: number;
};

export type MoodId = 'great' | 'good' | 'ok' | 'bad' | 'critical';

export type NeedActivity =
  | 'sleep'
  | 'cook'
  | 'tv'
  | 'wash'
  | 'clothes'
  | 'work'
  | 'chat'
  | 'toilet'
  | 'basin'
  | 'drink'
  | 'rest';

/** Comfortable start. After 3 days of play these stay in the okay range. */
export const COMFORT_NEEDS: NeedsState = {
  health: 100,
  stamina: 100,
  hunger: 78,
  thirst: 76,
  energy: 88,
  hygiene: 80,
  fun: 74,
  social: 70,
};

/** Real seconds in 3 days. Needs are paced against time the game is open. */
const THREE_DAYS = 3 * 24 * 60 * 60;

/** How many points a meter loses if the game stays open for 3 days. */
function across3Days(points: number): number {
  return points / THREE_DAYS;
}

/** Sims-like meters 0–100 — drain over time, restored by activities / shops / social. */
export class PlayerNeeds {
  health = COMFORT_NEEDS.health;
  stamina = COMFORT_NEEDS.stamina;
  hunger = COMFORT_NEEDS.hunger;
  thirst = COMFORT_NEEDS.thirst;
  energy = COMFORT_NEEDS.energy;
  hygiene = COMFORT_NEEDS.hygiene;
  fun = COMFORT_NEEDS.fun;
  social = COMFORT_NEEDS.social;

  private warnAcc = 0;

  update(dt: number, moving: boolean, running: boolean, busy: boolean): void {
    // ~25 points over 3 days of play, so a normal life stays okay without constant eating or sleeping.
    this.hunger = clamp(this.hunger - dt * across3Days(28), 0, 100);
    this.thirst = clamp(this.thirst - dt * across3Days(26), 0, 100);
    this.energy = clamp(this.energy - dt * across3Days(busy ? 8 : 18), 0, 100);
    this.hygiene = clamp(this.hygiene - dt * across3Days(18), 0, 100);
    this.fun = clamp(this.fun - dt * across3Days(20), 0, 100);
    this.social = clamp(this.social - dt * across3Days(16), 0, 100);

    if (running) {
      // A long run barely tires him. Three days of sprinting still leaves stamina usable.
      this.stamina = clamp(this.stamina - dt * across3Days(30), 0, 100);
      this.energy = clamp(this.energy - dt * across3Days(8), 0, 100);
    } else if (moving) {
      this.stamina = clamp(this.stamina + dt * 6, 0, 100);
    } else {
      this.stamina = clamp(this.stamina + dt * 12, 0, 100);
    }

    // Critical vitals hurt health; balanced life heals
    const starving = this.hunger < 12 || this.thirst < 12;
    const exhausted = this.energy < 8;
    if (starving || exhausted) {
      this.health = clamp(this.health - dt * 0.9, 5, 100);
    } else if (this.hygiene < 15) {
      this.health = clamp(this.health - dt * 0.25, 5, 100);
    } else if (this.health < 100 && this.hunger > 40 && this.thirst > 40) {
      this.health = clamp(this.health + dt * 0.35, 0, 100);
    }

    this.warnAcc += dt;
  }

  /** 0.45–1.1 movement multiplier from energy / hunger / health. */
  moveMultiplier(): number {
    let m = 1;
    if (this.energy < 20) m *= 0.55;
    else if (this.energy < 40) m *= 0.75;
    if (this.hunger < 15 || this.thirst < 15) m *= 0.7;
    if (this.health < 30) m *= 0.65;
    if (this.mood() === 'great') m *= 1.08;
    return m;
  }

  canRun(): boolean {
    return this.stamina > 8 && this.energy > 12 && this.health > 15;
  }

  mood(): MoodId {
    const avg =
      (this.hunger + this.thirst + this.energy + this.hygiene + this.fun + this.social + this.health) /
      7;
    if (this.hunger < 10 || this.thirst < 10 || this.energy < 8 || this.health < 20) return 'critical';
    if (avg >= 78) return 'great';
    if (avg >= 58) return 'good';
    if (avg >= 38) return 'ok';
    return 'bad';
  }

  moodLabel(): string {
    switch (this.mood()) {
      case 'great':
        return 'Excellent';
      case 'good':
        return 'Bien';
      case 'ok':
        return 'Moyen';
      case 'bad':
        return 'Mal';
      case 'critical':
        return 'Critique';
    }
  }

  /** Periodic tip when something is critically low. */
  popWarning(): string | null {
    if (this.warnAcc < 12) return null;
    this.warnAcc = 0;
    if (this.energy < 12) return 'Tu es épuisé — dors chez toi';
    if (this.hunger < 15) return 'Tu as faim — cuisine ou achète à manger';
    if (this.thirst < 15) return 'Tu as soif — bois quelque chose';
    if (this.hygiene < 18) return 'Tu sens mauvais — prends une douche';
    if (this.fun < 18) return 'Tu t’ennuies — télé, sortir, ou parler';
    if (this.social < 18) return 'Tu te sens seul — parle aux gens';
    return null;
  }

  applyActivity(kind: NeedActivity): void {
    if (kind === 'toilet') {
      this.hygiene = clamp(this.hygiene + 15, 0, 100);
      this.health = clamp(this.health + 2, 0, 100);
    } else if (kind === 'basin') {
      this.hygiene = clamp(this.hygiene + 20, 0, 100);
      this.fun = clamp(this.fun + 2, 0, 100);
    } else if (kind === 'drink') {
      this.thirst = clamp(this.thirst + 40, 0, 100);
      this.energy = clamp(this.energy + 3, 0, 100);
    } else if (kind === 'rest') {
      this.energy = clamp(this.energy + 10, 0, 100);
      this.stamina = clamp(this.stamina + 20, 0, 100);
      this.fun = clamp(this.fun + 4, 0, 100);
    } else if (kind === 'sleep') {
      this.energy = 100;
      this.stamina = 100;
      this.health = clamp(this.health + 18, 0, 100);
      this.fun = clamp(this.fun + 8, 0, 100);
      this.hygiene = clamp(this.hygiene - 8, 0, 100);
    } else if (kind === 'cook') {
      this.hunger = clamp(this.hunger + 55, 0, 100);
      this.thirst = clamp(this.thirst + 15, 0, 100);
      this.fun = clamp(this.fun + 6, 0, 100);
    } else if (kind === 'wash') {
      this.hygiene = 100;
      this.energy = clamp(this.energy + 10, 0, 100);
      this.health = clamp(this.health + 6, 0, 100);
      this.fun = clamp(this.fun + 4, 0, 100);
    } else if (kind === 'tv') {
      this.fun = clamp(this.fun + 35, 0, 100);
      this.energy = clamp(this.energy + 8, 0, 100);
      this.social = clamp(this.social - 2, 0, 100);
    } else if (kind === 'clothes') {
      this.fun = clamp(this.fun + 12, 0, 100);
      this.social = clamp(this.social + 8, 0, 100);
      this.hygiene = clamp(this.hygiene + 5, 0, 100);
    } else if (kind === 'work') {
      this.energy = clamp(this.energy - 18, 0, 100);
      this.fun = clamp(this.fun - 10, 0, 100);
      this.social = clamp(this.social + 6, 0, 100);
      this.stamina = clamp(this.stamina - 15, 0, 100);
      this.hunger = clamp(this.hunger - 8, 0, 100);
    } else if (kind === 'chat') {
      this.social = clamp(this.social + 22, 0, 100);
      this.fun = clamp(this.fun + 10, 0, 100);
    }
  }

  /** Combat / trespass hit. Returns true if health reached 0. */
  takeDamage(amount: number): boolean {
    this.health = clamp(this.health - amount, 0, 100);
    this.stamina = clamp(this.stamina - 10, 0, 100);
    return this.health <= 0;
  }

  applyBoost(boost?: { fun?: number; hygiene?: number; social?: number }): void {
    if (!boost) return;
    if (boost.fun) this.fun = clamp(this.fun + boost.fun, 0, 100);
    if (boost.hygiene) this.hygiene = clamp(this.hygiene + boost.hygiene, 0, 100);
    if (boost.social) this.social = clamp(this.social + boost.social, 0, 100);
  }

  consume(item: 'meal' | 'snack' | 'drink' | 'coffee'): void {
    if (item === 'meal') {
      this.hunger = clamp(this.hunger + 40, 0, 100);
      this.thirst = clamp(this.thirst + 12, 0, 100);
      this.fun = clamp(this.fun + 8, 0, 100);
    } else if (item === 'snack') {
      this.hunger = clamp(this.hunger + 18, 0, 100);
      this.fun = clamp(this.fun + 6, 0, 100);
    } else if (item === 'drink') {
      this.thirst = clamp(this.thirst + 45, 0, 100);
    } else if (item === 'coffee') {
      this.thirst = clamp(this.thirst + 20, 0, 100);
      this.energy = clamp(this.energy + 22, 0, 100);
      this.fun = clamp(this.fun + 5, 0, 100);
    }
  }

  snapshot(): NeedsState {
    return {
      health: this.health,
      stamina: this.stamina,
      hunger: this.hunger,
      thirst: this.thirst,
      energy: this.energy,
      hygiene: this.hygiene,
      fun: this.fun,
      social: this.social,
    };
  }

  load(s: Partial<NeedsState>): void {
    if (s.health != null) this.health = s.health;
    if (s.stamina != null) this.stamina = s.stamina;
    if (s.hunger != null) this.hunger = s.hunger;
    if (s.thirst != null) this.thirst = s.thirst;
    if (s.energy != null) this.energy = s.energy;
    if (s.hygiene != null) this.hygiene = s.hygiene;
    if (s.fun != null) this.fun = s.fun;
    if (s.social != null) this.social = s.social;
  }
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}
