import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { resolveExerciseAltImageByName, resolveExerciseIcon, resolveExerciseImageByName } from '../../core/exercise-icons';
import { ExerciseCatalogItem } from '../../models/exercise-catalog.model';
import { WorkoutExerciseRecord, WorkoutRecordDetail } from '../../models/workout-record.model';
import { ActiveWorkoutService } from '../../services/active-workout.service';
import { ExerciseCatalogService } from '../../services/exercise-catalog.service';
import { WorkoutRecordService } from '../../services/workout-record.service';

@Component({
  selector: 'app-workouts-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="workout-start">
      <div class="hero">
        <h2>New Workout</h2>
        <p>Piensa menos. Entrena mas.</p>
      </div>

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

          @if (selectedExercisePreview(); as focused) {
            <div class="exercise-hero">
              <img [src]="exerciseImageFor(focused)" [alt]="focused.name" />
              <img [src]="exerciseAltImageFor(focused)" [alt]="focused.name + ' variacion'" />
            </div>
          }

          @for (exercise of currentWorkout.exercises; track exercise.id) {
            <div class="exercise-card" [class.selected]="selectedExerciseId === exercise.id">
              <div class="exercise-head">
                <strong (click)="selectExercise(exercise.id)">{{ exercise.name }}</strong>
                <button type="button" class="remove-btn" (click)="removeExercise(exercise.id)">Eliminar</button>
              </div>
              <small>{{ exercise.muscle_group || 'General' }}</small>
              <div class="set-grid header">
                <span>SET</span>
                <span>PREVIOUS</span>
                <span>KG</span>
                <span>REPS</span>
                <span></span>
              </div>
              @for (set of exercise.sets; track set.id; let idx = $index) {
                <div class="set-grid">
                  <span class="set-num">{{ idx + 1 }}</span>
                  <span>{{ previousLabel(exercise, idx) }}</span>
                  <span>{{ set.weight || '-' }}</span>
                  <span>{{ set.done_reps || '-' }}</span>
                  <span class="done">✓</span>
                </div>
                @if (set.comment) {
                  <small class="set-comment">{{ set.comment }}</small>
                }
              }

              <div class="set-form">
                <span class="set-num next">{{ exercise.sets.length + 1 }}</span>
                <span>{{ previousLabel(exercise, exercise.sets.length) }}</span>
                <input type="number" [(ngModel)]="setInputs[exercise.id].weight" placeholder="KG" />
                <input type="number" [(ngModel)]="setInputs[exercise.id].reps" placeholder="REPS" />
                <button type="button" class="check" (click)="addSet(exercise.id)">✓</button>
              </div>
              <input class="set-note-input" [(ngModel)]="setInputs[exercise.id].comment" placeholder="Nota de esta serie" />
              <button type="button" class="link-btn" (click)="addSet(exercise.id)">ADD SET</button>
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
                <button type="button" (click)="replicateFrom(record.id)">
                  {{ record.workout_name }}
                </button>
              }
            </div>

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
                <button type="button" class="exercise-option" (click)="pickCatalogExercise(exercise)">
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
            <button type="button" class="primary" (click)="closeWorkoutSummary()">Cerrar</button>
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
      border: 1px solid #ececec;
      border-radius: 14px;
      background: #fff;
      padding: 1rem;
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
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.45rem;
      margin-top: 0.2rem;
    }

    .exercise-hero img {
      width: 100%;
      height: 138px;
      object-fit: cover;
      border-radius: 10px;
      border: 1px solid #e5e7eb;
    }

    .exercise-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
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

    .set-grid {
      display: grid;
      grid-template-columns: 40px 1fr 56px 56px 34px;
      gap: 0.35rem;
      align-items: center;
      font-size: 0.78rem;
      color: #4b5563;
    }

    .set-grid.header {
      color: #9ca3af;
      font-weight: 700;
      font-size: 0.68rem;
      letter-spacing: 0.03em;
      margin-top: 0.2rem;
    }

    .set-num {
      color: #38bdf8;
      font-weight: 700;
    }

    .done {
      color: #22c55e;
      font-weight: 700;
      justify-self: center;
    }

    .set-form {
      display: grid;
      grid-template-columns: 40px 1fr 56px 56px 34px;
      gap: 0.35rem;
      align-items: center;
    }

    .set-form input {
      height: 30px;
      padding: 0.25rem 0.4rem;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
      font-size: 0.82rem;
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

    .link-btn {
      border: 0;
      background: transparent;
      color: #111;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      justify-self: center;
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
  showNewSessionModal = false;
  showExerciseGroupModal = false;
  showExerciseListModal = false;
  selectedMuscleGroup = '';
  selectedExerciseId = '';
  manualMode = false;
  manualExerciseName = '';
  setInputs: Record<string, { reps?: number; weight?: number; comment?: string }> = {};
  routineOptions = ['Pecho', 'Espalda', 'Pierna', 'Biceps', 'Triceps', 'Hombro', 'Core', 'Cardio'];
  selectedRoutines: string[] = [];
  showWorkoutSummaryModal = false;
  summaryWorkoutName = '';
  summaryElapsedLabel = '00:00:00';
  summaryExercisesCount = 0;
  summarySetsCount = 0;
  readonly hasAnyWorkout = computed(() => this.workoutRecordService.records().length > 0);

  private readonly finalizeEffect = effect(() => {
    const tick = this.activeWorkout.finalizeRequestTick();
    if (!tick || !this.currentWorkout || this.activeWorkout.workoutId() !== this.currentWorkout.id) {
      return;
    }
    this.openWorkoutSummary();
    this.activeWorkout.finishWorkout();
    this.currentWorkout = null;
    this.selectedExerciseId = '';
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
  }

  closeReplicateModal(): void {
    this.showReplicateModal = false;
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
    await this.loadDetail(created.id);
    this.workoutName = '';
    this.selectedRoutines = [];
  }

  async addExercise(): Promise<void> {
    if (!this.currentWorkout || !this.selectedMuscleGroup) {
      return;
    }
    const created = await this.workoutRecordService.addExercise(this.currentWorkout.id, {
      name: this.manualExerciseName.trim(),
      muscle_group: this.selectedMuscleGroup || undefined
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
    const input = this.setInputs[exerciseId] || {};
    const ok = await this.workoutRecordService.addSet(this.currentWorkout.id, exerciseId, {
      set_type: 'normal',
      done_reps: input.reps,
      weight: input.weight,
      comment: input.comment
    });
    if (!ok) {
      return;
    }
    this.setInputs[exerciseId] = {};
    await this.loadDetail(this.currentWorkout.id);
  }

  private async loadDetail(workoutId: string): Promise<void> {
    const detail = await this.workoutRecordService.getWorkoutDetail(workoutId);
    if (!detail) {
      return;
    }
    this.currentWorkout = detail;
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
    this.manualExerciseName = exercise.name;
    await this.addExercise();
    this.showExerciseListModal = false;
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
    await this.loadDetail(this.currentWorkout.id);
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

  previousLabel(exercise: WorkoutExerciseRecord, setIndex: number): string {
    const prev = exercise.previous_sets?.[setIndex];
    if (!prev) {
      return '-';
    }
    const weight = prev.weight ?? '-';
    const reps = prev.done_reps ?? '-';
    return `${weight} x ${reps}`;
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
}
