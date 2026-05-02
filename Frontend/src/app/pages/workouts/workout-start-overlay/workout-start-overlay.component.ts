import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-workout-start-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workout-start-overlay.component.html',
  styleUrl: './workout-start-overlay.component.scss'
})
export class WorkoutStartOverlayComponent {
  @Input() show: boolean = false;
  @Input() currentGif: string = '';
}
