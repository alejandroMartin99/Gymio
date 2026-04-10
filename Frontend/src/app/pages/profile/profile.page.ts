import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { translateExerciseName } from '../../core/exercisedb-i18n';
import {
  WorkoutStatsHistoryPoint,
  WorkoutStatsMonthlyPersistence,
  WorkoutStatsProgressEntry,
  WorkoutStatsWeek,
} from '../../models/workout-record.model';
import { AuthService } from '../../services/auth.service';
import { WorkoutRecordService } from '../../services/workout-record.service';

interface ChartPt { x: number; y: number; v: number; }
interface GridLine { y: number; label: string; }
interface XLabel  { x: number; label: string; }
interface ChartData { path: string; dots: ChartPt[]; grid: GridLine[]; xLabels: XLabel[]; }

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="profile-page">

      <!-- ── Avatar + info ──────────────────────────────────── -->
      <div class="avatar-section">
        <button class="avatar-wrap" type="button" (click)="openUploadModal()" title="Cambiar foto">
          @if (auth.avatarUrl() && !avatarImgError) {
            <img [src]="auth.avatarUrl()!" alt="Foto de perfil" class="avatar-img" (error)="avatarImgError = true" />
          } @else {
            <span class="avatar-initials">{{ auth.avatarInitials() }}</span>
          }
          <span class="avatar-edit-badge" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
            </svg>
          </span>
        </button>
        <div class="user-info">
          <div class="name-row">
            <strong class="user-name">{{ auth.displayName() || 'Sin nombre' }}</strong>
            <button type="button" class="edit-btn" (click)="openNameModal()" title="Editar nombre">
              <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
              </svg>
            </button>
          </div>
          <small class="user-email">{{ auth.user()?.email }}</small>
        </div>
      </div>

      <!-- ── Dashboard ──────────────────────────────────────── -->
      <div class="dashboard-title">
        Estadísticas
        @if (svc.statsLoading()) { <span class="loading-dot"></span> }
      </div>

      @if (svc.stats(); as s) {

        <!-- Stat cards -->
        <div class="stat-cards">
          <div class="stat-card">
            <span class="stat-value">{{ s.totals.sessions }}</span>
            <span class="stat-label">Sesiones totales</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ s.totals.sets }}</span>
            <span class="stat-label">Series totales</span>
          </div>
          <div class="stat-card wide">
            <span class="stat-value">{{ avgSessionsPerWeek(s.sessions_per_week) }}</span>
            <span class="stat-label">Media sesiones / semana activa</span>
          </div>
        </div>

        <!-- ── Persistencia mensual ────────────────────────── -->
        @if (s.monthly_persistence.current_month) {
          <div class="persist-card">
            <div class="persist-header">
              <div>
                <div class="chart-title">Persistencia del mes</div>
                <div class="chart-sub">objetivo: 4 días / semana · {{ s.monthly_persistence.current_month | titlecase }}</div>
              </div>
              <div class="persist-pct-badge" [class.good]="s.monthly_persistence.current_pct >= 75" [class.mid]="s.monthly_persistence.current_pct >= 40 && s.monthly_persistence.current_pct < 75" [class.low]="s.monthly_persistence.current_pct < 40">
                {{ s.monthly_persistence.current_pct }}%
              </div>
            </div>
            <div class="persist-bar-wrap">
              <div class="persist-bar-fill"
                [class.good]="s.monthly_persistence.current_pct >= 75"
                [class.mid]="s.monthly_persistence.current_pct >= 40 && s.monthly_persistence.current_pct < 75"
                [class.low]="s.monthly_persistence.current_pct < 40"
                [style.width.%]="s.monthly_persistence.current_pct">
              </div>
            </div>
            <div class="persist-compare">
              <span class="persist-vs">vs. {{ s.monthly_persistence.prev_month | titlecase }}</span>
              @if (s.monthly_persistence.change_pct !== 0) {
                <span class="persist-delta" [class.up]="s.monthly_persistence.change_pct > 0" [class.down]="s.monthly_persistence.change_pct < 0">
                  {{ s.monthly_persistence.change_pct > 0 ? '+' : '' }}{{ s.monthly_persistence.change_pct }}%
                </span>
              } @else {
                <span class="persist-equal">Sin cambios</span>
              }
              <span class="persist-detail">{{ s.monthly_persistence.current_sessions }} sesiones · anterior: {{ s.monthly_persistence.prev_sessions }}</span>
            </div>
          </div>
        }

        <!-- ── Sessions per week — semáforo ───────────────── -->
        @if (s.sessions_per_week.length > 0) {
          <div class="chart-card">
            <div class="chart-header">
              <div>
                <div class="chart-title">Sesiones por semana</div>
                <div class="chart-sub">desde enero 2026</div>
              </div>
              <div class="semaforo-legend">
                <span class="s-dot" style="background:#16a34a"></span><span>4+</span>
                <span class="s-dot" style="background:#4ade80"></span><span>3</span>
                <span class="s-dot" style="background:#fb923c"></span><span>2</span>
                <span class="s-dot" style="background:#fca5a5"></span><span>1</span>
                <span class="s-dot" style="background:#ef4444"></span><span>0</span>
              </div>
            </div>
            <svg class="chart-svg" viewBox="0 0 320 108" preserveAspectRatio="none">
              @for (b of barBars(s.sessions_per_week); track $index) {
                <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" [attr.fill]="b.fill" rx="2"/>
              }
              @for (lbl of barWeekLabels(s.sessions_per_week); track $index) {
                <text [attr.x]="lbl.x" y="84" text-anchor="middle" font-size="6.5" fill="#d1d5db">{{ lbl.label }}</text>
              }
              <line x1="2" y1="89" x2="318" y2="89" stroke="#f3f4f6" stroke-width="0.5"/>
              @for (m of barMonthLabels(s.sessions_per_week); track $index) {
                <text [attr.x]="m.x" y="101" text-anchor="start" font-size="8" font-weight="600" fill="#6b7280">{{ m.label }}</text>
              }
            </svg>
          </div>
        }

        <!-- ── Progreso por ejercicio ──────────────────────── -->
        @if (s.progress_by_muscle.length > 0) {
          <div class="section-label">Progreso · últimas 2 semanas vs anteriores</div>
          @for (group of s.progress_by_muscle; track group.muscle_group) {
            <div class="list-card">
              <div class="chart-header">
                <div class="chart-title">{{ group.muscle_group }}</div>
              </div>
              <div class="progress-list">
                @for (ex of group.exercises; track ex.display) {
                  <div class="progress-ex-block">
                    <!-- header row -->
                    <div class="progress-row">
                      <span class="progress-name">{{ exEs(ex.display) }}</span>
                      <span class="progress-weight"><span class="progress-top-label">Top</span> {{ ex.current_max }} kg</span>
                      @if (ex.change_vs_min_pct !== null && ex.change_vs_min_pct !== undefined) {
                        <span class="progress-delta up">+{{ ex.change_vs_min_pct }}%</span>
                      }
                      <button type="button" class="chart-toggle-btn"
                        [disabled]="!ex.history_points || ex.history_points.length < 2"
                        (click)="openChartModal(ex)"
                        title="Ver historial">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        } @else if (!svc.statsLoading()) {
          <p class="muted-hint">Entrena esta semana para ver tu progreso comparado con la semana anterior.</p>
        }

        <!-- ── Distribución muscular ────────────────────────── -->
        @if (s.muscle_breakdown.length > 0) {
          <div class="list-card">
            <div class="chart-header">
              <div class="chart-title">Distribución muscular</div>
            </div>
            <div class="bar-list">
              @for (mg of s.muscle_breakdown; track $index) {
                <div class="bar-list-row">
                  <span class="bar-list-label">{{ mg.group }}</span>
                  <div class="bar-list-track">
                    <div class="bar-list-fill muscle" [style.width.%]="pct(mg.count, s.muscle_breakdown[0].count)"></div>
                  </div>
                  <span class="bar-list-val">{{ mg.count }}</span>
                </div>
              }
            </div>
          </div>
        }

      } @else if (!svc.statsLoading()) {
        <p class="muted-hint">Completa tu primer entrenamiento para ver estadísticas.</p>
      }

      <!-- ── Modal: subir foto ──────────────────────────────── -->
      @if (uploadModalOpen) {
        <div class="modal-backdrop" (click)="closeUploadModal()"></div>
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>Cambiar foto de perfil</h3>
          <p>Sube una imagen cuadrada o usa el zoom para ajustarla.</p>
          <input type="file" accept="image/*" (change)="onFileSelected($event)" />
          @if (previewUrl()) {
            <div class="preview-wrap"
              (wheel)="onWheel($event)"
              (touchstart)="onTouchStart($event)"
              (touchmove)="onTouchMove($event)"
              (touchend)="onTouchEnd()">
              <img [src]="previewUrl()!" alt="Vista previa" [style.transform]="'scale(' + zoom() + ')'" />
            </div>
            <small class="zoom-hint">Rueda del ratón o pellizco para hacer zoom</small>
          }
          @if (uploadError()) { <p class="form-error">{{ uploadError() }}</p> }
          <div class="modal-actions">
            <button type="button" (click)="closeUploadModal()" [disabled]="uploading()">Cancelar</button>
            <button type="button" class="primary" (click)="confirmUpload()" [disabled]="!previewUrl() || uploading()">
              {{ uploading() ? 'Subiendo…' : 'Guardar foto' }}
            </button>
          </div>
        </div>
      }

      <!-- ── Modal: historial de ejercicio ────────────────── -->
      @if (chartModalEx) {
        <div class="modal-backdrop" (click)="closeChartModal()"></div>
        <div class="modal chart-modal" (click)="$event.stopPropagation()">
          <div class="chart-modal-header">
            <span class="chart-modal-title">{{ exEs(chartModalEx.display) }}</span>
            <button type="button" class="chart-modal-close" (click)="closeChartModal()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="chart-modal-meta">
            <span class="progress-weight"><span class="progress-top-label">Top</span> {{ chartModalEx.current_max }} kg</span>
            @if (chartModalEx.change_vs_min_pct !== null && chartModalEx.change_vs_min_pct !== undefined) {
              <span class="progress-delta up">+{{ chartModalEx.change_vs_min_pct }}% vs mínimo</span>
            }
          </div>
          <div class="ex-charts">
            <div class="ex-chart-label">Peso máximo (kg)</div>
            <svg class="history-svg history-svg--lg" viewBox="0 0 300 90" preserveAspectRatio="none">
              @for (g of wChart(chartModalEx).grid; track $index) {
                <line [attr.x1]="HC.pl" [attr.y1]="g.y" [attr.x2]="HC.cw - HC.pr" [attr.y2]="g.y"
                  stroke="#e5e7eb" stroke-width="0.6" stroke-dasharray="3,3"/>
                <text [attr.x]="HC.pl - 3" [attr.y]="g.y + 3" text-anchor="end" font-size="7.5" fill="#9ca3af">{{ g.label }}</text>
              }
              @for (xl of wChart(chartModalEx).xLabels; track $index) {
                <text [attr.x]="xl.x" [attr.y]="HC.ch - 1" text-anchor="middle" font-size="7" fill="#9ca3af">{{ xl.label }}</text>
              }
              <path [attr.d]="wChart(chartModalEx).path" fill="none" stroke="#6366f1" stroke-width="1.8" stroke-dasharray="5,2.5" stroke-linejoin="round" stroke-linecap="round"/>
              @for (dot of wChart(chartModalEx).dots; track $index) {
                <circle [attr.cx]="dot.x" [attr.cy]="dot.y" r="3" fill="#fff" stroke="#6366f1" stroke-width="1.8"/>
              }
            </svg>
            <div class="ex-chart-label">Reps en máximo</div>
            <svg class="history-svg history-svg--lg" viewBox="0 0 300 90" preserveAspectRatio="none">
              @for (g of rChart(chartModalEx).grid; track $index) {
                <line [attr.x1]="HC.pl" [attr.y1]="g.y" [attr.x2]="HC.cw - HC.pr" [attr.y2]="g.y"
                  stroke="#e5e7eb" stroke-width="0.6" stroke-dasharray="3,3"/>
                <text [attr.x]="HC.pl - 3" [attr.y]="g.y + 3" text-anchor="end" font-size="7.5" fill="#9ca3af">{{ g.label }}</text>
              }
              @for (xl of rChart(chartModalEx).xLabels; track $index) {
                <text [attr.x]="xl.x" [attr.y]="HC.ch - 1" text-anchor="middle" font-size="7" fill="#9ca3af">{{ xl.label }}</text>
              }
              <path [attr.d]="rChart(chartModalEx).path" fill="none" stroke="#10b981" stroke-width="1.8" stroke-dasharray="5,2.5" stroke-linejoin="round" stroke-linecap="round"/>
              @for (dot of rChart(chartModalEx).dots; track $index) {
                <circle [attr.cx]="dot.x" [attr.cy]="dot.y" r="3" fill="#fff" stroke="#10b981" stroke-width="1.8"/>
              }
            </svg>
          </div>
        </div>
      }

      <!-- ── Modal: editar nombre ───────────────────────────── -->
      @if (nameModalOpen) {
        <div class="modal-backdrop" (click)="closeNameModal()"></div>
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>Editar nombre</h3>
          <label>
            Nombre completo
            <input [(ngModel)]="nameInput" placeholder="Tu nombre" (keyup.enter)="saveName()" autocomplete="name" />
          </label>
          @if (nameError()) { <p class="form-error">{{ nameError() }}</p> }
          <div class="modal-actions">
            <button type="button" (click)="closeNameModal()" [disabled]="nameSaving()">Cancelar</button>
            <button type="button" class="primary" (click)="saveName()" [disabled]="!nameInput.trim() || nameSaving()">
              {{ nameSaving() ? 'Guardando…' : 'Guardar' }}
            </button>
          </div>
        </div>
      }

    </section>
  `,
  styles: [`
    :host { display: block; overflow-x: hidden; max-width: 100%; }
    .profile-page { display: grid; gap: 1rem; max-width: 520px; padding-bottom: 2rem; width: 100%; box-sizing: border-box; }

    /* Avatar */
    .avatar-section { display: flex; align-items: center; gap: 1rem; }
    .avatar-wrap {
      position: relative; width: 72px; height: 72px; border-radius: 50%;
      border: 2px solid #e5e7eb; overflow: visible; background: #111; color: #fff;
      cursor: pointer; padding: 0; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
    .avatar-initials { font-size: 1.4rem; font-weight: 700; letter-spacing: 0.03em; pointer-events: none; }
    .avatar-edit-badge {
      position: absolute; bottom: 1px; right: 1px; width: 20px; height: 20px; border-radius: 50%;
      background: #111; color: #fff; display: flex; align-items: center; justify-content: center;
      border: 1.5px solid #fff; pointer-events: none;
    }
    .user-info { min-width: 0; }
    .name-row { display: flex; align-items: center; gap: 0.4rem; }
    .user-name { font-size: 1rem; font-weight: 700; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
    .edit-btn { border: none; background: transparent; color: #9ca3af; cursor: pointer; padding: 2px; display: inline-flex; align-items: center; &:hover { color: #111; } }
    .user-email { font-size: 0.8rem; color: #6b7280; }

    /* Section titles */
    .dashboard-title { display: flex; align-items: center; gap: 0.5rem; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: #6b7280; border-top: 1px solid #f3f4f6; padding-top: 0.75rem; }
    .section-label { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #9ca3af; }
    .loading-dot { width: 6px; height: 6px; border-radius: 50%; background: #6366f1; animation: pulse 1s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

    /* Stat cards */
    .stat-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; min-width: 0; width: 100%; }
    .stat-card {
      border: 1px solid #f0f2f5; border-radius: 14px; background: #fafbfc;
      padding: 0.7rem 0.65rem 0.6rem; display: flex; flex-direction: column; align-items: center; gap: 0.1rem; text-align: center;
      overflow: hidden; min-width: 0; box-sizing: border-box;
    }
    .stat-card.wide { grid-column: span 2; flex-direction: row; align-items: center; justify-content: center; gap: 0.45rem; padding: 0.55rem 0.75rem; }
    .stat-card.wide .stat-label { text-align: left; }
    .stat-value { font-size: 1.25rem; font-weight: 800; color: #111827; line-height: 1.1; letter-spacing: -0.02em; }
    .stat-card.wide .stat-value { font-size: 1.1rem; }
    .stat-label { font-size: 0.62rem; color: #6b7280; font-weight: 500; letter-spacing: 0.02em; line-height: 1.2; }

    /* Persistence card */
    .persist-card {
      border: 1px solid #eef1f6; border-radius: 16px; background: #fff;
      padding: 0.85rem 0.9rem 0.8rem; display: grid; gap: 0.55rem;
      overflow: hidden; min-width: 0; box-sizing: border-box;
      box-shadow: 0 1px 3px rgba(15,23,42,.04);
    }
    .persist-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; }
    .persist-pct-badge {
      font-size: 1.6rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1;
      flex-shrink: 0;
    }
    .persist-pct-badge.good { color: #16a34a; }
    .persist-pct-badge.mid  { color: #ea580c; }
    .persist-pct-badge.low  { color: #dc2626; }

    .persist-bar-wrap { height: 9px; border-radius: 999px; background: #f3f4f6; overflow: hidden; }
    .persist-bar-fill {
      height: 100%; border-radius: 999px; transition: width .6s cubic-bezier(.4,0,.2,1);
    }
    .persist-bar-fill.good { background: linear-gradient(90deg, #16a34a, #4ade80); }
    .persist-bar-fill.mid  { background: linear-gradient(90deg, #ea580c, #fb923c); }
    .persist-bar-fill.low  { background: linear-gradient(90deg, #dc2626, #f87171); }

    .persist-compare {
      display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
      font-size: 0.72rem; color: #9ca3af;
    }
    .persist-vs { color: #9ca3af; }
    .persist-delta {
      font-weight: 700; border-radius: 6px; padding: 0.1rem 0.35rem;
    }
    .persist-delta.up   { background: #dcfce7; color: #16a34a; }
    .persist-delta.down { background: #fee2e2; color: #dc2626; }
    .persist-equal { font-weight: 600; color: #9ca3af; }
    .persist-detail { color: #d1d5db; margin-left: auto; }

    /* Chart/list cards */
    .chart-card, .list-card {
      border: 1px solid #eef1f6; border-radius: 16px; background: #fff;
      padding: 0.85rem 0.9rem 0.75rem; display: grid; gap: 0.65rem;
      overflow: hidden; min-width: 0; box-sizing: border-box;
      box-shadow: 0 1px 3px rgba(15,23,42,.04);
    }
    .chart-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; }
    .chart-title { font-size: 0.84rem; font-weight: 700; color: #111827; line-height: 1.2; }
    .chart-sub { font-size: 0.68rem; color: #9ca3af; margin-top: 0.1rem; }
    .chart-svg { width: 100%; display: block; overflow: hidden; }
    .svg-clip { overflow: hidden; width: 100%; }

    /* Semáforo legend */
    .semaforo-legend { display: flex; align-items: center; gap: 0.25rem; font-size: 0.65rem; color: #9ca3af; white-space: nowrap; flex-shrink: 0; }
    .s-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }

    /* Progress section */
    .progress-list { display: grid; gap: 0.75rem; }
    .progress-ex-block { display: grid; gap: 0.35rem; }
    .progress-row { display: flex; align-items: center; gap: 0.4rem; }
    .progress-row .progress-name { flex: 1; min-width: 0; }
    .progress-name { font-size: 0.76rem; font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .progress-weight { font-size: 0.76rem; font-weight: 700; color: #374151; white-space: nowrap; }
    .progress-top-label { font-size: 0.62rem; font-weight: 500; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.04em; margin-right: 2px; }
    .progress-delta {
      font-size: 0.7rem; font-weight: 700; border-radius: 6px; padding: 0.1rem 0.35rem; white-space: nowrap;
    }
    .progress-delta.up   { background: #dcfce7; color: #16a34a; }
    .progress-delta.down { background: #fee2e2; color: #dc2626; }
    .progress-delta.flat { background: #f3f4f6; color: #6b7280; }
    .chart-toggle-btn {
      margin-left: auto; background: none; border: 1px solid #e5e7eb; border-radius: 5px;
      padding: 3px 6px; cursor: pointer; color: #9ca3af; line-height: 0; flex-shrink: 0;
      transition: color .15s, border-color .15s, background .15s;
      &:hover:not([disabled]) { color: #6366f1; border-color: #6366f1; }
      &.active { color: #6366f1; background: #eef2ff; border-color: #6366f1; }
      &[disabled] { opacity: 0.3; cursor: default; }
    }

    /* History charts */
    .ex-charts { display: grid; gap: 0.2rem; padding: 0.35rem 0 0.1rem; border-top: 1px solid #f3f4f6; }
    .ex-chart-label { font-size: 0.64rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #9ca3af; margin-bottom: -0.1rem; }
    .history-svg { width: 100%; display: block; overflow: hidden; }

    /* Horizontal bar list */
    .bar-list { display: grid; gap: 0.45rem; }
    .bar-list-row { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,110px) 30px; align-items: center; gap: 0.4rem; }
    .bar-list-label { font-size: 0.74rem; font-weight: 500; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bar-list-track { height: 7px; border-radius: 999px; background: #f3f4f6; overflow: hidden; }
    .bar-list-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg,#6366f1,#818cf8); transition: width .4s ease; }
    .bar-list-fill.muscle { background: linear-gradient(90deg,#10b981,#34d399); }
    .bar-list-val { font-size: 0.72rem; font-weight: 700; color: #6b7280; text-align: right; }
    .bar-list-extra { font-size: 0.68rem; color: #9ca3af; white-space: nowrap; }
    .bar-list-row:has(.bar-list-extra) { grid-template-columns: minmax(0,1fr) minmax(0,90px) 28px 44px; }

    .muted-hint { font-size: 0.8rem; color: #9ca3af; margin: 0; }

    /* Modals */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.3); z-index: 200; }
    .modal {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 210;
      background: #fff; border-radius: 14px; padding: 1.2rem 1.2rem 1rem; width: min(360px,92vw);
      box-shadow: 0 16px 40px rgba(0,0,0,.2); display: grid; gap: 0.75rem;
    }
    .modal h3 { margin: 0; font-size: 1rem; font-weight: 700; }
    .modal p  { margin: 0; font-size: 0.82rem; color: #6b7280; }
    .modal label { display: grid; gap: 0.3rem; font-size: 0.82rem; color: #374151; font-weight: 500; }
    .modal input[type="text"], .modal input[type="file"] { border: 1px solid #d1d5db; border-radius: 8px; padding: 0.5rem 0.65rem; font: inherit; font-size: 0.88rem; width: 100%; box-sizing: border-box; }
    .preview-wrap { width: 220px; height: 140px; border-radius: 10px; overflow: hidden; background: #000; position: relative; cursor: zoom-in; }
    .preview-wrap img { width: 100%; height: 100%; object-fit: cover; transform-origin: center; transition: transform 0.1s ease; }
    .preview-wrap::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at center, transparent 0, transparent 40%, rgba(0,0,0,.55) 43%, rgba(0,0,0,.7) 100%); }
    .zoom-hint { font-size: 0.74rem; color: #9ca3af; }
    .form-error { margin: 0; font-size: 0.8rem; color: #dc2626; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
    .modal-actions button { border: 1px solid #e5e7eb; border-radius: 9px; background: #fff; padding: 0.45rem 0.8rem; font: inherit; font-size: 0.84rem; cursor: pointer; &:disabled { opacity: .5; cursor: not-allowed; } }
    .modal-actions button.primary { background: #111; color: #fff; border-color: #111; &:hover:not(:disabled) { background: #222; } }

    /* Chart modal */
    .chart-modal { width: min(480px, 94vw); padding: 1rem 1.1rem 1.2rem; }
    .chart-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
    .chart-modal-title { font-size: 0.9rem; font-weight: 700; color: #111827; }
    .chart-modal-close { background: none; border: none; cursor: pointer; color: #9ca3af; padding: 2px; line-height: 0; border-radius: 4px; &:hover { color: #374151; } }
    .chart-modal-meta { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.8rem; padding-bottom: 0.6rem; border-bottom: 1px solid #f3f4f6; }
    .history-svg--lg { height: 90px; }

    @media (max-width: 380px) {
      .stat-cards { grid-template-columns: 1fr 1fr; }
      .stat-card.wide { grid-column: span 2; }
    }
  `]
})
export class ProfilePage implements OnInit {
  constructor(
    readonly auth: AuthService,
    private readonly router: Router,
    readonly svc: WorkoutRecordService,
  ) {}

  ngOnInit(): void { void this.svc.loadStats(); }

  /* Avatar upload */
  avatarImgError = false;
  uploadModalOpen = false;
  previewUrl = signal<string | null>(null);
  zoom = signal(1);
  uploading = signal(false);
  uploadError = signal<string | null>(null);
  private _previewBlobUrl: string | null = null;
  private _lastTouchDist: number | null = null;
  private _uploadFileName = 'avatar.webp';

  /* Name edit */
  nameModalOpen = false;
  nameInput = '';
  nameSaving = signal(false);
  nameError = signal<string | null>(null);

  /* ── Bar chart constants (viewBox 320×108) ──────────────── */
  private readonly B = { cw: 320, ch: 108, pt: 6, pb: 32, pl: 2, pr: 2 };

  /* ── History chart constants (viewBox 300×72) ───────────── */
  readonly HC = { cw: 300, ch: 72, pt: 12, pb: 18, pl: 32, pr: 6 };

  /* ── Chart modal state ──────────────────────────────────── */
  chartModalEx: WorkoutStatsProgressEntry | null = null;

  openChartModal(ex: WorkoutStatsProgressEntry): void { this.chartModalEx = ex; }
  closeChartModal(): void { this.chartModalEx = null; }

  /* ── Cached chart data ──────────────────────────────────── */
  private _wChartCache = new Map<string, ChartData>();
  private _rChartCache = new Map<string, ChartData>();

  /* ── General helpers ────────────────────────────────────── */
  pct(val: number, max: number): number {
    return max > 0 ? Math.round((val / max) * 100) : 0;
  }

  exEs(name: string): string { return translateExerciseName(name); }

  avgSessionsPerWeek(weeks: WorkoutStatsWeek[]): string {
    const active = weeks.filter((w) => w.count > 0);
    if (!active.length) return '0';
    const avg = active.reduce((a, w) => a + w.count, 0) / active.length;
    return avg % 1 === 0 ? avg.toString() : avg.toFixed(1);
  }

  /* ── Bar chart ──────────────────────────────────────────── */
  private barGeom(n: number): { barW: number; gap: number } {
    const iw = this.B.cw - this.B.pl - this.B.pr;
    const gap = 2;
    return { barW: Math.max(1, (iw - gap * (n - 1)) / n), gap };
  }

  private barColor(count: number): string {
    if (count >= 4) return '#16a34a';
    if (count === 3) return '#4ade80';
    if (count === 2) return '#fb923c';
    if (count === 1) return '#fca5a5';
    return '#ef4444';
  }

  barBars(weeks: WorkoutStatsWeek[]): Array<{ x: number; y: number; w: number; h: number; fill: string }> {
    const { ch, pt, pb, pl } = this.B;
    const ih = ch - pt - pb;
    const max = Math.max(...weeks.map((w) => w.count), 1);
    const { barW, gap } = this.barGeom(weeks.length);
    return weeks.map((w, i) => {
      const h = Math.max(w.count > 0 ? 2 : 1.5, (w.count / max) * ih);
      return { x: pl + i * (barW + gap), y: pt + ih - h, w: barW, h, fill: this.barColor(w.count) };
    });
  }

  barWeekLabels(weeks: WorkoutStatsWeek[]): Array<{ x: number; label: string }> {
    const n = weeks.length;
    const { barW, gap } = this.barGeom(n);
    const show = new Set([0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1]);
    return weeks
      .map((w, i) => ({ x: this.B.pl + i * (barW + gap) + barW / 2, label: w.label, i }))
      .filter((item) => show.has(item.i));
  }

  barMonthLabels(weeks: WorkoutStatsWeek[]): Array<{ x: number; label: string }> {
    const { barW, gap } = this.barGeom(weeks.length);
    const result: Array<{ x: number; label: string }> = [];
    let lastMonth = '';
    weeks.forEach((w, i) => {
      if (!w.start_date) return;
      const month = new Date(w.start_date + 'T12:00:00').toLocaleDateString('es', { month: 'short' });
      if (month !== lastMonth) {
        lastMonth = month;
        result.push({ x: this.B.pl + i * (barW + gap), label: month });
      }
    });
    return result;
  }

  /* ── History SVG charts ─────────────────────────────────── */
  private buildChart(rawPoints: Array<{ value: number; date: string }>): ChartData {
    const { cw, ch, pt, pb, pl, pr } = this.HC;
    const iw = cw - pl - pr;
    const ih = ch - pt - pb;

    if (rawPoints.length === 0) return { path: '', dots: [], grid: [], xLabels: [] };

    const vals = rawPoints.map((p) => p.value);
    const maxV = Math.max(...vals);
    const minV = Math.min(...vals);
    const range = maxV - minV || 1;

    const mapX = (i: number) => pl + (i / Math.max(rawPoints.length - 1, 1)) * iw;
    const mapY = (v: number) => pt + ih - ((v - minV) / range) * ih;

    const dots: ChartPt[] = rawPoints.map((p, i) => ({ x: mapX(i), y: mapY(p.value), v: p.value }));
    const path = dots.length > 1 ? `M${dots.map((d) => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join('L')}` : '';

    // 3 horizontal grid lines
    const grid: GridLine[] = [0, 0.5, 1].map((ratio) => {
      const v = minV + ratio * range;
      return { y: mapY(v), label: v % 1 === 0 ? v.toString() : v.toFixed(1) };
    });

    // X labels — max 5, always include last
    const step = Math.max(1, Math.ceil(rawPoints.length / 5));
    const xLabels: XLabel[] = rawPoints
      .map((p, i) => ({ x: mapX(i), label: this.fmtDate(p.date), i }))
      .filter((item, _, arr) => item.i % step === 0 || item.i === arr.length - 1);

    return { path, dots, grid, xLabels };
  }

  wChart(ex: WorkoutStatsProgressEntry): ChartData {
    const key = ex.display;
    if (!this._wChartCache.has(key)) {
      this._wChartCache.set(
        key,
        this.buildChart((ex.history_points ?? []).map((h: WorkoutStatsHistoryPoint) => ({ value: h.max_weight, date: h.date }))),
      );
    }
    return this._wChartCache.get(key)!;
  }

  rChart(ex: WorkoutStatsProgressEntry): ChartData {
    const key = ex.display;
    if (!this._rChartCache.has(key)) {
      this._rChartCache.set(
        key,
        this.buildChart((ex.history_points ?? []).map((h: WorkoutStatsHistoryPoint) => ({ value: h.max_reps, date: h.date }))),
      );
    }
    return this._rChartCache.get(key)!;
  }

  private fmtDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }

  /* ── Upload modal ───────────────────────────────────────── */
  openUploadModal(): void {
    this.uploadError.set(null); this.zoom.set(1);
    this.previewUrl.set(this.auth.avatarUrl()); this._uploadFileName = 'avatar.webp'; this.uploadModalOpen = true;
  }
  closeUploadModal(): void {
    this.uploadModalOpen = false; this._revokeBlobUrl(); this.previewUrl.set(null); this.zoom.set(1); this.uploadError.set(null);
  }
  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this._revokeBlobUrl();
    this._previewBlobUrl = URL.createObjectURL(file);
    this._uploadFileName = file.name;
    this.previewUrl.set(this._previewBlobUrl); this.zoom.set(1); this.uploadError.set(null);
  }
  onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.zoom.update((z) => Math.min(3, Math.max(1, z + (event.deltaY > 0 ? -0.1 : 0.1))));
  }
  onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 2) {
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      this._lastTouchDist = Math.hypot(dx, dy);
    }
  }
  onTouchMove(event: TouchEvent): void {
    if (event.touches.length !== 2 || this._lastTouchDist === null) return;
    event.preventDefault();
    const dx = event.touches[0].clientX - event.touches[1].clientX;
    const dy = event.touches[0].clientY - event.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    this.zoom.update((z) => Math.min(3, Math.max(1, z * (dist / this._lastTouchDist!))));
    this._lastTouchDist = dist;
  }
  onTouchEnd(): void { this._lastTouchDist = null; }

  async confirmUpload(): Promise<void> {
    const src = this.previewUrl();
    if (!src) return;
    this.uploading.set(true); this.uploadError.set(null);
    try {
      const img = new Image(); img.crossOrigin = 'anonymous'; img.src = src;
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('No se pudo cargar la imagen.')); });
      const z = Math.min(3, Math.max(1, this.zoom()));
      const side = Math.min(img.width, img.height) / z;
      const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
      canvas.getContext('2d')!.drawImage(img, sx, sy, side, side, 0, 0, 256, 256);
      const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Error al procesar imagen.'))), 'image/webp'));
      const { error } = await this.auth.uploadAvatar(blob, this._uploadFileName);
      if (error) { this.uploadError.set(error.message); return; }
      this.avatarImgError = false; this.closeUploadModal();
    } catch (e: any) {
      this.uploadError.set(e?.message ?? 'Error al subir la imagen.');
    } finally { this.uploading.set(false); }
  }

  /* ── Name modal ─────────────────────────────────────────── */
  openNameModal(): void { this.nameInput = this.auth.displayName(); this.nameError.set(null); this.nameModalOpen = true; }
  closeNameModal(): void { this.nameModalOpen = false; this.nameError.set(null); }
  async saveName(): Promise<void> {
    if (!this.nameInput.trim()) return;
    this.nameSaving.set(true); this.nameError.set(null);
    const { error } = await this.auth.updateProfile(this.nameInput.trim());
    this.nameSaving.set(false);
    if (error) { this.nameError.set(error.message); return; }
    this.closeNameModal();
  }

  /* ── Logout ─────────────────────────────────────────────── */
  async logout(): Promise<void> { await this.auth.signOut(); void this.router.navigateByUrl('/login'); }

  private _revokeBlobUrl(): void {
    if (this._previewBlobUrl) { URL.revokeObjectURL(this._previewBlobUrl); this._previewBlobUrl = null; }
  }
}
