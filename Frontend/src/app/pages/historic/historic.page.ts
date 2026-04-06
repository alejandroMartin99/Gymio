import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ExerciseSetRecord,
  WorkoutExerciseRecord,
  WorkoutRecord,
  WorkoutRecordDetail
} from '../../models/workout-record.model';
import { WorkoutRecordService } from '../../services/workout-record.service';

interface CalendarCell {
  day: number;
  dateKey: string;
  inMonth: boolean;
  isToday: boolean;
  hasWorkout: boolean;
  /** Nombre corto de la rutina (primer entreno del día) */
  workoutShortLabel: string;
  workoutColorName: string;
}

@Component({
  selector: 'app-historic-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="historic">
      <h2>Historic</h2>
      <p class="sub">Calendario de entrenos.</p>

      @if (workoutRecordService.loading()) {
        <small class="muted">Cargando historial…</small>
      } @else if (workoutRecordService.records().length === 0) {
        <small class="muted">Aún no hay entrenamientos guardados.</small>
      } @else {
        @if (routineNamesThisMonth().length > 0) {
          <div class="routine-legend">
            <span class="routine-legend-title">Rutinas este mes</span>
            <div class="routine-legend-chips">
              @for (name of routineNamesThisMonth(); track name) {
                <span class="routine-chip" [ngStyle]="routineChipStyle(name)">
                  <span class="routine-chip-dot" [ngStyle]="routineDotStyle(name)"></span>
                  <span>{{ name }}</span>
                </span>
              }
            </div>
          </div>
        }

        <div class="calendar-wrap">
          <div class="cal-nav">
            <button type="button" class="cal-nav-btn" (click)="prevMonth()" aria-label="Mes anterior">‹</button>
            <span class="cal-title">{{ monthTitle() }}</span>
            <button type="button" class="cal-nav-btn" (click)="nextMonth()" aria-label="Mes siguiente">›</button>
          </div>
          <div class="cal-weekdays">
            @for (w of weekLabels; track w) {
              <span>{{ w }}</span>
            }
          </div>
          <div class="cal-grid" role="grid" aria-label="Entrenamientos por día">
            @for (cell of calendarCells(); track cell.dateKey + '-' + cell.inMonth + '-' + cell.day) {
              <button
                type="button"
                class="cal-day"
                [class.off-month]="!cell.inMonth"
                [class.today]="cell.isToday"
                [class.has-workout]="cell.hasWorkout"
                [ngStyle]="cell.hasWorkout ? calendarDayStyle(cell) : null"
                [disabled]="!cell.hasWorkout"
                (click)="onCalendarDay(cell)"
                [attr.aria-label]="
                  cell.hasWorkout
                    ? 'Ver rutina: ' + (cell.workoutShortLabel || 'entreno') + ' (' + cell.dateKey + ')'
                    : 'Sin entreno'
                "
              >
                <span class="cal-num">{{ cell.day }}</span>
                @if (cell.hasWorkout) {
                  <span class="cal-marker" aria-hidden="true"></span>
                  @if (cell.workoutShortLabel) {
                    <span class="cal-routine">{{ cell.workoutShortLabel }}</span>
                  }
                }
              </button>
            }
          </div>
        </div>
      }
    </section>

    @if (showModal) {
      <div class="modal-backdrop" (click)="closeModal()">
        <div class="modal day-modal" (click)="$event.stopPropagation()">
          <div class="day-modal-head">
            <div class="day-modal-head-copy">
              <h3>Entrenamiento del día</h3>
              @if (selectedDayDateLabel()) {
                <small class="muted">{{ selectedDayDateLabel() }}</small>
              }
            </div>
            <button type="button" class="close x" (click)="closeModal()">✕</button>
          </div>

          @if (dayRecords.length > 1) {
            <div class="day-session-pills">
              @for (record of dayRecords; track record.id) {
                <button
                  type="button"
                  class="day-session-pill"
                  [class.active]="record.id === selectedRecordId"
                  [ngStyle]="routineChipStyle(record.workout_name)"
                  (click)="openRecord(record.id)"
                >
                  {{ record.workout_name }}
                </button>
              }
            </div>
          }

          @if (detailLoadingId === selectedRecordId) {
            <small class="muted">Cargando detalle…</small>
          } @else if (selectedDetail) {
            <div class="modal-head">
              <div class="modal-head-title">
                @if (isEditingWorkoutName) {
                  <input class="title-input" [(ngModel)]="editingWorkoutName" />
                } @else {
                  <h4>{{ selectedDetail.workout_name }}</h4>
                }
              </div>
              <button type="button" class="edit-title-btn" (click)="toggleEditWorkoutName()" aria-label="Editar nombre">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
            </div>
            <div class="day-summary">
              <div class="summary-pill">
                <span class="summary-label">Ejercicios</span>
                <strong>{{ selectedExercisesCount(selectedDetail) }}</strong>
              </div>
              <div class="summary-pill">
                <span class="summary-label">Series</span>
                <strong>{{ selectedSetsCount(selectedDetail) }}</strong>
              </div>
            </div>
            <div class="exercises">
              @for (ex of sortedExercises(selectedDetail); track ex.id) {
                <div class="exercise-block">
                  <div class="exercise-head-row">
                    <div class="exercise-name">{{ ex.name }}</div>
                    <span class="exercise-table-icon" aria-hidden="true">
                      <img src="/icons/chart-line.svg" alt="" />
                    </span>
                  </div>
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

    .sub {
      margin: 0;
      color: #6b7280;
      font-size: 0.88rem;
    }

    .routine-legend {
      display: grid;
      gap: 0.35rem;
    }

    .routine-legend-title {
      font-size: 0.72rem;
      font-weight: 600;
      color: #6b7280;
      letter-spacing: 0.02em;
    }

    .routine-legend-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    .routine-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.72rem;
      color: #111827;
      background: #f9fafb;
      border: 1px solid #f3f4f6;
      border-radius: 999px;
      padding: 0.2rem 0.55rem;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .routine-chip-dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      flex-shrink: 0;
      background: #9ca3af;
    }

    .calendar-wrap {
      display: grid;
      gap: 0.45rem;
      margin-bottom: 0.25rem;
      padding: 0.35rem 0;
    }

    .cal-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .cal-nav-btn {
      border: 1px solid #e5e7eb;
      background: #fff;
      color: #111827;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      font-size: 1.15rem;
      line-height: 1;
      cursor: pointer;
    }

    .cal-title {
      font-size: 0.92rem;
      font-weight: 600;
      color: #111827;
      text-transform: capitalize;
    }

    .cal-weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.2rem;
      text-align: center;
      font-size: 0.65rem;
      font-weight: 600;
      color: #9ca3af;
      letter-spacing: 0.02em;
    }

    .cal-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.28rem;
    }

    .cal-day {
      position: relative;
      min-height: 48px;
      border: 1px solid #f3f4f6;
      border-radius: 10px;
      background: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 0.25rem 0.12rem 0.2rem;
      cursor: default;
      font: inherit;
    }

    .cal-day.off-month .cal-num {
      color: #d1d5db;
    }

    .cal-day.off-month .cal-routine {
      color: #d1d5db;
    }

    .cal-day.today {
      border-color: #111827;
    }

    .cal-day.has-workout:not(:disabled) {
      cursor: pointer;
      border-color: color-mix(in srgb, var(--day-color, #c4b5fd) 40%, #ffffff 60%);
      background: color-mix(in srgb, var(--day-color, #c4b5fd) 18%, #ffffff 82%);
    }

    .cal-day.has-workout:not(:disabled):active {
      background: #fafafa;
    }

    .cal-day:disabled {
      opacity: 1;
    }

    .cal-day:disabled:not(.has-workout) {
      opacity: 0.55;
    }

    .cal-num {
      font-size: 0.78rem;
      font-weight: 600;
      color: #374151;
      line-height: 1.2;
    }

    .cal-marker {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--day-color, #111827);
      margin-top: 0.2rem;
      flex-shrink: 0;
    }

    .cal-routine {
      margin-top: 0.15rem;
      font-size: 0.55rem;
      font-weight: 500;
      color: #6b7280;
      line-height: 1.15;
      text-align: center;
      max-width: 100%;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      word-break: break-word;
    }

    .muted {
      color: #9ca3af;
      font-size: 0.74rem;
    }

    .exercises {
      display: grid;
      gap: 0.55rem;
      margin: 0.15rem 0 0.1rem;
      max-height: min(48vh, 420px);
      overflow: auto;
      padding-right: 0.12rem;
    }

    .exercise-block {
      border: 1px solid #eef2f7;
      border-radius: 12px;
      padding: 0.55rem 0.55rem 0.5rem;
      background: linear-gradient(180deg, #ffffff 0%, #fafcff 100%);
      box-shadow: 0 1px 2px rgba(17, 24, 39, 0.04);
    }

    .exercise-name {
      font-size: 0.82rem;
      font-weight: 700;
      color: #111827;
      margin-bottom: 0.34rem;
    }

    .exercise-head-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.45rem;
      margin-bottom: 0.2rem;
    }

    .exercise-table-icon {
      width: 24px;
      height: 24px;
      border: 1px solid #dde6f0;
      border-radius: 8px;
      display: grid;
      place-items: center;
      background: #ffffff;
      flex-shrink: 0;
    }

    .exercise-table-icon img {
      width: 13px;
      height: 13px;
      opacity: 0.75;
    }

    .sets-grid {
      display: grid;
      grid-template-columns: 22px minmax(0, 74px) minmax(0, 74px);
      gap: 0.35rem;
      align-items: center;
      font-size: 0.74rem;
      color: #374151;
      justify-content: start;
      text-align: center;
    }

    .sets-grid.header {
      color: #8b95a7;
      font-weight: 700;
      font-size: 0.62rem;
      letter-spacing: 0.04em;
      margin-top: 0.1rem;
      margin-bottom: 0.1rem;
    }

    .sets-grid span:first-child {
      font-weight: 700;
      color: #111;
    }

    .sets-grid.edit {
      margin-top: 0.1rem;
    }

    .sets-grid.edit input {
      border: 1px solid #d9e2ec;
      border-radius: 8px;
      padding: 0.22rem 0.22rem;
      font: inherit;
      font-size: 0.74rem;
      text-align: center;
      background: #fff;
      min-width: 0;
    }

    .buttons {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      border-top: 1px solid #eef2f7;
      padding-top: 0.55rem;
      margin-top: 0.25rem;
      position: sticky;
      bottom: 0;
      background: #fff;
    }

    .buttons button {
      border-radius: 10px;
      padding: 0.48rem 0.72rem;
      font: inherit;
      font-size: 0.76rem;
      font-weight: 700;
      cursor: pointer;
    }

    .buttons .save {
      border: 1px solid #111827;
      background: linear-gradient(180deg, #111827 0%, #0f172a 100%);
      color: #fff;
      margin-left: auto;
      min-width: 128px;
    }

    .buttons .danger {
      border: 1px solid #fda4af;
      background: #fff5f6;
      color: #dc2626;
      min-width: 92px;
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 120;
      background: rgba(0, 0, 0, 0.28);
      display: grid;
      place-items: center;
      padding: 0.5rem 0.5rem calc(var(--nav-height, 58px) + env(safe-area-inset-bottom, 0px) + 0.5rem);
    }

    .modal {
      width: 100%;
      max-width: 500px;
      max-height: calc(100vh - var(--nav-height, 58px) - env(safe-area-inset-bottom, 0px) - 1.4rem);
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

    .day-modal {
      gap: 0.62rem;
      padding: 0.75rem 0.75rem 0.55rem;
      border-radius: 18px;
      border: 1px solid #e8edf4;
      box-shadow: 0 14px 42px rgba(15, 23, 42, 0.2);
    }

    .day-modal-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.05rem 0.05rem 0.55rem;
      border-bottom: 1px solid #eef2f7;
    }

    .day-modal-head-copy h3 {
      margin: 0;
      font-size: 1.05rem;
      letter-spacing: -0.01em;
      color: #0f172a;
    }

    .day-session-pills {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
      margin-top: -0.05rem;
    }

    .day-session-pill {
      border: 1px solid #dbe3ec;
      background: #fff;
      color: #111827;
      border-radius: 999px;
      padding: 0.32rem 0.66rem;
      font-size: 0.72rem;
      font-weight: 600;
      cursor: pointer;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .day-session-pill.active {
      border-color: #94a3b8;
      box-shadow: inset 0 0 0 1px rgba(51, 65, 85, 0.14);
    }

    .modal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.55rem;
      padding: 0.18rem 0.12rem;
      border: 1px solid #e9eff6;
      border-radius: 12px;
      background: linear-gradient(180deg, #fbfdff 0%, #f6f9fc 100%);
    }

    .modal-head-title {
      min-width: 0;
      flex: 1;
    }

    .modal-head-title h4 {
      margin: 0;
      font-size: 0.95rem;
      color: #0f172a;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .day-summary {
      display: flex;
      gap: 0.45rem;
      margin-top: -0.1rem;
    }

    .summary-pill {
      flex: 1;
      border: 1px solid #e6edf6;
      border-radius: 10px;
      background: #f8fbff;
      padding: 0.35rem 0.5rem;
      display: grid;
      gap: 0.05rem;
      text-align: center;
    }

    .summary-label {
      font-size: 0.64rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #7b8798;
      font-weight: 700;
    }

    .summary-pill strong {
      font-size: 0.92rem;
      color: #0f172a;
    }

    .edit-title-btn {
      border: 1px solid #dbe3ec;
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
      border: 1px solid #dbe3ec;
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
      font-size: 0.8rem;
    }

    .close.x {
      border: 1px solid #dbe3ec;
      border-radius: 9px;
      width: 30px;
      height: 30px;
      font-size: 0.9rem;
      display: grid;
      place-items: center;
      color: #6b7280;
      background: #fff;
      padding: 0;
      flex-shrink: 0;
    }

    @media (max-width: 480px) {
      .modal-backdrop {
        padding: 0.5rem;
      }

      .modal {
        max-width: 100%;
        max-height: calc(100vh - var(--nav-height, 58px) - env(safe-area-inset-bottom, 0px) - 1rem);
        padding: 0.5rem 0.58rem;
        gap: 0.42rem;
      }

      .day-modal {
        padding: 0.58rem 0.58rem 0.5rem;
      }

      .exercise-name {
        font-size: 0.79rem;
      }

      .exercise-table-icon {
        width: 22px;
        height: 22px;
      }

      .exercise-table-icon img {
        width: 12px;
        height: 12px;
      }

      .sets-grid {
        grid-template-columns: 20px minmax(0, 66px) minmax(0, 66px);
      }

      .buttons {
        gap: 0.35rem;
        padding-top: 0.48rem;
      }

      .buttons button {
        padding: 0.38rem 0.56rem;
        font-size: 0.72rem;
      }
    }
  `]
})
export class HistoricPage implements OnInit {
  constructor(readonly workoutRecordService: WorkoutRecordService) {}

  readonly weekLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  readonly routinePastelPalette = ['#FBCFE8', '#BFDBFE', '#C7F9CC', '#FDE68A', '#DDD6FE', '#FBCFE8', '#A7F3D0', '#FECACA'];

  calendarYear = new Date().getFullYear();
  calendarMonth = new Date().getMonth();

  showModal = false;
  selectedDayKey = '';
  dayRecords: WorkoutRecord[] = [];
  selectedRecordId = '';
  selectedDetail: WorkoutRecordDetail | null = null;
  detailLoadingId = '';
  editingWorkoutName = '';
  isEditingWorkoutName = false;
  setDrafts: Record<string, { weight: number | null; reps: number | null; comment: string }> = {};

  async ngOnInit(): Promise<void> {
    await this.workoutRecordService.loadRecords();
  }

  monthTitle(): string {
    return new Date(this.calendarYear, this.calendarMonth, 1).toLocaleDateString('es', {
      month: 'long',
      year: 'numeric'
    });
  }

  /** Nombres de rutina únicos con al menos un entreno en el mes visible. */
  routineNamesThisMonth(): string[] {
    const y = this.calendarYear;
    const m = this.calendarMonth;
    const start = new Date(y, m, 1).getTime();
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999).getTime();
    const names = new Set<string>();
    for (const r of this.workoutRecordService.records()) {
      const t = new Date(r.created_at).getTime();
      if (t >= start && t <= end) {
        const n = r.workout_name?.trim();
        if (n) {
          names.add(n);
        }
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'es'));
  }

  private workoutShortLabelForDay(records: WorkoutRecord[]): string {
    if (!records.length) {
      return '';
    }
    const [latest] = records;
    let base = (latest.workout_name || 'Rutina').trim();
    if (base.length > 14) {
      base = `${base.slice(0, 13)}…`;
    }
    if (records.length > 1) {
      base += ` +${records.length - 1}`;
    }
    return base;
  }

  private colorByWorkoutName(name: string): string {
    const n = (name || 'Rutina').trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < n.length; i++) {
      hash = (hash << 5) - hash + n.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % this.routinePastelPalette.length;
    return this.routinePastelPalette[idx];
  }

  routineChipStyle(name: string): Record<string, string> {
    const c = this.colorByWorkoutName(name);
    return {
      background: `color-mix(in srgb, ${c} 28%, #ffffff 72%)`,
      borderColor: `color-mix(in srgb, ${c} 50%, #e5e7eb 50%)`
    };
  }

  routineDotStyle(name: string): Record<string, string> {
    return { background: this.colorByWorkoutName(name) };
  }

  calendarDayStyle(cell: CalendarCell): Record<string, string> {
    const baseName = cell.workoutColorName || cell.workoutShortLabel;
    return { '--day-color': this.colorByWorkoutName(baseName) };
  }

  selectedDayDateLabel(): string {
    if (!this.selectedDayKey) {
      return '';
    }
    const [y, m, d] = this.selectedDayKey.split('-').map((v) => Number(v));
    return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('es', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  prevMonth(): void {
    if (this.calendarMonth === 0) {
      this.calendarMonth = 11;
      this.calendarYear -= 1;
    } else {
      this.calendarMonth -= 1;
    }
  }

  nextMonth(): void {
    if (this.calendarMonth === 11) {
      this.calendarMonth = 0;
      this.calendarYear += 1;
    } else {
      this.calendarMonth += 1;
    }
  }

  private dateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private toLocalDateKey(iso: string): string {
    return this.dateKey(new Date(iso));
  }

  private trainingMap(): Map<string, WorkoutRecord[]> {
    const map = new Map<string, WorkoutRecord[]>();
    for (const r of this.workoutRecordService.records()) {
      const key = this.toLocalDateKey(r.created_at);
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return map;
  }

  calendarCells(): CalendarCell[] {
    const y = this.calendarYear;
    const m = this.calendarMonth;
    const map = this.trainingMap();
    const first = new Date(y, m, 1);
    const startPad = (first.getDay() + 6) % 7;
    const dim = new Date(y, m + 1, 0).getDate();
    const today = new Date();
    const todayKey = this.dateKey(today);
    const cells: CalendarCell[] = [];

    const pushCell = (d: Date, inMonth: boolean): void => {
      const dk = this.dateKey(d);
      const list = map.get(dk);
      const has = (list?.length ?? 0) > 0;
      cells.push({
        day: d.getDate(),
        dateKey: dk,
        inMonth,
        isToday: dk === todayKey,
        hasWorkout: has,
        workoutShortLabel: has && list ? this.workoutShortLabelForDay(list) : '',
        workoutColorName: has && list ? (list[0].workout_name || '') : ''
      });
    };

    for (let i = 0; i < startPad; i++) {
      pushCell(new Date(y, m, 1 - startPad + i), false);
    }
    for (let day = 1; day <= dim; day++) {
      pushCell(new Date(y, m, day), true);
    }
    let next = 1;
    while (cells.length % 7 !== 0) {
      pushCell(new Date(y, m + 1, next++), false);
    }
    return cells;
  }

  async onCalendarDay(cell: CalendarCell): Promise<void> {
    if (!cell.hasWorkout) {
      return;
    }
    const list = this.trainingMap().get(cell.dateKey) ?? [];
    this.selectedDayKey = cell.dateKey;
    this.dayRecords = list;
    this.showModal = true;
    const first = list?.[0];
    if (first) {
      await this.openRecord(first.id);
    }
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
    this.selectedDayKey = '';
    this.dayRecords = [];
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

  selectedExercisesCount(detail: WorkoutRecordDetail): number {
    return detail.exercises?.length ?? 0;
  }

  selectedSetsCount(detail: WorkoutRecordDetail): number {
    return (detail.exercises || []).reduce((acc, ex) => acc + (ex.sets?.length || 0), 0);
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
    if (this.selectedDayKey) {
      this.dayRecords = this.trainingMap().get(this.selectedDayKey) ?? [];
    }
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
    if (!this.selectedDayKey) {
      this.closeModal();
      return;
    }
    const stillInDay = this.trainingMap().get(this.selectedDayKey) ?? [];
    this.dayRecords = stillInDay;
    if (stillInDay.length === 0) {
      this.closeModal();
      return;
    }
    await this.openRecord(stillInDay[0].id);
  }
}
