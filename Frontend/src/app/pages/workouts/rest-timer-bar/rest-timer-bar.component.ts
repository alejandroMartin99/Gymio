import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-rest-timer-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rest-timer-bar.component.html',
  styleUrl: './rest-timer-bar.component.scss'
})
export class RestTimerBarComponent {
  @Input() open: boolean = false;
  @Input() label: string = '';
  @Input() paused: boolean = false;
  @Input() progress: number = 1;

  @Output() pauseToggle = new EventEmitter<void>();
  @Output() reset = new EventEmitter<void>();
  @Output() openEditor = new EventEmitter<void>();
  @Output() skip = new EventEmitter<void>();

  onPauseToggle(): void {
    this.pauseToggle.emit();
  }

  onReset(): void {
    this.reset.emit();
  }

  onOpenEditor(): void {
    this.openEditor.emit();
  }

  onSkip(): void {
    this.skip.emit();
  }
}
