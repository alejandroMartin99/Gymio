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

export interface ExerciseHistorySet {
  weight?: number | null;
  done_reps?: number | null;
  position: number;
}

export interface ExerciseHistorySession {
  workout_id: string;
  date: string;
  sets: ExerciseHistorySet[];
}

import type { ExerciseDbExercise } from './exercisedb.model';

export interface WorkoutExerciseRecord {
  id: string;
  workout_id: string;
  name: string;
  muscle_group?: string | null;
  notes?: string | null;
  position: number;
  /** Descanso configurado para este ejercicio en segundos. null => default 120s. */
  rest_seconds?: number | null;
  sets: ExerciseSetRecord[];
  previous_sets?: ExerciseSetRecord[];
  history_points?: ExerciseHistoryPoint[];
  history_sessions?: ExerciseHistorySession[];
  external_exercise_id?: string | null;
  exercise_detail?: ExerciseDbExercise | Record<string, unknown> | null;
}

export interface WorkoutRecordDetail extends WorkoutRecord {
  exercises: WorkoutExerciseRecord[];
}

export interface WorkoutStatsWeek {
  label: string;
  start_date: string;
  count: number;
}

export interface WorkoutStatsExercise {
  display: string;
  count: number;
  max_weight: number;
}

export interface WorkoutStatsMuscle {
  group: string;
  count: number;
}

export interface WorkoutStatsHistoryPoint {
  date: string;
  max_weight: number;
  max_reps: number;
}

export interface WorkoutStatsProgressEntry {
  display: string;
  current_max: number;
  prev_max: number;
  change_pct: number | null;
  all_time_min: number | null;
  all_time_max: number | null;
  change_vs_max_pct: number | null;
  change_vs_min_pct: number | null;
  /** % cambio: última sesión vs sesión anterior. null si es la primera. */
  change_vs_prev_week_pct?: number | null;
  history_points: WorkoutStatsHistoryPoint[];
}

export interface WorkoutStatsProgressGroup {
  muscle_group: string;
  exercises: WorkoutStatsProgressEntry[];
}

export interface WorkoutStatsMonthlyPersistence {
  current_pct: number;
  prev_pct: number;
  current_sessions: number;
  prev_sessions: number;
  current_month: string;
  prev_month: string;
  change_pct: number;
}

export interface WorkoutStats {
  sessions_per_week: WorkoutStatsWeek[];
  muscle_breakdown: WorkoutStatsMuscle[];
  progress_by_muscle: WorkoutStatsProgressGroup[];
  monthly_persistence: WorkoutStatsMonthlyPersistence;
  totals: {
    sessions: number;
    sets: number;
    current_streak_weeks: number;
    max_streak_weeks: number;
    unique_days: number;
  };
}
