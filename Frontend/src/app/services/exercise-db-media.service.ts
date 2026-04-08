import { Injectable } from '@angular/core';
import { EXERCISEDB_LOCAL_MEDIA_IDS } from '../core/exercisedb-local-media';

export type ExerciseDbImageResolution = '180' | '360' | '720' | '1080';

/**
 * GIF/imagen ExerciseDB via backend (con JWT); para usar en <img [src]> con blob URLs.
 */
@Injectable({ providedIn: 'root' })
export class ExerciseDbMediaService {
  private readonly objectUrlCache = new Map<string, string>();
  private readonly inFlight = new Map<string, Promise<string | null>>();
  private readonly failedCache = new Set<string>();
  private readonly failedCacheStorageKey = 'gymio:exercisedb:media:failed:v2';

  constructor() {
    this.restoreFailedCache();
  }

  private cacheKey(exerciseId: string, resolution: string): string {
    return `${exerciseId}:${resolution}`;
  }

  /**
   * URL local persistente; no dispara peticiones de red.
   *
   * Comprueba primero el índice local compilado. Si el ID está en el set,
   * devuelve la URL directamente y limpia cualquier entrada obsoleta en el
   * failedCache de localStorage (puede quedar de sesiones anteriores a la
   * descarga del GIF).
   */
  getObjectUrl(exerciseId: string, resolution: ExerciseDbImageResolution = '180'): Promise<string | null> {
    const id = exerciseId.trim();
    if (!id) {
      return Promise.resolve(null);
    }
    const ck = this.cacheKey(id, resolution);

    // Fast path: el GIF existe localmente según el índice compilado.
    if (EXERCISEDB_LOCAL_MEDIA_IDS.has(id)) {
      const localUrl = `/exercises/exercisedb/gifs/${id}.gif`;
      this.objectUrlCache.set(ck, localUrl);
      // Limpia entrada obsoleta en failedCache si existiera de otra sesión.
      if (this.failedCache.has(ck)) {
        this.failedCache.delete(ck);
        this.persistFailedCache();
      }
      return Promise.resolve(localUrl);
    }

    const hit = this.objectUrlCache.get(ck);
    if (hit) {
      return Promise.resolve(hit);
    }
    if (this.failedCache.has(ck)) {
      return Promise.resolve(null);
    }
    const running = this.inFlight.get(ck);
    if (running) {
      return running;
    }

    const task = this.resolveNotLocal(id, ck);
    this.inFlight.set(ck, task);
    return task.finally(() => this.inFlight.delete(ck));
  }

  private async resolveNotLocal(exerciseId: string, ck: string): Promise<string | null> {
    this.failedCache.add(ck);
    this.persistFailedCache();
    return null;
  }

  private restoreFailedCache(): void {
    try {
      const raw = localStorage.getItem(this.failedCacheStorageKey);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as string[];
      for (const entry of parsed) {
        this.failedCache.add(entry);
      }
    } catch {
      // Ignore storage parsing issues.
    }
  }

  private persistFailedCache(): void {
    try {
      const cap = 5000;
      const payload = Array.from(this.failedCache).slice(-cap);
      localStorage.setItem(this.failedCacheStorageKey, JSON.stringify(payload));
    } catch {
      // Ignore storage errors.
    }
  }

}
