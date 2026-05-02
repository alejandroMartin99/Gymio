import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExerciseCatalogItem } from '../../../models/exercise-catalog.model';
import { ExerciseCatalogService } from '../../../services/exercise-catalog.service';
import { translateExerciseName } from '../../../core/exercisedb-i18n';
import { resolveExerciseIcon } from '../../../core/exercise-icons';
import { EXERCISEDB_LOCAL_MEDIA_IDS } from '../../../core/exercisedb-local-media';

type EquipmentFilter = 'all' | 'dumbbell' | 'barbell' | 'machine' | 'free';

@Component({
  selector: 'app-exercise-catalog-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './exercise-catalog-modal.component.html',
  styleUrl: './exercise-catalog-modal.component.scss'
})
export class ExerciseCatalogModalComponent {
  private readonly catalogService = inject(ExerciseCatalogService);

  @Input() open: boolean = false;
  @Input() selectedMuscleGroup: string = '';
  @Input() selectedEquipmentFilter: EquipmentFilter = 'all';
  @Input() searchQuery: string = '';
  @Input() catalogItems: ExerciseCatalogItem[] = [];
  @Input() selectedThumbs: string[] = [];
  @Input() isLoading: boolean = false;
  @Input() muscleGroupSlides: Array<{ key: string; label: string; image: string }> = [];
  @Input() equipmentFilters: Array<{ key: EquipmentFilter; label: string }> = [];

  @Output() muscleGroupSelected = new EventEmitter<string>();
  @Output() equipmentFilterChange = new EventEmitter<EquipmentFilter>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() exercisePicked = new EventEmitter<ExerciseCatalogItem>();
  @Output() cancel = new EventEmitter<void>();

  catalogThumb(item: ExerciseCatalogItem): string {
    const ext = item.external_exercise_id;
    if (ext && EXERCISEDB_LOCAL_MEDIA_IDS.has(ext)) {
      return `/exercises/exercisedb/gifs/${ext}.gif`;
    }
    return this.catalogService.listThumbs()[item.id]
      || resolveExerciseIcon(item.icon_key, item.muscle_group, item.icon_url, item.name);
  }

  displayPrimaryName(item: ExerciseCatalogItem): string {
    return translateExerciseName(item.name) || item.name;
  }

  displaySecondaryName(item: ExerciseCatalogItem): string {
    const en = (item.name || '').trim();
    const es = this.displayPrimaryName(item).trim();
    return this.normalizeText(en) !== this.normalizeText(es) ? en : '';
  }

  private normalizeText(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }

  onMuscleGroupSelected(key: string): void {
    this.muscleGroupSelected.emit(key);
  }

  onEquipmentFilterChange(key: EquipmentFilter): void {
    this.equipmentFilterChange.emit(key);
  }

  onSearchChange(value: string): void {
    this.searchChange.emit(value);
  }

  onExercisePicked(exercise: ExerciseCatalogItem): void {
    this.exercisePicked.emit(exercise);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onSearch(): void {
    // Search is debounced at parent level via onSearchChange
  }
}
