import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { supabase } from '../core/supabase.client';

import { environment } from '../../environments/environment';
import { WorkoutExerciseRecord, WorkoutRecord, WorkoutRecordDetail } from '../models/workout-record.model';

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

  constructor(private readonly http: HttpClient) {}

  async loadRecords(): Promise<void> {
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
      this.loading.set(false);
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

  async replicateLatestWorkout(): Promise<WorkoutRecord | null> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<WorkoutRecord>>(
          `${environment.apiUrl}/api/workouts/records`,
          { replicate_latest: true },
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

  async getWorkoutDetail(workoutId: string): Promise<WorkoutRecordDetail | null> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<WorkoutRecordDetail>>(`${environment.apiUrl}/api/workouts/records/${workoutId}`, {
          headers: await this.authHeaders()
        })
      );
      return res.data;
    } catch {
      this.error.set('No se pudo cargar el detalle del entrenamiento.');
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  /** Detalle sin activar el loading global (listas, historic, etc.). */
  async getWorkoutDetailQuiet(workoutId: string): Promise<WorkoutRecordDetail | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<WorkoutRecordDetail>>(`${environment.apiUrl}/api/workouts/records/${workoutId}`, {
          headers: await this.authHeaders()
        })
      );
      return res.data;
    } catch {
      return null;
    }
  }

  async addExercise(
    workoutId: string,
    payload: {
      name: string;
      muscle_group?: string;
      notes?: string;
      external_exercise_id?: string;
      exercise_detail?: Record<string, unknown>;
    }
  ): Promise<WorkoutExerciseRecord | null> {
    this.loading.set(true);
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
    } finally {
      this.loading.set(false);
    }
  }

  async addSet(
    workoutId: string,
    exerciseId: string,
    payload: { set_type: string; target_reps?: number; done_reps?: number; weight?: number; unit?: 'kg' | 'lb'; comment?: string; assisted_reps?: number; rpe?: number }
  ): Promise<boolean> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.http.post<ApiResponse<unknown>>(
          `${environment.apiUrl}/api/workouts/records/${workoutId}/exercises/${exerciseId}/sets`,
          payload,
          { headers: await this.authHeaders() }
        )
      );
      return true;
    } catch {
      this.error.set('No se pudo agregar la serie.');
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  async deleteSet(workoutId: string, exerciseId: string, setId: string): Promise<boolean> {
    this.loading.set(true);
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
    } finally {
      this.loading.set(false);
    }
  }

  async updateSet(
    workoutId: string,
    exerciseId: string,
    setId: string,
    payload: { done_reps?: number | null; weight?: number | null; comment?: string | null }
  ): Promise<boolean> {
    this.loading.set(true);
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
    } finally {
      this.loading.set(false);
    }
  }

  async updateExerciseNotes(workoutId: string, exerciseId: string, notes: string): Promise<boolean> {
    this.loading.set(true);
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
    } finally {
      this.loading.set(false);
    }
  }

  async deleteExercise(workoutId: string, exerciseId: string): Promise<boolean> {
    this.loading.set(true);
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
    } finally {
      this.loading.set(false);
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

  async updateWorkoutName(workoutId: string, workoutName: string): Promise<boolean> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.patch<ApiResponse<WorkoutRecord>>(
          `${environment.apiUrl}/api/workouts/records/${workoutId}`,
          { workout_name: workoutName },
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
