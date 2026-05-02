/**
 * Static data and constants for the Workouts page.
 * Extracted from workouts.page.ts for better organization and reusability.
 */

export interface WorkoutTemplateExercise {
  name: string;
  exerciseId?: string;
  muscle_group?: string;
}

export interface WorkoutTemplate {
  id: string;
  title: string;
  subtitle: string;
  daysFilter: '2d' | '3-4d' | '5d';
  equipment: 'gym' | 'bodyweight';
  workoutName: string;
  exercises: WorkoutTemplateExercise[];
}

export const ROUTINE_LOADER_GIFS = [
  '/icons/icons8-banca-pesas.gif',
  '/icons/icons8-deadlift.gif',
  '/icons/icons8-pullups.gif',
  '/icons/icons8-running.gif'
] as const;

export const MUSCLE_GROUP_SLIDES = [
  { key: 'pecho', label: 'Pecho', image: '/exercises/groups/pecho.png' },
  { key: 'espalda', label: 'Espalda', image: '/exercises/groups/espalda.png' },
  { key: 'pierna', label: 'Pierna', image: '/exercises/groups/pierna.png' },
  { key: 'biceps', label: 'Biceps', image: '/exercises/groups/biceps.png' },
  { key: 'triceps', label: 'Triceps', image: '/exercises/groups/triceps.png' },
  { key: 'hombro', label: 'Hombro', image: '/exercises/groups/hombro.png' },
  { key: 'core', label: 'Core', image: '/exercises/groups/core.png' },
  { key: 'cardio', label: 'Cardio', image: '/exercises/groups/cardio.png' }
];

export const EQUIPMENT_FILTERS: Array<{ key: 'all' | 'dumbbell' | 'barbell' | 'machine' | 'free'; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'dumbbell', label: 'Mancuerna' },
  { key: 'barbell', label: 'Barra' },
  { key: 'machine', label: 'Maquina' },
  { key: 'free', label: 'Libre' }
];

export const TEMPLATE_DAYS_FILTERS: Array<{ key: WorkoutTemplate['daysFilter']; label: string }> = [
  { key: '2d', label: '2 días' },
  { key: '3-4d', label: '3-4 días' },
  { key: '5d', label: '5 días' },
];

export const TEMPLATE_EQUIPMENT_FILTERS: Array<{ key: WorkoutTemplate['equipment']; label: string }> = [
  { key: 'gym', label: 'Gym completo' },
  { key: 'bodyweight', label: 'Libre / sin material' },
];

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  // ── 2 DÍAS: PUSH (Gym) ────────────────────────────────────────────────────
  { id: '2d-push-gym', title: 'Push · Gym', subtitle: 'Pecho · Hombros · Tríceps', daysFilter: '2d', equipment: 'gym', workoutName: 'Push · Gym completo', exercises: [
    { name: 'barbell bench press', exerciseId: '0025', muscle_group: 'Pecho' },
    { name: 'dumbbell incline hammer press', exerciseId: '0321', muscle_group: 'Pecho' },
    { name: 'cable alternate shoulder press', exerciseId: '0148', muscle_group: 'Hombro' },
    { name: 'dumbbell seated lateral raise', exerciseId: '0396', muscle_group: 'Hombro' },
    { name: 'cable alternate triceps extension', exerciseId: '0149', muscle_group: 'Triceps' }
  ]},
  // ── 2 DÍAS: PUSH (Libre) ─────────────────────────────────────────────────
  { id: '2d-push-bw', title: 'Push · Libre', subtitle: 'Pecho · Hombros · Tríceps', daysFilter: '2d', equipment: 'bodyweight', workoutName: 'Push · Libre', exercises: [
    { name: 'chest dip', exerciseId: '0251', muscle_group: 'Pecho' },
    { name: 'incline push-up', exerciseId: '0493', muscle_group: 'Pecho' },
    { name: 'decline push-up', exerciseId: '0279', muscle_group: 'Pecho' },
    { name: 'close-grip push-up', exerciseId: '0259', muscle_group: 'Triceps' },
    { name: 'bench dip (knees bent)', exerciseId: '0129', muscle_group: 'Triceps' }
  ]},
  // ── 2 DÍAS: PULL (Gym) ────────────────────────────────────────────────────
  { id: '2d-pull-gym', title: 'Pull · Gym', subtitle: 'Espalda · Bíceps', daysFilter: '2d', equipment: 'gym', workoutName: 'Pull · Gym completo', exercises: [
    { name: 'barbell bent over row', exerciseId: '0027', muscle_group: 'Espalda' },
    { name: 'alternate lateral pulldown', exerciseId: '0007', muscle_group: 'Espalda' },
    { name: 'dumbbell one arm bent-over row', exerciseId: '0292', muscle_group: 'Espalda' },
    { name: 'barbell curl', exerciseId: '0031', muscle_group: 'Biceps' },
    { name: 'cable hammer curl (with rope)', exerciseId: '0165', muscle_group: 'Biceps' }
  ]},
  // ── 2 DÍAS: PULL (Libre) ─────────────────────────────────────────────────
  { id: '2d-pull-bw', title: 'Pull · Libre', subtitle: 'Espalda · Bíceps', daysFilter: '2d', equipment: 'bodyweight', workoutName: 'Pull · Libre', exercises: [
    { name: 'chin-ups (narrow parallel grip)', exerciseId: '0253', muscle_group: 'Espalda' },
    { name: 'biceps pull-up', exerciseId: '0140', muscle_group: 'Biceps' },
    { name: 'hyperextension (on bench)', exerciseId: '0488', muscle_group: 'Espalda' },
    { name: 'inverted row v. 2', exerciseId: '0497', muscle_group: 'Espalda' },
    { name: 'body-up', exerciseId: '0137', muscle_group: 'Core' }
  ]},
  // ── 3-4 DÍAS: DÍA 1 (Pecho + Tríceps) ──────────────────────────────────
  { id: '34d-d1-pecho-tri-gym', title: 'Día 1 · Pecho + Tríceps', subtitle: 'Press plano, cruces y extensiones', daysFilter: '3-4d', equipment: 'gym', workoutName: 'Día 1 · Pecho + Tríceps', exercises: [
    { name: 'barbell bench press', exerciseId: '0025', muscle_group: 'Pecho' },
    { name: 'dumbbell incline hammer press', exerciseId: '0321', muscle_group: 'Pecho' },
    { name: 'cable cross-over variation', exerciseId: '0155', muscle_group: 'Pecho' },
    { name: 'barbell lying triceps extension skull crusher', exerciseId: '0060', muscle_group: 'Triceps' },
    { name: 'cable alternate triceps extension', exerciseId: '0149', muscle_group: 'Triceps' }
  ]},
  { id: '34d-d1-pecho-tri-bw', title: 'Día 1 · Pecho + Tríceps', subtitle: 'Fondos, flexiones y extensiones sin material', daysFilter: '3-4d', equipment: 'bodyweight', workoutName: 'Día 1 · Pecho + Tríceps', exercises: [
    { name: 'chest dip', exerciseId: '0251', muscle_group: 'Pecho' },
    { name: 'incline push-up', exerciseId: '0493', muscle_group: 'Pecho' },
    { name: 'decline push-up', exerciseId: '0279', muscle_group: 'Pecho' },
    { name: 'close-grip push-up', exerciseId: '0259', muscle_group: 'Triceps' },
    { name: 'bench dip (knees bent)', exerciseId: '0129', muscle_group: 'Triceps' }
  ]},
  // ── 3-4 DÍAS: DÍA 2 (Espalda + Bíceps) ─────────────────────────────────
  { id: '34d-d2-espalda-bi-gym', title: 'Día 2 · Espalda + Bíceps', subtitle: 'Remos, jalones y curl mixto', daysFilter: '3-4d', equipment: 'gym', workoutName: 'Día 2 · Espalda + Bíceps', exercises: [
    { name: 'barbell bent over row', exerciseId: '0027', muscle_group: 'Espalda' },
    { name: 'alternate lateral pulldown', exerciseId: '0007', muscle_group: 'Espalda' },
    { name: 'dumbbell incline row', exerciseId: '0327', muscle_group: 'Espalda' },
    { name: 'barbell preacher curl', exerciseId: '0070', muscle_group: 'Biceps' },
    { name: 'cable hammer curl (with rope)', exerciseId: '0165', muscle_group: 'Biceps' }
  ]},
  { id: '34d-d2-espalda-bi-bw', title: 'Día 2 · Espalda + Bíceps', subtitle: 'Dominadas, remo invertido y curl corporal', daysFilter: '3-4d', equipment: 'bodyweight', workoutName: 'Día 2 · Espalda + Bíceps', exercises: [
    { name: 'chin-ups (narrow parallel grip)', exerciseId: '0253', muscle_group: 'Espalda' },
    { name: 'biceps pull-up', exerciseId: '0140', muscle_group: 'Biceps' },
    { name: 'hyperextension (on bench)', exerciseId: '0488', muscle_group: 'Espalda' },
    { name: 'inverted row v. 2', exerciseId: '0497', muscle_group: 'Espalda' },
    { name: 'body-up', exerciseId: '0137', muscle_group: 'Core' }
  ]},
  // ── 3-4 DÍAS: DÍA 3 (Piernas) ───────────────────────────────────────────
  { id: '34d-d3-piernas-gym', title: 'Día 3 · Piernas', subtitle: 'Sentadilla, peso muerto y femoral mixto', daysFilter: '3-4d', equipment: 'gym', workoutName: 'Día 3 · Piernas', exercises: [
    { name: 'barbell full squat', exerciseId: '0043', muscle_group: 'Pierna' },
    { name: 'barbell romanian deadlift', exerciseId: '0085', muscle_group: 'Pierna' },
    { name: 'dumbbell single leg split squat', exerciseId: '0410', muscle_group: 'Pierna' },
    { name: 'assisted prone hamstring', exerciseId: '0016', muscle_group: 'Pierna' },
    { name: 'cable pull through (with rope)', exerciseId: '0196', muscle_group: 'Pierna' }
  ]},
  { id: '34d-d3-piernas-bw', title: 'Día 3 · Piernas', subtitle: 'Sentadilla, zancada y glúteo sin material', daysFilter: '3-4d', equipment: 'bodyweight', workoutName: 'Día 3 · Piernas', exercises: [
    { name: 'bench hip extension', exerciseId: '0130', muscle_group: 'Pierna' },
    { name: 'flutter kicks', exerciseId: '0459', muscle_group: 'Pierna' },
    { name: 'inverse leg curl (bench support)', exerciseId: '0496', muscle_group: 'Pierna' },
    { name: 'bodyweight squat', muscle_group: 'Pierna' },
    { name: 'forward lunge', muscle_group: 'Pierna' }
  ]},
  // ── 3-4 DÍAS: DÍA 4 (Hombros + Brazos) ─────────────────────────────────
  { id: '34d-d4-hombros-brazos-gym', title: 'Día 4 · Hombros + Brazos', subtitle: 'Press, elevaciones, curl y tríceps mixto', daysFilter: '3-4d', equipment: 'gym', workoutName: 'Día 4 · Hombros + Brazos', exercises: [
    { name: 'barbell seated overhead press', exerciseId: '0091', muscle_group: 'Hombro' },
    { name: 'dumbbell seated lateral raise', exerciseId: '0396', muscle_group: 'Hombro' },
    { name: 'cable cross-over reverse fly', exerciseId: '0154', muscle_group: 'Hombro' },
    { name: 'dumbbell hammer curl', exerciseId: '0313', muscle_group: 'Biceps' },
    { name: 'cable alternate triceps extension', exerciseId: '0149', muscle_group: 'Triceps' }
  ]},
  { id: '34d-d4-hombros-brazos-bw', title: 'Día 4 · Hombros + Brazos', subtitle: 'Press vertical, curl y fondos sin material', daysFilter: '3-4d', equipment: 'bodyweight', workoutName: 'Día 4 · Hombros + Brazos', exercises: [
    { name: 'kettlebell alternating press', exerciseId: '0520', muscle_group: 'Hombro' },
    { name: 'handstand push-up', exerciseId: '0471', muscle_group: 'Hombro' },
    { name: 'biceps pull-up', exerciseId: '0140', muscle_group: 'Biceps' },
    { name: 'diamond push-up', exerciseId: '0283', muscle_group: 'Triceps' },
    { name: 'bench dip (knees bent)', exerciseId: '0129', muscle_group: 'Triceps' }
  ]},
  // ── 5 DÍAS: DÍA 1 (Pecho) ───────────────────────────────────────────────
  { id: '5d-d1-pecho-gym', title: 'Día 1 · Pecho', subtitle: 'Volumen completo con barra, mancuerna y polea', daysFilter: '5d', equipment: 'gym', workoutName: 'Día 1 · Pecho', exercises: [
    { name: 'barbell bench press', exerciseId: '0025', muscle_group: 'Pecho' },
    { name: 'dumbbell incline hammer press', exerciseId: '0321', muscle_group: 'Pecho' },
    { name: 'cable cross-over variation', exerciseId: '0155', muscle_group: 'Pecho' },
    { name: 'dumbbell fly', exerciseId: '0308', muscle_group: 'Pecho' },
    { name: 'assisted chest dip (kneeling)', exerciseId: '0009', muscle_group: 'Pecho' }
  ]},
  { id: '5d-d1-pecho-bw', title: 'Día 1 · Pecho', subtitle: 'Flexiones y fondos en todos los ángulos', daysFilter: '5d', equipment: 'bodyweight', workoutName: 'Día 1 · Pecho', exercises: [
    { name: 'chest dip', exerciseId: '0251', muscle_group: 'Pecho' },
    { name: 'clock push-up', exerciseId: '0258', muscle_group: 'Pecho' },
    { name: 'incline push-up', exerciseId: '0493', muscle_group: 'Pecho' },
    { name: 'decline push-up', exerciseId: '0279', muscle_group: 'Pecho' },
    { name: 'incline reverse grip push-up', exerciseId: '0494', muscle_group: 'Pecho' }
  ]},
  // ── 5 DÍAS: DÍA 2 (Espalda) ─────────────────────────────────────────────
  { id: '5d-d2-espalda-gym', title: 'Día 2 · Espalda', subtitle: 'Remos, jalones y polea mixto', daysFilter: '5d', equipment: 'gym', workoutName: 'Día 2 · Espalda', exercises: [
    { name: 'barbell bent over row', exerciseId: '0027', muscle_group: 'Espalda' },
    { name: 'dumbbell one arm bent-over row', exerciseId: '0292', muscle_group: 'Espalda' },
    { name: 'alternate lateral pulldown', exerciseId: '0007', muscle_group: 'Espalda' },
    { name: 'cable cross-over lateral pulldown', exerciseId: '0153', muscle_group: 'Espalda' },
    { name: 'barbell pullover', exerciseId: '0073', muscle_group: 'Espalda' }
  ]},
  { id: '5d-d2-espalda-bw', title: 'Día 2 · Espalda', subtitle: 'Dominadas, remo invertido e hiperextensiones', daysFilter: '5d', equipment: 'bodyweight', workoutName: 'Día 2 · Espalda', exercises: [
    { name: 'chin-ups (narrow parallel grip)', exerciseId: '0253', muscle_group: 'Espalda' },
    { name: 'biceps pull-up', exerciseId: '0140', muscle_group: 'Espalda' },
    { name: 'hyperextension (on bench)', exerciseId: '0488', muscle_group: 'Espalda' },
    { name: 'inverted row v. 2', exerciseId: '0497', muscle_group: 'Espalda' },
    { name: 'inverted row with straps', exerciseId: '0498', muscle_group: 'Espalda' }
  ]},
  // ── 5 DÍAS: DÍA 3 (Piernas) ─────────────────────────────────────────────
  { id: '5d-d3-piernas-gym', title: 'Día 3 · Piernas', subtitle: 'Sentadilla, peso muerto y femoral mixto', daysFilter: '5d', equipment: 'gym', workoutName: 'Día 3 · Piernas', exercises: [
    { name: 'barbell full squat', exerciseId: '0043', muscle_group: 'Pierna' },
    { name: 'barbell romanian deadlift', exerciseId: '0085', muscle_group: 'Pierna' },
    { name: 'dumbbell single leg split squat', exerciseId: '0410', muscle_group: 'Pierna' },
    { name: 'assisted prone hamstring', exerciseId: '0016', muscle_group: 'Pierna' },
    { name: 'cable pull through (with rope)', exerciseId: '0196', muscle_group: 'Pierna' }
  ]},
  { id: '5d-d3-piernas-bw', title: 'Día 3 · Piernas', subtitle: 'Sentadilla, zancada y glúteo sin material', daysFilter: '5d', equipment: 'bodyweight', workoutName: 'Día 3 · Piernas', exercises: [
    { name: 'bench hip extension', exerciseId: '0130', muscle_group: 'Pierna' },
    { name: 'flutter kicks', exerciseId: '0459', muscle_group: 'Pierna' },
    { name: 'inverse leg curl (bench support)', exerciseId: '0496', muscle_group: 'Pierna' },
    { name: 'bodyweight squat', muscle_group: 'Pierna' },
    { name: 'forward lunge', muscle_group: 'Pierna' }
  ]},
  // ── 5 DÍAS: DÍA 4 (Hombros) ─────────────────────────────────────────────
  { id: '5d-d4-hombros-gym', title: 'Día 4 · Hombros', subtitle: 'Press militar, elevaciones y vuelos mixto', daysFilter: '5d', equipment: 'gym', workoutName: 'Día 4 · Hombros', exercises: [
    { name: 'barbell seated overhead press', exerciseId: '0091', muscle_group: 'Hombro' },
    { name: 'dumbbell seated lateral raise', exerciseId: '0396', muscle_group: 'Hombro' },
    { name: 'cable forward raise', exerciseId: '0161', muscle_group: 'Hombro' },
    { name: 'barbell rear delt raise', exerciseId: '0075', muscle_group: 'Hombro' },
    { name: 'dumbbell rear lateral raise', exerciseId: '0380', muscle_group: 'Hombro' }
  ]},
  { id: '5d-d4-hombros-bw', title: 'Día 4 · Hombros', subtitle: 'Press vertical y deltoides sin material', daysFilter: '5d', equipment: 'bodyweight', workoutName: 'Día 4 · Hombros', exercises: [
    { name: 'kettlebell alternating press', exerciseId: '0520', muscle_group: 'Hombro' },
    { name: 'kettlebell arnold press', exerciseId: '0523', muscle_group: 'Hombro' },
    { name: 'kettlebell press', exerciseId: '0527', muscle_group: 'Hombro' },
    { name: 'kettlebell one arm press', exerciseId: '0528', muscle_group: 'Hombro' },
    { name: 'handstand push-up', exerciseId: '0471', muscle_group: 'Hombro' }
  ]},
  // ── 5 DÍAS: DÍA 5 (Brazos + Core) ───────────────────────────────────────
  { id: '5d-d5-brazos-gym', title: 'Día 5 · Brazos + Core', subtitle: 'Curl y tríceps en barra, mancuerna y polea', daysFilter: '5d', equipment: 'gym', workoutName: 'Día 5 · Brazos + Core', exercises: [
    { name: 'barbell curl', exerciseId: '0031', muscle_group: 'Biceps' },
    { name: 'dumbbell hammer curl', exerciseId: '0313', muscle_group: 'Biceps' },
    { name: 'cable hammer curl (with rope)', exerciseId: '0165', muscle_group: 'Biceps' },
    { name: 'barbell lying triceps extension skull crusher', exerciseId: '0060', muscle_group: 'Triceps' },
    { name: 'cable alternate triceps extension', exerciseId: '0149', muscle_group: 'Triceps' }
  ]},
  { id: '5d-d5-brazos-bw', title: 'Día 5 · Brazos + Core', subtitle: 'Dominadas, fondos y core sin material', daysFilter: '5d', equipment: 'bodyweight', workoutName: 'Día 5 · Brazos + Core', exercises: [
    { name: 'biceps pull-up', exerciseId: '0140', muscle_group: 'Biceps' },
    { name: 'bench dip (knees bent)', exerciseId: '0129', muscle_group: 'Triceps' },
    { name: 'diamond push-up', exerciseId: '0283', muscle_group: 'Triceps' },
    { name: 'body-up', exerciseId: '0137', muscle_group: 'Core' },
    { name: 'close-grip push-up', exerciseId: '0259', muscle_group: 'Triceps' }
  ]}
];
