import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ExerciseHistoryPoint, ExerciseHistorySession } from '../../../models/workout-record.model';

interface ChartDot {
  x: number;
  y: number;
  v: number;
  date: string;
  workoutId: string;
}

interface ChartView {
  path: string;
  area: string;
  dots: ChartDot[];
  grid: Array<{ y: number; label: string }>;
  xLabels: Array<{ x: number; label: string }>;
  prY: number | null;
  tip: { x: number; y: number; label: string } | null;
}

interface SessionRow {
  workoutId: string;
  date: string;
  dateLabel: string;
  setsLabel: string;
  volume: number;
  volumeLabel: string;
  topWeight: number;
  e1rm: number | null;
  isPr: boolean;
  deltaKg: number | null;
}

@Component({
  selector: 'app-history-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history-modal.component.html',
  styleUrl: './history-modal.component.scss'
})
export class HistoryModalComponent implements OnChanges {
  @Input() open = false;
  @Input() title = '';
  @Input() points: ExerciseHistoryPoint[] = [];
  @Input() historySessions: ExerciseHistorySession[] = [];
  @Output() closed = new EventEmitter<void>();

  readonly HC = { cw: 320, ch: 156, pt: 22, pb: 26, pl: 38, pr: 16 };
  selectedIndex: number | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] || changes['points'] || changes['historySessions']) {
      const n = this.sortedPoints().length;
      this.selectedIndex = n ? n - 1 : null;
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.open) this.onClose();
  }

  onClose(): void {
    this.closed.emit();
  }

  hasData(): boolean {
    return this.sortedPoints().length > 0;
  }

  selectPoint(index: number): void {
    this.selectedIndex = index;
  }

  selectSession(workoutId: string): void {
    const i = this.sortedPoints().findIndex((p) => p.workout_id === workoutId);
    if (i >= 0) this.selectedIndex = i;
  }

  isSessionSelected(workoutId: string): boolean {
    const pts = this.sortedPoints();
    const i = this.selectedIndex;
    return i != null && pts[i]?.workout_id === workoutId;
  }

  heroKg(): string {
    const p = this.selectedPoint();
    return p ? this.fmtKg(p.max_weight) : '–';
  }

  heroCaption(): string {
    const p = this.selectedPoint();
    if (!p) return 'Sin datos';
    const pts = this.sortedPoints();
    const isLast = this.selectedIndex === pts.length - 1;
    return isLast ? `Último máximo · ${this.fmtDate(p.date, 'short')}` : this.fmtDate(p.date, 'long');
  }

  heroDelta(): { text: string; tone: 'up' | 'down' | 'flat' } | null {
    const pts = this.sortedPoints();
    const i = this.selectedIndex;
    if (i == null || i === 0) return null;
    const delta = Math.round((pts[i].max_weight - pts[i - 1].max_weight) * 10) / 10;
    if (delta === 0) return { text: 'Igual que la sesión anterior', tone: 'flat' };
    const sign = delta > 0 ? '+' : '';
    return { text: `${sign}${this.fmtKg(delta)} kg vs anterior`, tone: delta > 0 ? 'up' : 'down' };
  }

  kpiPr(): string {
    const vals = this.sortedPoints().map((p) => p.max_weight);
    if (!vals.length) return '–';
    return `${this.fmtKg(Math.max(...vals))} kg`;
  }

  kpiSessions(): string {
    return String(this.sortedPoints().length);
  }

  kpiE1rm(): string {
    const rows = this.sessionRows();
    const best = rows.reduce((m, r) => (r.e1rm != null && r.e1rm > m ? r.e1rm : m), 0);
    if (best > 0) return `${this.fmtKg(best)} kg`;
    const p = this.selectedPoint();
    if (!p || !p.max_weight) return '–';
    const est = this.epley(p.max_weight, p.max_reps);
    return est != null ? `${this.fmtKg(est)} kg` : '–';
  }

  chart(): ChartView {
    const empty: ChartView = { path: '', area: '', dots: [], grid: [], xLabels: [], prY: null, tip: null };
    const pts = this.sortedPoints();
    if (!pts.length) return empty;

    const { cw, ch, pt, pb, pl, pr } = this.HC;
    const iw = cw - pl - pr;
    const ih = ch - pt - pb;
    const values = pts.map((p) => p.max_weight);
    const axis = this.axisRange(values);
    const prVal = Math.max(...values);

    const mapX = (i: number) =>
      pts.length === 1 ? pl + iw / 2 : pl + (i / (pts.length - 1)) * iw;
    const mapY = (v: number) => pt + ih - ((v - axis.min) / (axis.max - axis.min || 1)) * ih;

    const dots: ChartDot[] = pts.map((p, i) => ({
      x: mapX(i),
      y: mapY(p.max_weight),
      v: p.max_weight,
      date: p.date,
      workoutId: p.workout_id
    }));

    const line = dots.map((d) => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' L ');
    const path = dots.length ? `M ${line}` : '';
    const baseline = (pt + ih).toFixed(1);
    const area = dots.length
      ? `M ${dots[0].x.toFixed(1)},${baseline} L ${line} L ${dots[dots.length - 1].x.toFixed(1)},${baseline} Z`
      : '';

    const grid = axis.ticks.map((v) => ({
      y: mapY(v),
      label: this.fmtKg(v)
    }));

    const step = Math.max(1, Math.ceil(pts.length / 4));
    const xLabels = pts
      .map((p, i) => ({ x: mapX(i), label: this.fmtDate(p.date, 'short'), i }))
      .filter((item, _, arr) => item.i % step === 0 || item.i === arr.length - 1)
      .map(({ x, label }) => ({ x, label }));

    const prIsFlat = values.every((v) => v === prVal);
    const prY = !prIsFlat ? mapY(prVal) : null;

    const sel = this.selectedIndex != null ? dots[this.selectedIndex] : null;
    let tip: ChartView['tip'] = null;
    if (sel) {
      const y = sel.y < pt + 18 ? sel.y + 22 : sel.y - 14;
      const x = Math.min(cw - 28, Math.max(28, sel.x));
      tip = { x, y, label: `${this.fmtKg(sel.v)} kg` };
    }

    return { path, area, dots, grid, xLabels, prY, tip };
  }

  sessionRows(): SessionRow[] {
    const sessions = [...(this.historySessions ?? [])].sort((a, b) =>
      (a.date || '').localeCompare(b.date || '')
    );
    const pr = this.sortedPoints().reduce((m, p) => Math.max(m, p.max_weight || 0), 0);
    const rows: SessionRow[] = [];

    for (const session of sessions) {
      const sets = [...(session.sets ?? [])].sort((a, b) => a.position - b.position);
      const parts: string[] = [];
      let volume = 0;
      let topWeight = 0;
      let bestE1rm = 0;
      for (const s of sets) {
        const w = s.weight ?? null;
        const r = s.done_reps ?? null;
        if (w != null && r != null) {
          parts.push(`${this.fmtKg(w)}×${r}`);
          volume += w * r;
          if (w > topWeight) topWeight = w;
          const e = this.epley(w, r);
          if (e != null && e > bestE1rm) bestE1rm = e;
        } else if (w != null) {
          parts.push(`${this.fmtKg(w)} kg`);
          if (w > topWeight) topWeight = w;
        }
      }
      const prev = rows.length ? rows[rows.length - 1] : null;
      const deltaKg =
        prev && topWeight && prev.topWeight
          ? Math.round((topWeight - prev.topWeight) * 10) / 10
          : null;
      rows.push({
        workoutId: session.workout_id,
        date: session.date,
        dateLabel: this.fmtDate(session.date, 'long'),
        setsLabel: parts.join('  ·  '),
        volume,
        volumeLabel: this.fmtVolume(volume),
        topWeight,
        e1rm: bestE1rm || null,
        isPr: pr > 0 && topWeight > 0 && Math.abs(topWeight - pr) < 0.05,
        deltaKg: deltaKg === 0 ? null : deltaKg
      });
    }
    return rows.reverse();
  }

  fmtDelta(delta: number): string {
    const sign = delta > 0 ? '+' : '';
    return `${sign}${this.fmtKg(delta)} kg`;
  }

  private selectedPoint(): ExerciseHistoryPoint | null {
    const pts = this.sortedPoints();
    const i = this.selectedIndex;
    if (i == null || !pts[i]) return null;
    return pts[i];
  }

  private sortedPoints(): ExerciseHistoryPoint[] {
    return [...(this.points ?? [])]
      .filter((p) => p && Number(p.max_weight) > 0)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }

  private epley(weight: number, reps: number): number | null {
    if (!weight || !reps || reps < 1) return null;
    if (reps === 1) return weight;
    if (reps > 12) return null;
    return Math.round(weight * (1 + reps / 30) * 10) / 10;
  }

  fmtKg(n: number): string {
    if (!Number.isFinite(n)) return '–';
    const r = Math.round(n * 10) / 10;
    return r % 1 === 0 ? String(r) : r.toFixed(1);
  }

  private fmtVolume(n: number): string {
    if (n >= 1000) return `${this.fmtKg(n / 1000)} t`;
    return `${Math.round(n)} kg`;
  }

  private fmtDate(dateStr: string, kind: 'short' | 'long'): string {
    const raw = (dateStr || '').slice(0, 10);
    const d = new Date(raw + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return '';
    return kind === 'short'
      ? d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
      : d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  private axisRange(values: number[]): { min: number; max: number; ticks: number[] } {
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    let min = lo;
    let max = hi;
    if (min === max) {
      const pad = Math.max(2.5, min * 0.08);
      min = Math.max(0, min - pad);
      max = max + pad;
    } else {
      const span = max - min;
      min = Math.max(0, min - span * 0.14);
      max = max + span * 0.18;
    }
    const ticks = this.niceTicks(min, max, 4);
    return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
  }

  private niceTicks(min: number, max: number, count: number): number[] {
    const span = this.niceNum(max - min || 1, false);
    const step = this.niceNum(span / Math.max(1, count - 1), true);
    const start = Math.floor(min / step) * step;
    const end = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let v = start; v <= end + step / 2; v += step) {
      ticks.push(Math.round(v * 10) / 10);
    }
    return ticks.length ? ticks : [min, max];
  }

  private niceNum(range: number, round: boolean): number {
    const exp = Math.floor(Math.log10(range));
    const frac = range / Math.pow(10, exp);
    let nice: number;
    if (round) {
      if (frac < 1.5) nice = 1;
      else if (frac < 3) nice = 2;
      else if (frac < 7) nice = 5;
      else nice = 10;
    } else if (frac <= 1) nice = 1;
    else if (frac <= 2) nice = 2;
    else if (frac <= 5) nice = 5;
    else nice = 10;
    return nice * Math.pow(10, exp);
  }
}
