export interface WorkoutSet {
  id: string;
  setType: string;
  targetReps?: number;
  doneReps?: number;
  weight?: number;
  unit?: 'kg' | 'lb';
  comment?: string;
  assistedReps?: number;
  rpe?: number;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  muscleGroup?: string;
  notes?: string;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: string;
  status: 'active' | 'finished';
  routineName: string;
  routineCategory: string;
  startedAt: string;
  endedAt?: string;
  elapsedSeconds: number;
  exercises: WorkoutExercise[];
}
