import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { supabase } from '../core/supabase.client';

import { environment } from '../../environments/environment';
import {
  ExerciseSetRecord,
  WorkoutExerciseRecord,
  WorkoutRecord,
  WorkoutRecordDetail,
  WorkoutStats
} from '../models/workout-record.model';

function mapApiSetRow(row: Record<string, unknown>): ExerciseSetRecord {
  return {
    id: String(row['id'] ?? ''),
    set_type: String(row['set_type'] ?? 'bilateral'),
    target_reps: (row['target_reps'] as number | null | undefined) ?? null,
    done_reps: (row['done_reps'] as number | null | undefined) ?? null,
    weight: row['weight'] != null && row['weight'] !== '' ? Number(row['weight']) : null,
    unit: row['unit'] === 'lb' ? 'lb' : 'kg',
    comment: (row['comment'] as string | null | undefined) ?? null,
    assisted_reps: (row['assisted_reps'] as number | null | undefined) ?? null,
    rpe: row['rpe'] != null && row['rpe'] !== '' ? Number(row['rpe']) : null,
    position: Number(row['position'] ?? 0)
  };
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
}

@Injectable({ providedIn: 'root' })
export class WorkoutRecordService {
  readonly records = signal<WorkoutRecord[]>([]);
  readonly latest = signal<WorkoutRecord | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly stats = signal<WorkoutStats | null>(null);
  readonly statsLoading = signal(false);

  private lastRecordsLoadAt = 0;
  private readonly detailInflight = new Map<string, Promise<WorkoutRecordDetail | null>>();

  constructor(private readonly http: HttpClient) {}

  /**
   * Lista de entrenos. Con `minIntervalMs`, evita refetch si ya hay datos y poco tiempo pasó
   * (menos ida al servidor al cambiar de pestaña).
   */
  async loadRecords(options?: { minIntervalMs?: number }): Promise<void> {
    const minInterval = options?.minIntervalMs ?? 0;
    const now = Date.now();
    if (minInterval > 0 && this.records().length > 0 && now - this.lastRecordsLoadAt < minInterval) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<WorkoutRecord[]>>(`${environment.apiUrl}/api/workouts/records`, {
          headers: await this.authHeaders()
        })
      );
      this.records.set(res.data ?? []);
      this.latest.set((res.data ?? [])[0] ?? null);
    } catch {
      this.error.set('No se pudieron cargar entrenamientos.');
    } finally {
      this.lastRecordsLoadAt = Date.now();
      this.loading.set(false);
    }
  }

  async loadStats(): Promise<void> {
    this.statsLoading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<WorkoutStats>>(`${environment.apiUrl}/api/workouts/stats`, {
          headers: await this.authHeaders()
        })
      );
      this.stats.set(res.data ?? null);
    } catch {
      // stats are non-critical; silent fail
    } finally {
      this.statsLoading.set(false);
    }
  }

  async createWorkout(workoutName: string, routineTypes: string[]): Promise<WorkoutRecord | null> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<WorkoutRecord>>(
          `${environment.apiUrl}/api/workouts/records`,
          {
            workout_name: workoutName,
            routine_types: routineTypes,
            replicate_latest: false
          },
          { headers: await this.authHeaders() }
        )
      );
      this.records.update((items) => [res.data, ...items]);
      this.latest.set(res.data);
      return res.data;
    } catch {
      this.error.set('No se pudo registrar el entrenamiento.');
      return null;
    } finally {
      this.loading.set(false);
    }
  }


  async replicateWorkoutFrom(workoutId: string): Promise<WorkoutRecord | null> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<WorkoutRecord>>(
          `${environment.apiUrl}/api/workouts/records`,
          { replicate_from_id: workoutId },
          { headers: await this.authHeaders() }
        )
      );
      this.records.update((items) => [res.data, ...items]);
      this.latest.set(res.data);
      return res.data;
    } catch {
      this.error.set('No se pudo replicar el entrenamiento.');
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Detalle de un entreno. Varias llamadas concurrentes al mismo id comparten una sola petición HTTP.
   * `silent: true` no toca el spinner global (recomendado en la sesión en curso).
   */
  async getWorkoutDetail(workoutId: string, options?: { silent?: boolean }): Promise<WorkoutRecordDetail | null> {
    const existing = this.detailInflight.get(workoutId);
    if (existing) {
      return existing;
    }
    const silent = options?.silent ?? false;
    const promise = (async (): Promise<WorkoutRecordDetail | null> => {
      if (!silent) {
        this.loading.set(true);
        this.error.set(null);
      }
      try {
        const res = await firstValueFrom(
          this.http.get<ApiResponse<WorkoutRecordDetail>>(`${environment.apiUrl}/api/workouts/records/${workoutId}`, {
            headers: await this.authHeaders()
          })
        );
        return res.data ?? null;
      } catch {
        if (!silent) {
          this.error.set('No se pudo cargar el detalle del entrenamiento.');
        }
        return null;
      } finally {
        if (!silent) {
          this.loading.set(false);
        }
        this.detailInflight.delete(workoutId);
      }
    })();
    this.detailInflight.set(workoutId, promise);
    return promise;
  }

  /** Detalle sin activar el loading global (histórico, etc.). */
  async getWorkoutDetailQuiet(workoutId: string): Promise<WorkoutRecordDetail | null> {
    return this.getWorkoutDetail(workoutId, { silent: true });
  }

  async addExercise(
    workoutId: string,
    payload: {
      name: string;
      muscle_group?: string;
      notes?: string;
      external_exercise_id?: string;
      exercise_detail?: Record<string, unknown>;
      rest_seconds?: number;
    }
  ): Promise<WorkoutExerciseRecord | null> {
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<WorkoutExerciseRecord>>(
          `${environment.apiUrl}/api/workouts/records/${workoutId}/exercises`,
          payload,
          { headers: await this.authHeaders() }
        )
      );
      return res.data;
    } catch {
      this.error.set('No se pudo agregar el ejercicio.');
      return null;
    }
  }

  /**
   * Reordena los ejercicios de un workout. Optimistic UI desde el llamador:
   * cambia el array localmente antes y nosotros confirmamos con el backend.
   */
  async reorderExercises(workoutId: string, exerciseIds: string[]): Promise<boolean> {
    this.error.set(null);
    try {
      await firstValueFrom(
        this.http.patch<ApiResponse<unknown>>(
          `${environment.apiUrl}/api/workouts/records/${workoutId}/exercises/order`,
          { exercise_ids: exerciseIds },
          { headers: await this.authHeaders() }
        )
      );
      return true;
    } catch {
      this.error.set('No se pudo reordenar los ejercicios.');
      return false;
    }
  }

  /**
   * Actualiza el tiempo de descanso por ejercicio (rest_seconds). Reusa el
   * mismo PATCH que las notas para no añadir endpoints.
   */
  async updateExerciseRest(
    workoutId: string,
    exerciseId: string,
    restSeconds: number
  ): Promise<boolean> {
    this.error.set(null);
    try {
      await firstValueFrom(
        this.http.patch<ApiResponse<unknown>>(
          `${environment.apiUrl}/api/workouts/records/${workoutId}/exercises/${exerciseId}`,
          { rest_seconds: restSeconds },
          { headers: await this.authHeaders() }
        )
      );
      return true;
    } catch {
      this.error.set('No se pudo actualizar el tiempo de descanso.');
      return false;
    }
  }

  /** Devuelve la fila creada; evita tener que volver a pedir todo el detalle del entreno. */
  async addSet(
    workoutId: string,
    exerciseId: string,
    payload: { set_type: string; target_reps?: number; done_reps?: number; weight?: number; unit?: 'kg' | 'lb'; comment?: string; assisted_reps?: number; rpe?: number }
  ): Promise<ExerciseSetRecord | null> {
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<Record<string, unknown>>>(
          `${environment.apiUrl}/api/workouts/records/${workoutId}/exercises/${exerciseId}/sets`,
          payload,
          { headers: await this.authHeaders() }
        )
      );
      const row = res.data;
      if (!row || typeof row !== 'object') {
        return null;
      }
      return mapApiSetRow(row);
    } catch {
      this.error.set('No se pudo agregar la serie.');
      return null;
    }
  }

  async deleteSet(workoutId: string, exerciseId: string, setId: string): Promise<boolean> {
    this.error.set(null);
    try {
      await firstValueFrom(
        this.http.delete<ApiResponse<unknown>>(
          `${environment.apiUrl}/api/workouts/records/${workoutId}/exercises/${exerciseId}/sets/${setId}`,
          { headers: await this.authHeaders() }
        )
      );
      return true;
    } catch {
      this.error.set('No se pudo eliminar la serie.');
      return false;
    }
  }

  async updateSet(
    workoutId: string,
    exerciseId: string,
    setId: string,
    payload: { done_reps?: number | null; weight?: number | null; comment?: string | null }
  ): Promise<boolean> {
    this.error.set(null);
    try {
      await firstValueFrom(
        this.http.patch<ApiResponse<unknown>>(
          `${environment.apiUrl}/api/workouts/records/${workoutId}/exercises/${exerciseId}/sets/${setId}`,
          payload,
          { headers: await this.authHeaders() }
        )
      );
      return true;
    } catch {
      this.error.set('No se pudo actualizar la serie.');
      return false;
    }
  }

  async updateExerciseNotes(workoutId: string, exerciseId: string, notes: string): Promise<boolean> {
    this.error.set(null);
    try {
      await firstValueFrom(
        this.http.patch<ApiResponse<unknown>>(
          `${environment.apiUrl}/api/workouts/records/${workoutId}/exercises/${exerciseId}`,
          { notes },
          { headers: await this.authHeaders() }
        )
      );
      return true;
    } catch {
      this.error.set('No se pudieron guardar notas del ejercicio.');
      return false;
    }
  }

  async deleteExercise(workoutId: string, exerciseId: string): Promise<boolean> {
    this.error.set(null);
    try {
      await firstValueFrom(
        this.http.delete<ApiResponse<unknown>>(
          `${environment.apiUrl}/api/workouts/records/${workoutId}/exercises/${exerciseId}`,
          { headers: await this.authHeaders() }
        )
      );
      return true;
    } catch {
      this.error.set('No se pudo eliminar el ejercicio.');
      return false;
    }
  }

  async deleteWorkout(workoutId: string): Promise<boolean> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.http.delete<ApiResponse<unknown>>(`${environment.apiUrl}/api/workouts/records/${workoutId}`, {
          headers: await this.authHeaders()
        })
      );
      this.records.update((items) => items.filter((item) => item.id !== workoutId));
      if (this.latest()?.id === workoutId) {
        this.latest.set(this.records()[0] ?? null);
      }
      return true;
    } catch {
      this.error.set('No se pudo cancelar el entrenamiento.');
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  async updateWorkoutName(workoutId: string, workoutName: string, trainedAt?: string): Promise<boolean> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const body: Record<string, unknown> = { workout_name: workoutName };
      if (trainedAt) body['trained_at'] = trainedAt;
      const res = await firstValueFrom(
        this.http.patch<ApiResponse<WorkoutRecord>>(
          `${environment.apiUrl}/api/workouts/records/${workoutId}`,
          body,
          { headers: await this.authHeaders() }
        )
      );
      this.records.update((items) => items.map((item) => (item.id === workoutId ? res.data : item)));
      if (this.latest()?.id === workoutId) {
        this.latest.set(res.data);
      }
      return true;
    } catch {
      this.error.set('No se pudo actualizar el nombre de la rutina.');
      return false;
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
}
