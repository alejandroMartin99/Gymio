import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ExerciseHistorySession } from '../../../models/workout-record.model';

interface SessionDot     { x: number; y: number; v: number; isMax: boolean; }
interface SessionColumn  { x: number; dateLabel: string; dots: SessionDot[]; rangeTopY: number; rangeBotY: number; }
interface SessionChart   { columns: SessionColumn[]; trendPath: string; grid: { y: number; label: string }[]; isEmpty: boolean; }

@Component({
  selector: 'app-history-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history-modal.component.html',
  styleUrl: './history-modal.component.scss'
})
export class HistoryModalComponent {
  @Input() open = false;
  @Input() title = '';
  /** Backward-compat — no longer used for rendering (kept so callers don't break). */
  @Input() points: Array<{ workout_id: string; date: string; max_weight: number; max_reps: number }> = [];

  @Input() set historySessions(v: ExerciseHistorySession[]) {
    this._sessions = v ?? [];
    this._wCache = null;
    this._rCache = null;
  }

  @Output() closed = new EventEmitter<void>();

  /** viewBox dimensions — used in template for positioning helpers. */
  readonly HC = { cw: 300, ch: 110, pt: 12, pb: 26, pl: 36, pr: 10 };

  activeTab: 'weight' | 'reps' = 'weight';

  private _sessions: ExerciseHistorySession[] = [];
  private _wCache: SessionChart | null = null;
  private _rCache: SessionChart | null = null;

  onClose(): void { this.closed.emit(); }

  setTab(tab: 'weight' | 'reps'): void {
    this.activeTab = tab;
  }

  activeChart(): SessionChart {
    return this.activeTab === 'weight' ? this.wChart() : this.rChart();
  }

  wChart(): SessionChart {
    if (!this._wCache) this._wCache = this.buildChart('weight');
    return this._wCache;
  }

  rChart(): SessionChart {
    if (!this._rCache) this._rCache = this.buildChart('reps');
    return this._rCache;
  }

  private buildChart(field: 'weight' | 'reps'): SessionChart {
    const sessions = this._sessions;
    const { cw, ch, pt, pb, pl, pr } = this.HC;
    const iw = cw - pl - pr;
    const ih = ch - pt - pb;

    if (sessions.length === 0) return { columns: [], trendPath: '', grid: [], isEmpty: true };

    const allVals: number[] = [];
    for (const s of sessions) {
      for (const set of s.sets) {
        const v = field === 'weight' ? set.weight : set.done_reps;
        if (v != null && v > 0) allVals.push(v);
      }
    }
    if (allVals.length === 0) return { columns: [], trendPath: '', grid: [], isEmpty: true };

    const maxV = Math.max(...allVals);
    const minV = Math.min(...allVals);
    const rawRange = maxV - minV;
    // Add vertical padding so dots never touch top/bottom edge
    const pad = rawRange * 0.18 || (field === 'weight' ? 2.5 : 1);
    const range = rawRange + pad * 2;
    const vMin = minV - pad;

    const mapX = (i: number) =>
      sessions.length === 1 ? pl + iw / 2 : pl + (i / (sessions.length - 1)) * iw;
    const mapY = (v: number) => pt + ih - ((v - vMin) / range) * ih;
    const fmtV = (v: number) =>
      field === 'weight' ? (v % 1 === 0 ? String(v) : v.toFixed(1)) : String(Math.round(v));

    const columns: SessionColumn[] = sessions.map((session, i) => {
      const x = mapX(i);
      const vals = session.sets
        .map((s) => (field === 'weight' ? s.weight : s.done_reps))
        .filter((v): v is number => v != null && v > 0);

      if (vals.length === 0) {
        const mid = mapY(vMin + range / 2);
        return { x, dateLabel: this.fmtDate(session.date), dots: [], rangeTopY: mid, rangeBotY: mid };
      }

      const sessionMax = Math.max(...vals);
      const sessionMin = Math.min(...vals);
      const dots: SessionDot[] = vals.map((v) => ({ x, y: mapY(v), v, isMax: v === sessionMax }));
      return { x, dateLabel: this.fmtDate(session.date), dots, rangeTopY: mapY(sessionMax), rangeBotY: mapY(sessionMin) };
    });

    // Trend line: connects the max dot of each session
    const trendPts = columns.flatMap((col) => col.dots.filter((d) => d.isMax));
    const trendPath = trendPts.length > 1
      ? `M${trendPts.map((d) => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join('L')}`
      : '';

    // 3 horizontal grid lines
    const grid = [0, 0.5, 1].map((r) => {
      const v = vMin + r * range;
      return { y: mapY(v), label: fmtV(v) };
    });

    return { columns, trendPath, grid, isEmpty: false };
  }

  private fmtDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }
}
