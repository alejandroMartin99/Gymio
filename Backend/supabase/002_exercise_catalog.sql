create table if not exists public.exercise_catalog (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  muscle_group text not null,
  icon_url text,
  icon_key text,
  instructions_url text,
  is_custom boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.exercise_catalog enable row level security;

drop policy if exists "exercise_catalog_select" on public.exercise_catalog;
create policy "exercise_catalog_select" on public.exercise_catalog
for select using (user_id is null or auth.uid() = user_id);

drop policy if exists "exercise_catalog_insert_custom" on public.exercise_catalog;
create policy "exercise_catalog_insert_custom" on public.exercise_catalog
for insert with check (auth.uid() = user_id and is_custom = true);

drop policy if exists "exercise_catalog_update_owner" on public.exercise_catalog;
create policy "exercise_catalog_update_owner" on public.exercise_catalog
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_exercise_catalog_group on public.exercise_catalog(muscle_group, name);

insert into public.exercise_catalog (name, muscle_group, icon_url, icon_key, instructions_url, is_custom)
values
  ('Press banca', 'Pecho', null, 'bench-press', null, false),
  ('Press inclinado mancuernas', 'Pecho', null, 'incline-dumbbell-press', null, false),
  ('Press declinado barra', 'Pecho', null, 'bench-press', null, false),
  ('Press declinado mancuernas', 'Pecho', null, 'incline-dumbbell-press', null, false),
  ('Aperturas en maquina', 'Pecho', null, 'machine-fly', null, false),
  ('Aperturas con mancuernas', 'Pecho', null, 'machine-fly', null, false),
  ('Cruces en polea alta', 'Pecho', null, 'machine-fly', null, false),
  ('Cruces en polea baja', 'Pecho', null, 'machine-fly', null, false),
  ('Fondos en paralelas', 'Pecho', null, 'bench-press', null, false),
  ('Press en maquina convergente', 'Pecho', null, 'bench-press', null, false),
  ('Pullover mancuerna', 'Pecho', null, 'machine-fly', null, false),
  ('Dominadas', 'Espalda', null, 'pull-up', null, false),
  ('Dominadas supinas', 'Espalda', null, 'pull-up', null, false),
  ('Dominadas neutras', 'Espalda', null, 'pull-up', null, false),
  ('Remo con barra', 'Espalda', null, 'barbell-row', null, false),
  ('Remo pendlay', 'Espalda', null, 'barbell-row', null, false),
  ('Remo con mancuerna a una mano', 'Espalda', null, 'barbell-row', null, false),
  ('Jalon al pecho', 'Espalda', null, 'pull-up', null, false),
  ('Jalon agarre estrecho', 'Espalda', null, 'pull-up', null, false),
  ('Jalon tras nuca', 'Espalda', null, 'pull-up', null, false),
  ('Remo en polea baja', 'Espalda', null, 'barbell-row', null, false),
  ('Remo en maquina pecho apoyado', 'Espalda', null, 'barbell-row', null, false),
  ('Remo T-bar', 'Espalda', null, 'barbell-row', null, false),
  ('Pullover en polea', 'Espalda', null, 'barbell-row', null, false),
  ('Face pull', 'Espalda', null, 'barbell-row', null, false),
  ('Sentadilla trasera', 'Pierna', null, 'back-squat', null, false),
  ('Sentadilla frontal', 'Pierna', null, 'back-squat', null, false),
  ('Sentadilla goblet', 'Pierna', null, 'back-squat', null, false),
  ('Peso muerto rumano', 'Pierna', null, 'romanian-deadlift', null, false),
  ('Peso muerto convencional', 'Pierna', null, 'romanian-deadlift', null, false),
  ('Peso muerto sumo', 'Pierna', null, 'romanian-deadlift', null, false),
  ('Prensa 45', 'Pierna', null, 'legs', null, false),
  ('Prensa horizontal', 'Pierna', null, 'legs', null, false),
  ('Sentadilla hack', 'Pierna', null, 'back-squat', null, false),
  ('Zancadas', 'Pierna', null, 'legs', null, false),
  ('Zancadas caminando', 'Pierna', null, 'legs', null, false),
  ('Bulgarian split squat', 'Pierna', null, 'legs', null, false),
  ('Hip thrust', 'Pierna', null, 'romanian-deadlift', null, false),
  ('Hip thrust unilateral', 'Pierna', null, 'romanian-deadlift', null, false),
  ('Puente de gluteo', 'Pierna', null, 'romanian-deadlift', null, false),
  ('Extension de cuadriceps', 'Pierna', null, 'legs', null, false),
  ('Sissy squat asistida', 'Pierna', null, 'legs', null, false),
  ('Curl femoral tumbado', 'Pierna', null, 'legs', null, false),
  ('Curl femoral sentado', 'Pierna', null, 'legs', null, false),
  ('Buenos dias', 'Pierna', null, 'romanian-deadlift', null, false),
  ('Step up con mancuerna', 'Pierna', null, 'legs', null, false),
  ('Elevacion de gemelos', 'Pierna', null, 'legs', null, false),
  ('Gemelo sentado', 'Pierna', null, 'legs', null, false),
  ('Curl biceps barra', 'Biceps', null, 'barbell-curl', null, false),
  ('Curl biceps barra Z', 'Biceps', null, 'barbell-curl', null, false),
  ('Curl inclinado mancuernas', 'Biceps', null, 'barbell-curl', null, false),
  ('Curl martillo', 'Biceps', null, 'barbell-curl', null, false),
  ('Curl martillo cruzado', 'Biceps', null, 'barbell-curl', null, false),
  ('Curl concentrado', 'Biceps', null, 'barbell-curl', null, false),
  ('Curl en polea baja', 'Biceps', null, 'barbell-curl', null, false),
  ('Curl en banco predicador', 'Biceps', null, 'barbell-curl', null, false),
  ('Extension triceps polea', 'Triceps', null, 'triceps-pushdown', null, false),
  ('Extension triceps cuerda', 'Triceps', null, 'triceps-pushdown', null, false),
  ('Extension triceps barra V', 'Triceps', null, 'triceps-pushdown', null, false),
  ('Press frances', 'Triceps', null, 'triceps-pushdown', null, false),
  ('Extensiones sobre la cabeza', 'Triceps', null, 'triceps-pushdown', null, false),
  ('Patada de triceps', 'Triceps', null, 'triceps-pushdown', null, false),
  ('Press cerrado en banca', 'Triceps', null, 'triceps-pushdown', null, false),
  ('Fondos triceps', 'Triceps', null, 'triceps-pushdown', null, false),
  ('Press militar', 'Hombro', null, 'overhead-press', null, false),
  ('Press arnold', 'Hombro', null, 'overhead-press', null, false),
  ('Press militar sentado mancuernas', 'Hombro', null, 'overhead-press', null, false)
  ,('Elevaciones laterales', 'Hombro', null, 'overhead-press', null, false)
  ,('Elevaciones laterales en polea', 'Hombro', null, 'overhead-press', null, false)
  ,('Elevaciones frontales', 'Hombro', null, 'overhead-press', null, false)
  ,('Remo al menton', 'Hombro', null, 'overhead-press', null, false)
  ,('Pajaros', 'Hombro', null, 'overhead-press', null, false)
  ,('Pajaros en peck deck', 'Hombro', null, 'overhead-press', null, false)
  ,('Plancha', 'Core', null, 'core', null, false)
  ,('Plancha lateral', 'Core', null, 'core', null, false)
  ,('Plancha con peso', 'Core', null, 'core', null, false)
  ,('Crunch en polea', 'Core', null, 'core', null, false)
  ,('Crunch en maquina', 'Core', null, 'core', null, false)
  ,('Crunch invertido', 'Core', null, 'core', null, false)
  ,('Elevacion de piernas colgado', 'Core', null, 'core', null, false)
  ,('Toques al talon', 'Core', null, 'core', null, false)
  ,('Dead bug', 'Core', null, 'core', null, false)
  ,('Pallof press', 'Core', null, 'core', null, false)
  ,('Rueda abdominal', 'Core', null, 'core', null, false)
  ,('Cinta inclinada', 'Cardio', null, 'cardio', null, false)
  ,('Cinta carrera continua', 'Cardio', null, 'cardio', null, false)
  ,('Cinta HIIT', 'Cardio', null, 'cardio', null, false)
  ,('Remo ergometro', 'Cardio', null, 'cardio', null, false)
  ,('Remo intervalos', 'Cardio', null, 'cardio', null, false)
  ,('Bicicleta estatica', 'Cardio', null, 'cardio', null, false)
  ,('Bicicleta spinning', 'Cardio', null, 'cardio', null, false)
  ,('Eliptica', 'Cardio', null, 'cardio', null, false)
  ,('Escaladora', 'Cardio', null, 'cardio', null, false)
  ,('Assault bike', 'Cardio', null, 'cardio', null, false)
  ,('Saltar cuerda', 'Cardio', null, 'cardio', null, false)
  ,('Burpees', 'Cardio', null, 'cardio', null, false)
  ,('Mountain climbers', 'Cardio', null, 'cardio', null, false)
on conflict do nothing;
