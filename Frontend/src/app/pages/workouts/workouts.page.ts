import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  translateBodyPart,
  translateCategory,
  translateDifficulty,
  translateEquipment,
  translateExerciseName,
  translateTarget
} from '../../core/exercisedb-i18n';
import { resolveExerciseAltImageByName, resolveExerciseIcon, resolveExerciseImageByName } from '../../core/exercise-icons';
import { EXERCISEDB_LOCAL_MEDIA_IDS } from '../../core/exercisedb-local-media';
import { ExerciseCatalogItem } from '../../models/exercise-catalog.model';
import { isExerciseDbExercise } from '../../models/exercisedb.model';
import type { ExerciseDbExercise } from '../../models/exercisedb.model';
import { WorkoutExerciseRecord, WorkoutRecordDetail, ExerciseHistorySession } from '../../models/workout-record.model';
import { ActiveWorkoutService } from '../../services/active-workout.service';
import { WorkoutSessionDraftService, type WorkoutSessionDraftPayload } from '../../services/workout-session-draft.service';
import { ExerciseCatalogService } from '../../services/exercise-catalog.service';
import { ExerciseDbMediaService } from '../../services/exercise-db-media.service';
import { WorkoutRecordService } from '../../services/workout-record.service';
import { WorkoutStartOverlayComponent } from './workout-start-overlay/workout-start-overlay.component';
import { NumericPadSheetComponent } from './numeric-pad-sheet/numeric-pad-sheet.component';
import { RestTimerBarComponent } from './rest-timer-bar/rest-timer-bar.component';
import { NewSessionModalComponent } from './new-session-modal/new-session-modal.component';
import { ReplicateModalComponent } from './replicate-modal/replicate-modal.component';
import { WorkoutSummaryModalComponent } from './workout-summary-modal/workout-summary-modal.component';
import { HistoryModalComponent } from './history-modal/history-modal.component';
import { ExerciseInfoModalComponent } from './exercise-info-modal/exercise-info-modal.component';
import { RestTimeEditorModalComponent } from './rest-time-editor-modal/rest-time-editor-modal.component';
import { ExerciseCatalogModalComponent } from './exercise-catalog-modal/exercise-catalog-modal.component';

interface PendingSetDraft {
  local_id: string;
  set_type: string;
  done_reps?: number;
  weight?: number;
  comment?: string;
  assisted_reps?: number;
}

interface WorkoutTemplateExercise {
  name: string;
  exerciseId?: string;
  muscle_group?: string;
}

/** Gráficos de historial (mismo formato que perfil: dos SVG con grid). */
interface HistoryChartPt { x: number; y: number; v: number; }
interface HistoryGridLine { y: number; label: string; }
interface HistoryXLabel { x: number; label: string; i: number; }
interface HistoryChartData { path: string; dots: HistoryChartPt[]; grid: HistoryGridLine[]; xLabels: HistoryXLabel[]; }

interface WorkoutTemplate {
  id: string;
  title: string;
  subtitle: string;
  daysFilter: '2d' | '3-4d' | '5d';
  equipment: 'gym' | 'bodyweight';
  workoutName: string;
  exercises: WorkoutTemplateExercise[];
}

@Component({
  selector: 'app-workouts-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    WorkoutStartOverlayComponent,
    NumericPadSheetComponent,
    RestTimerBarComponent,
    NewSessionModalComponent,
    ReplicateModalComponent,
    WorkoutSummaryModalComponent,
    HistoryModalComponent,
    ExerciseInfoModalComponent,
    RestTimeEditorModalComponent,
    ExerciseCatalogModalComponent,
  ],
  templateUrl: './workouts.page.html',
  styleUrl: './workouts.page.scss'
})

export class WorkoutsPage implements OnInit, OnDestroy {
  constructor(
    readonly workoutRecordService: WorkoutRecordService,
    readonly exerciseCatalogService: ExerciseCatalogService,
    private readonly exerciseDbMedia: ExerciseDbMediaService,
    private readonly activeWorkout: ActiveWorkoutService,
    private readonly sessionDraft: WorkoutSessionDraftService
  ) {}

  workoutName = '';
  currentWorkout: WorkoutRecordDetail | null = null;
  showReplicateModal = false;
  showRoutineStartOverlay = false;
  selectedReplicateWorkoutId = '';
  replicateSelectionConfirmed = false;
  showNewSessionModal = false;
  showExerciseListModal = false;
  selectedMuscleGroup = '';
  selectedCatalogExerciseId = '';
  selectedExerciseId = '';
  completedExerciseIds = new Set<string>();
  catalogSearchQuery = '';
  debouncedCatalogSearchQuery = '';
  setInputs: Record<string, {
    reps?: number;
    weight?: number;
    comment?: string;
    setKind?: 'normal' | 'dropset';
    assistReps?: number;
    dropWeights?: string;
    dropReps?: string;
  }> =
    {};
  activeMuscleGroup = '';
  selectedEquipmentFilter: 'all' | 'dumbbell' | 'barbell' | 'machine' | 'free' = 'all';
  selectedCatalogThumbs = signal<string[]>([]);
  selectedTemplateDaysFilter: WorkoutTemplate['daysFilter'] = '2d';
  selectedTemplateEquipmentFilter: WorkoutTemplate['equipment'] = 'gym';
  readonly activeTemplateId = signal<string | null>(null);
  numericPadOpen = false;
  numericPadExerciseId = '';
  /** Si está editando una serie existente, su id; '' si es flujo de creación. */
  numericPadSetId = '';
  numericPadField: 'weight' | 'reps' | 'assistReps' = 'weight';
  numericPadValue = '';
  readonly numericPadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'];
  setSubmitStateByExercise: Record<string, 'idle' | 'saving' | 'confirmed'> = {};
  /** IDs de series que se acaban de confirmar en esta sesión (incluye id local optimista y luego id real). */
  confirmedSetIdsInSession = new Set<string>();
  restTimerOpen = false;
  restRemainingSec = 120;
  restTimerPaused = false;
  /** Duración seleccionada para el descanso actual (segundos). */
  private currentRestDurationSec = 120;
  /** Ejercicio que disparó el descanso actual (para asociarlo al editor). */
  private currentRestExerciseId: string | null = null;
  /** Default global por si el ejercicio no tiene rest_seconds configurado. */
  private readonly DEFAULT_REST_SECONDS = 120;
  private restTimerInterval: ReturnType<typeof setInterval> | null = null;
  /* Editor de tiempo de descanso por ejercicio. */
  restTimeEditorOpen = false;
  restTimeEditorExerciseId = '';
  restTimeEditorExerciseName = '';
  restTimeEditorValue = 120;
  readonly restTimePresets = [30, 45, 60, 75, 90, 120, 150, 180, 240];
  private isBootstrappingTemplate = false;
  private routineLoaderGifTimer: ReturnType<typeof setInterval> | null = null;
  private routineLoaderGifIndex = signal(0);
  readonly routineLoaderGifs = [
    '/icons/icons8-banca-pesas.gif',
    '/icons/icons8-deadlift.gif',
    '/icons/icons8-pullups.gif',
    '/icons/icons8-running.gif'
  ] as const;

  readonly muscleGroupSlides = [
    { key: 'pecho', label: 'Pecho', image: '/exercises/groups/pecho.png' },
    { key: 'espalda', label: 'Espalda', image: '/exercises/groups/espalda.png' },
    { key: 'pierna', label: 'Pierna', image: '/exercises/groups/pierna.png' },
    { key: 'biceps', label: 'Biceps', image: '/exercises/groups/biceps.png' },
    { key: 'triceps', label: 'Triceps', image: '/exercises/groups/triceps.png' },
    { key: 'hombro', label: 'Hombro', image: '/exercises/groups/hombro.png' },
    { key: 'core', label: 'Core', image: '/exercises/groups/core.png' },
    { key: 'cardio', label: 'Cardio', image: '/exercises/groups/cardio.png' }
  ];
  readonly equipmentFilters: Array<{ key: 'all' | 'dumbbell' | 'barbell' | 'machine' | 'free'; label: string }> = [
    { key: 'all', label: 'Todos' },
    { key: 'dumbbell', label: 'Mancuerna' },
    { key: 'barbell', label: 'Barra' },
    { key: 'machine', label: 'Maquina' },
    { key: 'free', label: 'Libre' }
  ];
  readonly templateDaysFilters: Array<{ key: WorkoutTemplate['daysFilter']; label: string }> = [
    { key: '2d', label: '2 días' },
    { key: '3-4d', label: '3-4 días' },
    { key: '5d', label: '5 días' },
  ];
  readonly templateEquipmentFilters: Array<{ key: WorkoutTemplate['equipment']; label: string }> = [
    { key: 'gym', label: 'Gym completo' },
    { key: 'bodyweight', label: 'Libre / sin material' },
  ];
  readonly workoutTemplates: WorkoutTemplate[] = [
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
  pendingSetsByExercise: Record<string, PendingSetDraft[]> = {};
  showWorkoutSummaryModal = false;
  summaryWorkoutName = '';
  summaryElapsedLabel = '00:00:00';
  summaryExercisesCount = 0;
  summarySetsCount = 0;
  showHistoryModal = false;
  showExerciseInfoModal = false;
  exerciseInfoName = '';
  exerciseInfoDetail: ExerciseDbExercise | null = null;
  historyExerciseName = '';
  /** Título del modal (nombre en español, como en la tarjeta del ejercicio). */
  historyExerciseTitle = '';
  historyPoints: Array<{ workout_id: string; date: string; max_weight: number; max_reps: number }> = [];
  historySessionsData: ExerciseHistorySession[] = [];
  /** Mismas constantes que perfil para los SVG de historial. */
  readonly HC = { cw: 300, ch: 90, pt: 12, pb: 18, pl: 32, pr: 6 };
  private _histW: HistoryChartData | null = null;
  private _histR: HistoryChartData | null = null;
  private _histCacheSig = '';
  /** GIF ExerciseDB (720) por id de fila workout_exercises */
  readonly workoutExerciseMediaUrls = signal<Record<string, string>>({});
  private isFinalizing = false;
  private autoOpenedPickerForWorkoutId = '';
  private catalogSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  /** Evita reaplicar el borrador de sessionStorage en cada `loadDetail` del mismo montaje. */
  private draftRestoredForWorkoutId: string | null = null;

  private readonly finalizeEffect = effect(() => {
    const tick = this.activeWorkout.finalizeRequestTick();
    if (!tick || !this.currentWorkout || this.activeWorkout.workoutId() !== this.currentWorkout.id) {
      return;
    }
    void this.finalizeCurrentWorkout();
  });

  private readonly sessionClosedEffect = effect(() => {
    const isActive = this.activeWorkout.isActive();
    if (!isActive) {
      this.draftRestoredForWorkoutId = null;
    }
    if (!isActive && this.currentWorkout) {
      this.currentWorkout = null;
      this.selectedExerciseId = '';
      this.workoutExerciseMediaUrls.set({});
      this.showExerciseListModal = false;
      this.selectedCatalogThumbs.set([]);
    }
  });

  private readonly resumePanelEffect = effect(() => {
    const tick = this.activeWorkout.resumeWorkoutPanelTick();
    if (!tick) {
      return;
    }
    const wid = this.activeWorkout.workoutId();
    if (!wid) {
      return;
    }
    queueMicrotask(() => {
      void this.loadDetail(wid).then(() => {
        const exercises = this.currentWorkout?.exercises ?? [];
        const first = exercises.find((e) => !this.completedExerciseIds.has(e.id));
        this.selectedExerciseId = first?.id ?? exercises[0]?.id ?? '';
      });
    });
  });

  async ngOnInit(): Promise<void> {
    await this.workoutRecordService.loadRecords({ minIntervalMs: 12_000 });
    const activeWorkoutId = this.activeWorkout.workoutId();
    if (activeWorkoutId) {
      await this.loadDetail(activeWorkoutId);
      if (!this.currentWorkout) {
        this.activeWorkout.finishWorkout();
      }
    }
  }

  isCreatingTemplate(): boolean {
    return this.activeTemplateId() !== null;
  }

  templateDaysLabel(v: WorkoutTemplate['daysFilter']): string {
    const map: Record<WorkoutTemplate['daysFilter'], string> = {
      '2d': '2 días', '3-4d': '3-4 días', '5d': '5 días'
    };
    return map[v];
  }

  templateEquipmentLabel(v: WorkoutTemplate['equipment']): string {
    const map: Record<WorkoutTemplate['equipment'], string> = {
      gym: 'Gym completo', bodyweight: 'Libre',
    };
    return map[v];
  }

  filteredTemplates(): WorkoutTemplate[] {
    return this.workoutTemplates.filter(
      (tpl) =>
        tpl.daysFilter === this.selectedTemplateDaysFilter &&
        tpl.equipment === this.selectedTemplateEquipmentFilter,
    );
  }

  templateGifUrl(gifId: string): string {
    return `/exercises/exercisedb/gifs/${gifId}.gif`;
  }

  async startWorkoutFromTemplate(template: WorkoutTemplate): Promise<void> {
    if (this.isCreatingTemplate()) {
      return;
    }
    this.activeTemplateId.set(template.id);
    this.isBootstrappingTemplate = true;
    try {
      const created = await this.workoutRecordService.createWorkout(template.workoutName, []);
      if (!created) {
        return;
      }
      this.showNewSessionModal = false;
      this.activeWorkout.startWorkout(created.id, created.workout_name);
      await this.loadDetail(created.id);
      for (const ex of template.exercises) {
        await this.workoutRecordService.addExercise(created.id, {
          name: ex.name,
          muscle_group: ex.muscle_group
        });
      }
      await this.loadDetail(created.id);
      this.showExerciseListModal = false;
    } finally {
      this.isBootstrappingTemplate = false;
      this.activeTemplateId.set(null);
    }
  }

  ngOnDestroy(): void {
    this.stopRestTimerInterval();
    this.stopRoutineLoaderGifCycle();
    if (this.catalogSearchDebounceTimer) {
      clearTimeout(this.catalogSearchDebounceTimer);
      this.catalogSearchDebounceTimer = null;
    }
    const activeId = this.activeWorkout.workoutId();
    const cid = this.currentWorkout?.id;
    if (activeId && cid && cid === activeId) {
      const payload: WorkoutSessionDraftPayload = {
        pendingSetsByExercise: JSON.parse(JSON.stringify(this.pendingSetsByExercise)),
        setInputs: JSON.parse(JSON.stringify(this.setInputs)),
        completedExerciseIds: [...this.completedExerciseIds],
        confirmedSetIds: [...this.confirmedSetIdsInSession],
        selectedExerciseId: this.selectedExerciseId
      };
      this.sessionDraft.save(activeId, payload);
    }
  }

  startWorkout(): void {
    if (!this.workoutName.trim()) {
      return;
    }
    void this.createWorkout();
  }

  openReplicateModal(): void {
    this.showReplicateModal = true;
    this.selectedReplicateWorkoutId = '';
    this.replicateSelectionConfirmed = false;
  }

  closeReplicateModal(): void {
    this.showReplicateModal = false;
    this.selectedReplicateWorkoutId = '';
    this.replicateSelectionConfirmed = false;
  }

  replicateModalRecords(): Array<{ id: string; workout_name: string }> {
    const byName = new Map<string, { id: string; workout_name: string }>();
    for (const record of this.workoutRecordService.records()) {
      const normalized = this.normalizeText(record.workout_name);
      if (!normalized || byName.has(normalized)) {
        continue;
      }
      byName.set(normalized, { id: record.id, workout_name: record.workout_name });
    }
    return Array.from(byName.values());
  }

  selectReplicateWorkout(workoutId: string): void {
    this.selectedReplicateWorkoutId = workoutId;
    this.replicateSelectionConfirmed = true;
  }

  async confirmReplicateWorkout(): Promise<void> {
    if (!this.showReplicateModal || !this.selectedReplicateWorkoutId || !this.replicateSelectionConfirmed) {
      return;
    }
    await this.replicateFrom(this.selectedReplicateWorkoutId);
    this.selectedReplicateWorkoutId = '';
    this.replicateSelectionConfirmed = false;
  }

  openNewSessionModal(): void {
    if (!this.workoutName) {
      this.workoutName = 'Nueva sesion';
    }
    this.showExerciseListModal = false;
    this.showNewSessionModal = true;
  }

  closeNewSessionModal(): void {
    this.showNewSessionModal = false;
    this.showExerciseListModal = false;
    this.selectedCatalogExerciseId = '';
    this.catalogSearchQuery = '';
    this.debouncedCatalogSearchQuery = '';
    this.selectedEquipmentFilter = 'all';
    this.activeMuscleGroup = '';
    this.selectedMuscleGroup = '';
    if (this.catalogSearchDebounceTimer) {
      clearTimeout(this.catalogSearchDebounceTimer);
      this.catalogSearchDebounceTimer = null;
    }
  }

  private async createWorkout(): Promise<void> {
    const created = await this.workoutRecordService.createWorkout(this.workoutName.trim(), []);
    if (!created) {
      return;
    }
    this.showNewSessionModal = false;
    this.activeWorkout.startWorkout(created.id, created.workout_name);
    await this.loadDetail(created.id);
    this.workoutName = '';
  }

  async replicateFrom(workoutId: string): Promise<void> {
    this.showRoutineStartOverlay = true;
    this.startRoutineLoaderGifCycle();
    try {
      const created = await this.workoutRecordService.replicateWorkoutFrom(workoutId);
      if (!created) {
        return;
      }
      this.showReplicateModal = false;
      this.replicateSelectionConfirmed = false;
      this.activeWorkout.startWorkout(created.id, created.workout_name);
      await this.loadDetail(created.id);
      await this.refreshWorkoutExerciseMedia();
      this.workoutName = '';
    } finally {
      this.showRoutineStartOverlay = false;
      this.stopRoutineLoaderGifCycle();
    }
  }

  currentRoutineLoaderGif(): string {
    const idx = this.routineLoaderGifIndex() % this.routineLoaderGifs.length;
    return this.routineLoaderGifs[idx];
  }

  private startRoutineLoaderGifCycle(): void {
    this.stopRoutineLoaderGifCycle();
    this.routineLoaderGifIndex.set(0);
    this.routineLoaderGifTimer = setInterval(() => {
      this.routineLoaderGifIndex.update((v) => (v + 1) % this.routineLoaderGifs.length);
    }, 1500);
  }

  private stopRoutineLoaderGifCycle(): void {
    if (!this.routineLoaderGifTimer) {
      return;
    }
    clearInterval(this.routineLoaderGifTimer);
    this.routineLoaderGifTimer = null;
  }

  openNumericPad(exerciseId: string, field: 'weight' | 'reps' | 'assistReps'): void {
    this.setInputs[exerciseId] = this.setInputs[exerciseId] || {};
    this.numericPadExerciseId = exerciseId;
    this.numericPadSetId = '';
    this.numericPadField = field;
    const current = this.setInputs[exerciseId]?.[field];
    this.numericPadValue = current != null ? String(current) : '';
    this.numericPadOpen = true;
  }

  /** Abre el pad para editar un campo concreto de una serie ya existente. */
  openSetCellPad(exerciseId: string, setId: string, field: 'weight' | 'reps' | 'assistReps'): void {
    const exercise = this.currentWorkout?.exercises.find((e) => e.id === exerciseId);
    const set = exercise?.sets.find((s) => s.id === setId);
    this.numericPadExerciseId = exerciseId;
    this.numericPadSetId = setId;
    this.numericPadField = field;
    let raw: number | null | undefined;
    if (set) {
      raw = field === 'weight' ? set.weight : field === 'reps' ? set.done_reps : set.assisted_reps;
    }
    this.numericPadValue = raw != null ? String(raw) : '';
    this.numericPadOpen = true;
  }

  hideNumericPad(): void {
    this.numericPadOpen = false;
    this.numericPadExerciseId = '';
    this.numericPadSetId = '';
    this.numericPadValue = '';
  }

  onNumericPadKey(key: string): void {
    if (key === '.' && this.numericPadField !== 'weight') {
      return;
    }
    if (key === '.' && this.numericPadValue.includes('.')) {
      return;
    }
    this.numericPadValue += key;
  }

  onNumericPadBackspace(): void {
    this.numericPadValue = this.numericPadValue.slice(0, -1);
  }

  async onNumericPadNext(): Promise<void> {
    // Modo edición de celda existente con encadenado KG → Reps → confirma.
    if (this.numericPadSetId) {
      const exId = this.numericPadExerciseId;
      const setId = this.numericPadSetId;
      const field = this.numericPadField;
      this.commitNumericPadValueToSet();
      if (field === 'weight') {
        // Pasamos a Reps de la misma serie (con prefill desde la propia serie o anterior).
        this.openSetCellPad(exId, setId, 'reps');
        return;
      }
      // Tras Reps (o cualquier otro), auto-confirmamos la serie y cerramos.
      this.hideNumericPad();
      await this.confirmSet(exId, setId);
      return;
    }
    // Modo legacy de creación encadenada (no usado con la UI nueva pero queda por seguridad).
    this.commitNumericPadValue();
    if (this.numericPadField === 'weight') {
      this.openNumericPad(this.numericPadExerciseId, 'reps');
      return;
    }
    if (this.numericPadField === 'reps') {
      this.openNumericPad(this.numericPadExerciseId, 'assistReps');
      return;
    }
    const exId = this.numericPadExerciseId;
    this.hideNumericPad();
    if (exId) {
      await this.addSet(exId);
    }
  }

  /** Actualiza el valor del numeric pad sobre el campo de una serie existente, solo en local.
   *  El guardado real al backend ocurre en confirmSet() cuando el usuario pulsa el tick. */
  private commitNumericPadValueToSet(): void {
    const exId = this.numericPadExerciseId;
    const setId = this.numericPadSetId;
    if (!exId || !setId || !this.currentWorkout) return;
    const exercise = this.currentWorkout.exercises.find((e) => e.id === exId);
    const set = exercise?.sets.find((s) => s.id === setId);
    if (!exercise || !set) return;

    const raw = this.numericPadValue.trim().replace(',', '.');
    const parsed = raw === '' ? null : Number(raw);
    if (parsed != null && Number.isNaN(parsed)) return;

    if (this.numericPadField === 'weight') set.weight = parsed;
    else if (this.numericPadField === 'reps') set.done_reps = parsed != null ? Math.round(parsed) : null;
    else if (this.numericPadField === 'assistReps') set.assisted_reps = parsed != null ? Math.round(parsed) : null;
  }

  /** Total de series del workout (incluye pendientes). */
  workoutProgressTotal(): number {
    const list = this.currentWorkout?.exercises ?? [];
    return list.reduce((sum, ex) => sum + (ex.sets?.length ?? 0), 0);
  }

  /** Series confirmadas en sesión que pertenecen al workout actual. */
  workoutProgressDone(): number {
    const list = this.currentWorkout?.exercises ?? [];
    let done = 0;
    for (const ex of list) {
      for (const s of ex.sets ?? []) {
        if (this.confirmedSetIdsInSession.has(s.id)) done += 1;
      }
    }
    return done;
  }

  /** Fracción 0..1 para el progress bar. */
  workoutProgressFraction(): number {
    const total = this.workoutProgressTotal();
    if (total === 0) return 0;
    return Math.max(0, Math.min(1, this.workoutProgressDone() / total));
  }

  /** Devuelve el snapshot de la serie anterior (idx) en formato "30kg×8" o "—" si no hay. */
  formatPreviousSetSnapshot(exercise: WorkoutExerciseRecord, idx: number): string {
    const prev = exercise.previous_sets ?? [];
    const target = prev[idx];
    if (!target) return '—';
    const w = target.weight;
    const r = target.done_reps;
    if (w == null || r == null) return '—';
    return `${w}kg × ${r}`;
  }

  /**
   * Inserta una nueva serie con valores prellenados (de la última serie del ejercicio,
   * o del máximo histórico si no hay todavía sets en este workout). El usuario puede
   * editar las celdas y luego confirmar con el tick.
   */
  async addEmptySet(exerciseId: string): Promise<void> {
    if (!this.currentWorkout) return;
    const exercise = this.currentWorkout.exercises.find((e) => e.id === exerciseId);
    if (!exercise) return;
    const lastSet = exercise.sets.length > 0 ? exercise.sets[exercise.sets.length - 1] : null;
    const fallbackWeight = Number(this.previousMaxWeight(exercise)) || 0;
    const fallbackReps = Number(this.previousMaxReps(exercise)) || 0;
    const weight = lastSet?.weight ?? (fallbackWeight > 0 ? fallbackWeight : null);
    const reps = lastSet?.done_reps ?? (fallbackReps > 0 ? fallbackReps : null);

    const serverSet = await this.workoutRecordService.addSet(this.currentWorkout.id, exerciseId, {
      set_type: 'normal',
      weight: weight ?? undefined,
      done_reps: reps ?? undefined,
    });
    if (serverSet) {
      exercise.sets = [...exercise.sets, serverSet];
      exercise.sets.sort((a, b) => a.position - b.position);
      exercise.notes = this.buildExerciseNotes(exercise);
    }
  }

  numericPadFieldLabel(): string {
    if (this.numericPadField === 'weight') return 'Peso (kg)';
    if (this.numericPadField === 'reps') return 'Reps';
    return 'Reps Ayuda';
  }

  numericPadNextLabel(): string {
    // En edición de celda de una serie: tras Reps, el botón confirma la serie.
    if (this.numericPadSetId) {
      return this.numericPadField === 'reps' ? 'Confirmar' : 'Next';
    }
    return this.numericPadField === 'assistReps' ? 'Confirmar' : 'Next';
  }

  setInputValueLabel(
    exerciseId: string,
    field: 'weight' | 'reps' | 'assistReps',
    placeholder: string
  ): string {
    const val = this.setInputs[exerciseId]?.[field];
    return val != null ? String(val) : placeholder;
  }

  private commitNumericPadValue(): void {
    const exId = this.numericPadExerciseId;
    if (!exId) return;
    this.setInputs[exId] = this.setInputs[exId] || {};
    const raw = this.numericPadValue.trim().replace(',', '.');
    if (!raw) {
      delete this.setInputs[exId][this.numericPadField];
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    this.setInputs[exId][this.numericPadField] = parsed;
  }

  private startRestTimer(exerciseId?: string): void {
    // Cancela cualquier timer activo: si registras una nueva serie antes de
    // que termine el descanso, reiniciamos limpio.
    this.stopRestTimerInterval();
    const exercise = this.currentWorkout?.exercises.find((e) => e.id === exerciseId) ?? null;
    const seconds = this.resolveRestSeconds(exercise);
    this.currentRestDurationSec = seconds;
    this.currentRestExerciseId = exerciseId ?? null;
    this.restRemainingSec = seconds;
    this.restTimerPaused = false;
    this.restTimerOpen = true;
    this.restTimerInterval = setInterval(() => {
      if (this.restTimerPaused) return;
      this.restRemainingSec = Math.max(0, this.restRemainingSec - 1);
      if (this.restRemainingSec === 0) {
        this.skipRestTimer();
      }
    }, 1000);
  }

  private resolveRestSeconds(exercise: WorkoutExerciseRecord | null): number {
    const explicit = exercise?.rest_seconds;
    if (typeof explicit === 'number' && explicit > 0) {
      return Math.min(3600, Math.floor(explicit));
    }
    return this.DEFAULT_REST_SECONDS;
  }

  toggleRestPause(): void {
    this.restTimerPaused = !this.restTimerPaused;
  }

  resetRestTimer(): void {
    this.restRemainingSec = this.currentRestDurationSec;
    this.restTimerPaused = false;
  }

  skipRestTimer(): void {
    this.restTimerOpen = false;
    this.stopRestTimerInterval();
    this.currentRestExerciseId = null;
  }

  restTimerLabel(): string {
    const m = Math.floor(this.restRemainingSec / 60).toString().padStart(2, '0');
    const s = (this.restRemainingSec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  /** Fracción 0..1 de progreso restante para el anillo del timer. */
  restTimerProgress(): number {
    if (this.currentRestDurationSec <= 0) return 0;
    const ratio = this.restRemainingSec / this.currentRestDurationSec;
    return Math.max(0, Math.min(1, ratio));
  }

  /** Nombre del ejercicio asociado al timer activo (para mostrarlo en la barra). */
  restTimeEditorRefName(): string {
    const id = this.currentRestExerciseId;
    if (!id || !this.currentWorkout) return '';
    const ex = this.currentWorkout.exercises.find((e) => e.id === id);
    return ex ? this.displayExercisePrimaryName(ex) : '';
  }

  private stopRestTimerInterval(): void {
    if (!this.restTimerInterval) return;
    clearInterval(this.restTimerInterval);
    this.restTimerInterval = null;
  }

  /* ── Editor de tiempo de descanso (por ejercicio) ─────────────────── */

  openRestTimeEditor(): void {
    const exId = this.currentRestExerciseId
      || this.selectedExerciseId
      || this.currentWorkout?.exercises[0]?.id
      || '';
    if (!exId) return;
    const exercise = this.currentWorkout?.exercises.find((e) => e.id === exId) ?? null;
    this.restTimeEditorExerciseId = exId;
    this.restTimeEditorExerciseName = exercise ? this.displayExercisePrimaryName(exercise) : '';
    this.restTimeEditorValue = this.resolveRestSeconds(exercise);
    this.restTimeEditorOpen = true;
  }

  closeRestTimeEditor(): void {
    this.restTimeEditorOpen = false;
    this.restTimeEditorExerciseId = '';
    this.restTimeEditorExerciseName = '';
  }

  setRestTimeEditorValue(value: number): void {
    this.restTimeEditorValue = value;
  }

  saveRestTimeFromEditor(value: number): void {
    this.restTimeEditorValue = value;
    void this.saveRestTimeEditor();
  }

  async saveRestTimeEditor(): Promise<void> {
    if (!this.currentWorkout) {
      this.closeRestTimeEditor();
      return;
    }
    const exId = this.restTimeEditorExerciseId;
    const value = Math.max(0, Math.min(3600, Math.floor(Number(this.restTimeEditorValue) || 0)));
    const exercise = this.currentWorkout.exercises.find((e) => e.id === exId);
    if (!exercise) {
      this.closeRestTimeEditor();
      return;
    }
    // Optimistic UI: actualiza el modelo local + el timer activo si es el mismo ejercicio.
    exercise.rest_seconds = value;
    if (this.currentRestExerciseId === exId && this.restTimerOpen) {
      this.currentRestDurationSec = value;
      // Si ya superó el nuevo valor, lo dejamos en 0 para skip; si no, ajustamos al máximo.
      if (this.restRemainingSec > value) {
        this.restRemainingSec = value;
      }
    }
    this.closeRestTimeEditor();
    // Persistimos en el backend.
    await this.workoutRecordService.updateExerciseRest(this.currentWorkout.id, exId, value);
  }

  /* ── Reordenar ejercicios (botones ↑↓) ────────────────────────────── */

  async moveExercise(fromIndex: number, toIndex: number): Promise<void> {
    if (!this.currentWorkout) return;
    const list = this.currentWorkout.exercises;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) return;
    if (fromIndex === toIndex) return;
    // Swap / move respetando el orden visual.
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    // Reasignamos position localmente para que coincida con lo que se persistirá.
    list.forEach((ex, idx) => (ex.position = idx + 1));
    const exerciseIds = list.map((ex) => ex.id);
    await this.workoutRecordService.reorderExercises(this.currentWorkout.id, exerciseIds);
  }

  /**
   * Confirma una serie: guarda weight + done_reps al backend y la marca como
   * "hecha en esta sesión" (sombreado verde + arranque del descanso).
   * Es el único punto donde se persiste al backend para series existentes;
   * commitNumericPadValueToSet() solo actualiza el estado local.
   */
  async confirmSet(exerciseId: string, setId: string): Promise<void> {
    if (!setId || !this.currentWorkout) return;
    if (this.confirmedSetIdsInSession.has(setId)) return;
    // Solo llamamos al backend para series reales (no pendientes locales).
    if (!setId.startsWith('local-')) {
      const exercise = this.currentWorkout.exercises.find((e) => e.id === exerciseId);
      const set = exercise?.sets.find((s) => s.id === setId);
      if (set) {
        await this.workoutRecordService.updateSet(
          this.currentWorkout.id,
          exerciseId,
          setId,
          { weight: set.weight ?? null, done_reps: set.done_reps ?? null }
        );
      }
    }
    this.confirmedSetIdsInSession.add(setId);
    this.startRestTimer(exerciseId);
  }

  /* ── "Subir peso" — peso igual + reps iguales o superiores ────────── */

  setRepeatsWeight(exercise: WorkoutExerciseRecord, idx: number): boolean {
    if (idx <= 0) return false;
    const current = exercise.sets[idx];
    const prev = exercise.sets[idx - 1];
    if (!current || !prev) return false;
    if (current.weight == null || prev.weight == null) return false;
    if (current.weight !== prev.weight) return false;
    if (current.done_reps == null || prev.done_reps == null) return false;
    // Reps iguales o superiores: el usuario sigue con el mismo peso pero ya iguala
    // o supera al de la serie previa, así que toca subir peso.
    return current.done_reps >= prev.done_reps;
  }

  /**
   * Marca "Sube peso" si:
   *  1. El usuario ya confirmó en esta sesión una serie que iguala (peso) y empata
   *     o mejora reps respecto a la anterior, o
   *  2. Las marcas previas (último entreno) ya muestran ese patrón → te avisa nada
   *     más cargar el ejercicio para que subas la carga directamente.
   */
  exerciseShouldRaiseWeight(exercise: WorkoutExerciseRecord): boolean {
    const sets = exercise.sets ?? [];
    for (let i = 1; i < sets.length; i += 1) {
      const current = sets[i];
      if (!this.confirmedSetIdsInSession.has(current.id)) continue;
      if (this.setRepeatsWeight(exercise, i)) return true;
    }
    const prev = exercise.previous_sets ?? [];
    for (let i = 1; i < prev.length; i += 1) {
      const a = prev[i - 1];
      const b = prev[i];
      if (!a || !b) continue;
      if (a.weight == null || b.weight == null || a.weight !== b.weight) continue;
      if (a.done_reps == null || b.done_reps == null) continue;
      if (b.done_reps >= a.done_reps) return true;
    }
    return false;
  }


  async addSet(exerciseId: string): Promise<void> {
    if (!this.currentWorkout) {
      return;
    }
    const workoutId = this.currentWorkout.id;
    this.setSubmitStateByExercise[exerciseId] = 'saving';
    const input = this.setInputs[exerciseId] || {};
    const exercise = this.currentWorkout.exercises.find((item) => item.id === exerciseId);
    if (!exercise) {
      this.setSubmitStateByExercise[exerciseId] = 'idle';
      return;
    }
    const weight = this.resolveSetNumberInput(input.weight, this.previousMaxWeight(exercise));
    const reps = this.resolveSetNumberInput(input.reps, this.previousMaxReps(exercise));
    if (weight == null || reps == null) {
      this.setSubmitStateByExercise[exerciseId] = 'idle';
      return;
    }
    const setKind = input.setKind || 'normal';
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const comment = this.buildSetComment(input.comment, setKind, input.dropWeights, input.dropReps);
    const payload: PendingSetDraft = {
      local_id: localId,
      set_type: setKind,
      done_reps: reps,
      weight,
      comment,
      assisted_reps: input.assistReps
    };
    this.pendingSetsByExercise[exerciseId] = [...(this.pendingSetsByExercise[exerciseId] || []), payload];

    exercise.sets = [
      ...exercise.sets,
      {
        id: localId,
        set_type: setKind,
        done_reps: reps,
        weight,
        comment,
        assisted_reps: input.assistReps,
        unit: 'kg',
        position: exercise.sets.length + 1
      }
    ];
    exercise.notes = this.buildExerciseNotes(exercise);
    this.setInputs[exerciseId] = { setKind: 'normal' };

    // Marcamos esta serie como "confirmada en sesión" para que reciba el sombreado verde
    // (y eventualmente el accent amber si repite). Las series cargadas por defecto no lo reciben.
    this.confirmedSetIdsInSession.add(localId);

    // Lanza el timer YA — sin esperar la respuesta del backend.
    // Si el descanso está corriendo de una serie anterior, se reinicia limpio.
    this.startRestTimer(exerciseId);

    const serverSet = await this.workoutRecordService.addSet(workoutId, exerciseId, {
      set_type: payload.set_type,
      done_reps: payload.done_reps,
      weight: payload.weight,
      comment: payload.comment,
      assisted_reps: payload.assisted_reps
    });
    if (!serverSet) {
      this.setSubmitStateByExercise[exerciseId] = 'idle';
      if (exercise) {
        exercise.sets = exercise.sets.filter((s) => s.id !== localId);
        exercise.notes = this.buildExerciseNotes(exercise);
      }
      this.pendingSetsByExercise[exerciseId] = (this.pendingSetsByExercise[exerciseId] || []).filter(
        (s) => s.local_id !== localId
      );
      this.confirmedSetIdsInSession.delete(localId);
      return;
    }
    this.pendingSetsByExercise[exerciseId] = (this.pendingSetsByExercise[exerciseId] || []).filter(
      (set) => set.local_id !== localId
    );
    // Promovemos el id en el Set ANTES de mutar exercise.sets para evitar flicker.
    this.confirmedSetIdsInSession.add(serverSet.id);
    this.confirmedSetIdsInSession.delete(localId);
    if (exercise) {
      exercise.sets = exercise.sets.map((s) => (s.id === localId ? serverSet : s));
      exercise.sets.sort((a, b) => a.position - b.position);
      exercise.notes = this.buildExerciseNotes(exercise);
    }
    this.setSubmitStateByExercise[exerciseId] = 'confirmed';
    setTimeout(() => {
      if (this.setSubmitStateByExercise[exerciseId] === 'confirmed') {
        this.setSubmitStateByExercise[exerciseId] = 'idle';
      }
    }, 900);
    // El timer ya se lanzó al inicio de addSet (UI optimista). No relanzar aquí.
  }

  private resolveSetNumberInput(rawValue: number | undefined, fallbackLabel: string): number | null {
    if (rawValue != null && !Number.isNaN(rawValue)) {
      return rawValue;
    }
    const fallback = Number(String(fallbackLabel || '').trim().replace(',', '.'));
    if (Number.isNaN(fallback) || fallback <= 0) {
      return null;
    }
    return fallback;
  }

  private async loadDetail(workoutId: string): Promise<void> {
    const detail = await this.workoutRecordService.getWorkoutDetail(workoutId, { silent: true });
    if (!detail) {
      return;
    }
    const exerciseIds = new Set(detail.exercises.map((e) => e.id));

    // Series cargadas desde el server NO deben tener el resaltado verde/amber.
    // Solo se aplica a las que el usuario confirma con el check en la sesión actual.
    if (this.draftRestoredForWorkoutId !== workoutId) {
      this.confirmedSetIdsInSession = new Set();
    }

    if (this.draftRestoredForWorkoutId !== workoutId) {
      const draft = this.sessionDraft.load(workoutId);
      if (draft) {
        const rawPending = JSON.parse(JSON.stringify(draft.pendingSetsByExercise)) as typeof this.pendingSetsByExercise;
        this.pendingSetsByExercise = Object.fromEntries(
          Object.entries(rawPending).filter(([id]) => exerciseIds.has(id))
        );
        this.completedExerciseIds = new Set(
          draft.completedExerciseIds.filter((id) => exerciseIds.has(id))
        );
        const allSetIds = new Set(detail.exercises.flatMap((e) => e.sets.map((s) => s.id)));
        this.confirmedSetIdsInSession = new Set(
          (draft.confirmedSetIds ?? []).filter((id) => allSetIds.has(id))
        );
        const nextInputs: typeof this.setInputs = {};
        for (const exercise of detail.exercises) {
          const fromDraft = draft.setInputs[exercise.id];
          nextInputs[exercise.id] = fromDraft ? { setKind: 'normal', ...fromDraft } : { setKind: 'normal' };
        }
        this.setInputs = nextInputs;
        if (draft.selectedExerciseId && exerciseIds.has(draft.selectedExerciseId)) {
          this.selectedExerciseId = draft.selectedExerciseId;
        }
      } else {
        this.pendingSetsByExercise = {};
        this.completedExerciseIds = new Set();
        const nextInputs: typeof this.setInputs = {};
        for (const exercise of detail.exercises) {
          nextInputs[exercise.id] = { setKind: 'normal' };
        }
        this.setInputs = nextInputs;
      }
      this.draftRestoredForWorkoutId = workoutId;
    }

    this.currentWorkout = this.mergePendingSets(detail);
    if (!this.selectedExerciseId && detail.exercises.length > 0) {
      this.selectedExerciseId = detail.exercises[0].id;
    }
    for (const exercise of detail.exercises) {
      if (!this.setInputs[exercise.id]) {
        this.setInputs[exercise.id] = { setKind: 'normal' };
      } else if (!this.setInputs[exercise.id].setKind) {
        this.setInputs[exercise.id].setKind = 'normal';
      }
    }
    void this.refreshWorkoutExerciseMedia();
    if (
      detail.exercises.length === 0 &&
      !this.showExerciseListModal &&
      !this.isBootstrappingTemplate &&
      this.autoOpenedPickerForWorkoutId !== detail.id
    ) {
      this.autoOpenedPickerForWorkoutId = detail.id;
      await this.openExerciseGroupModal();
    }
  }

  private async refreshWorkoutExerciseMedia(): Promise<void> {
    const list = this.currentWorkout?.exercises ?? [];
    const prev = this.workoutExerciseMediaUrls();
    const acc: Record<string, string> = {};
    for (const ex of list) {
      if (prev[ex.id]) {
        acc[ex.id] = prev[ex.id];
      }
    }
    for (const ex of list) {
      if (!ex.external_exercise_id || acc[ex.id]) {
        continue;
      }
      const url = await this.exerciseDbMedia.getObjectUrl(ex.external_exercise_id, '720');
      if (url) {
        acc[ex.id] = url;
      }
    }
    this.workoutExerciseMediaUrls.set(acc);
  }


  async openExerciseGroupModal(): Promise<void> {
    // Evita solape con el modal de "Definir entrenamiento".
    this.showNewSessionModal = false;
    this.selectedExerciseId = '';
    this.selectedCatalogExerciseId = '';
    this.catalogSearchQuery = '';
    this.debouncedCatalogSearchQuery = '';
    if (this.catalogSearchDebounceTimer) {
      clearTimeout(this.catalogSearchDebounceTimer);
      this.catalogSearchDebounceTimer = null;
    }
    this.selectedEquipmentFilter = 'all';
    this.activeMuscleGroup = '';
    this.selectedMuscleGroup = '';
    this.showExerciseListModal = true;
    await this.exerciseCatalogService.loadAll('Todos');
  }

  closeExerciseListModal(): void {
    this.showExerciseListModal = false;
    // Si por cualquier motivo quedo abierto en segundo plano, cerrarlo tambien.
    this.showNewSessionModal = false;
    this.selectedCatalogExerciseId = '';
    this.debouncedCatalogSearchQuery = '';
    if (this.catalogSearchDebounceTimer) {
      clearTimeout(this.catalogSearchDebounceTimer);
      this.catalogSearchDebounceTimer = null;
    }
  }

  async selectMuscleGroupSlide(key: string): Promise<void> {
    if (this.activeMuscleGroup === key) {
      this.activeMuscleGroup = '';
      this.selectedMuscleGroup = '';
      this.selectedCatalogExerciseId = '';
      this.catalogSearchQuery = '';
      this.debouncedCatalogSearchQuery = '';
      if (this.catalogSearchDebounceTimer) {
        clearTimeout(this.catalogSearchDebounceTimer);
        this.catalogSearchDebounceTimer = null;
      }
      this.selectedEquipmentFilter = 'all';
      await this.exerciseCatalogService.loadAll('Todos');
      return;
    }

    const slide = this.muscleGroupSlides.find((g) => g.key === key);
    if (!slide) {
      return;
    }
    this.activeMuscleGroup = key;
    this.selectedMuscleGroup = slide.label;
    this.selectedCatalogExerciseId = '';
    this.catalogSearchQuery = '';
    this.debouncedCatalogSearchQuery = '';
    if (this.catalogSearchDebounceTimer) {
      clearTimeout(this.catalogSearchDebounceTimer);
      this.catalogSearchDebounceTimer = null;
    }
    this.selectedEquipmentFilter = 'all';
    await this.exerciseCatalogService.loadByGroup(slide.label);
  }

  setEquipmentFilter(key: 'all' | 'dumbbell' | 'barbell' | 'machine' | 'free'): void {
    this.selectedEquipmentFilter = key;
  }

  runCatalogSearch(): void {
    const q = this.catalogSearchQuery.trim();
    this.flushCatalogSearchDebounce();
    if (!q) {
      if (this.selectedMuscleGroup) {
        void this.exerciseCatalogService.loadByGroup(this.selectedMuscleGroup);
      } else {
        void this.exerciseCatalogService.loadAll('Todos');
      }
      this.debouncedCatalogSearchQuery = '';
    }
  }

  onCatalogSearchInputChange(value: string): void {
    this.catalogSearchQuery = value;
    if (this.catalogSearchDebounceTimer) {
      clearTimeout(this.catalogSearchDebounceTimer);
    }
    this.catalogSearchDebounceTimer = setTimeout(() => {
      this.debouncedCatalogSearchQuery = this.catalogSearchQuery.trim();
      this.catalogSearchDebounceTimer = null;
      if (!this.debouncedCatalogSearchQuery) {
        if (this.selectedMuscleGroup) {
          void this.exerciseCatalogService.loadByGroup(this.selectedMuscleGroup);
        } else {
          void this.exerciseCatalogService.loadAll('Todos');
        }
      }
    }, 1000);
  }

  private flushCatalogSearchDebounce(): void {
    if (!this.catalogSearchDebounceTimer) {
      this.debouncedCatalogSearchQuery = this.catalogSearchQuery.trim();
      return;
    }
    clearTimeout(this.catalogSearchDebounceTimer);
    this.catalogSearchDebounceTimer = null;
    this.debouncedCatalogSearchQuery = this.catalogSearchQuery.trim();
  }

  private matchesSearchQuery(item: ExerciseCatalogItem, q: string): boolean {
    if (!q) {
      return true;
    }
    const needle = this.normalizeText(q);
    const english = this.normalizeText(item.name || '');
    const spanish = this.normalizeText(this.displayCatalogPrimaryName(item));
    return english.includes(needle) || spanish.includes(needle);
  }

  filteredCatalogItems(): ExerciseCatalogItem[] {
    const base = this.exerciseCatalogService.items().filter((item) =>
      this.matchesSearchQuery(item, this.debouncedCatalogSearchQuery)
    );
    const mode = this.selectedEquipmentFilter;
    if (mode === 'all') {
      return base;
    }
    return base.filter((item) => this.matchesEquipmentFilter(item, mode));
  }

  dbBodyPart(v: string): string {
    return translateBodyPart(v);
  }

  dbTarget(v: string): string {
    return translateTarget(v);
  }

  dbEquipment(v: string): string {
    return translateEquipment(v);
  }

  dbDifficulty(v: string): string {
    return translateDifficulty(v);
  }

  dbCategory(v: string): string {
    return translateCategory(v);
  }

  dbSecondaryMuscles(muscles: string[]): string {
    return muscles.map((m) => translateTarget(m)).join(', ');
  }

  displayCatalogPrimaryName(item: ExerciseCatalogItem): string {
    return translateExerciseName(item.name) || item.name;
  }

  displayCatalogSecondaryName(item: ExerciseCatalogItem): string {
    const en = (item.name || '').trim();
    const es = this.displayCatalogPrimaryName(item).trim();
    return this.normalizeText(en) !== this.normalizeText(es) ? en : '';
  }

  displayExercisePrimaryName(exercise: WorkoutExerciseRecord): string {
    const english = this.exerciseEnglishName(exercise);
    return translateExerciseName(english) || exercise.name;
  }

  displayExerciseSecondaryName(exercise: WorkoutExerciseRecord): string {
    const en = this.exerciseEnglishName(exercise);
    const es = this.displayExercisePrimaryName(exercise);
    return this.normalizeText(en) !== this.normalizeText(es) ? en : '';
  }

  async pickCatalogExercise(exercise: ExerciseCatalogItem): Promise<void> {
    if (!this.currentWorkout) {
      return;
    }
    this.selectedCatalogExerciseId = exercise.id;
    this.pushSelectedCatalogThumb(this.catalogThumb(exercise));
    const muscleGroup = exercise.muscle_group || this.selectedMuscleGroup;
    const created = await this.workoutRecordService.addExercise(this.currentWorkout.id, {
      name: exercise.name.trim(),
      muscle_group: muscleGroup || undefined,
      external_exercise_id: exercise.external_exercise_id ?? undefined,
      exercise_detail: exercise.detail as unknown as Record<string, unknown> | undefined
    });
    if (!created) {
      return;
    }
    const newEx: WorkoutExerciseRecord = {
      ...created,
      sets: created.sets ?? [],
      previous_sets: created.previous_sets ?? [],
      history_points: created.history_points ?? []
    };
    this.currentWorkout = {
      ...this.currentWorkout,
      exercises: [...this.currentWorkout.exercises, newEx].sort((a, b) => a.position - b.position)
    };
    this.selectedExerciseId = newEx.id;
    this.setInputs[newEx.id] = this.setInputs[newEx.id] ?? { setKind: 'normal' };
    void this.refreshWorkoutExerciseMedia();
    // Si el ejercicio tiene marcas previas, prellenamos N series pendientes
    // con esos valores para que el usuario sólo confirme.
    void this.prefillPendingSetsFromPrevious(newEx);
    void this.workoutRecordService.getWorkoutDetailQuiet(this.currentWorkout.id).then((detail) => {
      if (!detail || !this.currentWorkout) {
        return;
      }
      const fresh = detail.exercises.find((e) => e.id === newEx.id);
      const target = this.currentWorkout.exercises.find((e) => e.id === newEx.id);
      if (fresh && target) {
        target.previous_sets = fresh.previous_sets ?? [];
        target.history_points = fresh.history_points ?? [];
        // Reintentar prefill con previous_sets actualizados (por si el primer fetch los traía vacíos).
        void this.prefillPendingSetsFromPrevious(target);
      }
    });
    // Close picker after selecting so user can edit the added exercise immediately.
    this.showExerciseListModal = false;
  }

  /**
   * Si el ejercicio aún no tiene series y existen previous_sets, crea series
   * pendientes con los mismos valores. Así el usuario sólo tiene que confirmar
   * para repetir el último entreno (o editar antes de confirmar).
   */
  private async prefillPendingSetsFromPrevious(exercise: WorkoutExerciseRecord): Promise<void> {
    if (!this.currentWorkout) return;
    if ((exercise.sets?.length ?? 0) > 0) return;
    const prev = exercise.previous_sets ?? [];
    if (prev.length === 0) return;
    for (const p of prev) {
      const created = await this.workoutRecordService.addSet(this.currentWorkout.id, exercise.id, {
        set_type: 'normal',
        weight: p.weight ?? undefined,
        done_reps: p.done_reps ?? undefined,
      });
      if (created) {
        exercise.sets = [...exercise.sets, created];
      }
    }
    exercise.sets.sort((a, b) => a.position - b.position);
  }

  catalogThumb(item: ExerciseCatalogItem): string {
    const ext = item.external_exercise_id;
    if (ext && EXERCISEDB_LOCAL_MEDIA_IDS.has(ext)) {
      return `/exercises/exercisedb/gifs/${ext}.gif`;
    }
    return this.exerciseCatalogService.listThumbs()[item.id] || this.exerciseIcon(item);
  }

  private pushSelectedCatalogThumb(thumbUrl: string): void {
    const current = this.selectedCatalogThumbs();
    const deduped = [thumbUrl, ...current.filter((url) => url !== thumbUrl)];
    this.selectedCatalogThumbs.set(deduped.slice(0, 8));
  }


  cancelWorkoutView(): void {
    this.currentWorkout = null;
    this.selectedExerciseId = '';
    this.workoutExerciseMediaUrls.set({});
    this.selectedCatalogThumbs.set([]);
    this.activeWorkout.finishWorkout();
  }

  private openWorkoutSummary(): void {
    if (!this.currentWorkout) {
      return;
    }
    this.summaryWorkoutName = this.currentWorkout.workout_name;
    this.summaryElapsedLabel = this.activeWorkout.elapsedLabel();
    this.summaryExercisesCount = this.currentWorkout.exercises.length;
    this.summarySetsCount = this.currentWorkout.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
    this.showWorkoutSummaryModal = true;
  }

  closeWorkoutSummary(): void {
    this.showWorkoutSummaryModal = false;
    this.currentWorkout = null;
    this.selectedExerciseId = '';
    this.workoutExerciseMediaUrls.set({});
    this.selectedCatalogThumbs.set([]);
    this.activeWorkout.finishWorkout();
  }

  selectExercise(exerciseId: string): void {
    this.selectedExerciseId = exerciseId;
  }

  toggleExercise(exerciseId: string): void {
    this.selectedExerciseId = this.selectedExerciseId === exerciseId ? '' : exerciseId;
  }

  selectedExercisePreview(): WorkoutExerciseRecord | null {
    if (!this.currentWorkout || !this.selectedExerciseId) {
      return this.currentWorkout?.exercises[0] ?? null;
    }
    return this.currentWorkout.exercises.find((item) => item.id === this.selectedExerciseId) ?? null;
  }

  async removeExercise(exerciseId: string): Promise<void> {
    if (!this.currentWorkout) {
      return;
    }
    const ok = await this.workoutRecordService.deleteExercise(this.currentWorkout.id, exerciseId);
    if (!ok) {
      return;
    }
    if (this.selectedExerciseId === exerciseId) {
      this.selectedExerciseId = '';
    }
    delete this.pendingSetsByExercise[exerciseId];
    this.currentWorkout = {
      ...this.currentWorkout,
      exercises: this.currentWorkout.exercises.filter((e) => e.id !== exerciseId)
    };
  }

  async removeSet(exerciseId: string, setId: string): Promise<void> {
    if (!this.currentWorkout) {
      return;
    }
    const exercise = this.currentWorkout.exercises.find((item) => item.id === exerciseId);
    if (!exercise) {
      return;
    }
    if (setId.startsWith('local-')) {
      exercise.sets = exercise.sets.filter((set) => set.id !== setId);
      this.pendingSetsByExercise[exerciseId] = (this.pendingSetsByExercise[exerciseId] || []).filter(
        (set) => set.local_id !== setId
      );
      exercise.notes = this.buildExerciseNotes(exercise);
      return;
    }
    const ok = await this.workoutRecordService.deleteSet(this.currentWorkout.id, exerciseId, setId);
    if (!ok) {
      return;
    }
    await this.loadDetail(this.currentWorkout.id);
    const refreshed = this.currentWorkout?.exercises.find((item) => item.id === exerciseId);
    if (refreshed) {
      refreshed.notes = this.buildExerciseNotes(refreshed);
    }
  }

  clearSetDraft(exerciseId: string): void {
    this.setInputs[exerciseId] = { setKind: 'normal' };
  }

  completeExercise(exerciseId: string): void {
    this.completedExerciseIds.add(exerciseId);
    if (!this.currentWorkout) {
      return;
    }
    const currentIndex = this.currentWorkout.exercises.findIndex((item) => item.id === exerciseId);
    if (currentIndex < 0) {
      return;
    }
    const next = this.currentWorkout.exercises
      .slice(currentIndex + 1)
      .find((item) => !this.completedExerciseIds.has(item.id));
    this.selectedExerciseId = next?.id ?? '';
  }

  exerciseIcon(item: ExerciseCatalogItem): string {
    return resolveExerciseIcon(item.icon_key, item.muscle_group, item.icon_url, item.name);
  }

  exerciseImageFor(exercise: WorkoutExerciseRecord): string {
    return resolveExerciseImageByName(exercise.name, exercise.muscle_group || undefined);
  }

  workoutExerciseHero(exercise: WorkoutExerciseRecord): string {
    const blob = this.workoutExerciseMediaUrls()[exercise.id];
    if (blob) {
      return blob;
    }
    return this.exerciseImageFor(exercise);
  }

  exerciseDbDetail(exercise: WorkoutExerciseRecord): ExerciseDbExercise | null {
    return isExerciseDbExercise(exercise.exercise_detail) ? exercise.exercise_detail : null;
  }

  private exerciseEnglishName(exercise: WorkoutExerciseRecord): string {
    const d = this.exerciseDbDetail(exercise);
    return (d?.name || exercise.name || '').trim();
  }

  private matchesEquipmentFilter(
    item: ExerciseCatalogItem,
    mode: 'dumbbell' | 'barbell' | 'machine' | 'free'
  ): boolean {
    const eq = this.normalizeText(item.detail?.equipment ?? '');
    if (!eq) {
      return mode === 'free';
    }
    if (mode === 'dumbbell') {
      return eq.includes('dumbbell');
    }
    if (mode === 'barbell') {
      return eq.includes('barbell') || eq.includes('ez bar');
    }
    if (mode === 'machine') {
      return eq.includes('machine') || eq.includes('smith') || eq.includes('leverage') || eq.includes('cable');
    }
    return !(
      eq.includes('dumbbell') ||
      eq.includes('barbell') ||
      eq.includes('ez bar') ||
      eq.includes('machine') ||
      eq.includes('smith') ||
      eq.includes('leverage') ||
      eq.includes('cable')
    );
  }

  exerciseAltImageFor(exercise: WorkoutExerciseRecord): string {
    return resolveExerciseAltImageByName(exercise.name, exercise.muscle_group || undefined);
  }

  previousMaxWeight(exercise: WorkoutExerciseRecord): string {
    const maxWeight = Math.max(...(exercise.previous_sets || []).map((set) => Number(set.weight || 0)), 0);
    return maxWeight > 0 ? `${maxWeight}` : 'KG';
  }

  previousMaxReps(exercise: WorkoutExerciseRecord): string {
    const maxReps = Math.max(...(exercise.previous_sets || []).map((set) => Number(set.done_reps || 0)), 0);
    return maxReps > 0 ? `${maxReps}` : 'REPS';
  }

  openHistoryModal(exercise: WorkoutExerciseRecord): void {
    this.historyExerciseName = exercise.name;
    this.historyExerciseTitle = this.displayExercisePrimaryName(exercise);
    this.historyPoints = [...(exercise.history_points || [])];
    this.historySessionsData = [...(exercise.history_sessions || [])];
    this._histCacheSig = '';
    this._histW = null;
    this._histR = null;
    this.showHistoryModal = true;
  }

  closeHistoryModal(): void {
    this.showHistoryModal = false;
    this._histCacheSig = '';
    this._histW = null;
    this._histR = null;
  }

  openExerciseInfoModal(exercise: WorkoutExerciseRecord): void {
    const detail = this.exerciseDbDetail(exercise);
    if (!detail) {
      return;
    }
    this.exerciseInfoName = exercise.name;
    this.exerciseInfoDetail = detail;
    this.showExerciseInfoModal = true;
  }

  closeExerciseInfoModal(): void {
    this.showExerciseInfoModal = false;
    this.exerciseInfoName = '';
    this.exerciseInfoDetail = null;
  }

  selectedExerciseInfoDetail(): ExerciseDbExercise | null {
    return this.exerciseInfoDetail;
  }

  private historyChartCacheSig(): string {
    return this.historyPoints.map((p) => `${p.date}:${p.max_weight}:${p.max_reps}`).join('|');
  }

  private fmtHistChartDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }

  private buildHistoryChartFromPoints(rawPoints: Array<{ value: number; date: string }>): HistoryChartData {
    const { cw, ch, pt, pb, pl, pr } = this.HC;
    const iw = cw - pl - pr;
    const ih = ch - pt - pb;

    if (rawPoints.length === 0) return { path: '', dots: [], grid: [], xLabels: [] };

    const vals = rawPoints.map((p) => p.value);
    const maxV = Math.max(...vals);
    const minV = Math.min(...vals);
    const range = maxV - minV || 1;

    const mapX = (i: number) =>
      rawPoints.length === 1 ? pl + iw / 2 : pl + (i / (rawPoints.length - 1)) * iw;
    const mapY = (v: number) => pt + ih - ((v - minV) / range) * ih;

    const dots: HistoryChartPt[] = rawPoints.map((p, i) => ({ x: mapX(i), y: mapY(p.value), v: p.value }));
    const path =
      dots.length > 1 ? `M${dots.map((d) => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join('L')}` : '';

    const grid: HistoryGridLine[] = [0, 0.5, 1].map((ratio) => {
      const v = minV + ratio * range;
      return { y: mapY(v), label: v % 1 === 0 ? v.toString() : v.toFixed(1) };
    });

    const step = Math.max(1, Math.ceil(rawPoints.length / 5));
    const xLabels: HistoryXLabel[] = rawPoints
      .map((p, i) => ({ x: mapX(i), label: this.fmtHistChartDate(p.date), i }))
      .filter((item, _, arr) => item.i % step === 0 || item.i === arr.length - 1);

    return { path, dots, grid, xLabels };
  }

  historyWChart(): HistoryChartData {
    if (this.historyPoints.length === 0) {
      return { path: '', dots: [], grid: [], xLabels: [] };
    }
    const sig = this.historyChartCacheSig();
    if (this._histCacheSig !== sig || !this._histW) {
      this._histCacheSig = sig;
      this._histW = this.buildHistoryChartFromPoints(
        this.historyPoints.map((p) => ({ value: p.max_weight, date: p.date })),
      );
      this._histR = this.buildHistoryChartFromPoints(
        this.historyPoints.map((p) => ({ value: p.max_reps, date: p.date })),
      );
    }
    return this._histW;
  }

  historyRChart(): HistoryChartData {
    if (this.historyPoints.length === 0) {
      return { path: '', dots: [], grid: [], xLabels: [] };
    }
    this.historyWChart();
    return this._histR!;
  }

  private normalizeText(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private async finalizeCurrentWorkout(): Promise<void> {
    if (!this.currentWorkout || this.isFinalizing) {
      return;
    }
    this.isFinalizing = true;
    const workoutId = this.currentWorkout.id;
    const persisted = await this.flushPendingSets(workoutId);
    if (!persisted) {
      this.isFinalizing = false;
      return;
    }
    this.openWorkoutSummary();
    this.activeWorkout.finishWorkout();
    this.currentWorkout = null;
    this.selectedExerciseId = '';
    this.workoutExerciseMediaUrls.set({});
    this.pendingSetsByExercise = {};
    this.isFinalizing = false;
  }

  private async flushPendingSets(workoutId: string): Promise<boolean> {
    for (const [exerciseId, pendingSets] of Object.entries(this.pendingSetsByExercise)) {
      for (const set of pendingSets) {
        const createdSet = await this.workoutRecordService.addSet(workoutId, exerciseId, {
          set_type: set.set_type,
          done_reps: set.done_reps,
          weight: set.weight,
          comment: set.comment,
          assisted_reps: set.assisted_reps
        });
        if (!createdSet) {
          return false;
        }
      }
    }
    if (this.currentWorkout) {
      for (const exercise of this.currentWorkout.exercises) {
        const ok = await this.workoutRecordService.updateExerciseNotes(
          workoutId,
          exercise.id,
          this.buildExerciseNotes(exercise)
        );
        if (!ok) {
          return false;
        }
      }
    }
    return true;
  }

  private mergePendingSets(detail: WorkoutRecordDetail): WorkoutRecordDetail {
    const mergedExercises = detail.exercises.map((exercise) => {
      const pending = this.pendingSetsByExercise[exercise.id] || [];
      if (pending.length === 0) {
        return exercise;
      }
      const localSets = pending.map((set, index) => ({
        id: set.local_id,
        set_type: set.set_type,
        done_reps: set.done_reps,
        weight: set.weight,
        comment: set.comment,
        assisted_reps: set.assisted_reps,
        unit: 'kg' as const,
        position: exercise.sets.length + index + 1
      }));
      return {
        ...exercise,
        sets: [...exercise.sets, ...localSets],
        notes: this.buildExerciseNotes({ ...exercise, sets: [...exercise.sets, ...localSets] })
      };
    });
    return { ...detail, exercises: mergedExercises };
  }

  buildExerciseNotes(exercise: WorkoutExerciseRecord): string {
    const lines = exercise.sets
      .map((set, index) => ({ idx: index + 1, comment: (set.comment || '').trim() }))
      .filter((item) => item.comment.length > 0)
      .map((item) => `Serie ${item.idx}: ${item.comment}`);
    return lines.join('\n');
  }

  setTypeIcon(setType: string, assistedReps?: number | null): string {
    if (setType === 'dropset') return '⬇';
    if (assistedReps && assistedReps > 0) return '🤝';
    return '•';
  }

  setTypeText(setType: string): string {
    return setType === 'dropset' ? 'DROPSET' : 'NORMAL';
  }

  setTypeTooltip(setType: string, assistedReps?: number | null): string {
    if (setType === 'dropset') return 'Drop set';
    if (assistedReps && assistedReps > 0) {
      return assistedReps && assistedReps > 0 ? `Asistida (+${assistedReps})` : 'Asistida';
    }
    return 'Normal';
  }

  private buildSetComment(
    base: string | undefined,
    setKind: 'normal' | 'dropset',
    dropWeights?: string,
    dropReps?: string
  ): string | undefined {
    const plain = (base || '').trim();
    if (setKind !== 'dropset') {
      return plain || undefined;
    }
    const dropsW = (dropWeights || '').trim();
    const dropsR = (dropReps || '').trim();
    const chunks: string[] = [];
    if (dropsW) chunks.push(`kg ${dropsW}`);
    if (dropsR) chunks.push(`reps ${dropsR}`);
    if (chunks.length === 0) return plain || undefined;
    const dropInfo = `Drop: ${chunks.join(' · ')}`;
    if (!plain) {
      return dropInfo;
    }
    return `${plain} | ${dropInfo}`;
  }

}
