export interface WorkoutRecord {
  id: string;
  workout_name: string;
  routine_types: string[];
  notes?: string | null;
  created_at: string;
}

export interface ExerciseSetRecord {
  id: string;
  set_type: string;
  target_reps?: number | null;
  done_reps?: number | null;
  weight?: number | null;
  unit: 'kg' | 'lb';
  comment?: string | null;
  assisted_reps?: number | null;
  rpe?: number | null;
  position: number;
}

export interface ExerciseHistoryPoint {
  workout_id: string;
  date: string;
  max_weight: number;
  max_reps: number;
}

import type { ExerciseDbExercise } from './exercisedb.model';

export interface WorkoutExerciseRecord {
  id: string;
  workout_id: string;
  name: string;
  muscle_group?: string | null;
  notes?: string | null;
  position: number;
  sets: ExerciseSetRecord[];
  previous_sets?: ExerciseSetRecord[];
  history_points?: ExerciseHistoryPoint[];
  external_exercise_id?: string | null;
  exercise_detail?: ExerciseDbExercise | Record<string, unknown> | null;
}

export interface WorkoutRecordDetail extends WorkoutRecord {
  exercises: WorkoutExerciseRecord[];
}
