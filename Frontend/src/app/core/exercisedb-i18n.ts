/** Traducciones UI para valores en ingles devueltos por ExerciseDB (v1). */
import { EXERCISE_NAME_ES_MANUAL } from './exercisedb-name-manual-es';
import { EXERCISE_NAME_ES } from './exercisedb-name-translations';

const BODY_PART_ES: Record<string, string> = {
  back: 'Espalda',
  cardio: 'Cardio',
  chest: 'Pecho',
  'lower arms': 'Antebrazos',
  'lower legs': 'Pierna inferior',
  neck: 'Cuello',
  shoulders: 'Hombros',
  'upper arms': 'Brazos superiores',
  'upper legs': 'Pierna superior',
  waist: 'Cintura / core'
};

const TARGET_ES: Record<string, string> = {
  abductors: 'Abductores',
  abs: 'Abdominales',
  adductors: 'Aductores',
  biceps: 'Bíceps',
  calves: 'Gemelos',
  'cardiovascular system': 'Sistema cardiovascular',
  delts: 'Deltoides',
  forearms: 'Antebrazos',
  glutes: 'Glúteos',
  hamstrings: 'Isquiotibiales',
  lats: 'Dorsales',
  'levator scapulae': 'Elevador de la escápula',
  pectorals: 'Pectorales',
  quads: 'Cuádriceps',
  'serratus anterior': 'Serrato anterior',
  spine: 'Columna',
  traps: 'Trapecio',
  triceps: 'Tríceps',
  'upper back': 'Espalda alta'
};

const EQUIPMENT_ES: Record<string, string> = {
  'body weight': 'Peso corporal',
  cable: 'Polea / cable',
  'leverage machine': 'Máquina de palanca',
  assisted: 'Asistido',
  barbell: 'Barra',
  dumbbell: 'Mancuernas',
  kettlebell: 'Kettlebell',
  'smith machine': 'Multipower',
  band: 'Banda elástica',
  'medicine ball': 'Balón medicinal',
  roller: 'Rueda abdominal',
  rope: 'Cuerda',
  'stability ball': 'Fitball',
  wheel: 'Rueda',
  weighted: 'Lastrado',
  other: 'Otro'
};

const DIFFICULTY_ES: Record<string, string> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado'
};

const CATEGORY_ES: Record<string, string> = {
  strength: 'Fuerza',
  stretching: 'Estiramiento',
  cardio: 'Cardio',
  'plyometrics': 'Pliometría',
  'strongman': 'Strongman',
  'powerlifting': 'Powerlifting',
  'olympic weightlifting': 'Halterofilia olímpica'
};

function normKey(s: string): string {
  return s.trim().toLowerCase();
}

export function translateBodyPart(value?: string | null): string {
  if (!value) return '';
  return BODY_PART_ES[normKey(value)] ?? capitalizeWords(value);
}

export function translateTarget(value?: string | null): string {
  if (!value) return '';
  return TARGET_ES[normKey(value)] ?? capitalizeWords(value);
}

export function translateEquipment(value?: string | null): string {
  if (!value) return '';
  return EQUIPMENT_ES[normKey(value)] ?? capitalizeWords(value);
}

export function translateDifficulty(value?: string | null): string {
  if (!value) return '';
  return DIFFICULTY_ES[normKey(value)] ?? capitalizeWords(value);
}

export function translateCategory(value?: string | null): string {
  if (!value) return '';
  return CATEGORY_ES[normKey(value)] ?? capitalizeWords(value);
}

const NAME_TOKEN_ES: Record<string, string> = {
  ab: 'abdominal',
  abs: 'abdominales',
  assisted: 'asistido',
  alternating: 'alterno',
  arnold: 'arnold',
  barbell: 'barra',
  bench: 'banco',
  bent: 'inclinado',
  body: 'cuerpo',
  cable: 'polea',
  chest: 'pecho',
  curl: 'curl',
  deadlift: 'peso muerto',
  decline: 'declinado',
  dip: 'fondo',
  dumbbell: 'mancuerna',
  extension: 'extension',
  fly: 'apertura',
  front: 'frontal',
  glute: 'gluteo',
  hammer: 'martillo',
  high: 'alto',
  incline: 'inclinado',
  kickback: 'patada',
  lateral: 'lateral',
  leg: 'pierna',
  machine: 'maquina',
  overhead: 'sobre cabeza',
  press: 'press',
  pulldown: 'jalon',
  pull: 'tiron',
  push: 'empuje',
  raise: 'elevacion',
  rear: 'posterior',
  reverse: 'inverso',
  row: 'remo',
  russian: 'ruso',
  seated: 'sentado',
  shoulder: 'hombro',
  shrug: 'encogimiento',
  sit: 'abdominal',
  squat: 'sentadilla',
  standing: 'de pie',
  triceps: 'triceps',
  twist: 'giro',
  up: 'arriba',
  weight: 'peso'
};

/**
 * Traduccion heuristica de nombres de ejercicio (EN -> ES).
 * Mantiene legibilidad para hispanohablantes y cae con gracia si faltan tokens.
 */
export function translateExerciseName(value?: string | null): string {
  if (!value) return '';
  const src = value.trim();
  if (!src) return '';
  const manualExact = EXERCISE_NAME_ES_MANUAL[src];
  if (manualExact) return manualExact;
  const manualNormalized = EXERCISE_NAME_ES_MANUAL_BY_NORM[normKey(src)];
  if (manualNormalized) return manualNormalized;
  const exact = EXERCISE_NAME_ES[src];
  if (exact) return exact;
  const normalizedLookup = EXERCISE_NAME_ES_BY_NORM[normKey(src)];
  if (normalizedLookup) return normalizedLookup;
  const normalized = src
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/[/_,-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = normalized.split(' ');
  const translated = words.map((w) => NAME_TOKEN_ES[w] ?? w).join(' ');
  return capitalizeWords(translated);
}

const EXERCISE_NAME_ES_BY_NORM: Record<string, string> = Object.fromEntries(
  Object.entries(EXERCISE_NAME_ES).map(([en, es]) => [normKey(en), es])
);

const EXERCISE_NAME_ES_MANUAL_BY_NORM: Record<string, string> = Object.fromEntries(
  Object.entries(EXERCISE_NAME_ES_MANUAL).map(([en, es]) => [normKey(en), es])
);

function capitalizeWords(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}
