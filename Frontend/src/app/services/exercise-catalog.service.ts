import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { mergeQueriesFromLabels, normalizeRoutineLabel, type ExerciseDbQuery } from '../core/exercise-db-queries';
import { resolveExerciseImageByName } from '../core/exercise-icons';
import { environment } from '../../environments/environment';
import { ExerciseCatalogItem } from '../models/exercise-catalog.model';
import type { ExerciseDbExercise } from '../models/exercisedb.model';
import { supabase } from '../core/supabase.client';
import { ExerciseDbMediaService } from './exercise-db-media.service';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
}

/** Grupos mostrados al usuario (alineados con rutinas de la app). */
const DEFAULT_SPANISH_GROUPS = [
  'Pecho',
  'Espalda',
  'Pierna',
  'Biceps',
  'Triceps',
  'Hombro',
  'Core',
  'Cardio'
];

@Injectable({ providedIn: 'root' })
export class ExerciseCatalogService {
  readonly groups = signal<string[]>([]);
  readonly items = signal<ExerciseCatalogItem[]>([]);
  readonly listThumbs = signal<Record<string, string>>({});
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private readonly http = inject(HttpClient);
  private readonly media = inject(ExerciseDbMediaService);
  private localExercises: ExerciseDbExercise[] | null = null;
  private localExercisesLoadPromise: Promise<ExerciseDbExercise[]> | null = null;

  async loadGroups(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.groups.set([...DEFAULT_SPANISH_GROUPS]);
    } catch {
      this.error.set('No se pudieron cargar grupos musculares.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadByGroup(group: string): Promise<void> {
    const queries = mergeQueriesFromLabels([normalizeRoutineLabel(group)]);
    await this.loadByQueries(queries, group);
  }

  async loadByRoutineTypes(routineTypes: string[]): Promise<void> {
    const normalized = routineTypes.map((t) => normalizeRoutineLabel(t)).filter((s) => s.length > 0);
    const queries = mergeQueriesFromLabels(normalized);
    await this.loadByQueries(queries, 'Rutina combinada');
  }

  async loadAll(displayLabel = 'Todos'): Promise<void> {
    await this.loadExercisesUnfiltered(displayLabel);
  }

  /** Busqueda por nombre (ExerciseDB /exercises/name/...). */
  async searchByName(term: string, displayLabel = 'Busqueda'): Promise<void> {
    const q = term.trim();
    if (!q) {
      this.items.set([]);
      this.listThumbs.set({});
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.listThumbs.set({});
    try {
      const local = await this.loadLocalExercises();
      const items: ExerciseCatalogItem[] = local
        .filter((row) => row.name.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .map((row) => this.toCatalogItem(row, displayLabel));
      this.items.set(items);
      void this.prefetchListThumbs(items);
    } catch {
      this.error.set('No se pudo buscar en el catalogo local.');
      this.items.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadByQueries(queries: ExerciseDbQuery[], displayGroupLabel: string): Promise<void> {
    if (queries.length === 0) {
      await this.loadExercisesUnfiltered(displayGroupLabel);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.listThumbs.set({});
    try {
      const local = await this.loadLocalExercises();
      const merged = new Map<string, ExerciseDbExercise>();
      for (const query of queries) {
        const rows =
          query.kind === 'body_part'
            ? local.filter((row) => (row.bodyPart || '').toLowerCase() === query.value.toLowerCase())
            : local.filter((row) => (row.target || '').toLowerCase() === query.value.toLowerCase());
        for (const row of rows) {
          merged.set(row.id, row);
        }
      }
      if (merged.size === 0) {
        for (const row of local) {
          merged.set(row.id, row);
        }
      }
      const items: ExerciseCatalogItem[] = Array.from(merged.values())
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .map((row) => this.toCatalogItem(row, displayGroupLabel));
      this.items.set(items);
      void this.prefetchListThumbs(items);
    } catch {
      this.error.set('No se pudo cargar el catalogo local.');
      this.items.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadExercisesUnfiltered(displayGroupLabel: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.listThumbs.set({});
    try {
      const local = await this.loadLocalExercises();
      const items: ExerciseCatalogItem[] = local
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .map((row) => this.toCatalogItem(row, displayGroupLabel));
      this.items.set(items);
      void this.prefetchListThumbs(items);
    } catch {
      this.error.set('No se pudo cargar el catalogo local.');
      this.items.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private toCatalogItem(row: ExerciseDbExercise, displayGroup: string): ExerciseCatalogItem {
    return {
      id: `edb-${row.id}`,
      name: row.name,
      muscle_group: displayGroup,
      is_custom: false,
      external_exercise_id: row.id,
      detail: row
    };
  }

  private async prefetchListThumbs(items: ExerciseCatalogItem[]): Promise<void> {
    const cap = 40;
    const next: Record<string, string> = {};
    for (const item of items.slice(0, cap)) {
      const ext = item.external_exercise_id;
      if (!ext) {
        continue;
      }
      const url = await this.media.getObjectUrl(ext, '180');
      if (url) {
        next[item.id] = url;
      } else {
        // Fallback visual local para ejercicios sin media ExerciseDB local.
        next[item.id] = resolveExerciseImageByName(item.name, item.muscle_group);
      }
    }
    this.listThumbs.set(next);
  }

  async createCustom(name: string, muscleGroup: string): Promise<ExerciseCatalogItem | null> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<ExerciseCatalogItem>>(
          `${environment.apiUrl}/api/exercises/custom`,
          { name, muscle_group: muscleGroup },
          { headers: await this.authHeaders() }
        )
      );
      return res.data;
    } catch {
      this.error.set('No se pudo crear el ejercicio personalizado.');
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      throw new Error('No active session');
    }
    return { Authorization: `Bearer ${token}` };
  }

  private async loadLocalExercises(): Promise<ExerciseDbExercise[]> {
    if (this.localExercises) {
      return this.localExercises;
    }
    if (this.localExercisesLoadPromise) {
      return this.localExercisesLoadPromise;
    }
    this.localExercisesLoadPromise = firstValueFrom(
      this.http.get<ExerciseDbExercise[]>('/exercises/exercisedb/exercises.json')
    )
      .then((data) => {
        this.localExercises = Array.isArray(data) ? data : [];
        return this.localExercises;
      })
      .finally(() => {
        this.localExercisesLoadPromise = null;
      });
    return this.localExercisesLoadPromise;
  }
}
