import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';

import { translateExerciseName } from '../../core/exercisedb-i18n';
import {
  ExerciseHistoryPoint,
  ExerciseHistorySession,
  WorkoutStatsProgressEntry,
  WorkoutStatsWeek,
} from '../../models/workout-record.model';
import { WorkoutRecordService } from '../../services/workout-record.service';
import { HistoryModalComponent } from '../workouts/history-modal/history-modal.component';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, HistoryModalComponent],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage implements OnInit {
  constructor(
    readonly svc: WorkoutRecordService,
  ) {}

  ngOnInit(): void { void this.svc.loadStats(); }

  /* ── Bar chart constants (viewBox 320×108) ──────────────── */
  private readonly B = { cw: 320, ch: 108, pt: 6, pb: 32, pl: 2, pr: 2 };

  chartModalOpen = false;
  chartModalTitle = '';
  chartModalPoints: ExerciseHistoryPoint[] = [];
  chartModalSessions: ExerciseHistorySession[] = [];

  openChartModal(ex: WorkoutStatsProgressEntry): void {
    this.chartModalTitle = this.exEs(ex.display);
    this.chartModalPoints = (ex.history_points ?? []).map((p, i) => ({
      workout_id: p.workout_id || p.date || String(i),
      date: p.date,
      max_weight: p.max_weight,
      max_reps: p.max_reps,
    }));
    this.chartModalSessions = ex.history_sessions ?? [];
    this.chartModalOpen = true;
  }

  closeChartModal(): void {
    this.chartModalOpen = false;
  }

  isHistoricMax(ex: WorkoutStatsProgressEntry): boolean {
    const max = ex.all_time_max;
    if (max == null || max <= 0) return false;
    return ex.current_max >= max - 1e-6;
  }

  /* ── General helpers ────────────────────────────────────── */
  pct(val: number, max: number): number {
    return max > 0 ? Math.round((val / max) * 100) : 0;
  }

  exEs(name: string): string { return translateExerciseName(name); }

  chartStartLabel(weeks: WorkoutStatsWeek[]): string {
    const first = weeks.find(w => w.start_date);
    if (!first) return '';
    const d = new Date(first.start_date + 'T12:00:00');
    return 'desde ' + d.toLocaleDateString('es', { month: 'long', year: 'numeric' });
  }

  avgSessionsPerWeek(weeks: WorkoutStatsWeek[]): string {
    const active = weeks.filter(w => w.count > 0);
    if (!active.length) return '0';
    const avg = active.reduce((a, w) => a + w.count, 0) / active.length;
    return avg % 1 === 0 ? avg.toString() : avg.toFixed(1);
  }

  /* ── Bar chart ──────────────────────────────────────────── */
  private barGeom(n: number): { barW: number; gap: number } {
    const iw = this.B.cw - this.B.pl - this.B.pr;
    const gap = 2;
    // Anchura máxima = la que tendría el gráfico con 20 semanas llenando el viewBox.
    // Con menos semanas las barras mantienen ese ancho y dejan espacio en blanco a la derecha.
    // Con más semanas se comprimen para que todo quepa.
    const REF_WEEKS = 20;
    const maxBarW = (iw - gap * (REF_WEEKS - 1)) / REF_WEEKS;
    const naturalBarW = n > 1 ? (iw - gap * (n - 1)) / n : iw;
    return { barW: Math.max(1, Math.min(maxBarW, naturalBarW)), gap };
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
    const max = Math.max(...weeks.map(w => w.count), 1);
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
      .filter(item => show.has(item.i));
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

  progressPctLabel(v: number | null | undefined): string {
    if (v === null || v === undefined) return '—';
    const sign = v > 0 ? '+' : '';
    return `${sign}${v}%`;
  }

  progressPctTone(v: number | null | undefined): string {
    if (v === null || v === undefined) return 'no-data';
    if (v > 0) return 'up';
    if (v < 0) return 'down';
    return 'flat';
  }

}
