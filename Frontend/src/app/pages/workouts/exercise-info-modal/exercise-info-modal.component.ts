import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ExerciseDbExercise } from '../../../models/exercisedb.model';
import {
  translateBodyPart,
  translateCategory,
  translateDifficulty,
  translateEquipment,
  translateTarget
} from '../../../core/exercisedb-i18n';

@Component({
  selector: 'app-exercise-info-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './exercise-info-modal.component.html',
  styleUrl: './exercise-info-modal.component.scss'
})
export class ExerciseInfoModalComponent {
  @Input() open: boolean = false;
  @Input() exerciseName: string = '';
  @Input() detail: ExerciseDbExercise | null = null;

  @Output() closed = new EventEmitter<void>();

  dbBodyPart(v: string): string {
    return translateBodyPart(v);
  }

  dbTarget(v: string): string {
    return translateTarget(v);
  }

  dbEquipment(v: string): string {
    return translateEquipment(v);
  }

  dbDifficulty(v: string): string {
    return translateDifficulty(v);
  }

  dbCategory(v: string): string {
    return translateCategory(v);
  }

  dbSecondaryMuscles(muscles: string[]): string {
    return muscles.map((m) => translateTarget(m)).join(', ');
  }

  onClose(): void {
    this.closed.emit();
  }
}
