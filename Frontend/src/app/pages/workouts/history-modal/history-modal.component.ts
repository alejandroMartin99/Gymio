import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ExerciseHistorySession } from '../../../models/workout-record.model';

interface ChartPt   { x: number; y: number; v: number; }
interface GridLine  { y: number; label: string; }
interface XLabel    { x: number; label: string; }
interface ChartData { path: string; dots: ChartPt[]; grid: GridLine[]; xLabels: XLabel[]; }

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

  readonly HC = { cw: 300, ch: 90, pt: 12, pb: 18, pl: 32, pr: 6 };
  readonly SET_COLORS = ['#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#e0f2fe'];

  activeTab: 'weight' | 'reps' = 'weight';

  private _sessions: ExerciseHistorySession[] = [];
  private _wCache: ChartData | null = null;
  private _rCache: ChartData | null = null;
  private _rmCache: ChartData | null = null;

  onClose(): void { this.closed.emit(); }
  setTab(tab: 'weight' | 'reps'): void { this.activeTab = tab; }

  setColor(pos: number): string {
    return this.SET_COLORS[(pos - 1) % this.SET_COLORS.length];
  }

  wChart(): ChartData {
    if (!this._wCache) this._wCache = this.buildChart('weight');
    return this._wCache;
  }

  rChart(): ChartData {
    if (!this._rCache) this._rCache = this.buildChart('reps');
    return this._rCache;
  }

  currentWeight(): string {
    const d = this.wChart().dots;
    if (d.length === 0) return '–';
    return d[d.length - 1].v % 1 === 0
      ? String(d[d.length - 1].v)
      : d[d.length - 1].v.toFixed(1);
  }

  currentReps(): string {
    const d = this.rChart().dots;
    if (d.length === 0) return '–';
    return String(Math.round(d[d.length - 1].v));
  }

  hasData(): boolean {
    return this._sessions.length > 0 && this._sessions.some(s => s.sets.length > 0);
  }

  sessionCards(): SessionCard[] {
    const sessions = this._sessions;
    return sessions.map((session, idx) => {
      const prev = idx > 0 ? sessions[idx - 1] : null;
      const sets = [...session.sets]
        .sort((a, b) => a.position - b.position)
        .map(set => {
          const prevSet = prev?.sets.find(s => s.position === set.position);
          const weight = set.weight ?? null;
          const reps = set.done_reps ?? null;
          let weightDelta: number | null = null;
          let repsDelta: number | null = null;
          if (prevSet) {
            if (weight != null && prevSet.weight != null)
              weightDelta = Math.round((weight - prevSet.weight) * 10) / 10;
            if (reps != null && prevSet.done_reps != null)
              repsDelta = reps - prevSet.done_reps;
          }
          return { position: set.position, weight, reps, color: this.setColor(set.position), weightDelta, repsDelta };
        });
      return { date: session.date, dateLabel: this.fmtDateLong(session.date), sets };
    }).reverse();
  }

  legendPositions(): number[] {
    const cards = this.sessionCards();
    const positions = new Set<number>();
    for (const card of cards) for (const set of card.sets) positions.add(set.position);
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

  private buildChart(field: 'weight' | 'reps'): ChartData {
    const { cw, ch, pt, pb, pl, pr } = this.HC;
    const iw = cw - pl - pr;
    const ih = ch - pt - pb;
    const empty: ChartData = { path: '', dots: [], grid: [], xLabels: [] };

    const rawPoints: { value: number; date: string }[] = [];
    for (const session of this._sessions) {
      let best = 0;
      for (const set of session.sets) {
        const v = field === 'weight' ? (set.weight ?? 0) : (set.done_reps ?? 0);
        if (v > best) best = v;
      }
      if (best > 0) rawPoints.push({ value: best, date: session.date });
    }

    if (rawPoints.length === 0) return empty;

    const vals = rawPoints.map(p => p.value);
    const maxV = Math.max(...vals);
    const minV = Math.min(...vals);
    const range = maxV - minV || 1;

    const mapX = (i: number) =>
      rawPoints.length === 1 ? pl + iw / 2 : pl + (i / (rawPoints.length - 1)) * iw;
    const mapY = (v: number) => pt + ih - ((v - minV) / range) * ih;

    const dots: ChartPt[] = rawPoints.map((p, i) => ({ x: mapX(i), y: mapY(p.value), v: p.value }));
    const path = dots.length > 1
      ? `M${dots.map(d => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join('L')}`
      : '';

    const grid: GridLine[] = [0, 0.5, 1].map(ratio => {
      const v = minV + ratio * range;
      return { y: mapY(v), label: v % 1 === 0 ? v.toString() : v.toFixed(1) };
    });

    const step = Math.max(1, Math.ceil(rawPoints.length / 5));
    const xLabels: XLabel[] = rawPoints
      .map((p, i) => ({ x: mapX(i), label: this.fmtDateShort(p.date), i }))
      .filter((item, _, arr) => item.i % step === 0 || item.i === arr.length - 1);

    return { path, dots, grid, xLabels };
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
