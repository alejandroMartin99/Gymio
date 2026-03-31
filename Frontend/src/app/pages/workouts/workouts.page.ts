import { CommonModule } from '@angular/common';
import { Component, OnInit, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { resolveExerciseIcon } from '../../core/exercise-icons';
import { ExerciseCatalogItem } from '../../models/exercise-catalog.model';
import { WorkoutRecordDetail } from '../../models/workout-record.model';
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

      @if (!hasAnyWorkout()) {
        <div class="empty">
          <strong>No hay entrenamientos registrados.</strong>
          <p>Empieza ahora creando una sesion nueva.</p>
          <div class="action-row">
            <button type="button" (click)="openNewSessionModal()">Nueva sesion</button>
          </div>
        </div>
      } @else {
        <div class="empty">
          <strong>Ya tienes entrenamientos guardados.</strong>
          <div class="action-row">
            <button type="button" (click)="openReplicateModal()" [disabled]="workoutRecordService.loading()">
              Replicar entrenamiento
            </button>
            <button type="button" class="secondary" (click)="openNewSessionModal()">
              Nueva sesion
            </button>
          </div>
        </div>
      }

      @if (currentWorkout) {
        <div class="builder">
          <h3>2) Entrenamiento en curso: {{ currentWorkout.workout_name }}</h3>
          <button type="button" class="primary" (click)="openExerciseGroupModal()" [disabled]="workoutRecordService.loading()">
            + Seleccionar ejercicio
          </button>

          @for (exercise of currentWorkout.exercises; track exercise.id) {
            <div class="exercise-card">
              <strong>{{ exercise.name }}</strong>
              <small>{{ exercise.muscle_group || 'Sin grupo' }} · {{ exercise.sets.length }} series</small>

              <div class="set-form">
                <input type="number" [(ngModel)]="setInputs[exercise.id].reps" placeholder="Reps" />
                <input type="number" [(ngModel)]="setInputs[exercise.id].weight" placeholder="Peso kg" />
                <input [(ngModel)]="setInputs[exercise.id].comment" placeholder="Comentario" />
                <button type="button" (click)="addSet(exercise.id)">Agregar serie</button>
              </div>

              @if (exercise.sets.length > 0) {
                <div class="set-hint">
                  Ultima serie: {{ exercise.sets[exercise.sets.length - 1].done_reps || '-' }} reps ·
                  {{ exercise.sets[exercise.sets.length - 1].weight || '-' }} kg
                </div>
              }
            </div>
          }
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
                  <img [src]="exerciseIcon(exercise)" [alt]="exercise.name" />
                  <span>{{ exercise.name }}</span>
                </button>
              }
            </div>
            @if (exerciseCatalogService.items().length === 0 && !exerciseCatalogService.loading()) {
              <small class="note">No hay ejercicios en este grupo todavia. Puedes agregar uno manual.</small>
            }

            <button type="button" class="toggle-manual" (click)="manualMode = !manualMode">
              {{ manualMode ? 'Ocultar manual' : 'No aparece en lista? agregar manual' }}
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

            <button type="button" class="close" (click)="closeExerciseListModal()">Cerrar</button>
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
      justify-self: start;
      border: 1px solid #111;
      border-radius: 10px;
      background: #111;
      color: #fff;
      padding: 0.55rem 0.9rem;
      font-weight: 600;
      cursor: pointer;
    }

    .action-row {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
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

    .set-form {
      display: grid;
      gap: 0.5rem;
      grid-template-columns: 1fr 1fr;
    }

    .set-form input:last-of-type {
      grid-column: 1 / -1;
    }

    .set-form button {
      grid-column: 1 / -1;
      border: 1px solid #111;
      background: #fff;
      border-radius: 10px;
      padding: 0.6rem;
      font-weight: 600;
      cursor: pointer;
    }

    .set-hint {
      font-size: 0.75rem;
      color: #6b7280;
      border-top: 1px dashed #e5e7eb;
      padding-top: 0.4rem;
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
      gap: 0.6rem;
    }

    .exercise-option img {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: 1px solid #ececec;
      object-fit: cover;
    }

    .exercise-option span {
      font-weight: 600;
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
  `]
})
export class WorkoutsPage implements OnInit {
  constructor(
    readonly workoutRecordService: WorkoutRecordService,
    readonly exerciseCatalogService: ExerciseCatalogService
  ) {}

  workoutName = '';
  currentWorkout: WorkoutRecordDetail | null = null;
  showReplicateModal = false;
  showNewSessionModal = false;
  showExerciseGroupModal = false;
  showExerciseListModal = false;
  selectedMuscleGroup = '';
  manualMode = false;
  manualExerciseName = '';
  setInputs: Record<string, { reps?: number; weight?: number; comment?: string }> = {};
  routineOptions = ['Pecho', 'Espalda', 'Pierna', 'Biceps', 'Triceps', 'Hombro', 'Core', 'Cardio'];
  selectedRoutines: string[] = [];
  readonly hasAnyWorkout = computed(() => this.workoutRecordService.records().length > 0);

  async ngOnInit(): Promise<void> {
    await this.workoutRecordService.loadRecords();
    await this.exerciseCatalogService.loadGroups();
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
    const targetGroup = this.resolveGroupToCatalog(group);
    this.selectedMuscleGroup = targetGroup;
    await this.exerciseCatalogService.loadByGroup(targetGroup);
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

  exerciseIcon(item: ExerciseCatalogItem): string {
    return resolveExerciseIcon(item.icon_key, item.muscle_group, item.icon_url);
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
