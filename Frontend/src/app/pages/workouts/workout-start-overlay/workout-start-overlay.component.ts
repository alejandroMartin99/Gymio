import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-workout-start-overlay',
  standalone: true,
  templateUrl: './workout-start-overlay.component.html',
  styleUrl: './workout-start-overlay.component.scss'
})
export class WorkoutStartOverlayComponent {
  @Input() show = false;
}
