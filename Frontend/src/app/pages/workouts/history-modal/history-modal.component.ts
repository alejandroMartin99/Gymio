import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

interface HistoryChartPt { x: number; y: number; v: number; }
interface HistoryGridLine { y: number; label: string; }
interface HistoryXLabel { x: number; label: string; i: number; }
interface HistoryChartData { path: string; dots: HistoryChartPt[]; grid: HistoryGridLine[]; xLabels: HistoryXLabel[]; }

@Component({
  selector: 'app-history-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history-modal.component.html',
  styleUrl: './history-modal.component.scss'
})
export class HistoryModalComponent {
  @Input() open: boolean = false;
  @Input() title: string = '';
  @Input() points: Array<{ workout_id: string; date: string; max_weight: number; max_reps: number }> = [];

  @Output() closed = new EventEmitter<void>();

  readonly HC = { cw: 300, ch: 90, pt: 12, pb: 18, pl: 32, pr: 6 };
  private _histW: HistoryChartData | null = null;
  private _histR: HistoryChartData | null = null;
  private _histCacheSig = '';

  onClose(): void {
    this.closed.emit();
  }

  private historyChartCacheSig(): string {
    return this.points.map((p) => `${p.date}:${p.max_weight}:${p.max_reps}`).join('|');
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
    if (this.points.length === 0) {
      return { path: '', dots: [], grid: [], xLabels: [] };
    }
    const sig = this.historyChartCacheSig();
    if (this._histCacheSig !== sig || !this._histW) {
      this._histCacheSig = sig;
      this._histW = this.buildHistoryChartFromPoints(
        this.points.map((p) => ({ value: p.max_weight, date: p.date })),
      );
      this._histR = this.buildHistoryChartFromPoints(
        this.points.map((p) => ({ value: p.max_reps, date: p.date })),
      );
    }
    return this._histW;
  }

  historyRChart(): HistoryChartData {
    if (this.points.length === 0) {
      return { path: '', dots: [], grid: [], xLabels: [] };
    }
    this.historyWChart();
    return this._histR!;
  }
}
