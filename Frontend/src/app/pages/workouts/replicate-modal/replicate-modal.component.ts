import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-replicate-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './replicate-modal.component.html',
  styleUrl: './replicate-modal.component.scss'
})
export class ReplicateModalComponent {
  @Input() open: boolean = false;
  @Input() records: Array<{ id: string; workout_name: string }> = [];
  @Input() selectedId: string = '';
  @Input() confirmed: boolean = false;
  @Input() isLoading: boolean = false;

  @Output() workoutSelected = new EventEmitter<string>();
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onWorkoutSelected(id: string): void {
    this.workoutSelected.emit(id);
  }

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
