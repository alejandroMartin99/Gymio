import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { WorkoutRecordService } from '../../services/workout-record.service';

@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './splash.component.html',
  styleUrl: './splash.component.scss',
})
export class SplashComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('vid') videoRef?: ElementRef<HTMLVideoElement>;
  progress = signal(0);
  currentText = signal('');

  private readonly texts = [
    'Push your limits',
    'Every rep counts',
    'No excuses',
    'Become unstoppable'
  ];

  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private textTimer: ReturnType<typeof setInterval> | null = null;
  private serverReady = false;
  private textIdx = 0;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly workoutRecord: WorkoutRecordService
  ) {}

  ngAfterViewInit(): void {
    const v = this.videoRef?.nativeElement;
    if (v) { v.muted = true; v.play().catch(() => {}); }
  }

  ngOnInit(): void {
    this.currentText.set(this.texts[0]);

    // Progress: 0→99 in ~60s using ease-out curve
    // Each tick adds a smaller increment as we approach 99
    const TICK_MS = 200;
    const TOTAL_TICKS = (60_000 / TICK_MS); // 300 ticks over 60s
    let tick = 0;

    this.tickTimer = setInterval(() => {
      if (this.serverReady) return; // auth resolved → autocomplete handles it
      tick++;
      // Ease-out: progress = 99 * (1 - (1 - t)^2.5) where t = tick/totalTicks
      const t = Math.min(tick / TOTAL_TICKS, 1);
      const value = 99 * (1 - Math.pow(1 - t, 2.5));
      this.progress.set(Math.min(value, 99));
    }, TICK_MS);

    // Cycle motivational text every 2.5s
    this.textTimer = setInterval(() => {
      this.textIdx = (this.textIdx + 1) % this.texts.length;
      this.currentText.set(this.texts[this.textIdx]);
    }, 2500);

    // Wait for auth + preload data + minimum 2s display
    const minDelay = new Promise<void>(r => setTimeout(r, 2000));
    const initAndPreload = this.auth.initialize().then(async () => {
      if (this.auth.user()) {
        await this.workoutRecord.loadRecords();
      }
    });
    Promise.all([initAndPreload, minDelay]).then(() => {
      this.serverReady = true;
      this.autocomplete();
    });
  }

  ngOnDestroy(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.textTimer) clearInterval(this.textTimer);
  }

  private autocomplete(): void {
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }

    // Quickly fill from current value to 100
    const start = this.progress();
    const remaining = 100 - start;
    const STEPS = 15;
    let step = 0;

    const fill = setInterval(() => {
      step++;
      this.progress.set(start + (remaining * step / STEPS));
      if (step >= STEPS) {
        clearInterval(fill);
        this.progress.set(100);
        setTimeout(() => {
          const target = this.auth.user() ? '/workouts' : '/login';
          this.router.navigateByUrl(target);
        }, 300);
      }
    }, 30);
  }
}
