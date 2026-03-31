import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { WorkoutRecord } from '../models/workout-record.model';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
}

@Injectable({ providedIn: 'root' })
export class WorkoutRecordService {
  readonly records = signal<WorkoutRecord[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor(private readonly http: HttpClient) {}

  async loadRecords(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<WorkoutRecord[]>>(`${environment.apiUrl}/api/workouts/records`)
      );
      this.records.set(res.data ?? []);
    } catch {
      this.error.set('No se pudieron cargar entrenamientos.');
    } finally {
      this.loading.set(false);
    }
  }

  async createWorkout(workoutName: string, routineTypes: string[]): Promise<boolean> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<WorkoutRecord>>(`${environment.apiUrl}/api/workouts/records`, {
          workout_name: workoutName,
          routine_types: routineTypes
        })
      );
      this.records.update((items) => [res.data, ...items]);
      return true;
    } catch {
      this.error.set('No se pudo registrar el entrenamiento.');
      return false;
    } finally {
      this.loading.set(false);
    }
  }
}
