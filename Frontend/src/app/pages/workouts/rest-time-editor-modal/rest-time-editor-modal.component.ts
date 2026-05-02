import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-rest-time-editor-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rest-time-editor-modal.component.html',
  styleUrl: './rest-time-editor-modal.component.scss'
})
export class RestTimeEditorModalComponent {
  @Input() open: boolean = false;
  @Input() exerciseName: string = '';
  @Input() value: number = 120;
  @Input() presets: number[] = [];

  @Output() cancel = new EventEmitter<void>();
  @Output() save = new EventEmitter<number>();
  @Output() presetSelect = new EventEmitter<number>();

  onCancel(): void {
    this.cancel.emit();
  }

  onSave(): void {
    this.save.emit(this.value);
  }

  onPresetSelect(preset: number): void {
    this.presetSelect.emit(preset);
  }

  formatRestPreset(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s === 0 ? `${m}m` : `${m}m ${s}s`;
  }
}
