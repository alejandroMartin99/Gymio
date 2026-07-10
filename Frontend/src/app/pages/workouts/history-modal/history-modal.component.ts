import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ExerciseHistorySession } from '../../../models/workout-record.model';

interface Pt { x: number; y: number; v: number; }

interface SessionSetRow {
  position: number;
  weight: number | null;
  reps: number | null;
  color: string;
  weightDelta: number | null;
  repsDelta: number | null;
}

interface SessionCard {
  date: string;
  dateLabel: string;
  sets: SessionSetRow[];
}

interface SeriesLine {
  position: number;
  color: string;
  path: string;
  areaPath: string;
  dots: Pt[];
}

interface MiniChart {
  lines: SeriesLine[];
  grid: { y: number; label: string }[];
  xLabels: { x: number; label: string }[];
  isEmpty: boolean;
}

interface RmChart {
  dots: Pt[];
  path: string;
  areaPath: string;
  grid: { y: number; label: string }[];
  xLabels: { x: number; label: string }[];
  isEmpty: boolean;
  latest: number | null;
  change: number | null;
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

  readonly SVG = { cw: 320, ch: 110, pt: 16, pb: 24, pl: 36, pr: 12 };
  readonly MINI = { cw: 320, ch: 64, pt: 6, pb: 6, pl: 8, pr: 8 };
  readonly SET_COLORS = ['#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#e0f2fe', '#f0f9ff'];
  readonly SET_OPACITY = [1, 0.85, 0.7, 0.55, 0.45, 0.35];

  activeTab: 'series' | 'rm' = 'series';

  private _sessions: ExerciseHistorySession[] = [];
  private _wCache: MiniChart | null = null;
  private _rCache: MiniChart | null = null;
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
    return position === 1 ? 'none' : `${4},${2 + position}`;
  }

  weightChart(): MiniChart {
    if (!this._wCache) this._wCache = this.buildMiniChart('weight');
    return this._wCache;
  }

  repsChart(): MiniChart {
    if (!this._rCache) this._rCache = this.buildMiniChart('reps');
    return this._rCache;
  }

  sessionCards(): SessionCard[] {
    const sessions = this._sessions;
    return sessions.map((session, idx) => {
      const prev = idx > 0 ? sessions[idx - 1] : null;
      const sets = [...session.sets]
        .sort((a, b) => a.position - b.position)
        .map((set) => {
          const prevSet = prev?.sets.find((s) => s.position === set.position);
          const weight = set.weight ?? null;
          const reps = set.done_reps ?? null;
          let weightDelta: number | null = null;
          let repsDelta: number | null = null;
          if (prevSet) {
            if (weight != null && prevSet.weight != null) {
              weightDelta = Math.round((weight - prevSet.weight) * 10) / 10;
            }
            if (reps != null && prevSet.done_reps != null) {
              repsDelta = reps - prevSet.done_reps;
            }
          }
          return {
            position: set.position,
            weight,
            reps,
            color: this.setColor(set.position),
            weightDelta,
            repsDelta
          };
        });
      return {
        date: session.date,
        dateLabel: this.fmtDateLong(session.date),
        sets
      };
    }).reverse();
  }

  rmChart(): RmChart {
    if (!this._rmCache) this._rmCache = this.buildRmChart();
    return this._rmCache;
  }

  hasData(): boolean {
    return this._sessions.length > 0 && this._sessions.some((s) => s.sets.length > 0);
  }

  legendPositions(): number[] {
    const cards = this.sessionCards();
    if (cards.length === 0) return [];
    const positions = new Set<number>();
    for (const card of cards) {
      for (const set of card.sets) positions.add(set.position);
    }
    return [...positions].sort((a, b) => a - b);
  }

  formatDelta(delta: number | null, unit: string): string {
    if (delta == null || delta === 0) return '—';
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta}${unit}`;
  }

  deltaTone(delta: number | null): string {
    if (delta == null || delta === 0) return 'neutral';
    return delta > 0 ? 'up' : 'down';
  }

  private buildMiniChart(field: 'weight' | 'reps'): MiniChart {
    const sessions = this._sessions;
    const { cw, ch, pt, pb, pl, pr } = this.MINI;
    const iw = cw - pl - pr;
    const ih = ch - pt - pb;
    const empty: MiniChart = { lines: [], grid: [], xLabels: [], isEmpty: true };

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
    const pad = rawRange * 0.2 || (field === 'weight' ? 2.5 : 1);
    const range = rawRange + pad * 2;
    const vBase = minV - pad;

    const mapX = (i: number) =>
      sessions.length === 1 ? pl + iw / 2 : pl + (i / (sessions.length - 1)) * iw;
    const mapY = (v: number) => pt + ih - ((v - vBase) / range) * ih;
    const fmt = (v: number) => field === 'weight'
      ? (v % 1 === 0 ? String(v) : v.toFixed(1))
      : String(Math.round(v));

    const baseY = pt + ih;

    const lines: SeriesLine[] = positions.map((pos) => {
      const dots: Pt[] = [];
      sessions.forEach((session, i) => {
        const set = session.sets.find((s) => s.position === pos);
        if (!set) return;
        const v = field === 'weight' ? set.weight : set.done_reps;
        if (v != null && v > 0) dots.push({ x: mapX(i), y: mapY(v), v });
      });
      const path = dots.length > 1 ? this.smoothPath(dots) : '';
      const areaPath = (pos === 1 && dots.length > 1)
        ? `${path}L${dots[dots.length - 1].x.toFixed(1)},${baseY}L${dots[0].x.toFixed(1)},${baseY}Z`
        : '';
      return { position: pos, color: this.setColor(pos), path, areaPath, dots };
    });

    const grid = this.niceGrid(vBase, range, field === 'weight' ? 'weight' : 'reps', mapY, fmt).slice(0, 3);
    const step = Math.max(1, Math.ceil(sessions.length / 4));
    const xLabels = sessions
      .map((s, i) => ({ x: mapX(i), label: this.fmtDateShort(s.date), i }))
      .filter((item, _, arr) => item.i % step === 0 || item.i === arr.length - 1);

    return { lines, grid, xLabels, isEmpty: false };
  }

  private buildRmChart(): RmChart {
    const empty: RmChart = {
      dots: [], path: '', areaPath: '', grid: [], xLabels: [], isEmpty: true, latest: null, change: null
    };
    const sessions = this._sessions;
    const { cw, ch, pt, pb, pl, pr } = this.SVG;
    const iw = cw - pl - pr;
    const ih = ch - pt - pb;

    if (sessions.length === 0) return empty;

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

    if (rmPerSession.length === 0) return empty;

    const vals = rmPerSession.map((p) => p.rm);
    const maxV = Math.max(...vals);
    const minV = Math.min(...vals);
    const rawRange = maxV - minV;
    const pad = rawRange * 0.2 || 2.5;
    const range = rawRange + pad * 2;
    const vMin = minV - pad;

    const mapX = (i: number) =>
      rmPerSession.length === 1 ? pl + iw / 2 : pl + (i / (rmPerSession.length - 1)) * iw;
    const mapY = (v: number) => pt + ih - ((v - vMin) / range) * ih;
    const baseY = pt + ih;

    const dots: Pt[] = rmPerSession.map((p, i) => ({ x: mapX(i), y: mapY(p.rm), v: p.rm }));
    const path = dots.length > 1 ? this.smoothPath(dots) : '';
    const areaPath = dots.length > 1
      ? `${path}L${dots[dots.length - 1].x.toFixed(1)},${baseY}L${dots[0].x.toFixed(1)},${baseY}Z`
      : '';

    const fmtRm = (v: number) => (v % 1 === 0 ? String(v) : v.toFixed(1));
    const grid = this.niceGrid(vMin, range, 'rm', mapY, fmtRm);

    const step = Math.max(1, Math.ceil(rmPerSession.length / 5));
    const xLabels = rmPerSession
      .map((p, i) => ({ x: mapX(i), label: this.fmtDateShort(p.date), i }))
      .filter((item, _, arr) => item.i % step === 0 || item.i === arr.length - 1);

    const latest = rmPerSession[rmPerSession.length - 1]?.rm ?? null;
    const prev = rmPerSession.length > 1 ? rmPerSession[rmPerSession.length - 2].rm : null;
    const change = latest != null && prev != null ? Math.round((latest - prev) * 10) / 10 : null;

    return { dots, path, areaPath, grid, xLabels, isEmpty: false, latest, change };
  }

  private smoothPath(pts: Pt[]): string {
    if (pts.length < 2) return '';
    const f = (a: number, b: number) => a.toFixed(1);
    let d = `M${f(pts[0].x, 0)},${f(pts[0].y, 0)}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      const cpx = (prev.x + cur.x) / 2;
      d += `C${cpx.toFixed(1)},${prev.y.toFixed(1)} ${cpx.toFixed(1)},${cur.y.toFixed(1)} ${cur.x.toFixed(1)},${cur.y.toFixed(1)}`;
    }
    return d;
  }

  private niceStep(range: number, field: 'weight' | 'reps' | 'rm'): number {
    const target = range / 4;
    const candidates = field === 'reps'
      ? [1, 2, 3, 5, 10, 15, 20]
      : [1.25, 2.5, 5, 10, 15, 20, 25, 50, 100];
    return candidates.find((c) => c >= target) ?? candidates[candidates.length - 1];
  }

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
    if (ticks.length > 5) {
      const doubled = step * 2;
      const ft2 = Math.ceil(lo / doubled) * doubled;
      ticks.length = 0;
      for (let v = ft2; v <= hi + doubled * 0.01; v += doubled) {
        ticks.push({ y: mapY(v), label: fmt(v) });
      }
    }
    return ticks;
  }

  private fmtDateShort(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }

  private fmtDateLong(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
  }
}
