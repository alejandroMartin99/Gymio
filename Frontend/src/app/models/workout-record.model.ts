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

export interface WorkoutExerciseRecord {
  id: string;
  workout_id: string;
  name: string;
  muscle_group?: string | null;
  notes?: string | null;
  position: number;
  sets: ExerciseSetRecord[];
}

export interface WorkoutRecordDetail extends WorkoutRecord {
  exercises: WorkoutExerciseRecord[];
}
