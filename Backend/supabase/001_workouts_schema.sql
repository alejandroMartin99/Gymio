create extension if not exists "pgcrypto";

create table if not exists public.workout_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_name text not null,
  routine_types text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workout_records(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  muscle_group text,
  notes text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workout_records(id) on delete cascade,
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  set_type text not null default 'normal',
  target_reps int,
  done_reps int,
  weight numeric,
  unit text not null default 'kg',
  comment text,
  assisted_reps int,
  rpe numeric,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.workout_records enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.exercise_sets enable row level security;

drop policy if exists "workout_records_owner" on public.workout_records;
create policy "workout_records_owner" on public.workout_records
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "workout_exercises_owner" on public.workout_exercises;
create policy "workout_exercises_owner" on public.workout_exercises
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "exercise_sets_owner" on public.exercise_sets;
create policy "exercise_sets_owner" on public.exercise_sets
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_workout_records_user_created_at
  on public.workout_records(user_id, created_at desc);
create index if not exists idx_workout_exercises_workout_position
  on public.workout_exercises(workout_id, position);
create index if not exists idx_exercise_sets_exercise_position
  on public.exercise_sets(workout_exercise_id, position);
