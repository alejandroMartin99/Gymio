import type { ExerciseDbExercise } from './exercisedb.model';

export interface ExerciseCatalogItem {
  id: string;
  user_id?: string | null;
  name: string;
  muscle_group: string;
  icon_url?: string | null;
  icon_key?: string | null;
  instructions_url?: string | null;
  is_custom: boolean;
  /** ID numerico ExerciseDB (ej. 0001) para /api/exercisedb/media/... */
  external_exercise_id?: string | null;
  /** Datos completos del listado API (instrucciones, descripcion, etc.) */
  detail?: ExerciseDbExercise | null;
}
