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
  private readonly failedCacheStorageKey = 'gymio:exercisedb:media:failed:v1';

  constructor() {
    this.restoreFailedCache();
  }

  private cacheKey(exerciseId: string, resolution: string): string {
    return `${exerciseId}:${resolution}`;
  }

  /**
   * URL local persistente; no dispara peticiones de red.
   */
  async getObjectUrl(exerciseId: string, resolution: ExerciseDbImageResolution = '180'): Promise<string | null> {
    const id = exerciseId.trim();
    if (!id) {
      return null;
    }
    const ck = this.cacheKey(id, resolution);
    const hit = this.objectUrlCache.get(ck);
    if (hit) {
      return hit;
    }
    if (this.failedCache.has(ck)) {
      return null;
    }
    const running = this.inFlight.get(ck);
    if (running) {
      return running;
    }

    const task = this.resolveObjectUrl(id, ck);
    this.inFlight.set(ck, task);
    try {
      return await task;
    } finally {
      this.inFlight.delete(ck);
    }
  }

  private async resolveObjectUrl(exerciseId: string, ck: string): Promise<string | null> {
    if (!EXERCISEDB_LOCAL_MEDIA_IDS.has(exerciseId)) {
      this.failedCache.add(ck);
      this.persistFailedCache();
      return null;
    }
    const localUrl = `/exercises/exercisedb/gifs/${exerciseId}.gif`;
    this.objectUrlCache.set(ck, localUrl);
    return localUrl;
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
