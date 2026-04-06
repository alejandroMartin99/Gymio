/**
 * Mapeo de etiquetas de rutina (espanol / ingles) a consultas ExerciseDB:
 * bodyPart (/exercises/bodyPart/...) o target (/exercises/target/...).
 */
export type ExerciseDbQuery =
  | { kind: 'body_part'; value: string }
  | { kind: 'target'; value: string };

const BODY_PARTS_API = new Set([
  'back',
  'cardio',
  'chest',
  'lower arms',
  'lower legs',
  'neck',
  'shoulders',
  'upper arms',
  'upper legs',
  'waist'
]);

const TARGETS_API = new Set([
  'abductors',
  'abs',
  'adductors',
  'biceps',
  'calves',
  'cardiovascular system',
  'delts',
  'forearms',
  'glutes',
  'hamstrings',
  'lats',
  'levator scapulae',
  'pectorals',
  'quads',
  'serratus anterior',
  'spine',
  'traps',
  'triceps',
  'upper back'
]);

/** Grupo muscular de la app -> llamadas API (se unen por id de ejercicio). */
const ROUTINE_TO_QUERIES: Record<string, ExerciseDbQuery[]> = {
  pecho: [
    { kind: 'body_part', value: 'chest' },
    { kind: 'target', value: 'pectorals' },
    { kind: 'target', value: 'serratus anterior' }
  ],
  espalda: [
    { kind: 'body_part', value: 'back' },
    { kind: 'target', value: 'lats' },
    { kind: 'target', value: 'upper back' },
    { kind: 'target', value: 'traps' },
    { kind: 'target', value: 'levator scapulae' }
  ],
  pierna: [
    { kind: 'body_part', value: 'upper legs' },
    { kind: 'body_part', value: 'lower legs' },
    { kind: 'target', value: 'quads' },
    { kind: 'target', value: 'hamstrings' },
    { kind: 'target', value: 'glutes' },
    { kind: 'target', value: 'calves' },
    { kind: 'target', value: 'abductors' },
    { kind: 'target', value: 'adductors' }
  ],
  piernas: [
    { kind: 'body_part', value: 'upper legs' },
    { kind: 'body_part', value: 'lower legs' },
    { kind: 'target', value: 'quads' },
    { kind: 'target', value: 'hamstrings' },
    { kind: 'target', value: 'glutes' },
    { kind: 'target', value: 'calves' }
  ],
  biceps: [{ kind: 'target', value: 'biceps' }],
  triceps: [{ kind: 'target', value: 'triceps' }],
  hombro: [
    { kind: 'body_part', value: 'shoulders' },
    { kind: 'target', value: 'delts' }
  ],
  hombros: [
    { kind: 'body_part', value: 'shoulders' },
    { kind: 'target', value: 'delts' }
  ],
  core: [
    { kind: 'body_part', value: 'waist' },
    { kind: 'target', value: 'abs' },
    { kind: 'target', value: 'spine' }
  ],
  abs: [
    { kind: 'body_part', value: 'waist' },
    { kind: 'target', value: 'abs' }
  ],
  abdominales: [
    { kind: 'body_part', value: 'waist' },
    { kind: 'target', value: 'abs' }
  ],
  cardio: [
    { kind: 'body_part', value: 'cardio' },
    { kind: 'target', value: 'cardiovascular system' }
  ],
  // Alias ingles frecuentes en routine_types
  chest: [{ kind: 'body_part', value: 'chest' }, { kind: 'target', value: 'pectorals' }],
  back: [
    { kind: 'body_part', value: 'back' },
    { kind: 'target', value: 'lats' },
    { kind: 'target', value: 'upper back' }
  ],
  legs: [
    { kind: 'body_part', value: 'upper legs' },
    { kind: 'body_part', value: 'lower legs' },
    { kind: 'target', value: 'quads' },
    { kind: 'target', value: 'hamstrings' }
  ],
  shoulders: [
    { kind: 'body_part', value: 'shoulders' },
    { kind: 'target', value: 'delts' }
  ],
  arms: [
    { kind: 'body_part', value: 'upper arms' },
    { kind: 'body_part', value: 'lower arms' },
    { kind: 'target', value: 'biceps' },
    { kind: 'target', value: 'triceps' },
    { kind: 'target', value: 'forearms' }
  ],
  brazos: [
    { kind: 'body_part', value: 'upper arms' },
    { kind: 'body_part', value: 'lower arms' }
  ],
  waist: [{ kind: 'body_part', value: 'waist' }, { kind: 'target', value: 'abs' }],
  neck: [{ kind: 'body_part', value: 'neck' }]
};

export function normalizeRoutineLabel(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Consultas API para una etiqueta de rutina ya normalizada. */
export function routineLabelToQueries(normalizedLabel: string): ExerciseDbQuery[] {
  const mapped = ROUTINE_TO_QUERIES[normalizedLabel];
  if (mapped) {
    return mapped;
  }
  if (BODY_PARTS_API.has(normalizedLabel)) {
    return [{ kind: 'body_part', value: normalizedLabel }];
  }
  const spaced = normalizedLabel.replace(/-/g, ' ');
  if (BODY_PARTS_API.has(spaced)) {
    return [{ kind: 'body_part', value: spaced }];
  }
  if (TARGETS_API.has(normalizedLabel)) {
    return [{ kind: 'target', value: normalizedLabel }];
  }
  if (TARGETS_API.has(spaced)) {
    return [{ kind: 'target', value: spaced }];
  }
  return [];
}

/** Une consultas de varias etiquetas (rutina combinada) sin duplicar mismo endpoint. */
export function mergeQueriesFromLabels(normalizedLabels: string[]): ExerciseDbQuery[] {
  const seen = new Set<string>();
  const out: ExerciseDbQuery[] = [];
  for (const label of normalizedLabels) {
    if (!label) {
      continue;
    }
    for (const q of routineLabelToQueries(label)) {
      const key = `${q.kind}:${q.value}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(q);
      }
    }
  }
  return out;
}
