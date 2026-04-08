import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ActiveWorkoutService {
  private readonly storageKey = 'gymio.activeWorkout';
  readonly workoutId = signal<string | null>(null);
  readonly workoutName = signal<string | null>(null);
  readonly startedAt = signal<number | null>(null);
  readonly elapsedSeconds = signal(0);
  readonly finalizeRequestTick = signal(0);

  private ticker: ReturnType<typeof setInterval> | null = null;

  readonly isActive = computed(() => !!this.workoutId());
  readonly elapsedLabel = computed(() => {
    const total = this.elapsedSeconds();
    const hours = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  });

  constructor() {
    this.restoreFromStorage();
  }

  startWorkout(id: string, name: string): void {
    if (this.workoutId() === id && this.startedAt()) {
      return;
    }
    this.workoutId.set(id);
    this.workoutName.set(name);
    this.startedAt.set(Date.now());
    this.elapsedSeconds.set(0);
    this.startTicker();
    this.persist();
  }

  finishWorkout(): void {
    this.stopTicker();
    this.workoutId.set(null);
    this.workoutName.set(null);
    this.startedAt.set(null);
    this.elapsedSeconds.set(0);
    this.finalizeRequestTick.set(0);
    this.persist();
  }

  requestFinalize(): void {
    this.finalizeRequestTick.update((value) => value + 1);
  }

  private startTicker(): void {
    this.stopTicker();
    this.ticker = setInterval(() => {
      const started = this.startedAt();
      if (!started) {
        this.elapsedSeconds.set(0);
        return;
      }
      this.elapsedSeconds.set(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    }, 1000);
  }

  private stopTicker(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const id = this.workoutId();
    const name = this.workoutName();
    const startedAt = this.startedAt();
    if (!id || !name || !startedAt) {
      localStorage.removeItem(this.storageKey);
      return;
    }
    localStorage.setItem(
      this.storageKey,
      JSON.stringify({
        workoutId: id,
        workoutName: name,
        startedAt,
      })
    );
  }

  private restoreFromStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { workoutId?: string; workoutName?: string; startedAt?: number };
      if (!parsed.workoutId || !parsed.workoutName || !parsed.startedAt) {
        localStorage.removeItem(this.storageKey);
        return;
      }
      this.workoutId.set(parsed.workoutId);
      this.workoutName.set(parsed.workoutName);
      this.startedAt.set(parsed.startedAt);
      this.elapsedSeconds.set(Math.max(0, Math.floor((Date.now() - parsed.startedAt) / 1000)));
      this.startTicker();
    } catch {
      localStorage.removeItem(this.storageKey);
    }
  }
}
