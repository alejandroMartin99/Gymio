import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { translateExerciseName } from '../../core/exercisedb-i18n';
import {
  WorkoutStatsHistoryPoint,
  WorkoutStatsProgressEntry,
  WorkoutStatsWeek,
} from '../../models/workout-record.model';
import { AuthService } from '../../services/auth.service';
import { WorkoutRecordService } from '../../services/workout-record.service';

interface ChartPt   { x: number; y: number; v: number; }
interface GridLine  { y: number; label: string; }
interface XLabel    { x: number; label: string; }
interface ChartData { path: string; dots: ChartPt[]; grid: GridLine[]; xLabels: XLabel[]; }

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage implements OnInit {
  constructor(
    readonly auth: AuthService,
    private readonly router: Router,
    readonly svc: WorkoutRecordService,
  ) {}

  ngOnInit(): void { void this.svc.loadStats(); }

  /* ── Avatar upload ──────────────────────────────────────── */
  avatarImgError = false;
  uploadModalOpen = false;
  previewUrl = signal<string | null>(null);
  zoom = signal(1);
  uploading = signal(false);
  uploadError = signal<string | null>(null);
  private _previewBlobUrl: string | null = null;
  private _lastTouchDist: number | null = null;
  private _uploadFileName = 'avatar.webp';

  /* ── Name edit ──────────────────────────────────────────── */
  nameModalOpen = false;
  nameInput = '';
  nameSaving = signal(false);
  nameError = signal<string | null>(null);

  /* ── Bar chart constants (viewBox 320×108) ──────────────── */
  private readonly B = { cw: 320, ch: 108, pt: 6, pb: 32, pl: 2, pr: 2 };

  /* ── History chart constants (viewBox 300×90) ───────────── */
  readonly HC = { cw: 300, ch: 90, pt: 12, pb: 18, pl: 32, pr: 6 };

  /* ── Chart modal ────────────────────────────────────────── */
  chartModalEx: WorkoutStatsProgressEntry | null = null;

  openChartModal(ex: WorkoutStatsProgressEntry): void { this.chartModalEx = ex; }
  closeChartModal(): void { this.chartModalEx = null; }

  /* ── Chart cache ────────────────────────────────────────── */
  private _wChartCache = new Map<string, ChartData>();
  private _rChartCache = new Map<string, ChartData>();

  /* ── General helpers ────────────────────────────────────── */
  pct(val: number, max: number): number {
    return max > 0 ? Math.round((val / max) * 100) : 0;
  }

  exEs(name: string): string { return translateExerciseName(name); }

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

  /* ── History SVG charts ─────────────────────────────────── */
  private buildChart(rawPoints: Array<{ value: number; date: string }>): ChartData {
    const { cw, ch, pt, pb, pl, pr } = this.HC;
    const iw = cw - pl - pr;
    const ih = ch - pt - pb;

    if (rawPoints.length === 0) return { path: '', dots: [], grid: [], xLabels: [] };

    const vals = rawPoints.map(p => p.value);
    const maxV = Math.max(...vals);
    const minV = Math.min(...vals);
    const range = maxV - minV || 1;

    // Single point: center it
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
      .map((p, i) => ({ x: mapX(i), label: this.fmtDate(p.date), i }))
      .filter((item, _, arr) => item.i % step === 0 || item.i === arr.length - 1);

    return { path, dots, grid, xLabels };
  }

  wChart(ex: WorkoutStatsProgressEntry): ChartData {
    const key = ex.display;
    if (!this._wChartCache.has(key)) {
      this._wChartCache.set(key,
        this.buildChart((ex.history_points ?? []).map((h: WorkoutStatsHistoryPoint) => ({ value: h.max_weight, date: h.date }))),
      );
    }
    return this._wChartCache.get(key)!;
  }

  rChart(ex: WorkoutStatsProgressEntry): ChartData {
    const key = ex.display;
    if (!this._rChartCache.has(key)) {
      this._rChartCache.set(key,
        this.buildChart((ex.history_points ?? []).map((h: WorkoutStatsHistoryPoint) => ({ value: h.max_reps, date: h.date }))),
      );
    }
    return this._rChartCache.get(key)!;
  }

  changeVsPrev(ex: WorkoutStatsProgressEntry): number | null {
    const pts = ex.history_points;
    if (!pts || pts.length < 2) return null;
    const prev = pts[pts.length - 2].max_weight;
    const last = pts[pts.length - 1].max_weight;
    if (prev <= 0) return null;
    return Math.round(((last - prev) / prev) * 1000) / 10;
  }

  private fmtDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }

  /* ── Upload modal ───────────────────────────────────────── */
  openUploadModal(): void {
    this.uploadError.set(null);
    this.zoom.set(1);
    this.previewUrl.set(this.auth.avatarUrl());
    this._uploadFileName = 'avatar.webp';
    this.uploadModalOpen = true;
  }

  closeUploadModal(): void {
    this.uploadModalOpen = false;
    this._revokeBlobUrl();
    this.previewUrl.set(null);
    this.zoom.set(1);
    this.uploadError.set(null);
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this._revokeBlobUrl();
    this._previewBlobUrl = URL.createObjectURL(file);
    this._uploadFileName = file.name;
    this.previewUrl.set(this._previewBlobUrl);
    this.zoom.set(1);
    this.uploadError.set(null);
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.zoom.update(z => Math.min(3, Math.max(1, z + (event.deltaY > 0 ? -0.1 : 0.1))));
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
    this.zoom.update(z => Math.min(3, Math.max(1, z * (dist / this._lastTouchDist!))));
    this._lastTouchDist = dist;
  }

  onTouchEnd(): void { this._lastTouchDist = null; }

  async confirmUpload(): Promise<void> {
    const src = this.previewUrl();
    if (!src) return;
    this.uploading.set(true);
    this.uploadError.set(null);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = src;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
      });
      const z = Math.min(3, Math.max(1, this.zoom()));
      const side = Math.min(img.width, img.height) / z;
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      canvas.getContext('2d')!.drawImage(img, sx, sy, side, side, 0, 0, 256, 256);
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob(b => (b ? res(b) : rej(new Error('Error al procesar imagen.'))), 'image/webp'),
      );
      const { error } = await this.auth.uploadAvatar(blob, this._uploadFileName);
      if (error) { this.uploadError.set(error.message); return; }
      this.avatarImgError = false;
      this.closeUploadModal();
    } catch (e: unknown) {
      this.uploadError.set((e as Error)?.message ?? 'Error al subir la imagen.');
    } finally {
      this.uploading.set(false);
    }
  }

  /* ── Name modal ─────────────────────────────────────────── */
  openNameModal(): void {
    this.nameInput = this.auth.displayName();
    this.nameError.set(null);
    this.nameModalOpen = true;
  }

  closeNameModal(): void {
    this.nameModalOpen = false;
    this.nameError.set(null);
  }

  async saveName(): Promise<void> {
    if (!this.nameInput.trim()) return;
    this.nameSaving.set(true);
    this.nameError.set(null);
    const { error } = await this.auth.updateProfile(this.nameInput.trim());
    this.nameSaving.set(false);
    if (error) { this.nameError.set(error.message); return; }
    this.closeNameModal();
  }

  /* ── Logout ─────────────────────────────────────────────── */
  async logout(): Promise<void> {
    await this.auth.signOut();
    void this.router.navigateByUrl('/login');
  }

  private _revokeBlobUrl(): void {
    if (this._previewBlobUrl) {
      URL.revokeObjectURL(this._previewBlobUrl);
      this._previewBlobUrl = null;
    }
  }
}
