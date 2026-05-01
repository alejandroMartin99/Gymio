import { Injectable } from '@angular/core';

const STORAGE_KEY = 'gymio.workoutSessionDraft';

/** Borrador de la sesión en curso (reps/kg sin guardar, series pendientes de sync, etc.). */
export interface WorkoutSessionDraftPayload {
  pendingSetsByExercise: Record<
    string,
    Array<{ local_id: string; set_type: string; done_reps?: number; weight?: number; comment?: string }>
  >;
  setInputs: Record<string, { reps?: number; weight?: number; comment?: string; mode?: 'unilateral' | 'bilateral' }>;
  completedExerciseIds: string[];
  confirmedSetIds: string[];
  selectedExerciseId: string;
}

interface StoredDraft extends WorkoutSessionDraftPayload {
  workoutId: string;
}

@Injectable({ providedIn: 'root' })
export class WorkoutSessionDraftService {
  clear(): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }
    sessionStorage.removeItem(STORAGE_KEY);
  }

  save(workoutId: string, payload: WorkoutSessionDraftPayload): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }
    try {
      const body: StoredDraft = { workoutId, ...payload };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(body));
    } catch {
      // quota / private mode
    }
  }

  /** Devuelve el borrador solo si corresponde a este entreno. */
  load(workoutId: string): WorkoutSessionDraftPayload | null {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as StoredDraft;
      if (!parsed || parsed.workoutId !== workoutId) {
        return null;
      }
      return {
        pendingSetsByExercise: parsed.pendingSetsByExercise ?? {},
        setInputs: parsed.setInputs ?? {},
        completedExerciseIds: Array.isArray(parsed.completedExerciseIds) ? parsed.completedExerciseIds : [],
        confirmedSetIds: Array.isArray(parsed.confirmedSetIds) ? parsed.confirmedSetIds : [],
        selectedExerciseId: typeof parsed.selectedExerciseId === 'string' ? parsed.selectedExerciseId : ''
      };
    } catch {
      return null;
    }
  }
}
