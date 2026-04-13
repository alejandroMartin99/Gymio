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
import { WorkoutExerciseRecord, WorkoutRecordDetail } from '../../models/workout-record.model';
import { ActiveWorkoutService } from '../../services/active-workout.service';
import { ExerciseCatalogService } from '../../services/exercise-catalog.service';
import { ExerciseDbMediaService } from '../../services/exercise-db-media.service';
import { WorkoutRecordService } from '../../services/workout-record.service';

interface PendingSetDraft {
  local_id: string;
  set_type: string;
  done_reps?: number;
  weight?: number;
  comment?: string;
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
              <button type="button" (click)="openReplicateModal()" [disabled]="replicateModalRecords().length === 0">
                Repetir rutina
              </button>
              <button type="button" class="secondary" (click)="openNewSessionModal()">
                Nueva rutina
              </button>
            </div>
          }
          </div>

        @if (!workoutRecordService.loading()) {
          <div class="templates-zone">
            <div class="templates-head">
              <h3>Workout Templates</h3>
              <small>Rutinas completas y listas para empezar.</small>
            </div>

            <div class="template-filter-group">
              <span class="filter-label">Días / semana</span>
              <div class="template-filter-row">
                @for (f of templateDaysFilters; track f.key) {
                  <button
                    type="button"
                    class="template-chip"
                    [class.active]="selectedTemplateDaysFilter === f.key"
                    (click)="selectedTemplateDaysFilter = f.key"
                  >{{ f.label }}</button>
                }
              </div>
            </div>
            <div class="template-filter-group">
              <span class="filter-label">Equipamiento</span>
              <div class="template-filter-row">
                @for (f of templateEquipmentFilters; track f.key) {
                  <button
                    type="button"
                    class="template-chip"
                    [class.active]="selectedTemplateEquipmentFilter === f.key"
                    (click)="selectedTemplateEquipmentFilter = f.key"
                  >{{ f.label }}</button>
                }
              </div>
            </div>

            <div class="template-grid">
              @for (tpl of filteredTemplates(); track tpl.id) {
                <article class="template-card">
                  <div class="template-content">
                    <strong>{{ tpl.title }}</strong>
                    <small>{{ tpl.subtitle }}</small>
                    <div class="template-badges">
                      <span>{{ templateDaysLabel(tpl.daysFilter) }}</span>
                      <span>{{ templateEquipmentLabel(tpl.equipment) }}</span>
                    </div>
                    <div class="template-gif-strip">
                      @for (ex of tpl.exercises; track $index) {
                        @if (ex.exerciseId) {
                          <img [src]="templateGifUrl(ex.exerciseId)" alt="" />
                        } @else {
                          <div class="gif-placeholder">{{ ex.muscle_group?.[0] ?? '·' }}</div>
                        }
                      }
                    </div>
                    <button
                      type="button"
                      class="template-cta"
                      [disabled]="isCreatingTemplate() || workoutRecordService.loading()"
                      (click)="startWorkoutFromTemplate(tpl)"
                    >
                      @if (activeTemplateId() === tpl.id) {
                        Cargando rutina...
                      } @else {
                        Cargar rutina
                      }
                    </button>
                  </div>
                </article>
              }
            </div>
          </div>
        }
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
                <strong class="exercise-name-block">
                  <span>{{ displayExercisePrimaryName(exercise) }}</span>
                  @if (displayExerciseSecondaryName(exercise); as enName) {
                    <small>{{ enName }}</small>
                  }
                </strong>
                <div class="exercise-head-actions">
                  @if (exerciseDbDetail(exercise)) {
                    <button
                      type="button"
                      class="info-icon-btn"
                      (click)="$event.stopPropagation(); openExerciseInfoModal(exercise)"
                      aria-label="Ver informacion del ejercicio"
                    >
                      <img src="/icons/info-circle.svg" alt="" />
                    </button>
                  }
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
                  <img [src]="workoutExerciseHero(exercise)" [alt]="exercise.name" />
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
                    <option value="bilateral">Bilateral</option>
                    <option value="unilateral">Unilateral</option>
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
          <button
            type="button"
            class="link-btn add-exercise add-exercise-icon"
            (click)="openExerciseGroupModal()"
            aria-label="Agregar ejercicio"
            title="Agregar ejercicio"
          >
            <img src="/icons/plus-circle.svg" alt="" />
          </button>
        </div>
      }

      @if (showReplicateModal) {
        <div class="modal-backdrop" (click)="closeReplicateModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>Selecciona entrenamiento</h3>
            <p>Elige uno para cargar nombre, ejercicios y series.</p>

            <div class="history-list">
              @for (record of replicateModalRecords(); track record.id) {
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

              <button type="button" class="primary" (click)="startWorkout()" [disabled]="!workoutName.trim() || workoutRecordService.loading()">
                + Iniciar entrenamiento
              </button>

              @if (workoutRecordService.error(); as error) {
                <small class="note error">{{ error }}</small>
              }
            </div>

            <button type="button" class="close" (click)="closeNewSessionModal()">Cerrar</button>
          </div>
        </div>
      }

      @if (showExerciseListModal) {
        <div class="modal-backdrop" (click)="closeExerciseListModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>Agregar ejercicio</h3>

            <div class="group-slider">
              @for (group of muscleGroupSlides; track group.key) {
                <button
                  type="button"
                  class="group-slide"
                  [class.active]="activeMuscleGroup === group.key"
                  (click)="selectMuscleGroupSlide(group.key)"
                >
                  <img [src]="group.image" [alt]="group.label" />
                  <span>{{ group.label }}</span>
                </button>
              }
            </div>

            <div class="catalog-search-row">
              <input
                type="search"
                [ngModel]="catalogSearchQuery"
                (ngModelChange)="onCatalogSearchInputChange($event)"
                placeholder="Buscar por nombre..."
                (keydown.enter)="runCatalogSearch()"
              />
              <button type="button" class="catalog-search-btn" (click)="runCatalogSearch()">Buscar</button>
            </div>

            <div class="equipment-slider">
              @for (f of equipmentFilters; track f.key) {
                <button
                  type="button"
                  class="equipment-chip"
                  [class.active]="selectedEquipmentFilter === f.key"
                  (click)="setEquipmentFilter(f.key)"
                >
                  {{ f.label }}
                </button>
              }
            </div>

            @if (selectedCatalogThumbs().length > 0) {
              <div class="selected-thumb-block">
                <small>Seleccionados</small>
                <div class="selected-thumb-list">
                  @for (thumb of selectedCatalogThumbs(); track thumb) {
                    <img [src]="thumb" alt="" />
                  }
                </div>
              </div>
            }

            @if (exerciseCatalogService.loading()) {
              <div class="loading-state">
                <span class="spinner" aria-hidden="true"></span>
                <small>Cargando ejercicios...</small>
              </div>
            }

            <div class="history-list exercise-catalog-scroll">
              @for (exercise of filteredCatalogItems(); track exercise.id) {
                <button
                  type="button"
                  class="exercise-option"
                  (click)="pickCatalogExercise(exercise)"
                >
                  <span class="option-thumb-wrap">
                    <img [src]="catalogThumb(exercise)" alt="" class="option-thumb" />
                  </span>
                  <span class="option-text">
                    <span class="option-name">
                      <span>{{ displayCatalogPrimaryName(exercise) }}</span>
                      @if (displayCatalogSecondaryName(exercise); as enName) {
                        <small>{{ enName }}</small>
                      }
                    </span>
                  </span>
                </button>
              }
            </div>
            @if (filteredCatalogItems().length === 0 && !exerciseCatalogService.loading()) {
              <small class="note">No hay ejercicios para este grupo. Prueba con otro.</small>
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
          <div class="modal chart-modal" (click)="$event.stopPropagation()">
            <div class="chart-modal-header">
              <span class="chart-modal-title">Historial - {{ historyExerciseTitle }}</span>
              <button type="button" class="chart-modal-close" (click)="closeHistoryModal()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <p class="history-chart-sub">Máximos por entrenamiento (peso y repeticiones).</p>
            @if (historyPoints.length > 0) {
              <div class="ex-charts">
                <div class="ex-chart-label">Peso máximo (kg)</div>
                <svg class="history-svg history-svg--lg" viewBox="0 0 300 90" preserveAspectRatio="none">
                  @for (g of historyWChart().grid; track $index) {
                    <line [attr.x1]="HC.pl" [attr.y1]="g.y" [attr.x2]="HC.cw - HC.pr" [attr.y2]="g.y"
                      stroke="#e5e7eb" stroke-width="0.6" stroke-dasharray="3,3"/>
                    <text [attr.x]="HC.pl - 3" [attr.y]="g.y + 3" text-anchor="end" font-size="7.5" fill="#9ca3af">{{ g.label }}</text>
                  }
                  @for (xl of historyWChart().xLabels; track $index) {
                    <text [attr.x]="xl.x" [attr.y]="HC.ch - 1" text-anchor="middle" font-size="7" fill="#9ca3af">{{ xl.label }}</text>
                  }
                  <path [attr.d]="historyWChart().path" fill="none" stroke="#6366f1" stroke-width="1.8" stroke-dasharray="5,2.5" stroke-linejoin="round" stroke-linecap="round"/>
                  @for (dot of historyWChart().dots; track $index) {
                    <circle [attr.cx]="dot.x" [attr.cy]="dot.y" r="3" fill="#fff" stroke="#6366f1" stroke-width="1.8"/>
                  }
                </svg>
                <div class="ex-chart-label">Reps en máximo</div>
                <svg class="history-svg history-svg--lg" viewBox="0 0 300 90" preserveAspectRatio="none">
                  @for (g of historyRChart().grid; track $index) {
                    <line [attr.x1]="HC.pl" [attr.y1]="g.y" [attr.x2]="HC.cw - HC.pr" [attr.y2]="g.y"
                      stroke="#e5e7eb" stroke-width="0.6" stroke-dasharray="3,3"/>
                    <text [attr.x]="HC.pl - 3" [attr.y]="g.y + 3" text-anchor="end" font-size="7.5" fill="#9ca3af">{{ g.label }}</text>
                  }
                  @for (xl of historyRChart().xLabels; track $index) {
                    <text [attr.x]="xl.x" [attr.y]="HC.ch - 1" text-anchor="middle" font-size="7" fill="#9ca3af">{{ xl.label }}</text>
                  }
                  <path [attr.d]="historyRChart().path" fill="none" stroke="#10b981" stroke-width="1.8" stroke-dasharray="5,2.5" stroke-linejoin="round" stroke-linecap="round"/>
                  @for (dot of historyRChart().dots; track $index) {
                    <circle [attr.cx]="dot.x" [attr.cy]="dot.y" r="3" fill="#fff" stroke="#10b981" stroke-width="1.8"/>
                  }
                </svg>
              </div>
            } @else {
              <small class="note">No hay datos históricos para este ejercicio todavía.</small>
            }
            <button type="button" class="close" (click)="closeHistoryModal()">Cerrar</button>
          </div>
        </div>
      }

      @if (showExerciseInfoModal && selectedExerciseInfoDetail(); as d) {
        <div class="modal-backdrop" (click)="closeExerciseInfoModal()">
          <div class="modal modal-compact" (click)="$event.stopPropagation()">
            <h3>{{ exerciseInfoName }}</h3>
            <p>Informacion del ejercicio</p>
            <div class="exercise-db-info">
              <ul class="exercise-db-meta">
                @if (d.bodyPart) {
                  <li><strong>Zona</strong> {{ dbBodyPart(d.bodyPart) }}</li>
                }
                <li><strong>Enfoque</strong> {{ dbTarget(d.target) }}</li>
                <li><strong>Equipo</strong> {{ dbEquipment(d.equipment) }}</li>
                @if (d.difficulty) {
                  <li><strong>Nivel</strong> {{ dbDifficulty(d.difficulty) }}</li>
                }
                @if (d.category) {
                  <li><strong>Tipo</strong> {{ dbCategory(d.category) }}</li>
                }
                @if (d.secondaryMuscles.length) {
                  <li><strong>Secundarios</strong> {{ dbSecondaryMuscles(d.secondaryMuscles) }}</li>
                }
              </ul>
              @if (d.description) {
                <p class="exercise-db-desc">{{ d.description }}</p>
              }
              @if (d.instructions.length) {
                <ol class="exercise-db-steps">
                  @for (step of d.instructions; track $index) {
                    <li>{{ step }}</li>
                  }
                </ol>
              }
            </div>
            <button type="button" class="close" (click)="closeExerciseInfoModal()">Cerrar</button>
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
      padding: 0.58rem;
      background: #fff;
      display: grid;
      gap: 0.28rem;
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
      border-radius: 8px;
      background: #111;
      color: #fff;
      padding: 0.36rem 0.58rem;
      font: inherit;
      font-size: 0.72rem;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      line-height: 1.2;
    }

    .empty button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .action-row {
      display: flex;
      gap: 0.35rem;
      width: 100%;
    }

    .action-row button {
      flex: 1;
    }

    .templates-zone {
      margin-top: 0.68rem;
      display: grid;
      gap: 0.34rem;
    }

    .templates-head {
      display: grid;
      gap: 0.12rem;
    }

    .templates-head h3 {
      margin: 0;
      font-size: 1.3rem;
      color: #111;
    }

    .templates-head small {
      margin: 0.25rem 0 0;
      font-size: 1rem;
      color: #666;
    }

    .template-filter-group {
      margin-bottom: 0.45rem;
    }

    .filter-label {
      display: block;
      font-size: 0.6rem;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.2rem;
    }

    .template-filter-row {
      display: flex;
      gap: 0.3rem;
      overflow-x: auto;
      padding-bottom: 0.1rem;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }

    .template-filter-row::-webkit-scrollbar {
      display: none;
    }

    .template-chip {
      flex-shrink: 0;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #475569;
      border-radius: 6px;
      padding: 0.22rem 0.6rem;
      font-size: 0.7rem;
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;
      width: auto !important;
      line-height: 1.3;
      transition: background 0.1s, border-color 0.1s, color 0.1s;
    }

    .template-chip:hover {
      border-color: #94a3b8;
      background: #f1f5f9;
      color: #0f172a;
    }

    .template-chip.active {
      border-color: #0f172a;
      background: #0f172a;
      color: #fff;
    }

    .template-grid {
      display: grid;
      gap: 0.45rem;
      grid-template-columns: 1fr;
    }

    .template-card {
      position: relative;
      border-radius: 12px;
      min-height: 128px;
      border: 1px solid #e2e8f0;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
    }

    .template-content {
      display: grid;
      gap: 0.28rem;
      padding: 0.45rem 0.5rem;
      color: #0f172a;
    }

    .template-content strong {
      font-size: 0.8rem;
      line-height: 1.2;
    }

    .template-content small {
      font-size: 0.72rem;
      line-height: 1.2;
      color: #64748b;
    }

    .template-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      margin-top: 0.1rem;
    }

    .template-badges span {
      font-size: 0.62rem;
      border: 1px solid #e2e8f0;
      background: #f1f5f9;
      color: #475569;
      padding: 0.1rem 0.38rem;
      border-radius: 4px;
      font-weight: 500;
    }

    .template-gif-strip {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 0.22rem;
      margin-top: 0.1rem;
    }

    .template-gif-strip img,
    .gif-placeholder {
      width: 100%;
      height: 38px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }

    .template-gif-strip img {
      object-fit: contain;
      background: #ffffff;
    }

    .gif-placeholder {
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.65rem;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
    }

    .template-cta {
      margin-top: 0.12rem;
      border: 1px solid #cbd5e1;
      background: #fff;
      color: #0f172a;
      border-radius: 8px;
      padding: 0.3rem 0.5rem;
      font-size: 0.7rem;
      font-weight: 700;
      cursor: pointer;
      width: 100%;
      box-shadow: none;
      transition: border-color 0.12s ease, background 0.12s ease;
    }

    .template-cta:hover:not(:disabled) {
      border-color: #94a3b8;
      background: #f8fafc;
    }

    .template-cta:active:not(:disabled) {
      background: #f1f5f9;
    }

    .template-cta:disabled {
      opacity: 0.6;
      cursor: not-allowed;
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
      gap: 0.45rem;
    }

    .exercise-name-block {
      display: grid;
      gap: 0.08rem;
      min-width: 0;
    }

    .exercise-name-block > span {
      line-height: 1.15;
    }

    .exercise-name-block small {
      color: #6b7280;
      font-size: 0.72rem;
      font-weight: 500;
      line-height: 1.05;
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

    .info-icon-btn {
      border: 1px solid #e5e7eb;
      background: #fff;
      border-radius: 999px;
      width: 28px;
      height: 28px;
      display: grid;
      place-items: center;
      cursor: pointer;
      padding: 0;
      color: #374151;
      transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
    }

    .info-icon-btn img {
      width: 15px;
      height: 15px;
      display: block;
      opacity: 0.95;
    }

    .info-icon-btn:hover {
      border-color: #cbd5e1;
      background: #f8fafc;
      color: #111827;
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

    .add-exercise-icon {
      width: 36px;
      height: 36px;
      border-radius: 999px;
      border: 1px solid #e5e7eb;
      background: #fff;
      display: grid;
      place-items: center;
      padding: 0;
      transition: border-color 0.15s ease, background 0.15s ease;
    }

    .add-exercise-icon img {
      width: 20px;
      height: 20px;
      display: block;
      opacity: 0.9;
    }

    .add-exercise-icon:hover {
      border-color: #cbd5e1;
      background: #f8fafc;
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
      max-width: 460px;
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

    .modal-compact {
      max-width: 430px;
      padding: 0.72rem 0.85rem;
      gap: 0.5rem;
      max-height: min(72vh, 560px);
      overflow: auto;
    }

    .modal-compact h3 {
      font-size: 0.95rem;
    }

    .modal-compact p {
      font-size: 0.8rem;
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
      gap: 0.55rem;
      font: inherit;
      font-size: 0.92rem;
    }

    .option-thumb-wrap {
      flex-shrink: 0;
      width: 44px;
      height: 44px;
      border-radius: 8px;
      overflow: hidden;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
    }

    .option-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }


    .option-text {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      min-width: 0;
      text-align: left;
    }

    .option-name {
      display: grid;
      gap: 0.08rem;
      min-width: 0;
    }

    .option-name > span {
      line-height: 1.1;
      font-size: 0.8rem;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }

    .option-name small {
      color: #6b7280;
      font-size: 0.68rem;
      font-weight: 500;
      line-height: 1.05;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }


    .group-slider {
      display: flex;
      gap: 0.45rem;
      overflow-x: auto;
      padding: 0.15rem 0;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }

    .group-slider::-webkit-scrollbar {
      display: none;
    }

    .group-slide {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      padding: 0.3rem 0.35rem 0.25rem;
      background: #fafafa;
      cursor: pointer;
      min-width: 62px;
      font: inherit;
      color: inherit;
    }

    .group-slide.active {
      border-color: #111;
      background: #f0f0f0;
    }

    .group-slide img {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      object-fit: cover;
    }

    .group-slide span {
      font-size: 0.66rem;
      font-weight: 600;
      color: #374151;
      white-space: nowrap;
    }

    .selected-thumb-block {
      display: grid;
      gap: 0.3rem;
      justify-items: start;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 0.45rem 0.55rem;
      background: #fafafa;
      width: fit-content;
    }

    .selected-thumb-block small {
      color: #6b7280;
      font-size: 0.72rem;
      line-height: 1;
    }

    .selected-thumb-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
      max-width: 280px;
    }

    .selected-thumb-block img {
      width: 56px;
      height: 56px;
      object-fit: cover;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      background: #fff;
      display: block;
    }

    .catalog-search-row {
      display: flex;
      gap: 0.45rem;
      align-items: center;
    }

    .catalog-search-row input[type='search'] {
      flex: 1;
      min-width: 0;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 0.45rem 0.55rem;
      font: inherit;
      font-size: 0.85rem;
    }

    .catalog-search-btn {
      flex-shrink: 0;
      border: 1px solid #111;
      background: #111;
      color: #fff;
      border-radius: 8px;
      padding: 0.45rem 0.65rem;
      font: inherit;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
    }

    .equipment-slider {
      display: flex;
      gap: 0.4rem;
      overflow-x: auto;
      padding: 0.1rem 0 0.05rem;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }

    .equipment-slider::-webkit-scrollbar {
      display: none;
    }

    .equipment-chip {
      flex-shrink: 0;
      border: 1px solid #e5e7eb;
      background: #fff;
      color: #374151;
      border-radius: 999px;
      padding: 0.34rem 0.62rem;
      font: inherit;
      font-size: 0.76rem;
      font-weight: 600;
      cursor: pointer;
    }

    .equipment-chip.active {
      border-color: #111;
      background: #111;
      color: #fff;
    }

    .exercise-db-meta {
      margin: 0 0 0.5rem;
      padding-left: 1rem;
      display: grid;
      gap: 0.2rem;
      font-size: 0.8rem;
      list-style: disc;
    }

    .exercise-db-info {
      margin: 0.3rem 0 0.35rem;
      padding: 0.45rem 0.55rem;
      border-radius: 10px;
      background: #f9fafb;
      border: 1px solid #ececec;
      font-size: 0.79rem;
      color: #374151;
    }

    .exercise-db-desc {
      margin: 0 0 0.45rem;
      line-height: 1.35;
    }

    .exercise-db-steps {
      margin: 0;
      padding-left: 1.1rem;
      display: grid;
      gap: 0.18rem;
    }

    .selected-option {
      border-color: #111 !important;
      background: #f8fafc !important;
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

    .chart-modal {
      width: min(480px, 94vw);
      max-width: 480px;
    }

    .chart-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .chart-modal-title {
      font-size: 0.9rem;
      font-weight: 700;
      color: #111827;
      line-height: 1.25;
    }

    .chart-modal-close {
      flex-shrink: 0;
      background: none;
      border: none;
      cursor: pointer;
      color: #9ca3af;
      padding: 2px;
      line-height: 0;
      border-radius: 4px;
    }

    .chart-modal-close:hover {
      color: #374151;
    }

    .history-chart-sub {
      margin: 0;
      font-size: 0.82rem;
      color: #6b7280;
    }

    .ex-charts {
      display: grid;
      gap: 0.2rem;
      padding: 0.35rem 0 0.1rem;
      border-top: 1px solid #f3f4f6;
    }

    .ex-chart-label {
      font-size: 0.64rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #9ca3af;
      margin-bottom: -0.1rem;
    }

    .history-svg {
      width: 100%;
      display: block;
      overflow: hidden;
    }

    .history-svg--lg {
      height: 90px;
    }

    .note {
      color: #7a7a7a;
      font-size: 0.8rem;
    }
  `]
})
export class WorkoutsPage implements OnInit, OnDestroy {
  constructor(
    readonly workoutRecordService: WorkoutRecordService,
    readonly exerciseCatalogService: ExerciseCatalogService,
    private readonly exerciseDbMedia: ExerciseDbMediaService,
    private readonly activeWorkout: ActiveWorkoutService
  ) {}

  workoutName = '';
  currentWorkout: WorkoutRecordDetail | null = null;
  showReplicateModal = false;
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
  setInputs: Record<string, { reps?: number; weight?: number; comment?: string; mode?: 'unilateral' | 'bilateral' }> =
    {};
  activeMuscleGroup = '';
  selectedEquipmentFilter: 'all' | 'dumbbell' | 'barbell' | 'machine' | 'free' = 'all';
  selectedCatalogThumbs = signal<string[]>([]);
  selectedTemplateDaysFilter: WorkoutTemplate['daysFilter'] = '2d';
  selectedTemplateEquipmentFilter: WorkoutTemplate['equipment'] = 'gym';
  readonly activeTemplateId = signal<string | null>(null);
  private isBootstrappingTemplate = false;

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
      this.workoutExerciseMediaUrls.set({});
      this.showExerciseListModal = false;
      this.selectedCatalogThumbs.set([]);
    }
  });

  async ngOnInit(): Promise<void> {
    await this.workoutRecordService.loadRecords();
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
    if (this.catalogSearchDebounceTimer) {
      clearTimeout(this.catalogSearchDebounceTimer);
      this.catalogSearchDebounceTimer = null;
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
    const created = await this.workoutRecordService.replicateWorkoutFrom(workoutId);
    if (!created) {
      return;
    }
    this.showReplicateModal = false;
    this.replicateSelectionConfirmed = false;
    this.activeWorkout.startWorkout(created.id, created.workout_name);
    await this.loadDetail(created.id);
    this.workoutName = '';
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
    this.selectedExerciseId = created.id;
    await this.loadDetail(this.currentWorkout.id);
    // Close picker after selecting so user can edit the added exercise immediately.
    this.showExerciseListModal = false;
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
