/** Yaoundé / Cameroon timezone (WAT = UTC+1). */
const YAOUNDE_TZ = 'Africa/Douala';

/**
 * In-game clock locked to Yaoundé real local time (24 h).
 * Day/night lighting follows the real sun cycle in Cameroon.
 */
export class GameClock {
  /** Minutes since midnight (0–1439) — always synced from real Yaoundé time. */
  minutes = 0;
  weather: 'clear' | 'haze' | 'rain' = 'clear';
  private weatherTimer = 0;
  private syncAcc = 0;

  constructor() {
    this.syncFromYaounde();
  }

  /** Dev/testing: pin the clock to an hour (0–24) instead of real Yaoundé time. */
  debugHour: number | null = null;

  /** Pull current wall-clock time in Yaoundé. */
  syncFromYaounde(): void {
    this.minutes = this.debugHour !== null ? Math.round(this.debugHour * 60) % 1440 : yaoundeMinutesNow();
  }

  update(dt: number): void {
    this.syncAcc += dt;
    // Resync often so the HUD stays on real time
    if (this.syncAcc >= 0.5) {
      this.syncAcc = 0;
      this.syncFromYaounde();
    }
    this.weatherTimer += dt;
    if (this.weatherTimer > 180) {
      this.weatherTimer = 0;
      const r = Math.random();
      this.weather = r < 0.7 ? 'clear' : r < 0.9 ? 'haze' : 'rain';
    }
  }

  /**
   * Sleep / work no longer skip the clock — Yaoundé stays on real time.
   * Kept for API compatibility.
   */
  advanceMinutes(_mins: number): void {
    this.syncFromYaounde();
  }

  get hours(): number {
    return Math.floor(this.minutes / 60);
  }

  get hourFloat(): number {
    return this.minutes / 60;
  }

  get mins(): number {
    return Math.floor(this.minutes % 60);
  }

  get label(): string {
    return `${String(this.hours).padStart(2, '0')}:${String(this.mins).padStart(2, '0')}`;
  }

  /** Full label with date for phone status bar. */
  get fullLabel(): string {
    try {
      return new Date().toLocaleString('fr-FR', {
        timeZone: YAOUNDE_TZ,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return this.label;
    }
  }

  get period(): 'night' | 'dawn' | 'day' | 'dusk' {
    const h = this.hours;
    if (h < 5 || h >= 20) return 'night';
    if (h < 7) return 'dawn';
    if (h < 18) return 'day';
    return 'dusk';
  }

  get weatherLabel(): string {
    if (this.weather === 'rain') return 'Pluie';
    if (this.weather === 'haze') return 'Brume';
    return 'Clair';
  }

  /** 0–1 sun intensity factor from Yaoundé time of day. */
  get sunFactor(): number {
    const h = this.hours + this.mins / 60;
    if (h < 5 || h >= 20) return 0.15;
    if (h < 7) return 0.15 + ((h - 5) / 2) * 0.85;
    if (h < 17) return 1;
    if (h < 20) return 1 - ((h - 17) / 3) * 0.85;
    return 0.15;
  }
}

function yaoundeMinutesNow(): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: YAOUNDE_TZ,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    // en-GB can return 24 for midnight in some engines
    const h = hour === 24 ? 0 : hour;
    return ((h * 60 + minute) % 1440 + 1440) % 1440;
  } catch {
    const d = new Date();
    // Fallback WAT ≈ UTC+1
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    const wat = new Date(utc + 60 * 60000);
    return wat.getHours() * 60 + wat.getMinutes();
  }
}
