import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ExerciseSetRecord, WorkoutExerciseRecord, WorkoutRecordDetail } from '../../models/workout-record.model';
import { WorkoutRecordService } from '../../services/workout-record.service';

@Component({
  selector: 'app-historic-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="historic">
      <h2>Historic</h2>
      <p>Todas las rutinas realizadas.</p>

      @if (workoutRecordService.loading()) {
        <small class="muted">Cargando historial...</small>
      } @else if (workoutRecordService.records().length === 0) {
        <small class="muted">Aun no hay entrenamientos guardados.</small>
      } @else {
        <div class="list">
          @for (record of workoutRecordService.records(); track record.id) {
            <article class="item">
              <button type="button" class="row" (click)="openRecord(record.id)">
                <strong>{{ record.workout_name }}</strong>
                <small>{{ record.created_at.slice(0, 10) }}</small>
              </button>
            </article>
          }
        </div>
      }
    </section>

    @if (showModal) {
      <div class="modal-backdrop" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          @if (detailLoadingId === selectedRecordId) {
            <small class="muted">Cargando detalle...</small>
          } @else if (selectedDetail) {
            <div class="modal-head">
              @if (isEditingWorkoutName) {
                <input class="title-input" [(ngModel)]="editingWorkoutName" />
              } @else {
                <h3>{{ selectedDetail.workout_name }}</h3>
              }
              <button type="button" class="edit-title-btn" (click)="toggleEditWorkoutName()" aria-label="Editar nombre">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 20h9"/>
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                </svg>
              </button>
            </div>

            <div class="exercises">
                      @for (ex of sortedExercises(selectedDetail); track ex.id) {
                        <div class="exercise-block">
                          <div class="exercise-name">{{ ex.name }}</div>
                  @if (ex.sets.length === 0) {
                    <small class="muted">Sin series</small>
                  } @else {
                    <div class="sets-grid header">
                      <span>#</span>
                      <span>KG</span>
                      <span>REPS</span>
                    </div>
                    @for (set of sortedSets(ex.sets); track set.id; let i = $index) {
                      <div class="sets-grid edit">
                        <span>{{ i + 1 }}</span>
                        <input type="number" [(ngModel)]="setDrafts[set.id].weight" />
                        <input type="number" [(ngModel)]="setDrafts[set.id].reps" />
                      </div>
                    }
                  }
                </div>
              }
            </div>
          } @else {
            <small class="muted">No se pudo cargar el detalle de esta rutina.</small>
          }

          <div class="buttons">
            <button type="button" class="danger" (click)="deleteSelected()">Eliminar</button>
            <button type="button" class="save" (click)="saveSelected()">Guardar cambios</button>
          </div>
          <button type="button" class="close" (click)="closeModal()">Cerrar</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .historic {
      display: grid;
      gap: 0.65rem;
    }

    .historic h2 {
      margin: 0;
      color: #111;
      font-size: 1.2rem;
    }

    .historic p {
      margin: 0;
      color: #6b7280;
      font-size: 0.88rem;
    }

    .list {
      display: grid;
      gap: 0.55rem;
    }

    .item {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      background: #fff;
      padding: 0.35rem 0.45rem;
      display: grid;
      gap: 0.45rem;
    }

    .row {
      border: 0;
      background: transparent;
      width: 100%;
      text-align: left;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.35rem 0.35rem;
      cursor: pointer;
    }

    .item strong {
      color: #111827;
      font-size: 0.9rem;
      font-weight: 600;
    }

    .item small {
      color: #6b7280;
      font-size: 0.78rem;
      white-space: nowrap;
    }

    .exercises {
      display: grid;
      gap: 0.45rem;
      margin-bottom: 0.35rem;
    }

    .exercise-block {
      border: 0;
      border-radius: 0;
      padding: 0.25rem 0;
      background: transparent;
      border-bottom: 1px solid #f3f4f6;
    }

    .exercise-block:last-child {
      border-bottom: 0;
    }

    .exercise-name {
      font-size: 0.84rem;
      font-weight: 600;
      color: #111827;
      margin-bottom: 0.4rem;
    }

    .sets-grid {
      display: grid;
      grid-template-columns: 28px 1fr 1fr;
      gap: 0.3rem;
      align-items: center;
      font-size: 0.76rem;
      color: #374151;
      text-align: center;
    }

    .sets-grid.header {
      color: #9ca3af;
      font-weight: 700;
      font-size: 0.65rem;
      letter-spacing: 0.04em;
      margin-top: 0.25rem;
    }

    .sets-grid span:first-child {
      font-weight: 700;
      color: #111;
    }

    .sets-grid.edit {
      margin-top: 0.1rem;
    }

    .sets-grid.edit input {
      border: 0;
      border-bottom: 1px solid #d1d5db;
      border-radius: 0;
      padding: 0.18rem 0.2rem 0.14rem;
      font: inherit;
      font-size: 0.74rem;
      text-align: center;
      background: transparent;
      min-width: 0;
    }

    label {
      display: grid;
      gap: 0.25rem;
      color: #6b7280;
      font-size: 0.76rem;
    }

    label input {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 0.45rem 0.55rem;
      font: inherit;
      font-size: 0.84rem;
      color: #111827;
      background: #fff;
    }

    .buttons {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }

    .buttons button {
      border-radius: 8px;
      padding: 0.42rem 0.6rem;
      font: inherit;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
    }

    .buttons .save {
      border: 1px solid #111;
      background: #111;
      color: #fff;
    }

    .buttons .danger {
      border: 1px solid #fecaca;
      background: #fff;
      color: #dc2626;
    }

    .muted {
      color: #9ca3af;
      font-size: 0.74rem;
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 120;
      background: rgba(0, 0, 0, 0.28);
      display: grid;
      place-items: center;
      padding: 0.5rem;
    }

    .modal {
      width: 100%;
      max-width: 500px;
      max-height: 90vh;
      overflow-y: auto;
      overflow-x: hidden;
      border-radius: 14px;
      border: 1px solid #e5e7eb;
      background: #fff;
      padding: 0.55rem 0.65rem;
      display: grid;
      gap: 0.45rem;
      box-sizing: border-box;
    }

    .modal h3 {
      margin: 0;
      color: #111827;
      font-size: 1rem;
    }

    .modal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.55rem;
    }

    .edit-title-btn {
      border: 1px solid #e5e7eb;
      background: #fff;
      color: #374151;
      width: 30px;
      height: 30px;
      border-radius: 8px;
      display: grid;
      place-items: center;
      cursor: pointer;
      flex-shrink: 0;
    }

    .title-input {
      width: 100%;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 0.45rem 0.55rem;
      font: inherit;
      font-size: 0.95rem;
      font-weight: 600;
      color: #111827;
      background: #fff;
    }

    .close {
      justify-self: end;
      border: 0;
      background: transparent;
      color: #6b7280;
      cursor: pointer;
    }

    @media (max-width: 480px) {
      .modal-backdrop {
        padding: 0.5rem;
      }

      .modal {
        max-width: 100%;
        max-height: 92vh;
        padding: 0.5rem 0.58rem;
        gap: 0.42rem;
      }

      .exercise-name {
        font-size: 0.79rem;
      }

      .buttons {
        gap: 0.35rem;
      }

      .buttons button {
        padding: 0.36rem 0.52rem;
        font-size: 0.74rem;
      }
    }
  `]
})
export class HistoricPage implements OnInit {
  constructor(readonly workoutRecordService: WorkoutRecordService) {}
  showModal = false;
  selectedRecordId = '';
  selectedDetail: WorkoutRecordDetail | null = null;
  detailLoadingId = '';
  editingWorkoutName = '';
  isEditingWorkoutName = false;
  setDrafts: Record<string, { weight: number | null; reps: number | null; comment: string }> = {};

  async ngOnInit(): Promise<void> {
    await this.workoutRecordService.loadRecords();
  }

  async openRecord(recordId: string): Promise<void> {
    this.showModal = true;
    this.selectedRecordId = recordId;
    this.selectedDetail = null;
    this.editingWorkoutName = '';
    this.setDrafts = {};
    this.detailLoadingId = recordId;
    const detail = await this.workoutRecordService.getWorkoutDetailQuiet(recordId);
    this.selectedDetail = detail;
    this.editingWorkoutName = detail?.workout_name || '';
    this.isEditingWorkoutName = false;
    if (detail) {
      for (const ex of detail.exercises || []) {
        for (const set of ex.sets || []) {
          this.setDrafts[set.id] = {
            weight: set.weight ?? null,
            reps: set.done_reps ?? null,
            comment: set.comment || ''
          };
        }
      }
    }
    this.detailLoadingId = '';
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedRecordId = '';
    this.selectedDetail = null;
    this.isEditingWorkoutName = false;
  }

  toggleEditWorkoutName(): void {
    this.isEditingWorkoutName = !this.isEditingWorkoutName;
  }

  sortedExercises(detail: WorkoutRecordDetail): WorkoutExerciseRecord[] {
    return [...(detail.exercises || [])].sort((a, b) => a.position - b.position);
  }

  sortedSets(sets: ExerciseSetRecord[]): ExerciseSetRecord[] {
    return [...sets].sort((a, b) => a.position - b.position);
  }

  formatWeight(set: ExerciseSetRecord): string {
    const w = set.weight;
    if (w === null || w === undefined) {
      return '-';
    }
    const unit = set.unit === 'lb' ? 'lb' : 'kg';
    return `${w} ${unit}`;
  }

  async saveSelected(): Promise<void> {
    if (!this.selectedDetail || !this.selectedRecordId) {
      return;
    }
    const nameDraft = this.editingWorkoutName.trim();
    if (nameDraft.length > 0) {
      const okName = await this.workoutRecordService.updateWorkoutName(this.selectedRecordId, nameDraft);
      if (!okName) {
        return;
      }
    }

    for (const ex of this.selectedDetail.exercises || []) {
      for (const set of ex.sets || []) {
        const draft = this.setDrafts[set.id];
        if (!draft) {
          continue;
        }
        const changed =
          (set.weight ?? null) !== (draft.weight ?? null) ||
          (set.done_reps ?? null) !== (draft.reps ?? null) ||
          (set.comment || '') !== (draft.comment || '');
        if (!changed) {
          continue;
        }
        const okSet = await this.workoutRecordService.updateSet(this.selectedRecordId, ex.id, set.id, {
          weight: draft.weight,
          done_reps: draft.reps,
          comment: draft.comment
        });
        if (!okSet) {
          return;
        }
      }
    }
    await this.workoutRecordService.loadRecords();
    await this.openRecord(this.selectedRecordId);
  }

  async deleteSelected(): Promise<void> {
    if (!this.selectedRecordId) {
      return;
    }
    const ok = await this.workoutRecordService.deleteWorkout(this.selectedRecordId);
    if (!ok) {
      return;
    }
    await this.workoutRecordService.loadRecords();
    this.closeModal();
  }
}
