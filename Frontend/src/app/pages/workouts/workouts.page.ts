import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { resolveExerciseAltImageByName, resolveExerciseIcon, resolveExerciseImageByName } from '../../core/exercise-icons';
import { ExerciseCatalogItem } from '../../models/exercise-catalog.model';
import { WorkoutExerciseRecord, WorkoutRecordDetail } from '../../models/workout-record.model';
import { ActiveWorkoutService } from '../../services/active-workout.service';
import { ExerciseCatalogService } from '../../services/exercise-catalog.service';
import { WorkoutRecordService } from '../../services/workout-record.service';

interface PendingSetDraft {
  local_id: string;
  set_type: string;
  done_reps?: number;
  weight?: number;
  comment?: string;
}

@Component({
  selector: 'app-workouts-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="workout-start">
      @if (!currentWorkout) {
        <div class="hero">
          <h2>New Workout</h2>
          <p>Piensa menos. Entrena mas.</p>
        </div>
      }

      @if (!currentWorkout) {
        <div class="empty">
          @if (workoutRecordService.loading()) {
            <div class="loading-state">
              <span class="spinner" aria-hidden="true"></span>
              <small>Cargando rutinas...</small>
            </div>
          } @else {
            <div class="action-row">
              <button type="button" (click)="openReplicateModal()" [disabled]="!hasAnyWorkout()">
                Repetir rutina
              </button>
              <button type="button" class="secondary" (click)="openNewSessionModal()">
                Nueva rutina
              </button>
            </div>
          }
          </div>
      }

      @if (currentWorkout) {
        <div class="builder">
          <h3>{{ currentWorkout.workout_name }}</h3>

          @for (exercise of currentWorkout.exercises; track exercise.id) {
            <div
              class="exercise-card"
              [class.selected]="selectedExerciseId === exercise.id"
              [class.completed]="completedExerciseIds.has(exercise.id)"
            >
              <div class="exercise-head" (click)="toggleExercise(exercise.id)">
                <strong>{{ exercise.name }}</strong>
                <div class="exercise-head-actions">
                  <button
                    type="button"
                    class="history-icon-btn"
                    (click)="$event.stopPropagation(); openHistoryModal(exercise)"
                    aria-label="Ver historial"
                  >
                    <img src="/icons/chart-line.svg" alt="" />
                  </button>
                  <button type="button" class="remove-btn" (click)="$event.stopPropagation(); removeExercise(exercise.id)">
                    Eliminar
                  </button>
                </div>
              </div>
              @if (selectedExerciseId === exercise.id) {
                <small>{{ exercise.muscle_group || 'General' }}</small>
                <div class="exercise-hero">
                  <img [src]="exerciseImageFor(exercise)" [alt]="exercise.name" />
                </div>
                <div class="set-grid header">
                  <span>SET</span>
                  <span>KG</span>
                  <span>REPS</span>
                  <span>MODE</span>
                  <span></span>
                </div>
                @for (set of exercise.sets; track set.id; let idx = $index) {
                  <div class="set-grid">
                    <span class="set-num">{{ idx + 1 }}</span>
                    <span>{{ set.weight || '-' }}</span>
                    <span>{{ set.done_reps || '-' }}</span>
                    <span>{{ set.set_type === 'unilateral' ? 'UNI' : 'BI' }}</span>
                    <button type="button" class="delete-set-btn" (click)="removeSet(exercise.id, set.id)">x</button>
                  </div>
                  @if (set.comment) {
                    <small class="set-comment">{{ set.comment }}</small>
                  }
                }

                <div class="set-form">
                  <span class="set-num next">{{ exercise.sets.length + 1 }}</span>
                  <input
                    type="number"
                    [(ngModel)]="setInputs[exercise.id].weight"
                    [placeholder]="previousMaxWeight(exercise)"
                  />
                  <input
                    type="number"
                    [(ngModel)]="setInputs[exercise.id].reps"
                    [placeholder]="previousMaxReps(exercise)"
                  />
                  <select [(ngModel)]="setInputs[exercise.id].mode">
                    <option value="bilateral">BI</option>
                    <option value="unilateral">UNI</option>
                  </select>
                  <button type="button" class="check" (click)="addSet(exercise.id)">✓</button>
                </div>
                <input class="set-note-input" [(ngModel)]="setInputs[exercise.id].comment" placeholder="Nota" />
                <button type="button" class="finish-exercise" (click)="completeExercise(exercise.id)">
                  Terminar ejercicio
                </button>
              }
            </div>
          }
          <button type="button" class="link-btn add-exercise" (click)="openExerciseGroupModal()">ADD EXERCISE</button>
        </div>
      }

      @if (showReplicateModal) {
        <div class="modal-backdrop" (click)="closeReplicateModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>Selecciona entrenamiento</h3>
            <p>Elige uno para cargar nombre, ejercicios y series.</p>

            <div class="history-list">
              @for (record of workoutRecordService.records(); track record.id) {
                <button
                  type="button"
                  [class.selected-option]="selectedReplicateWorkoutId === record.id"
                  (click)="selectReplicateWorkout(record.id)"
                >
                  {{ record.workout_name }}
                </button>
              }
            </div>

            <button
              type="button"
              class="primary"
              [disabled]="!selectedReplicateWorkoutId || !replicateSelectionConfirmed || workoutRecordService.loading()"
              (click)="confirmReplicateWorkout()"
            >
              Confirmar repetir rutina
            </button>

            <button type="button" class="close" (click)="closeReplicateModal()">Cerrar</button>
          </div>
        </div>
      }

      @if (showNewSessionModal) {
        <div class="modal-backdrop" (click)="closeNewSessionModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>Define tu entrenamiento</h3>
            <p>Nombre y tipo de rutina para arrancar.</p>

            <div class="builder in-modal">
              <label>
                Nombre del entrenamiento
                <input [(ngModel)]="workoutName" placeholder="Ej: Push day pesado" />
              </label>

              <div class="routines">
                <span>Tipo de rutina (puedes combinar varias)</span>
                <div class="chips">
                  @for (option of routineOptions; track option) {
                    <button
                      type="button"
                      class="chip"
                      [class.active]="isSelected(option)"
                      (click)="toggleRoutine(option)"
                    >
                      {{ option }}
                    </button>
                  }
                </div>
              </div>

              <button type="button" class="primary" (click)="startWorkout()" [disabled]="workoutRecordService.loading()">
                + Iniciar entrenamiento
              </button>

              @if (workoutRecordService.error(); as error) {
                <small class="note error">{{ error }}</small>
              } @else if (selectedRoutines.length === 0) {
                <small class="note">Selecciona al menos un tipo de rutina.</small>
              } @else {
                <small class="note">Seleccion actual: {{ selectedRoutines.join(' + ') }}</small>
              }
            </div>

            <button type="button" class="close" (click)="closeNewSessionModal()">Cerrar</button>
          </div>
        </div>
      }

      @if (showExerciseGroupModal) {
        <div class="modal-backdrop" (click)="closeExerciseGroupModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>Selecciona grupo muscular</h3>
            <p>Primero elige el grupo y luego el ejercicio.</p>

            <div class="history-list">
              @for (group of preferredGroups(); track group) {
                <button type="button" (click)="selectGroup(group)">
                  {{ group }}
                </button>
              }
            </div>

            <button type="button" class="close" (click)="closeExerciseGroupModal()">Cerrar</button>
          </div>
        </div>
      }

      @if (showExerciseListModal) {
        <div class="modal-backdrop" (click)="closeExerciseListModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>Ejercicios - {{ selectedMuscleGroup }}</h3>
            <p>Selecciona uno del catalogo o crea uno manual.</p>

            <div class="history-list">
              @for (exercise of exerciseCatalogService.items(); track exercise.id) {
                <button
                  type="button"
                  class="exercise-option"
                  [class.selected-option]="selectedCatalogExerciseId === exercise.id"
                  (click)="pickCatalogExercise(exercise)"
                >
                  <span class="option-arrow">></span>
                  <span>{{ exercise.name }}</span>
                </button>
              }
            </div>
            @if (exerciseCatalogService.items().length === 0 && !exerciseCatalogService.loading()) {
              <small class="note">No hay ejercicios en este grupo todavia. Puedes agregar uno manual.</small>
            }

            <button type="button" class="manual-inline" (click)="manualMode = !manualMode">
              <span>Agregar manualmente</span>
              <span class="plus">+</span>
            </button>

            @if (manualMode) {
              <div class="manual-card">
                <label>
                  Nombre ejercicio
                  <input [(ngModel)]="manualExerciseName" placeholder="Ej: Press banca agarre cerrado" />
                </label>
                <button type="button" class="primary" (click)="addManualExerciseFromModal()" [disabled]="workoutRecordService.loading()">
                  Guardar y agregar
                </button>
              </div>
            } @else {
              <button
                type="button"
                class="primary"
                [disabled]="!selectedCatalogExerciseId || workoutRecordService.loading()"
                (click)="confirmCatalogExercise()"
              >
                Agregar ejercicio
              </button>
            }

            <button type="button" class="close close-danger" (click)="closeExerciseListModal()">Cancelar</button>
          </div>
        </div>
      }

      @if (showWorkoutSummaryModal) {
        <div class="modal-backdrop" (click)="closeWorkoutSummary()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>Resumen del entrenamiento</h3>
            <p>{{ summaryWorkoutName }}</p>
            <small class="note">Tiempo: {{ summaryElapsedLabel }}</small>
            <small class="note">Ejercicios: {{ summaryExercisesCount }} · Series: {{ summarySetsCount }}</small>
            <div class="summary-actions">
              <button type="button" class="close close-danger" (click)="closeWorkoutSummary()">Cancelar</button>
              <button type="button" class="primary" (click)="closeWorkoutSummary()">Cerrar</button>
            </div>
          </div>
        </div>
      }

      @if (showHistoryModal) {
        <div class="modal-backdrop" (click)="closeHistoryModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>Historial - {{ historyExerciseName }}</h3>
            <p>Maximos por entrenamiento (peso y repeticiones).</p>
            @if (historyPoints.length > 0) {
              <div class="line-chart">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polyline class="line-weight" [attr.points]="historyWeightPath()"></polyline>
                  <polyline class="line-reps" [attr.points]="historyRepsPath()"></polyline>
                  @for (point of historyPoints; track point.workout_id; let idx = $index) {
                    <circle class="dot-weight" [attr.cx]="historyX(idx)" [attr.cy]="historyWeightY(point.max_weight)" r="1.6"></circle>
                    <circle class="dot-reps" [attr.cx]="historyX(idx)" [attr.cy]="historyRepsY(point.max_reps)" r="1.6"></circle>
                  }
                </svg>
              </div>
              @if (lastHistoryPoint(); as last) {
                <div class="history-summary">
                  <small>{{ last.date }}</small>
                  <strong>{{ last.max_weight || 0 }} kg</strong>
                  <strong>{{ last.max_reps || 0 }} reps</strong>
                </div>
              }
            } @else {
              <small class="note">No hay datos historicos para este ejercicio todavia.</small>
            }
            <button type="button" class="close" (click)="closeHistoryModal()">Cerrar</button>
          </div>
        </div>
      }
    </section>
  `,
  styles: [`
    .workout-start {
      max-width: 620px;
      margin: 0 auto;
      display: grid;
      gap: 0.9rem;
    }

    .hero h2 {
      margin: 0;
      font-size: 1.3rem;
      color: #111;
    }

    .hero p {
      margin: 0.25rem 0 0;
      color: #666;
    }

    .empty {
      border: 1px solid #ececec;
      border-radius: 14px;
      padding: 0.9rem;
      background: #fafafa;
      display: grid;
      gap: 0.35rem;
    }

    .empty strong {
      font-size: 0.95rem;
    }

    .empty p {
      margin: 0;
      color: #666;
      font-size: 0.9rem;
    }

    .empty button {
      border: 1px solid #111;
      border-radius: 10px;
      background: #111;
      color: #fff;
      padding: 0.55rem 0.9rem;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
    }

    .action-row {
      display: flex;
      gap: 0.5rem;
      width: 100%;
    }

    .action-row button {
      flex: 1;
    }

    .loading-state {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #6b7280;
      font-size: 0.84rem;
    }

    .spinner {
      width: 14px;
      height: 14px;
      border-radius: 999px;
      border: 2px solid #d1d5db;
      border-top-color: #111;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .secondary {
      border: 1px solid #d1d5db !important;
      background: #fff !important;
      color: #111 !important;
    }

    .builder {
      border: 0;
      border-radius: 0;
      background: transparent;
      padding: 0;
      display: grid;
      gap: 0.85rem;
    }

    .in-modal {
      border: 0;
      border-radius: 0;
      padding: 0;
      background: transparent;
    }

    label {
      display: grid;
      gap: 0.35rem;
      font-size: 0.88rem;
      color: #444;
    }

    input {
      border: 1px solid #e6e6e6;
      border-radius: 10px;
      padding: 0.7rem 0.75rem;
      font: inherit;
      background: #fff;
    }

    .routines {
      display: grid;
      gap: 0.45rem;
    }

    .routines span {
      font-size: 0.88rem;
      color: #444;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    }

    .chip {
      border: 1px solid #dfdfdf;
      background: #fff;
      color: #555;
      border-radius: 999px;
      padding: 0.45rem 0.75rem;
      font-size: 0.82rem;
      cursor: pointer;
    }

    .chip.active {
      border-color: #111;
      background: #111;
      color: #fff;
    }

    .primary {
      border: 0;
      border-radius: 10px;
      padding: 0.8rem 1rem;
      font-weight: 600;
      background: #111;
      color: #fff;
      cursor: pointer;
    }

    .primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .note {
      color: #7a7a7a;
      font-size: 0.8rem;
    }

    .error {
      color: #b91c1c;
    }

    h3 {
      margin: 0;
      font-size: 1rem;
    }

    .exercise-card {
      border: 1px solid #ececec;
      border-radius: 10px;
      padding: 0.7rem;
      display: grid;
      gap: 0.45rem;
    }

    .exercise-card.completed {
      border-color: #22c55e;
      box-shadow: inset 0 0 0 1px #bbf7d0;
    }

    .toggle-manual {
      border: 0;
      background: transparent;
      color: #2563eb;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
    }

    .exercise-card small {
      color: #666;
    }

    .exercise-hero {
      display: block;
      margin-top: 0.2rem;
    }

    .exercise-hero img {
      width: 100%;
      height: 138px;
      object-fit: contain;
      border-radius: 10px;
      border: 1px solid #e5e7eb;
      background: #fff;
    }

    .exercise-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
    }

    .remove-btn {
      border: 0;
      background: transparent;
      color: #ef4444;
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
      padding: 0;
    }

    .exercise-head-actions {
      display: flex;
      align-items: center;
      gap: 0.55rem;
    }

    .history-icon-btn {
      border: 1px solid #e5e7eb;
      background: #fff;
      border-radius: 8px;
      width: 28px;
      height: 28px;
      display: grid;
      place-items: center;
      cursor: pointer;
      padding: 0;
    }

    .history-icon-btn img {
      width: 17px;
      height: 17px;
      opacity: 0.9;
    }

    .set-grid {
      display: grid;
      grid-template-columns: 44px 72px 72px 96px 34px;
      gap: 0.35rem;
      align-items: center;
      font-size: 0.78rem;
      color: #4b5563;
    }

    .set-grid span {
      text-align: center;
    }

    .set-grid.header {
      color: #9ca3af;
      font-weight: 700;
      font-size: 0.68rem;
      letter-spacing: 0.03em;
      margin-top: 0.2rem;
      text-align: center;
    }

    .set-num {
      color: #111;
      font-weight: 700;
      text-align: center;
    }

    .done {
      color: #22c55e;
      font-weight: 700;
      justify-self: center;
    }

    .set-form {
      display: grid;
      grid-template-columns: 44px 72px 72px 96px 34px;
      gap: 0.35rem;
      align-items: center;
    }

    .set-form input,
    .set-form select {
      height: 30px;
      padding: 0.25rem 0.4rem;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
      font-size: 0.82rem;
      text-align: center;
      background: #fff;
    }

    .set-form input::placeholder {
      color: #9ca3af;
      text-align: center;
    }

    .set-note-input {
      margin-top: 0.2rem;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 0.4rem 0.5rem;
      font-size: 0.8rem;
      background: #fff;
    }

    .set-comment {
      display: block;
      margin-left: 40px;
      color: #6b7280;
      font-size: 0.74rem;
    }

    .check {
      border: 0;
      background: #22c55e;
      color: #fff;
      border-radius: 8px;
      height: 30px;
      width: 30px;
      font-weight: 700;
      cursor: pointer;
      justify-self: center;
    }

    .delete-set-btn {
      border: 0;
      background: transparent;
      color: #ef4444;
      font-weight: 700;
      cursor: pointer;
      justify-self: center;
      padding: 0;
    }

    .link-btn {
      border: 0;
      background: transparent;
      color: #111;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      justify-self: center;
    }

    .finish-exercise {
      justify-self: end;
      border: 1px solid #111;
      color: #fff;
      background: #111;
      border-radius: 8px;
      padding: 0.35rem 0.65rem;
      font-family: inherit;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.28);
      display: grid;
      place-items: center;
      z-index: 40;
      padding: 1rem;
    }

    .modal {
      width: 100%;
      max-width: 420px;
      border-radius: 14px;
      background: #fff;
      border: 1px solid #ececec;
      padding: 1rem;
      display: grid;
      gap: 0.7rem;
    }

    .modal p {
      margin: 0;
      color: #666;
      font-size: 0.85rem;
    }

    .history-list {
      max-height: 260px;
      overflow: auto;
      display: grid;
      gap: 0.45rem;
    }

    .history-list button {
      border: 1px solid #e5e7eb;
      background: #fff;
      border-radius: 10px;
      padding: 0.6rem 0.7rem;
      text-align: left;
      cursor: pointer;
      font-weight: 600;
      color: #111;
    }

    .exercise-option {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font: inherit;
      font-size: 0.92rem;
    }

    .selected-option {
      border-color: #111 !important;
      background: #f8fafc !important;
    }

    .option-arrow {
      color: #9ca3af;
      font-weight: 700;
      width: 10px;
      text-align: center;
    }

    .manual-inline {
      border: 1px solid #e5e7eb;
      background: #fff;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6rem 0.7rem;
      font: inherit;
      cursor: pointer;
    }

    .manual-inline .plus {
      font-size: 1.05rem;
      font-weight: 700;
      color: #111;
    }

    .manual-card {
      border: 1px solid #ececec;
      border-radius: 10px;
      padding: 0.7rem;
      display: grid;
      gap: 0.6rem;
    }

    .close {
      justify-self: end;
      border: 0;
      background: transparent;
      color: #6b7280;
      cursor: pointer;
    }

    .close-danger {
      color: #dc2626;
    }

    .summary-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.6rem;
    }

    .line-chart {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      background: #fff;
      padding: 0.4rem;
      margin-bottom: 0.55rem;
    }

    .line-chart svg {
      width: 100%;
      height: 180px;
      display: block;
    }

    .line-weight,
    .line-reps {
      fill: none;
      stroke-width: 1.8;
      vector-effect: non-scaling-stroke;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .line-weight {
      stroke: #2563eb;
    }

    .line-reps {
      stroke: #6b7280;
    }

    .dot-weight {
      fill: #2563eb;
    }

    .dot-reps {
      fill: #6b7280;
    }

    .history-summary {
      display: grid;
      gap: 0.15rem;
      margin-bottom: 0.6rem;
      color: #111827;
    }

    .history-summary small {
      color: #6b7280;
      font-size: 0.76rem;
    }

    .history-summary strong {
      font-size: 0.88rem;
    }
  `]
})
export class WorkoutsPage implements OnInit {
  constructor(
    readonly workoutRecordService: WorkoutRecordService,
    readonly exerciseCatalogService: ExerciseCatalogService,
    private readonly activeWorkout: ActiveWorkoutService
  ) {}

  workoutName = '';
  currentWorkout: WorkoutRecordDetail | null = null;
  showReplicateModal = false;
  selectedReplicateWorkoutId = '';
  replicateSelectionConfirmed = false;
  showNewSessionModal = false;
  showExerciseGroupModal = false;
  showExerciseListModal = false;
  selectedMuscleGroup = '';
  selectedCatalogExerciseId = '';
  selectedCatalogExerciseMuscleGroup = '';
  selectedExerciseId = '';
  completedExerciseIds = new Set<string>();
  manualMode = false;
  manualExerciseName = '';
  setInputs: Record<string, { reps?: number; weight?: number; comment?: string; mode?: 'unilateral' | 'bilateral' }> =
    {};
  routineOptions = ['Pecho', 'Espalda', 'Pierna', 'Biceps', 'Triceps', 'Hombro', 'Core', 'Cardio'];
  selectedRoutines: string[] = [];
  pendingSetsByExercise: Record<string, PendingSetDraft[]> = {};
  showWorkoutSummaryModal = false;
  summaryWorkoutName = '';
  summaryElapsedLabel = '00:00:00';
  summaryExercisesCount = 0;
  summarySetsCount = 0;
  showHistoryModal = false;
  historyExerciseName = '';
  historyPoints: Array<{ workout_id: string; date: string; max_weight: number; max_reps: number }> = [];
  readonly hasAnyWorkout = computed(() => this.workoutRecordService.records().length > 0);
  private isFinalizing = false;

  private readonly finalizeEffect = effect(() => {
    const tick = this.activeWorkout.finalizeRequestTick();
    if (!tick || !this.currentWorkout || this.activeWorkout.workoutId() !== this.currentWorkout.id) {
      return;
    }
    void this.finalizeCurrentWorkout();
  });

  private readonly sessionClosedEffect = effect(() => {
    const isActive = this.activeWorkout.isActive();
    if (!isActive && this.currentWorkout) {
      this.currentWorkout = null;
      this.selectedExerciseId = '';
      this.showExerciseGroupModal = false;
      this.showExerciseListModal = false;
    }
  });

  async ngOnInit(): Promise<void> {
    await this.workoutRecordService.loadRecords();
    await this.exerciseCatalogService.loadGroups();
    const activeWorkoutId = this.activeWorkout.workoutId();
    if (activeWorkoutId) {
      await this.loadDetail(activeWorkoutId);
      if (!this.currentWorkout) {
        this.activeWorkout.finishWorkout();
      }
    }
  }

  isSelected(option: string): boolean {
    return this.selectedRoutines.includes(option);
  }

  toggleRoutine(option: string): void {
    if (this.isSelected(option)) {
      this.selectedRoutines = this.selectedRoutines.filter((item) => item !== option);
      return;
    }
    this.selectedRoutines = [...this.selectedRoutines, option];
  }

  startWorkout(): void {
    if (!this.workoutName.trim() || this.selectedRoutines.length === 0) {
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
    this.showNewSessionModal = true;
  }

  closeNewSessionModal(): void {
    this.showNewSessionModal = false;
  }

  private async createWorkout(): Promise<void> {
    const created = await this.workoutRecordService.createWorkout(this.workoutName.trim(), this.selectedRoutines);
    if (!created) {
      return;
    }
    this.showNewSessionModal = false;
    this.activeWorkout.startWorkout(created.id, created.workout_name);
    await this.loadDetail(created.id);
    this.workoutName = '';
    this.selectedRoutines = [];
  }

  async replicateFrom(workoutId: string): Promise<void> {
    const created = await this.workoutRecordService.replicateWorkoutFrom(workoutId);
    if (!created) {
      return;
    }
    this.showReplicateModal = false;
    this.replicateSelectionConfirmed = false;
    this.activeWorkout.startWorkout(created.id, created.workout_name);
    await this.loadDetail(created.id);
    this.workoutName = '';
    this.selectedRoutines = [];
  }

  async addExercise(): Promise<void> {
    if (!this.currentWorkout || !this.selectedMuscleGroup) {
      return;
    }
    const muscleFromSelection = this.selectedCatalogExerciseMuscleGroup || this.selectedMuscleGroup;
    const created = await this.workoutRecordService.addExercise(this.currentWorkout.id, {
      name: this.manualExerciseName.trim(),
      muscle_group: muscleFromSelection || undefined
    });
    if (!created) {
      return;
    }
    this.manualExerciseName = '';
    this.manualMode = false;
    this.selectedExerciseId = created.id;
    await this.loadDetail(this.currentWorkout.id);
  }

  async addSet(exerciseId: string): Promise<void> {
    if (!this.currentWorkout) {
      return;
    }
    const workoutId = this.currentWorkout.id;
    const input = this.setInputs[exerciseId] || {};
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload: PendingSetDraft = {
      local_id: localId,
      set_type: input.mode || 'bilateral',
      done_reps: input.reps,
      weight: input.weight,
      comment: input.comment
    };
    this.pendingSetsByExercise[exerciseId] = [...(this.pendingSetsByExercise[exerciseId] || []), payload];

    const exercise = this.currentWorkout.exercises.find((item) => item.id === exerciseId);
    if (exercise) {
      exercise.sets = [
        ...exercise.sets,
        {
          id: localId,
          set_type: input.mode || 'bilateral',
          done_reps: input.reps,
          weight: input.weight,
          comment: input.comment,
          unit: 'kg',
          position: exercise.sets.length + 1
        }
      ];
      exercise.notes = this.buildExerciseNotes(exercise);
    }
    this.setInputs[exerciseId] = {};

    const persisted = await this.workoutRecordService.addSet(workoutId, exerciseId, {
      set_type: payload.set_type,
      done_reps: payload.done_reps,
      weight: payload.weight,
      comment: payload.comment
    });
    if (persisted) {
      this.pendingSetsByExercise[exerciseId] = (this.pendingSetsByExercise[exerciseId] || []).filter(
        (set) => set.local_id !== localId
      );
      await this.loadDetail(workoutId);
    }
  }

  private async loadDetail(workoutId: string): Promise<void> {
    const detail = await this.workoutRecordService.getWorkoutDetail(workoutId);
    if (!detail) {
      return;
    }
    this.currentWorkout = this.mergePendingSets(detail);
    if (!this.selectedExerciseId && detail.exercises.length > 0) {
      this.selectedExerciseId = detail.exercises[0].id;
    }
    for (const exercise of detail.exercises) {
      if (!this.setInputs[exercise.id]) {
        this.setInputs[exercise.id] = {};
      }
    }
  }

  preferredGroups(): string[] {
    const available = this.exerciseCatalogService.groups();
    const fromWorkout = this.currentWorkout?.routine_types?.filter((item) => !!item) ?? [];
    if (fromWorkout.length > 0 && available.length > 0) {
      const matched = fromWorkout
        .map((group) => this.resolveGroupToCatalog(group))
        .filter((group, index, arr) => !!group && arr.indexOf(group) === index);
      if (matched.length > 0) {
        return matched;
      }
    }
    if (available.length > 0) {
      return available;
    }
    return this.routineOptions;
  }

  async openExerciseGroupModal(): Promise<void> {
    if (this.exerciseCatalogService.groups().length === 0) {
      await this.exerciseCatalogService.loadGroups();
    }
    // Reset visual focus so previous exercise preview does not block adding a new one
    this.selectedExerciseId = '';
    this.showExerciseGroupModal = true;
    this.manualMode = false;
    this.manualExerciseName = '';
  }

  closeExerciseGroupModal(): void {
    this.showExerciseGroupModal = false;
  }

  closeExerciseListModal(): void {
    this.showExerciseListModal = false;
    this.manualMode = false;
    this.manualExerciseName = '';
    this.selectedCatalogExerciseId = '';
    this.selectedCatalogExerciseMuscleGroup = '';
  }

  async selectGroup(group: string): Promise<void> {
    const routineGroups = this.currentWorkout?.routine_types ?? [];
    const matchedRoutineGroups = routineGroups
      .map((item) => this.resolveGroupToCatalog(item))
      .filter((item, index, arr) => !!item && arr.indexOf(item) === index);

    if (matchedRoutineGroups.length > 1) {
      this.selectedMuscleGroup = 'Rutina combinada';
      await this.exerciseCatalogService.loadByGroups(matchedRoutineGroups);
    } else {
      const targetGroup = this.resolveGroupToCatalog(group);
      this.selectedMuscleGroup = targetGroup;
      await this.exerciseCatalogService.loadByGroup(targetGroup);
    }
    this.showExerciseGroupModal = false;
    this.showExerciseListModal = true;
  }

  async pickCatalogExercise(exercise: ExerciseCatalogItem): Promise<void> {
    this.selectedCatalogExerciseId = exercise.id;
    this.selectedCatalogExerciseMuscleGroup = exercise.muscle_group;
  }

  async confirmCatalogExercise(): Promise<void> {
    const selected = this.exerciseCatalogService.items().find((item) => item.id === this.selectedCatalogExerciseId);
    if (!selected) {
      return;
    }
    this.manualExerciseName = selected.name;
    await this.addExercise();
    this.showExerciseListModal = false;
    this.selectedCatalogExerciseId = '';
  }

  async addManualExerciseFromModal(): Promise<void> {
    if (!this.manualExerciseName.trim() || !this.selectedMuscleGroup) {
      return;
    }
    const custom = await this.exerciseCatalogService.createCustom(this.manualExerciseName.trim(), this.selectedMuscleGroup);
    if (!custom) {
      return;
    }
    this.manualExerciseName = custom.name;
    await this.addExercise();
    this.showExerciseListModal = false;
  }

  cancelWorkoutView(): void {
    this.currentWorkout = null;
    this.selectedExerciseId = '';
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
    await this.loadDetail(this.currentWorkout.id);
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
    this.setInputs[exerciseId] = {};
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
    this.historyPoints = [...(exercise.history_points || [])];
    this.showHistoryModal = true;
  }

  closeHistoryModal(): void {
    this.showHistoryModal = false;
  }

  lastHistoryPoint(): { workout_id: string; date: string; max_weight: number; max_reps: number } | null {
    if (this.historyPoints.length === 0) {
      return null;
    }
    return this.historyPoints[this.historyPoints.length - 1];
  }

  historyX(index: number): number {
    if (this.historyPoints.length <= 1) {
      return 10;
    }
    const step = 80 / (this.historyPoints.length - 1);
    return 10 + index * step;
  }

  historyWeightY(value: number): number {
    if (this.historyPoints.length === 0) {
      return 90;
    }
    const max = Math.max(...this.historyPoints.map((item) => Number(item.max_weight || 0)), 1);
    const normalized = Number(value || 0) / max;
    return 90 - normalized * 70;
  }

  historyRepsY(value: number): number {
    if (this.historyPoints.length === 0) {
      return 90;
    }
    const max = Math.max(...this.historyPoints.map((item) => Number(item.max_reps || 0)), 1);
    const normalized = Number(value || 0) / max;
    return 90 - normalized * 70;
  }

  historyWeightPath(): string {
    if (this.historyPoints.length === 0) {
      return '';
    }
    return this.historyPoints.map((point, idx) => `${this.historyX(idx)},${this.historyWeightY(point.max_weight)}`).join(' ');
  }

  historyRepsPath(): string {
    if (this.historyPoints.length === 0) {
      return '';
    }
    return this.historyPoints.map((point, idx) => `${this.historyX(idx)},${this.historyRepsY(point.max_reps)}`).join(' ');
  }

  private resolveGroupToCatalog(group: string): string {
    const available = this.exerciseCatalogService.groups();
    if (available.length === 0) {
      return group;
    }
    const normalizedTarget = this.normalizeText(group);
    const exact = available.find((item) => this.normalizeText(item) === normalizedTarget);
    if (exact) {
      return exact;
    }
    const contains = available.find(
      (item) => this.normalizeText(item).includes(normalizedTarget) || normalizedTarget.includes(this.normalizeText(item))
    );
    return contains ?? available[0];
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
    this.pendingSetsByExercise = {};
    this.isFinalizing = false;
  }

  private async flushPendingSets(workoutId: string): Promise<boolean> {
    for (const [exerciseId, pendingSets] of Object.entries(this.pendingSetsByExercise)) {
      for (const set of pendingSets) {
        const ok = await this.workoutRecordService.addSet(workoutId, exerciseId, {
          set_type: set.set_type,
          done_reps: set.done_reps,
          weight: set.weight,
          comment: set.comment
        });
        if (!ok) {
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

}
