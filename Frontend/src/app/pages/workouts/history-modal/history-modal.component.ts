import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ExerciseHistorySession } from '../../../models/workout-record.model';

interface Pt { x: number; y: number; v: number; }

interface SeriesLine {
  position: number;
  color: string;
  path: string;
  dots: Pt[];
}

interface SingleAxisChart {
  lines: SeriesLine[];
  grid: { y: number; label: string }[];
  xLabels: { x: number; label: string }[];
  isEmpty: boolean;
}

interface RmPoint { x: number; y: number; v: number; }

interface RmChart {
  dots: RmPoint[];
  path: string;
  grid: { y: number; label: string }[];
  xLabels: { x: number; label: string }[];
  isEmpty: boolean;
}

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
  @Input() points: unknown[] = [];

  @Input() set historySessions(v: ExerciseHistorySession[]) {
    this._sessions = v ?? [];
    this._wCache = null;
    this._rCache = null;
    this._rmCache = null;
  }

  @Output() closed = new EventEmitter<void>();

  readonly SVG = { cw: 300, ch: 130, pt: 12, pb: 22, pl: 32, pr: 8 };
  readonly SET_COLORS = ['#2563eb', '#4f8ff7', '#7ab5ff', '#a5d0ff', '#c8e2ff', '#e0eeff'];
  readonly SET_OPACITY = [1, 0.82, 0.64, 0.50, 0.40, 0.32];

  activeTab: 'series' | 'rm' = 'series';

  private _sessions: ExerciseHistorySession[] = [];
  private _wCache: SingleAxisChart | null = null;
  private _rCache: SingleAxisChart | null = null;
  private _rmCache: RmChart | null = null;

  onClose(): void { this.closed.emit(); }
  setTab(tab: 'series' | 'rm'): void { this.activeTab = tab; }

  setColor(position: number): string {
    return this.SET_COLORS[(position - 1) % this.SET_COLORS.length];
  }

  setOpacity(position: number): number {
    return this.SET_OPACITY[(position - 1) % this.SET_OPACITY.length];
  }

  setDash(position: number): string {
    return position === 1 ? 'none' : `${5},${2 + position}`;
  }

  weightChart(): SingleAxisChart {
    if (!this._wCache) this._wCache = this.buildSingleChart('weight');
    return this._wCache;
  }

  repsChart(): SingleAxisChart {
    if (!this._rCache) this._rCache = this.buildSingleChart('reps');
    return this._rCache;
  }

  rmChart(): RmChart {
    if (!this._rmCache) this._rmCache = this.buildRmChart();
    return this._rmCache;
  }

  private buildSingleChart(field: 'weight' | 'reps'): SingleAxisChart {
    const sessions = this._sessions;
    const { cw, ch, pt, pb, pl, pr } = this.SVG;
    const iw = cw - pl - pr;
    const ih = ch - pt - pb;
    const empty: SingleAxisChart = { lines: [], grid: [], xLabels: [], isEmpty: true };

    if (sessions.length === 0) return empty;

    const posSet = new Set<number>();
    const allVals: number[] = [];
    for (const s of sessions) {
      for (const set of s.sets) {
        posSet.add(set.position);
        const v = field === 'weight' ? set.weight : set.done_reps;
        if (v != null && v > 0) allVals.push(v);
      }
    }
    if (allVals.length === 0) return empty;

    const positions = [...posSet].sort((a, b) => a - b);
    const maxV = Math.max(...allVals);
    const minV = Math.min(...allVals);
    const rawRange = maxV - minV;
    const pad = rawRange * 0.18 || (field === 'weight' ? 2.5 : 1);
    const range = rawRange + pad * 2;
    const vBase = minV - pad;

    const mapX = (i: number) =>
      sessions.length === 1 ? pl + iw / 2 : pl + (i / (sessions.length - 1)) * iw;
    const mapY = (v: number) => pt + ih - ((v - vBase) / range) * ih;
    const fmt = (v: number) => field === 'weight'
      ? (v % 1 === 0 ? String(v) : v.toFixed(1))
      : String(Math.round(v));

    const lines: SeriesLine[] = positions.map(pos => {
      const dots: Pt[] = [];
      sessions.forEach((session, i) => {
        const set = session.sets.find(s => s.position === pos);
        if (!set) return;
        const v = field === 'weight' ? set.weight : set.done_reps;
        if (v != null && v > 0) dots.push({ x: mapX(i), y: mapY(v), v });
      });
      const path = dots.length > 1
        ? `M${dots.map(d => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join('L')}`
        : '';
      return { position: pos, color: this.setColor(pos), path, dots };
    });

    const grid = this.niceGrid(vBase, range, field === 'weight' ? 'weight' : 'reps', mapY, fmt);

    const step = Math.max(1, Math.ceil(sessions.length / 6));
    const xLabels = sessions
      .map((s, i) => ({ x: mapX(i), label: this.fmtDate(s.date), i }))
      .filter((item, _, arr) => item.i % step === 0 || item.i === arr.length - 1);

    return { lines, grid, xLabels, isEmpty: false };
  }

  private buildRmChart(): RmChart {
    const sessions = this._sessions;
    const { cw, ch, pt, pb, pl, pr } = this.SVG;
    const iw = cw - pl - pr;
    const ih = ch - pt - pb;

    if (sessions.length === 0) return { dots: [], path: '', grid: [], xLabels: [], isEmpty: true };

    const rmPerSession: { rm: number; date: string }[] = [];
    for (const session of sessions) {
      let bestRm = 0;
      for (const set of session.sets) {
        const w = set.weight ?? 0;
        const r = set.done_reps ?? 0;
        if (w > 0 && r > 0) {
          const rm = w * (1 + r / 30);
          if (rm > bestRm) bestRm = rm;
        }
      }
      if (bestRm > 0) rmPerSession.push({ rm: Math.round(bestRm * 10) / 10, date: session.date });
    }

    if (rmPerSession.length === 0) return { dots: [], path: '', grid: [], xLabels: [], isEmpty: true };

    const vals = rmPerSession.map(p => p.rm);
    const maxV = Math.max(...vals);
    const minV = Math.min(...vals);
    const rawRange = maxV - minV;
    const pad = rawRange * 0.18 || 2.5;
    const range = rawRange + pad * 2;
    const vMin = minV - pad;

    const mapX = (i: number) =>
      rmPerSession.length === 1 ? pl + iw / 2 : pl + (i / (rmPerSession.length - 1)) * iw;
    const mapY = (v: number) => pt + ih - ((v - vMin) / range) * ih;

    const dots: RmPoint[] = rmPerSession.map((p, i) => ({ x: mapX(i), y: mapY(p.rm), v: p.rm }));
    const path = dots.length > 1
      ? `M${dots.map(d => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join('L')}`
      : '';

    const fmtRm = (v: number) => v % 1 === 0 ? String(v) : v.toFixed(1);
    const grid = this.niceGrid(vMin, range, 'rm', mapY, fmtRm);

    const step = Math.max(1, Math.ceil(rmPerSession.length / 5));
    const xLabels = rmPerSession
      .map((p, i) => ({ x: mapX(i), label: this.fmtDate(p.date), i }))
      .filter((item, _, arr) => item.i % step === 0 || item.i === arr.length - 1);

    return { dots, path, grid, xLabels, isEmpty: false };
  }

  /** Pick a "nice" tick step that aligns with gym-friendly increments. */
  private niceStep(range: number, field: 'weight' | 'reps' | 'rm'): number {
    const target = range / 4;
    const candidates = field === 'reps'
      ? [1, 2, 3, 5, 10, 15, 20]
      : [1.25, 2.5, 5, 10, 15, 20, 25, 50, 100];
    return candidates.find(c => c >= target) ?? candidates[candidates.length - 1];
  }

  /** Generate grid ticks at round multiples within vBase..vBase+range. */
  private niceGrid(
    vBase: number, range: number, field: 'weight' | 'reps' | 'rm',
    mapY: (v: number) => number, fmt: (v: number) => string
  ): { y: number; label: string }[] {
    const step = this.niceStep(range, field);
    const lo = vBase;
    const hi = vBase + range;
    const firstTick = Math.ceil(lo / step) * step;
    const ticks: { y: number; label: string }[] = [];
    for (let v = firstTick; v <= hi + step * 0.01; v += step) {
      ticks.push({ y: mapY(v), label: fmt(v) });
    }
    if (ticks.length > 6) {
      const doubled = step * 2;
      const ft2 = Math.ceil(lo / doubled) * doubled;
      ticks.length = 0;
      for (let v = ft2; v <= hi + doubled * 0.01; v += doubled) {
        ticks.push({ y: mapY(v), label: fmt(v) });
      }
    }
    return ticks;
  }

  private fmtDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }
}
