type ExerciseMedia = { image: string; imageAlt?: string };

const BY_GROUP: Record<string, ExerciseMedia> = {
  pecho: { image: '/exercises/chest.png', imageAlt: '/exercises/chest-alt.png' },
  espalda: { image: '/exercises/back.png', imageAlt: '/exercises/back-alt.png' },
  pierna: { image: '/exercises/legs.png', imageAlt: '/exercises/legs-alt.png' },
  biceps: { image: '/exercises/biceps.png' },
  triceps: { image: '/exercises/triceps.png' },
  hombro: { image: '/exercises/shoulders.png' },
  core: { image: '/exercises/core.png' },
  cardio: { image: '/exercises/cardio.png' }
};

const BY_ICON_KEY: Record<string, ExerciseMedia> = {
  'bench-press': { image: '/exercises/chest.png', imageAlt: '/exercises/chest-alt.png' },
  'incline-dumbbell-press': { image: '/exercises/chest-alt.png', imageAlt: '/exercises/chest.png' },
  'machine-fly': { image: '/exercises/chest-alt.png', imageAlt: '/exercises/chest.png' },
  'pull-up': { image: '/exercises/back.png', imageAlt: '/exercises/back-alt.png' },
  'barbell-row': { image: '/exercises/back-alt.png', imageAlt: '/exercises/back.png' },
  'back-squat': { image: '/exercises/legs.png', imageAlt: '/exercises/legs-alt.png' },
  'romanian-deadlift': { image: '/exercises/legs-alt.png', imageAlt: '/exercises/legs.png' },
  legs: { image: '/exercises/legs.png', imageAlt: '/exercises/legs-alt.png' },
  'barbell-curl': { image: '/exercises/biceps.png' },
  'triceps-pushdown': { image: '/exercises/triceps.png' },
  'overhead-press': { image: '/exercises/shoulders.png' },
  core: { image: '/exercises/core.png' },
  cardio: { image: '/exercises/cardio.png' }
};

const BY_EXACT_NAME: Record<string, ExerciseMedia> = {
  // Pecho
  'press banca': { image: '/exercises/chest.png', imageAlt: '/exercises/chest-alt.png' },
  'press inclinado mancuernas': { image: '/exercises/chest-alt.png', imageAlt: '/exercises/chest.png' },
  'press declinado barra': { image: '/exercises/chest.png', imageAlt: '/exercises/chest-alt.png' },
  'press declinado mancuernas': { image: '/exercises/chest-alt.png', imageAlt: '/exercises/chest.png' },
  'aperturas en maquina': { image: '/exercises/chest-alt.png', imageAlt: '/exercises/chest.png' },
  'aperturas con mancuernas': { image: '/exercises/chest-alt.png', imageAlt: '/exercises/chest.png' },
  'cruces en polea alta': { image: '/exercises/chest-alt.png', imageAlt: '/exercises/chest.png' },
  'cruces en polea baja': { image: '/exercises/chest-alt.png', imageAlt: '/exercises/chest.png' },
  'fondos en paralelas': { image: '/exercises/chest.png', imageAlt: '/exercises/chest-alt.png' },
  'press en maquina convergente': { image: '/exercises/chest.png', imageAlt: '/exercises/chest-alt.png' },
  'pullover mancuerna': { image: '/exercises/chest-alt.png', imageAlt: '/exercises/chest.png' },
  // Espalda
  dominadas: { image: '/exercises/back.png', imageAlt: '/exercises/back-alt.png' },
  'dominadas supinas': { image: '/exercises/back.png', imageAlt: '/exercises/back-alt.png' },
  'dominadas neutras': { image: '/exercises/back.png', imageAlt: '/exercises/back-alt.png' },
  'remo con barra': { image: '/exercises/back-alt.png', imageAlt: '/exercises/back.png' },
  'remo pendlay': { image: '/exercises/back-alt.png', imageAlt: '/exercises/back.png' },
  'remo con mancuerna a una mano': { image: '/exercises/back-alt.png', imageAlt: '/exercises/back.png' },
  'jalon al pecho': { image: '/exercises/back.png', imageAlt: '/exercises/back-alt.png' },
  'jalon agarre estrecho': { image: '/exercises/back.png', imageAlt: '/exercises/back-alt.png' },
  'jalon tras nuca': { image: '/exercises/back.png', imageAlt: '/exercises/back-alt.png' },
  'remo en polea baja': { image: '/exercises/back-alt.png', imageAlt: '/exercises/back.png' },
  'remo en maquina pecho apoyado': { image: '/exercises/back-alt.png', imageAlt: '/exercises/back.png' },
  'remo t-bar': { image: '/exercises/back-alt.png', imageAlt: '/exercises/back.png' },
  'pullover en polea': { image: '/exercises/back-alt.png', imageAlt: '/exercises/back.png' },
  'face pull': { image: '/exercises/back.png', imageAlt: '/exercises/back-alt.png' },
  // Pierna
  'sentadilla trasera': { image: '/exercises/legs.png', imageAlt: '/exercises/legs-alt.png' },
  'sentadilla frontal': { image: '/exercises/legs.png', imageAlt: '/exercises/legs-alt.png' },
  'sentadilla goblet': { image: '/exercises/legs.png', imageAlt: '/exercises/legs-alt.png' },
  'peso muerto rumano': { image: '/exercises/legs-alt.png', imageAlt: '/exercises/legs.png' },
  'peso muerto convencional': { image: '/exercises/legs-alt.png', imageAlt: '/exercises/legs.png' },
  'peso muerto sumo': { image: '/exercises/legs-alt.png', imageAlt: '/exercises/legs.png' },
  'prensa 45': { image: '/exercises/legs.png', imageAlt: '/exercises/legs-alt.png' },
  'prensa horizontal': { image: '/exercises/legs.png', imageAlt: '/exercises/legs-alt.png' },
  'sentadilla hack': { image: '/exercises/legs.png', imageAlt: '/exercises/legs-alt.png' },
  zancadas: { image: '/exercises/legs-alt.png', imageAlt: '/exercises/legs.png' },
  'zancadas caminando': { image: '/exercises/legs-alt.png', imageAlt: '/exercises/legs.png' },
  'bulgarian split squat': { image: '/exercises/legs-alt.png', imageAlt: '/exercises/legs.png' },
  'hip thrust': { image: '/exercises/legs-alt.png', imageAlt: '/exercises/legs.png' },
  'hip thrust unilateral': { image: '/exercises/legs-alt.png', imageAlt: '/exercises/legs.png' },
  'puente de gluteo': { image: '/exercises/legs-alt.png', imageAlt: '/exercises/legs.png' },
  'extension de cuadriceps': { image: '/exercises/legs.png', imageAlt: '/exercises/legs-alt.png' },
  'sissy squat asistida': { image: '/exercises/legs.png', imageAlt: '/exercises/legs-alt.png' },
  'curl femoral tumbado': { image: '/exercises/legs-alt.png', imageAlt: '/exercises/legs.png' },
  'curl femoral sentado': { image: '/exercises/legs-alt.png', imageAlt: '/exercises/legs.png' },
  'buenos dias': { image: '/exercises/legs-alt.png', imageAlt: '/exercises/legs.png' },
  'step up con mancuerna': { image: '/exercises/legs.png', imageAlt: '/exercises/legs-alt.png' },
  'elevacion de gemelos': { image: '/exercises/legs.png', imageAlt: '/exercises/legs-alt.png' },
  'gemelo sentado': { image: '/exercises/legs.png', imageAlt: '/exercises/legs-alt.png' },
  // Brazos y hombro
  'curl biceps barra': { image: '/exercises/biceps.png' },
  'curl biceps barra z': { image: '/exercises/biceps.png' },
  'curl inclinado mancuernas': { image: '/exercises/biceps.png' },
  'curl martillo': { image: '/exercises/biceps.png' },
  'curl martillo cruzado': { image: '/exercises/biceps.png' },
  'curl concentrado': { image: '/exercises/biceps.png' },
  'curl en polea baja': { image: '/exercises/biceps.png' },
  'curl en banco predicador': { image: '/exercises/biceps.png' },
  'extension triceps polea': { image: '/exercises/triceps.png' },
  'extension triceps cuerda': { image: '/exercises/triceps.png' },
  'extension triceps barra v': { image: '/exercises/triceps.png' },
  'press frances': { image: '/exercises/triceps.png' },
  'extensiones sobre la cabeza': { image: '/exercises/triceps.png' },
  'patada de triceps': { image: '/exercises/triceps.png' },
  'press cerrado en banca': { image: '/exercises/triceps.png' },
  'fondos triceps': { image: '/exercises/triceps.png' },
  'press militar': { image: '/exercises/shoulders.png' },
  'press arnold': { image: '/exercises/shoulders.png' },
  'press militar sentado mancuernas': { image: '/exercises/shoulders.png' },
  'elevaciones laterales': { image: '/exercises/shoulders.png' },
  'elevaciones laterales en polea': { image: '/exercises/shoulders.png' },
  'elevaciones frontales': { image: '/exercises/shoulders.png' },
  'remo al menton': { image: '/exercises/shoulders.png' },
  pajaros: { image: '/exercises/shoulders.png' },
  'pajaros en peck deck': { image: '/exercises/shoulders.png' },
  // Core y cardio
  plancha: { image: '/exercises/core.png' },
  'plancha lateral': { image: '/exercises/core.png' },
  'plancha con peso': { image: '/exercises/core.png' },
  'crunch en polea': { image: '/exercises/core.png' },
  'crunch en maquina': { image: '/exercises/core.png' },
  'crunch invertido': { image: '/exercises/core.png' },
  'elevacion de piernas colgado': { image: '/exercises/core.png' },
  'toques al talon': { image: '/exercises/core.png' },
  'dead bug': { image: '/exercises/core.png' },
  'pallof press': { image: '/exercises/core.png' },
  'rueda abdominal': { image: '/exercises/core.png' },
  'cinta inclinada': { image: '/exercises/cardio.png' },
  'cinta carrera continua': { image: '/exercises/cardio.png' },
  'cinta hiit': { image: '/exercises/cardio.png' },
  'remo ergometro': { image: '/exercises/cardio.png' },
  'remo intervalos': { image: '/exercises/cardio.png' },
  'bicicleta estatica': { image: '/exercises/cardio.png' },
  'bicicleta spinning': { image: '/exercises/cardio.png' },
  eliptica: { image: '/exercises/cardio.png' },
  escaladora: { image: '/exercises/cardio.png' },
  'assault bike': { image: '/exercises/cardio.png' },
  'saltar cuerda': { image: '/exercises/cardio.png' },
  burpees: { image: '/exercises/cardio.png' },
  'mountain climbers': { image: '/exercises/cardio.png' }
};

function normalizeName(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function resolveMedia(name?: string | null, iconKey?: string | null, muscleGroup?: string | null): ExerciseMedia {
  const byName = BY_EXACT_NAME[normalizeName(name)];
  if (byName) {
    return byName;
  }
  if (iconKey && BY_ICON_KEY[iconKey]) {
    return BY_ICON_KEY[iconKey];
  }
  const normalizedGroup = normalizeName(muscleGroup);
  if (BY_GROUP[normalizedGroup]) {
    return BY_GROUP[normalizedGroup];
  }
  return { image: '/exercises/default.png', imageAlt: '/exercises/default.png' };
}

export function resolveExerciseIcon(
  iconKey?: string | null,
  muscleGroup?: string | null,
  iconUrl?: string | null,
  name?: string | null
): string {
  // Si el catalogo trae imagen propia, priorizarla siempre.
  if (iconUrl) {
    return iconUrl;
  }
  return resolveMedia(name, iconKey, muscleGroup).image;
}

export function resolveExerciseImageByName(name?: string | null, fallbackMuscleGroup?: string | null): string {
  return resolveMedia(name, undefined, fallbackMuscleGroup).image;
}

export function resolveExerciseAltImageByName(name?: string | null, fallbackMuscleGroup?: string | null): string {
  const media = resolveMedia(name, undefined, fallbackMuscleGroup);
  return media.imageAlt || media.image;
}
