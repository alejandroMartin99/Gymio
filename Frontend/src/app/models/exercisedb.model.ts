/** Respuesta tipica de GET /exercises (ExerciseDB v1 / RapidAPI). */
export interface ExerciseDbExercise {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  secondaryMuscles: string[];
  instructions: string[];
  description?: string;
  difficulty?: string;
  category?: string;
}

export function isExerciseDbExercise(value: unknown): value is ExerciseDbExercise {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const o = value as { id?: unknown; name?: unknown };
  return typeof o.id === 'string' && typeof o.name === 'string';
}
