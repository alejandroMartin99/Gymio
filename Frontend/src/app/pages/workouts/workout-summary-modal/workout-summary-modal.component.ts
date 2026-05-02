import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-workout-summary-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workout-summary-modal.component.html',
  styleUrl: './workout-summary-modal.component.scss'
})
export class WorkoutSummaryModalComponent {
  @Input() open: boolean = false;
  @Input() workoutName: string = '';
  @Input() elapsedLabel: string = '';
  @Input() exercisesCount: number = 0;
  @Input() setsCount: number = 0;

  @Output() closed = new EventEmitter<void>();

  onClose(): void {
    this.closed.emit();
  }
}
