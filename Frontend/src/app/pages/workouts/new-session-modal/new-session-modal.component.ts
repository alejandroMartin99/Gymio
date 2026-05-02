import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-new-session-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './new-session-modal.component.html',
  styleUrl: './new-session-modal.component.scss'
})
export class NewSessionModalComponent {
  @Input() open: boolean = false;
  @Input() workoutName: string = '';
  @Input() error: string | null = null;
  @Input() isLoading: boolean = false;

  @Output() nameChange = new EventEmitter<string>();
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onNameChange(value: string): void {
    this.nameChange.emit(value);
  }

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
