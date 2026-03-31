import { CommonModule } from '@angular/common';
import { Component, OnInit, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { WorkoutRecordService } from '../../services/workout-record.service';

@Component({
  selector: 'app-workouts-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="workout-start">
      <div class="hero">
        <h2>New Workout</h2>
        <p>Configura tu entrenamiento en 20 segundos.</p>
      </div>

      @if (!hasAnyWorkout()) {
        <div class="empty">
          <strong>No hay entrenamientos registrados.</strong>
          <p>Empieza tu primer entrenamiento ahora.</p>
          <button type="button" (click)="prepareFirstWorkout()">Empezar ahora</button>
        </div>
      }

      <div class="builder">
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

    .builder {
      border: 1px solid #ececec;
      border-radius: 14px;
      background: #fff;
      padding: 1rem;
      display: grid;
      gap: 0.85rem;
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
  `]
})
export class WorkoutsPage implements OnInit {
  constructor(readonly workoutRecordService: WorkoutRecordService) {}

  workoutName = '';
  routineOptions = ['Pecho', 'Espalda', 'Pierna', 'Biceps', 'Triceps', 'Hombro', 'Core', 'Cardio'];
  selectedRoutines: string[] = [];
  readonly hasAnyWorkout = computed(() => this.workoutRecordService.records().length > 0);

  async ngOnInit(): Promise<void> {
    await this.workoutRecordService.loadRecords();
  }

  prepareFirstWorkout(): void {
    if (!this.workoutName) {
      this.workoutName = 'Primer entrenamiento';
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

  private async createWorkout(): Promise<void> {
    const created = await this.workoutRecordService.createWorkout(this.workoutName.trim(), this.selectedRoutines);
    if (!created) {
      return;
    }
    this.workoutName = '';
    this.selectedRoutines = [];
  }
}
