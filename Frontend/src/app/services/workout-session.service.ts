import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { WorkoutSession } from '../models/workout-session.model';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class WorkoutSessionService {
  readonly session = signal<WorkoutSession | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor(private readonly http: HttpClient) {}

  async loadActiveSession(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<WorkoutSession | null>>(`${environment.apiUrl}/api/workouts/sessions/active`)
      );
      this.session.set(res.data);
    } catch {
      this.error.set('No se pudo cargar la sesion activa.');
    } finally {
      this.loading.set(false);
    }
  }

  async startSession(routineName: string, routineCategory: string, loadPrevious: boolean): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<WorkoutSession>>(`${environment.apiUrl}/api/workouts/sessions/start`, {
          routine_name: routineName,
          routine_category: routineCategory,
          load_previous: loadPrevious
        })
      );
      this.session.set(res.data);
    } catch {
      this.error.set('No se pudo iniciar el entrenamiento.');
    } finally {
      this.loading.set(false);
    }
  }

  async finishSession(): Promise<void> {
    const activeSession = this.session();
    if (!activeSession) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.http.post<ApiResponse<WorkoutSession>>(
          `${environment.apiUrl}/api/workouts/sessions/${activeSession.id}/finish`,
          {}
        )
      );
      this.session.set(null);
    } catch {
      this.error.set('No se pudo finalizar la sesion.');
    } finally {
      this.loading.set(false);
    }
  }
}
