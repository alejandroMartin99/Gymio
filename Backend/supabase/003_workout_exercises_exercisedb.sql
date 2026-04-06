-- Metadatos ExerciseDB (RapidAPI) por ejercicio en un entrenamiento
alter table public.workout_exercises
  add column if not exists external_exercise_id text,
  add column if not exists exercise_detail jsonb;

comment on column public.workout_exercises.external_exercise_id is 'ID numerico ExerciseDB v1, ej. 0001';
comment on column public.workout_exercises.exercise_detail is 'Snapshot JSON del ejercicio (instrucciones, descripcion, etc.)';
