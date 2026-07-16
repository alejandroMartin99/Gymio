import { Component, Input, ViewChild, ElementRef, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-workout-start-overlay',
  standalone: true,
  templateUrl: './workout-start-overlay.component.html',
  styleUrl: './workout-start-overlay.component.scss'
})
export class WorkoutStartOverlayComponent implements AfterViewInit, OnChanges {
  @Input() show = false;
  @ViewChild('vid') videoRef?: ElementRef<HTMLVideoElement>;

  ngAfterViewInit(): void {
    this.tryPlay();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show']?.currentValue) {
      setTimeout(() => this.tryPlay(), 50);
    }
  }

  private tryPlay(): void {
    const v = this.videoRef?.nativeElement;
    if (v) { v.muted = true; v.play().catch(() => {}); }
  }
}
