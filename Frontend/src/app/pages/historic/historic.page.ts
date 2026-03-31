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
            <article class="item" [class.expanded]="expandedId === record.id">
              <button type="button" class="row" (click)="toggleExpand(record.id)">
                <strong>{{ record.workout_name }}</strong>
                <small>{{ record.created_at.slice(0, 10) }}</small>
              </button>

              @if (expandedId === record.id) {
                @if (detailLoadingId === record.id) {
                  <small class="muted detail-loading">Cargando ejercicios...</small>
                } @else if (detailFor(record.id)) {
                  <div class="detail">
                    <div class="exercises">
                      @for (ex of sortedExercises(detailFor(record.id)!); track ex.id) {
                        <div class="exercise-block">
                          <div class="exercise-name">{{ ex.name }}</div>
                          @if (ex.sets.length === 0) {
                            <small class="muted">Sin series registradas</small>
                          } @else {
                            <div class="sets-grid header">
                              <span>#</span>
                              <span>KG</span>
                              <span>REPS</span>
                            </div>
                            @for (set of sortedSets(ex.sets); track set.id; let i = $index) {
                              <div class="sets-grid">
                                <span>{{ i + 1 }}</span>
                                <span>{{ formatWeight(set) }}</span>
                                <span>{{ set.done_reps ?? 0 }}</span>
                              </div>
                              @if (set.comment) {
                                <small class="set-comment">{{ set.comment }}</small>
                              }
                            }
                          }
                        </div>
                      }
                    </div>
                  </div>
                } @else if (detailCache[record.id] === null) {
                  <small class="muted detail-loading">No se pudo cargar el detalle de esta rutina.</small>
                }

                <div class="actions">
                  <label>
                    Nombre rutina
                    <input [(ngModel)]="nameDrafts[record.id]" />
                  </label>
                  <div class="buttons">
                    <button type="button" class="save" (click)="saveName(record.id)">Guardar</button>
                    <button type="button" class="danger" (click)="deleteRecord(record.id)">Eliminar</button>
                  </div>
                </div>
              }
            </article>
          }
        </div>
      }
    </section>
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

    .item.expanded {
      border-color: #111;
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

    .detail-loading {
      padding: 0 0.35rem;
    }

    .detail {
      padding: 0 0.35rem;
    }

    .exercises {
      display: grid;
      gap: 0.65rem;
      margin-bottom: 0.55rem;
    }

    .exercise-block {
      border: 1px solid #f3f4f6;
      border-radius: 8px;
      padding: 0.5rem 0.55rem;
      background: #fafafa;
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
      gap: 0.35rem;
      align-items: center;
      font-size: 0.78rem;
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

    .set-comment {
      display: block;
      margin: 0.2rem 0 0 0;
      color: #6b7280;
      font-size: 0.72rem;
      text-align: left;
    }

    .actions {
      display: grid;
      gap: 0.45rem;
      padding: 0.1rem 0.35rem 0.35rem;
    }

    .actions label {
      display: grid;
      gap: 0.25rem;
      color: #6b7280;
      font-size: 0.76rem;
    }

    .actions input {
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
      color: #6b7280;
      font-size: 0.84rem;
    }
  `]
})
export class HistoricPage implements OnInit {
  constructor(readonly workoutRecordService: WorkoutRecordService) {}
  expandedId = '';
  nameDrafts: Record<string, string> = {};
  detailCache: Record<string, WorkoutRecordDetail | null> = {};
  detailLoadingId = '';

  async ngOnInit(): Promise<void> {
    await this.workoutRecordService.loadRecords();
    this.syncDrafts();
  }

  detailFor(recordId: string): WorkoutRecordDetail | null {
    const d = this.detailCache[recordId];
    return d ?? null;
  }

  async toggleExpand(recordId: string): Promise<void> {
    if (this.expandedId === recordId) {
      this.expandedId = '';
      return;
    }
    this.expandedId = recordId;
    this.syncDrafts();
    if (this.detailCache[recordId] === undefined) {
      this.detailLoadingId = recordId;
      const detail = await this.workoutRecordService.getWorkoutDetailQuiet(recordId);
      this.detailCache[recordId] = detail;
      this.detailLoadingId = '';
    }
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

  async saveName(recordId: string): Promise<void> {
    const draft = (this.nameDrafts[recordId] || '').trim();
    if (!draft) {
      return;
    }
    const ok = await this.workoutRecordService.updateWorkoutName(recordId, draft);
    if (ok) {
      this.expandedId = '';
      this.syncDrafts();
      delete this.detailCache[recordId];
    }
  }

  async deleteRecord(recordId: string): Promise<void> {
    const ok = await this.workoutRecordService.deleteWorkout(recordId);
    if (ok) {
      if (this.expandedId === recordId) {
        this.expandedId = '';
      }
      delete this.detailCache[recordId];
    }
  }

  private syncDrafts(): void {
    for (const item of this.workoutRecordService.records()) {
      this.nameDrafts[item.id] = item.workout_name;
    }
  }
}
