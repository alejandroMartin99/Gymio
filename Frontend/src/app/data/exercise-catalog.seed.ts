import { ExerciseCatalogItem } from '../models/exercise-catalog.model';

type SeedItem = Pick<ExerciseCatalogItem, 'name' | 'muscle_group' | 'icon_key'>;

const SEED: SeedItem[] = [
  { name: 'Press banca', muscle_group: 'Pecho', icon_key: 'bench-press' },
  { name: 'Press inclinado mancuernas', muscle_group: 'Pecho', icon_key: 'incline-dumbbell-press' },
  { name: 'Aperturas en maquina', muscle_group: 'Pecho', icon_key: 'machine-fly' },
  { name: 'Aperturas con mancuernas', muscle_group: 'Pecho', icon_key: 'machine-fly' },
  { name: 'Cruces en polea alta', muscle_group: 'Pecho', icon_key: 'machine-fly' },
  { name: 'Cruces en polea baja', muscle_group: 'Pecho', icon_key: 'machine-fly' },
  { name: 'Fondos en paralelas', muscle_group: 'Pecho', icon_key: 'bench-press' },
  { name: 'Press declinado barra', muscle_group: 'Pecho', icon_key: 'bench-press' },
  { name: 'Press declinado mancuernas', muscle_group: 'Pecho', icon_key: 'incline-dumbbell-press' },
  { name: 'Press en maquina convergente', muscle_group: 'Pecho', icon_key: 'bench-press' },
  { name: 'Pullover mancuerna', muscle_group: 'Pecho', icon_key: 'machine-fly' },
  { name: 'Dominadas', muscle_group: 'Espalda', icon_key: 'pull-up' },
  { name: 'Dominadas supinas', muscle_group: 'Espalda', icon_key: 'pull-up' },
  { name: 'Dominadas neutras', muscle_group: 'Espalda', icon_key: 'pull-up' },
  { name: 'Jalon al pecho', muscle_group: 'Espalda', icon_key: 'pull-up' },
  { name: 'Remo con barra', muscle_group: 'Espalda', icon_key: 'barbell-row' },
  { name: 'Remo en polea baja', muscle_group: 'Espalda', icon_key: 'barbell-row' },
  { name: 'Face pull', muscle_group: 'Espalda', icon_key: 'barbell-row' },
  { name: 'Sentadilla trasera', muscle_group: 'Pierna', icon_key: 'back-squat' },
  { name: 'Sentadilla frontal', muscle_group: 'Pierna', icon_key: 'back-squat' },
  { name: 'Prensa 45', muscle_group: 'Pierna', icon_key: 'legs' },
  { name: 'Peso muerto rumano', muscle_group: 'Pierna', icon_key: 'romanian-deadlift' },
  { name: 'Zancadas', muscle_group: 'Pierna', icon_key: 'legs' },
  { name: 'Hip thrust', muscle_group: 'Pierna', icon_key: 'romanian-deadlift' },
  { name: 'Curl biceps barra', muscle_group: 'Biceps', icon_key: 'barbell-curl' },
  { name: 'Curl martillo', muscle_group: 'Biceps', icon_key: 'barbell-curl' },
  { name: 'Curl concentrado', muscle_group: 'Biceps', icon_key: 'barbell-curl' },
  { name: 'Extension triceps polea', muscle_group: 'Triceps', icon_key: 'triceps-pushdown' },
  { name: 'Press frances', muscle_group: 'Triceps', icon_key: 'triceps-pushdown' },
  { name: 'Fondos triceps', muscle_group: 'Triceps', icon_key: 'triceps-pushdown' },
  { name: 'Press militar', muscle_group: 'Hombro', icon_key: 'overhead-press' },
  { name: 'Press arnold', muscle_group: 'Hombro', icon_key: 'overhead-press' },
  { name: 'Elevaciones laterales', muscle_group: 'Hombro', icon_key: 'overhead-press' },
  { name: 'Plancha', muscle_group: 'Core', icon_key: 'core' },
  { name: 'Crunch en polea', muscle_group: 'Core', icon_key: 'core' },
  { name: 'Rueda abdominal', muscle_group: 'Core', icon_key: 'core' },
  { name: 'Cinta inclinada', muscle_group: 'Cardio', icon_key: 'cardio' },
  { name: 'Remo ergometro', muscle_group: 'Cardio', icon_key: 'cardio' },
  { name: 'Bicicleta estatica', muscle_group: 'Cardio', icon_key: 'cardio' },
];

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const EXERCISE_CATALOG_SEED: ExerciseCatalogItem[] = SEED.map((item) => ({
  id: `${slugify(item.muscle_group)}-${slugify(item.name)}`,
  name: item.name,
  muscle_group: item.muscle_group,
  icon_key: item.icon_key,
  icon_url: null,
  instructions_url: null,
  is_custom: false,
}));
