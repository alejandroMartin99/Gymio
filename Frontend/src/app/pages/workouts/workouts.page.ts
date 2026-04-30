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
import { WorkoutSessionDraftService, type WorkoutSessionDraftPayload } from '../../services/workout-session-draft.service';
import { ExerciseCatalogService } from '../../services/exercise-catalog.service';
import { ExerciseDbMediaService } from '../../services/exercise-db-media.service';
import { WorkoutRecordService } from '../../services/workout-record.service';

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
  imports: [CommonModule, FormsModule],
  template: `
    <section class="workout-start">
      @if (showRoutineStartOverlay) {
        <div class="routine-start-overlay" role="alertdialog" aria-busy="true" aria-live="polite" aria-label="Iniciando rutina">
          <div class="routine-start-card">
            <div class="routine-loader-stage" aria-hidden="true">
              <img class="routine-loader-gif" [src]="currentRoutineLoaderGif()" alt="" />
            </div>
            <p class="routine-start-title">Iniciando rutina</p>
            <p class="routine-start-caption">Preparando ejercicios…</p>
          </div>
        </div>
      }

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
          <div class="workout-header-row">
            <h3>{{ currentWorkout.workout_name }}</h3>
            <span class="workout-progress-count">
              {{ workoutProgressDone() }}/{{ workoutProgressTotal() }}
            </span>
          </div>
          <div class="workout-progress" [style.--progress]="workoutProgressFraction()" role="progressbar"
            [attr.aria-valuenow]="workoutProgressDone()" [attr.aria-valuemax]="workoutProgressTotal()">
            <div class="workout-progress-bar"></div>
          </div>

          <div class="exercise-list">
          @for (exercise of currentWorkout.exercises; track exercise.id; let exIdx = $index) {
            <div
              class="exercise-card"
              [class.selected]="selectedExerciseId === exercise.id"
              [class.completed]="completedExerciseIds.has(exercise.id)"
              [class.needs-weight-up]="exerciseShouldRaiseWeight(exercise)"
            >
              <div class="exercise-head" (click)="toggleExercise(exercise.id)">
                <div class="exercise-order-controls" (click)="$event.stopPropagation()">
                  <button
                    type="button"
                    class="order-btn"
                    [disabled]="exIdx === 0"
                    (click)="moveExercise(exIdx, exIdx - 1)"
                    aria-label="Subir ejercicio"
                    title="Subir"
                  >
                    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                      <path d="M2.5 7.5l3.5-4 3.5 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="order-btn"
                    [disabled]="exIdx === currentWorkout.exercises.length - 1"
                    (click)="moveExercise(exIdx, exIdx + 1)"
                    aria-label="Bajar ejercicio"
                    title="Bajar"
                  >
                    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                      <path d="M2.5 4.5l3.5 4 3.5-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                </div>
                <strong class="exercise-name-block">
                  <span class="exercise-name-row">
                    <span class="exercise-primary-name">{{ displayExercisePrimaryName(exercise) }}</span>
                    @if (exerciseShouldRaiseWeight(exercise)) {
                      <span class="weight-up-chip" title="Llevas dos series con el mismo peso y reps. Sube el peso.">
                        <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true">
                          <path d="M5 8V2M2.5 4.5L5 2l2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Sube peso
                      </span>
                    }
                  </span>
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
                  <span>SERIE</span>
                  <span>ANTERIOR</span>
                  <span>KG</span>
                  <span>REPS</span>
                  <span></span>
                </div>
                @for (set of exercise.sets; track set.id; let idx = $index) {
                  <div
                    class="set-grid"
                    [class.confirmed]="confirmedSetIdsInSession.has(set.id)"
                  >
                    <span class="set-index">{{ idx + 1 }}</span>
                    <span class="set-prev">{{ formatPreviousSetSnapshot(exercise, idx) }}</span>
                    @if (confirmedSetIdsInSession.has(set.id)) {
                      <span>{{ set.weight ?? '–' }}</span>
                      <span>{{ set.done_reps ?? '–' }}</span>
                    } @else {
                      <button type="button" class="set-cell-btn" (click)="openSetCellPad(exercise.id, set.id, 'weight')">
                        {{ set.weight ?? '–' }}
                      </button>
                      <button type="button" class="set-cell-btn" (click)="openSetCellPad(exercise.id, set.id, 'reps')">
                        {{ set.done_reps ?? '–' }}
                      </button>
                    }
                    @if (confirmedSetIdsInSession.has(set.id)) {
                      <button
                        type="button"
                        class="delete-set-btn"
                        (click)="removeSet(exercise.id, set.id)"
                        aria-label="Eliminar serie"
                        title="Eliminar"
                      >×</button>
                    } @else {
                      <button
                        type="button"
                        class="set-tick-btn"
                        (click)="confirmSet(exercise.id, set.id)"
                        aria-label="Confirmar serie"
                        title="Confirmar"
                      >
                        <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <polyline points="3.5 8.5 7 12 12.5 4.5"/>
                        </svg>
                      </button>
                    }
                  </div>
                  @if (set.comment) {
                    <small class="set-comment">{{ set.comment }}</small>
                  }
                }

                <button
                  type="button"
                  class="add-set-btn"
                  (click)="addEmptySet(exercise.id)"
                  aria-label="Añadir nueva serie"
                  title="Añadir serie"
                >
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                    <line x1="8" y1="3" x2="8" y2="13"/>
                    <line x1="3" y1="8" x2="13" y2="8"/>
                  </svg>
                  <span>Añadir serie</span>
                </button>
                <input class="set-note-input" [(ngModel)]="setInputs[exercise.id].comment" placeholder="Nota" />
                <button type="button" class="finish-exercise" (click)="completeExercise(exercise.id)">
                  Terminar ejercicio
                </button>
              }
            </div>
          }
          </div>
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

      @if (numericPadOpen) {
        <div class="numeric-pad-backdrop" (click)="hideNumericPad()"></div>
        <div class="numeric-pad-sheet" (click)="$event.stopPropagation()">
          <div class="numeric-pad-top">
            <strong>{{ numericPadFieldLabel() }}</strong>
            <span>{{ numericPadValue || '0' }}</span>
          </div>
          <div class="numeric-pad-grid">
            @for (k of numericPadKeys; track k) {
              <button type="button" (click)="onNumericPadKey(k)">{{ k }}</button>
            }
          </div>
          <div class="numeric-pad-actions">
            <button type="button" class="ghost" (click)="hideNumericPad()">Ocultar teclado</button>
            <button type="button" class="ghost" (click)="onNumericPadBackspace()">Borrar</button>
            <button type="button" class="primary" (click)="onNumericPadNext()">{{ numericPadNextLabel() }}</button>
          </div>
        </div>
      }

      @if (restTimerOpen) {
        <div class="rest-timer-bar" role="timer" aria-live="polite">
          <div class="rest-timer-bar-inner">
            <small class="rest-timer-label">
              Descanso{{ restTimerPaused ? ' · pausado' : '' }}
            </small>
            <strong class="rest-timer-time">{{ restTimerLabel() }}</strong>
            <div
              class="rest-timer-progress"
              role="presentation"
              [style.--rest-progress]="restTimerProgress()"
            ></div>
            <div class="rest-timer-actions">
              <button type="button" (click)="toggleRestPause()">
                {{ restTimerPaused ? 'Reanudar' : 'Pausa' }}
              </button>
              <button type="button" (click)="resetRestTimer()">Reset</button>
              <button type="button" (click)="openRestTimeEditor()">Tiempo</button>
              <button type="button" class="skip" (click)="skipRestTimer()">Skip</button>
            </div>
          </div>
        </div>
      }

      @if (restTimeEditorOpen) {
        <div class="modal-backdrop" (click)="closeRestTimeEditor()">
          <div class="modal modal-compact" (click)="$event.stopPropagation()">
            <h3>Tiempo de descanso</h3>
            <p>{{ restTimeEditorExerciseName }}</p>
            <div class="rest-time-presets">
              @for (preset of restTimePresets; track preset) {
                <button
                  type="button"
                  class="rest-time-preset"
                  [class.active]="restTimeEditorValue === preset"
                  (click)="setRestTimeEditorValue(preset)"
                >{{ formatRestPreset(preset) }}</button>
              }
            </div>
            <label>
              Personalizado (segundos)
              <input
                type="number"
                min="0"
                max="900"
                step="5"
                [(ngModel)]="restTimeEditorValue"
              />
            </label>
            <div class="summary-actions">
              <button type="button" class="close close-danger" (click)="closeRestTimeEditor()">Cancelar</button>
              <button type="button" class="primary" (click)="saveRestTimeEditor()">Guardar</button>
            </div>
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
      position: relative;
    }

    .routine-start-overlay {
      position: fixed;
      inset: 0;
      z-index: 80;
      display: grid;
      place-items: center;
      padding: 1.25rem;
      background: rgba(255, 255, 255, 0.82);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }

    .routine-start-card {
      width: min(300px, 92vw);
      border-radius: 22px;
      padding: 1.35rem 1.1rem 1.2rem;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow:
        0 22px 50px rgba(15, 23, 42, 0.18),
        inset 0 1px 0 rgba(255, 255, 255, 0.85);
      display: grid;
      gap: 0.55rem;
      text-align: center;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .routine-loader-stage {
      width: 76px;
      height: 76px;
      margin: 0.15rem auto 0.35rem;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid #dbe3ee;
      background: #fff;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.14);
    }

    .routine-loader-gif {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .routine-start-title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 650;
      letter-spacing: -0.02em;
      color: #0f172a;
    }

    .routine-start-caption {
      margin: 0;
      font-size: 0.82rem;
      color: #64748b;
      font-weight: 500;
    }

    @media (prefers-reduced-motion: reduce) {
      .routine-loader-gif {
        animation: none !important;
      }
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

    .workout-header-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.6rem;
    }

    .workout-progress-count {
      font-size: 0.78rem;
      font-weight: 700;
      color: #475569;
      letter-spacing: 0.02em;
      font-variant-numeric: tabular-nums;
    }

    .workout-progress {
      --progress: 0;
      width: 100%;
      height: 6px;
      border-radius: 999px;
      background: #eef2f6;
      overflow: hidden;
      position: relative;
      margin-top: -0.4rem;
    }

    .workout-progress-bar {
      width: calc(var(--progress) * 100%);
      height: 100%;
      background: linear-gradient(90deg, #34d399 0%, #10b981 100%);
      border-radius: 999px;
      transition: width 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .exercise-list {
      display: grid;
      gap: 0.7rem;
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
      position: relative;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      padding: 0.7rem 0.75rem;
      display: grid;
      gap: 0.5rem;
      background: #ffffff;
      box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02), 0 6px 14px rgba(15, 23, 42, 0.04);
      transition: box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease;
    }

    .exercise-card.selected {
      border-color: #cbd5e1;
      box-shadow: 0 2px 0 rgba(15, 23, 42, 0.02), 0 12px 26px rgba(15, 23, 42, 0.08);
    }

    .exercise-card.completed {
      border-color: #bbf7d0;
      box-shadow: inset 3px 0 0 0 #22c55e, 0 6px 14px rgba(15, 23, 42, 0.04);
    }

    .exercise-card small {
      color: #6b7280;
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
      gap: 0.5rem;
      user-select: none;
    }

    .exercise-name-block {
      flex: 1;
      display: grid;
      gap: 0.1rem;
      min-width: 0;
      font-weight: 700;
      font-size: 0.92rem;
      color: #0f172a;
      letter-spacing: -0.01em;
    }

    .exercise-name-block > .exercise-name-row {
      line-height: 1.2;
    }

    .exercise-name-block small {
      color: #94a3b8;
      font-size: 0.68rem;
      font-weight: 500;
      line-height: 1.1;
      letter-spacing: 0.01em;
    }

    .remove-btn {
      border: 0;
      background: transparent;
      color: #ef4444;
      font-size: 0.7rem;
      font-weight: 600;
      cursor: pointer;
      padding: 0.15rem 0.35rem;
      border-radius: 6px;
      letter-spacing: 0.01em;
      transition: background 0.12s ease;
    }

    .remove-btn:hover { background: #fef2f2; }

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
      grid-template-columns: 36px minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr) 32px;
      gap: 0.3rem;
      align-items: center;
      font-size: 0.86rem;
      font-weight: 600;
      color: #1f2937;
      font-variant-numeric: tabular-nums;
      background: transparent;
      border: 0;
      border-radius: 0;
      padding: 0.4rem 0.5rem;
      transition: background 0.18s ease;
    }

    /* Confirmadas: bloque verde, full-width (extiende hasta los bordes de la tarjeta),
       sin esquinas redondeadas y SIN gap entre confirmadas consecutivas. */
    .set-grid.confirmed {
      background: #d1fae5;
      color: #065f46;
      border-radius: 0;
      margin-left: -0.75rem;
      margin-right: -0.75rem;
      padding-left: 1.25rem;
      padding-right: 1.25rem;
      box-shadow: 0 -1px 0 0 #d1fae5;
    }

    /* Cancela el row-gap del parent grid entre dos confirmadas consecutivas
       para que se vean como un único bloque sin línea fina. */
    .set-grid.confirmed + .set-grid.confirmed {
      margin-top: calc(-0.5rem - 1px);
    }

    /* Numeración de la serie. */
    .set-index {
      font-weight: 800;
      color: #94a3b8;
      font-size: 0.78rem;
    }

    .set-grid.confirmed .set-index {
      color: #047857;
    }

    /* Snapshot del entreno anterior (formato 30kg×8). */
    .set-prev {
      color: #94a3b8;
      font-weight: 600;
      font-size: 0.74rem;
      letter-spacing: 0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .set-grid.confirmed .set-prev {
      color: #059669;
    }

    .set-grid span {
      text-align: center;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .set-grid.header {
      color: #94a3b8;
      font-weight: 700;
      font-size: 0.6rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      margin: 0.4rem 0 0.05rem;
      text-align: center;
    }

    .set-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) 84px 38px;
      gap: 0.28rem;
      align-items: center;
      margin-top: 0.1rem;
    }

    .set-form input,
    .set-form select {
      height: 34px;
      padding: 0.18rem 0.32rem;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      font-size: 15px;
      font-weight: 600;
      text-align: center;
      text-align-last: center;
      background: #ffffff;
      min-width: 0;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
      transition: border-color 0.12s ease, box-shadow 0.12s ease;
    }

    .set-form input:focus,
    .set-form select:focus {
      outline: none;
      border-color: #94a3b8;
      box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.18);
    }

    .set-input-btn {
      height: 34px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      background: #ffffff;
      font: inherit;
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
      text-align: center;
      padding: 0.18rem 0.32rem;
      min-width: 0;
      cursor: pointer;
      font-variant-numeric: tabular-nums;
      transition: border-color 0.12s ease, background 0.12s ease;
    }

    .set-input-btn:hover { border-color: #cbd5e1; background: #f8fafc; }

    /* Celda tappable dentro de una serie pendiente. */
    .set-cell-btn {
      border: 0;
      background: transparent;
      font: inherit;
      color: inherit;
      font-weight: 600;
      font-size: 0.92rem;
      font-variant-numeric: tabular-nums;
      cursor: pointer;
      padding: 0.18rem 0.2rem;
      border-radius: 6px;
      text-align: center;
      transition: background 0.14s ease, color 0.14s ease;
    }

    .set-cell-btn:hover {
      background: #f1f5f9;
      color: #0f172a;
    }

    /* Tick minimalista en cada fila pendiente. */
    .set-tick-btn {
      width: 24px;
      height: 24px;
      display: inline-grid;
      place-items: center;
      border: 1.5px solid #cbd5e1;
      background: transparent;
      border-radius: 999px;
      color: #64748b;
      cursor: pointer;
      padding: 0;
      justify-self: center;
      transition: border-color 0.14s ease, color 0.14s ease, background 0.14s ease, transform 0.14s ease;
    }

    .set-tick-btn:hover {
      border-color: #10b981;
      color: #059669;
      background: #ecfdf5;
    }

    .set-tick-btn:active { transform: scale(0.92); }
    .set-tick-btn svg { display: block; }

    /* Botón + para añadir nueva serie (indentado, discreto). */
    .add-set-btn {
      align-self: start;
      margin: 0.15rem 0 0 0.5rem;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      border: 1px dashed #cbd5e1;
      background: transparent;
      color: #475569;
      border-radius: 999px;
      padding: 0.35rem 0.75rem 0.35rem 0.6rem;
      font: inherit;
      font-size: 0.74rem;
      font-weight: 700;
      letter-spacing: 0.01em;
      cursor: pointer;
      transition: border-color 0.14s ease, color 0.14s ease, background 0.14s ease;
    }

    .add-set-btn:hover {
      border-color: #94a3b8;
      color: #0f172a;
      background: #f8fafc;
    }

    .add-set-btn svg { color: #64748b; }
    .add-set-btn:hover svg { color: #0f172a; }

    .set-form input::placeholder {
      color: #9ca3af;
      text-align: center;
    }

    .set-note-input {
      margin-top: 0.25rem;
      border: 1px solid #e5e7eb;
      border-radius: 9px;
      padding: 0.5rem 0.6rem;
      font-size: 0.85rem;
      background: #fafafa;
      color: #0f172a;
      transition: border-color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease;
    }

    .set-note-input::placeholder {
      color: #9ca3af;
    }

    .set-note-input:focus {
      outline: none;
      background: #ffffff;
      border-color: #94a3b8;
      box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.16);
    }

    .set-extra-row {
      margin-top: 0.28rem;
    }

    .set-extra-row input {
      width: 100%;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 0.38rem 0.48rem;
      font-size: 16px;
      background: #fff;
    }

    .drop-set-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.3rem;
    }

    .set-comment {
      display: block;
      margin-left: 0;
      color: #6b7280;
      font-size: 0.74rem;
    }

    .set-type-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 64px;
      height: 22px;
      border-radius: 999px;
      border: 1px solid #e5e7eb;
      background: #f8fafc;
      color: #475569;
      font-size: 0.54rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      justify-self: center;
      padding: 0 0.35rem;
    }

    .set-type-pill.drop {
      background: #fff7ed;
      border-color: #fdba74;
      color: #c2410c;
    }

    .set-type-pill.assisted {
      background: #eff6ff;
      border-color: #93c5fd;
      color: #1d4ed8;
    }

    .numeric-pad-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.28);
      z-index: 120;
    }

    .numeric-pad-sheet {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 121;
      background: #fff;
      border-top-left-radius: 16px;
      border-top-right-radius: 16px;
      border: 1px solid #e5e7eb;
      padding: 0.7rem 0.75rem calc(0.75rem + env(safe-area-inset-bottom, 0px));
      display: grid;
      gap: 0.5rem;
      box-shadow: 0 -16px 40px rgba(0, 0, 0, 0.16);
    }

    .numeric-pad-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.4rem;
    }

    .numeric-pad-top strong {
      font-size: 0.82rem;
      color: #6b7280;
    }

    .numeric-pad-top span {
      font-size: 1.05rem;
      font-weight: 700;
      color: #111827;
    }

    .numeric-pad-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.38rem;
    }

    .numeric-pad-grid button {
      border: 1px solid #e5e7eb;
      background: #f8fafc;
      border-radius: 10px;
      height: 40px;
      font-size: 1rem;
      font-weight: 700;
      color: #0f172a;
      cursor: pointer;
    }

    .numeric-pad-actions {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0.38rem;
    }

    .numeric-pad-actions button {
      border: 1px solid #e5e7eb;
      border-radius: 9px;
      height: 36px;
      font: inherit;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      background: #fff;
      color: #334155;
    }

    .numeric-pad-actions .primary {
      border-color: #111827;
      background: #111827;
      color: #fff;
    }

    /* ── Rest timer bar (centrado, premium, glass) ──────────────────── */
    .rest-timer-bar {
      position: fixed;
      left: 0;
      right: 0;
      bottom: calc(var(--nav-height, 60px) + var(--safe-area-bottom, 0px) + 0.4rem);
      z-index: 95;
      padding: 0 0.7rem;
      pointer-events: none;
      animation: rest-timer-slide-up 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    @keyframes rest-timer-slide-up {
      from { transform: translateY(120%); opacity: 0; }
      to   { transform: translateY(0); opacity: 1; }
    }

    .rest-timer-bar-inner {
      pointer-events: auto;
      max-width: 360px;
      margin: 0 auto;
      display: grid;
      gap: 0.4rem;
      padding: 0.7rem 0.9rem 0.65rem;
      border-radius: 18px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      box-shadow:
        0 18px 36px rgba(15, 23, 42, 0.14),
        0 1px 0 rgba(255, 255, 255, 0.6) inset;
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    .rest-timer-label {
      color: #6b7280;
      font-size: 0.66rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .rest-timer-time {
      font-size: 1.95rem;
      line-height: 1;
      color: #065f46;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
      font-weight: 800;
    }

    /* Barra de progreso fina y discreta. */
    .rest-timer-progress {
      --rest-progress: 1;
      height: 3px;
      width: 100%;
      border-radius: 999px;
      background: #e5f9f0;
      overflow: hidden;
      margin-top: 0.05rem;
      position: relative;
    }

    .rest-timer-progress::after {
      content: '';
      position: absolute;
      inset: 0;
      width: calc(var(--rest-progress) * 100%);
      background: linear-gradient(90deg, #34d399, #10b981);
      border-radius: 999px;
      transition: width 0.4s linear;
    }

    .rest-timer-actions {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.35rem;
      margin-top: 0.18rem;
    }

    .rest-timer-actions button {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      background: #ffffff;
      color: #475569;
      font: inherit;
      font-size: 0.7rem;
      font-weight: 700;
      height: 32px;
      cursor: pointer;
      letter-spacing: 0.01em;
      padding: 0 0.3rem;
      transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease, transform 0.12s ease;
    }

    .rest-timer-actions button:hover {
      background: #f8fafc;
      color: #0f172a;
      border-color: #cbd5e1;
    }

    .rest-timer-actions button:active { transform: scale(0.97); }

    .rest-timer-actions .skip {
      background: #0f172a;
      color: #ffffff;
      border-color: #0f172a;
    }

    .rest-timer-actions .skip:hover {
      background: #1e293b;
      color: #ffffff;
    }

    /* Mobile (≤ 420px): timer compacto. */
    @media (max-width: 420px) {
      .rest-timer-bar {
        padding: 0 0.55rem;
        bottom: calc(var(--nav-height, 60px) + var(--safe-area-bottom, 0px) + 0.3rem);
      }
      .rest-timer-bar-inner {
        max-width: 100%;
        padding: 0.6rem 0.7rem 0.55rem;
        border-radius: 16px;
      }
      .rest-timer-time { font-size: 1.7rem; }
      .rest-timer-actions button {
        height: 30px;
        font-size: 0.66rem;
      }
    }

    /* Mobile: tarjetas más generosas en padding y gap. */
    @media (max-width: 420px) {
      .exercise-list { gap: 0.6rem; }
      .exercise-card { padding: 0.65rem 0.6rem; }
      .exercise-name-block { font-size: 0.88rem; }
      .exercise-head-actions { gap: 0.4rem; }
      .info-icon-btn,
      .history-icon-btn {
        width: 26px;
        height: 26px;
      }
    }

    .rest-time-presets {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.35rem;
      margin: 0.2rem 0 0.4rem;
    }

    .rest-time-preset {
      border: 1px solid #e5e7eb;
      background: #f8fafc;
      border-radius: 10px;
      padding: 0.5rem 0.4rem;
      font: inherit;
      font-weight: 700;
      color: #334155;
      cursor: pointer;
    }

    .rest-time-preset.active {
      border-color: #111827;
      background: #111827;
      color: #fff;
    }

    /* Botón Aceptar serie — píldora redonda con gradiente premium. */
    .check {
      border: 0;
      background: linear-gradient(180deg, #34d399 0%, #10b981 60%, #059669 100%);
      color: #ffffff;
      border-radius: 999px;
      height: 34px;
      width: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 0.95rem;
      line-height: 1;
      cursor: pointer;
      justify-self: center;
      box-shadow:
        0 6px 14px rgba(5, 150, 105, 0.28),
        0 1px 0 rgba(255, 255, 255, 0.25) inset,
        0 -1px 0 rgba(0, 0, 0, 0.06) inset;
      transition: transform 0.14s ease, box-shadow 0.14s ease, background 0.14s ease;
    }

    .check:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow:
        0 9px 18px rgba(5, 150, 105, 0.32),
        0 1px 0 rgba(255, 255, 255, 0.28) inset;
    }

    .check:active:not(:disabled) {
      transform: scale(0.96);
      box-shadow: 0 3px 8px rgba(5, 150, 105, 0.28);
    }

    .check.saving {
      background: linear-gradient(180deg, #cbd5e1 0%, #94a3b8 100%);
      box-shadow: 0 4px 10px rgba(100, 116, 139, 0.22);
    }

    .check.confirmed {
      background: linear-gradient(180deg, #34d399 0%, #047857 100%);
      box-shadow:
        0 0 0 3px rgba(16, 185, 129, 0.18),
        0 6px 14px rgba(5, 150, 105, 0.32);
      animation: check-pop 0.32s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    @keyframes check-pop {
      0%   { transform: scale(0.8); }
      55%  { transform: scale(1.08); }
      100% { transform: scale(1); }
    }

    /* Botones ↑↓ ghost para reordenar el ejercicio. */
    .exercise-order-controls {
      flex-shrink: 0;
      display: grid;
      grid-template-rows: 1fr 1fr;
      gap: 1px;
      margin-right: 0.15rem;
    }

    .order-btn {
      width: 20px;
      height: 16px;
      display: grid;
      place-items: center;
      border: 0;
      background: transparent;
      color: #94a3b8;
      border-radius: 4px;
      font: inherit;
      line-height: 0;
      cursor: pointer;
      padding: 0;
      transition: background 0.12s ease, color 0.12s ease;
    }

    .order-btn:hover:not(:disabled) {
      background: #f1f5f9;
      color: #0f172a;
    }

    .order-btn:active:not(:disabled) {
      background: #e2e8f0;
    }

    .order-btn:disabled {
      opacity: 0.25;
      cursor: not-allowed;
    }

    /* Cabecera con nombre + chip "subir peso" inline. */
    .exercise-name-row {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
      line-height: 1.2;
    }

    .exercise-primary-name {
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .weight-up-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.22rem;
      padding: 0.08rem 0.45rem 0.1rem 0.4rem;
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      color: #92400e;
      background: #fef3c7;
      border-radius: 999px;
      white-space: nowrap;
      line-height: 1.4;
    }

    .weight-up-chip svg {
      flex-shrink: 0;
      stroke-width: 2;
    }

    /* En vez de teñir el título completo, dejamos un puntito amber discreto. */
    .exercise-card.needs-weight-up {
      box-shadow: inset 3px 0 0 0 #f59e0b;
    }

    /* (Repeat-flag y set-up-hint eliminados a favor del chip a nivel de cabecera.) */

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
      border: 1px solid #0f172a;
      color: #ffffff;
      background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
      border-radius: 10px;
      padding: 0.5rem 0.85rem;
      font-family: inherit;
      font-size: 0.74rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      cursor: pointer;
      box-shadow: 0 4px 10px rgba(15, 23, 42, 0.15);
      transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
    }

    .finish-exercise:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 16px rgba(15, 23, 42, 0.18);
    }

    .finish-exercise:active { transform: translateY(0); }

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
      await this.commitNumericPadValueToSet();
      if (field === 'weight') {
        // Pasamos a Reps de la misma serie (con prefill desde la propia serie o anterior).
        this.openSetCellPad(exId, setId, 'reps');
        return;
      }
      // Tras Reps (o cualquier otro), auto-confirmamos la serie y cerramos.
      this.hideNumericPad();
      this.confirmSet(exId, setId);
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

  /** Guarda el valor del numeric pad sobre el campo de una serie existente, en local + backend. */
  private async commitNumericPadValueToSet(): Promise<void> {
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

    if (this.numericPadField === 'weight' || this.numericPadField === 'reps') {
      const payload: { weight?: number | null; done_reps?: number | null } = {};
      if (this.numericPadField === 'weight') payload.weight = parsed;
      if (this.numericPadField === 'reps') payload.done_reps = parsed != null ? Math.round(parsed) : null;
      await this.workoutRecordService.updateSet(this.currentWorkout.id, exId, setId, payload);
    }
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

  formatRestPreset(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s === 0 ? `${m}m` : `${m}m ${s}s`;
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
   * Confirma una serie cargada (pendiente) sin pasar por el backend: la serie
   * ya existe en BD desde "Repetir rutina" o sesión previa. Solo la marca como
   * "hecha en esta sesión" para que reciba el sombreado verde y para arrancar
   * el descanso. El usuario sigue pudiendo borrarla luego con la X.
   */
  confirmSet(exerciseId: string, setId: string): void {
    if (!setId) return;
    if (this.confirmedSetIdsInSession.has(setId)) return;
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
