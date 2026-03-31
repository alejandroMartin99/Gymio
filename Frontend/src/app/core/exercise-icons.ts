const ICON_BY_KEY: Record<string, string> = {
  'bench-press': '/exercises/chest.svg',
  'incline-dumbbell-press': '/exercises/chest.svg',
  'machine-fly': '/exercises/chest.svg',
  'pull-up': '/exercises/back.svg',
  'barbell-row': '/exercises/back.svg',
  'back-squat': '/exercises/legs.svg',
  'romanian-deadlift': '/exercises/legs.svg',
  legs: '/exercises/legs.svg',
  'barbell-curl': '/exercises/biceps.svg',
  'triceps-pushdown': '/exercises/triceps.svg',
  'overhead-press': '/exercises/shoulders.svg',
  core: '/exercises/core.svg',
  cardio: '/exercises/cardio.svg'
};

const ICON_BY_GROUP: Record<string, string> = {
  pecho: '/exercises/chest.svg',
  espalda: '/exercises/back.svg',
  pierna: '/exercises/legs.svg',
  biceps: '/exercises/biceps.svg',
  triceps: '/exercises/triceps.svg',
  hombro: '/exercises/shoulders.svg',
  core: '/exercises/core.svg',
  cardio: '/exercises/cardio.svg'
};

export function resolveExerciseIcon(iconKey?: string | null, muscleGroup?: string | null, iconUrl?: string | null): string {
  if (iconKey && ICON_BY_KEY[iconKey]) {
    return ICON_BY_KEY[iconKey];
  }
  const normalized = (muscleGroup || '').toLowerCase();
  if (ICON_BY_GROUP[normalized]) {
    return ICON_BY_GROUP[normalized];
  }
  if (iconUrl) {
    return iconUrl;
  }
  return '/exercises/default.svg';
}
