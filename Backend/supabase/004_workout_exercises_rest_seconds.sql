-- Tiempo de descanso por ejercicio (en segundos) configurable por el usuario
-- desde la sesión activa. Si está vacío, el frontend usa el default (120s).
alter table public.workout_exercises
  add column if not exists rest_seconds integer;

comment on column public.workout_exercises.rest_seconds is 'Tiempo de descanso entre series en segundos. NULL => default cliente (120).';

-- Índice de orden + búsqueda por nombre normalizado para acelerar las consultas
-- de previous_sets/history_points (hot path de _build_workout_detail).
create index if not exists workout_exercises_user_name_idx
  on public.workout_exercises (user_id, lower(name));

create index if not exists exercise_sets_user_exercise_idx
  on public.exercise_sets (user_id, workout_exercise_id);
