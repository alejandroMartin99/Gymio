import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-numeric-pad-sheet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './numeric-pad-sheet.component.html',
  styleUrl: './numeric-pad-sheet.component.scss'
})
export class NumericPadSheetComponent {
  @Input() open: boolean = false;
  @Input() value: string = '';
  @Input() fieldLabel: string = '';
  @Input() nextLabel: string = '';
  @Input() keys: string[] = [];

  @Output() keyPressed = new EventEmitter<string>();
  @Output() backspace = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Output() hide = new EventEmitter<void>();

  onKeyClick(key: string): void {
    this.keyPressed.emit(key);
  }

  onBackspace(): void {
    this.backspace.emit();
  }

  onNext(): void {
    this.next.emit();
  }

  onHide(): void {
    this.hide.emit();
  }
}
