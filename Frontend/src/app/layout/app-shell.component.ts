import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ActiveWorkoutService } from '../services/active-workout.service';
import { AuthService } from '../services/auth.service';
import { WorkoutRecordService } from '../services/workout-record.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss'
})
export class AppShellComponent {
  constructor(
    private readonly router: Router,
    readonly auth: AuthService,
    readonly activeWorkout: ActiveWorkoutService,
    private readonly workoutRecordService: WorkoutRecordService
  ) {}

  profileMenuOpen = false;
  avatarImgError = false;
  uploadModalOpen = false;
  nameModalOpen = false;
  nameInput = '';
  previewUrl = signal<string | null>(null);
  zoom = signal(1);
  uploading = signal(false);
  uploadError = signal<string | null>(null);
  nameSaving = signal(false);
  nameError = signal<string | null>(null);
  private previewBlobUrl: string | null = null;
  private lastTouchDist: number | null = null;
  private uploadFileName = 'avatar.webp';

  readonly tagline = 'Entrena simple. Progresa constante.';

  navItems = [
    { label: 'Perfil', path: '/profile', iconSrc: '/icons/user-circle.svg', icon: '' },
    { label: 'New Workout', path: '/workouts', iconSrc: '/icons/plus-circle.svg', icon: '', center: true },
    { label: 'Historic', path: '/historic', iconSrc: '/icons/chart-line.svg', icon: '' }
  ];
  showWorkoutConfirmModal = false;
  pendingWorkoutAction: 'cancel' | 'finish' | null = null;

  toggleProfileMenu(): void {
    this.profileMenuOpen = !this.profileMenuOpen;
  }

  closeProfileMenu(): void {
    this.profileMenuOpen = false;
  }

  openUploadModal(): void {
    this.closeProfileMenu();
    this.uploadError.set(null);
    this.zoom.set(1);
    this.previewUrl.set(this.auth.avatarUrl());
    this.uploadFileName = 'avatar.webp';
    this.uploadModalOpen = true;
  }

  closeUploadModal(): void {
    this.uploadModalOpen = false;
    this.revokeBlobUrl();
    this.previewUrl.set(null);
    this.zoom.set(1);
    this.uploadError.set(null);
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.revokeBlobUrl();
    this.previewBlobUrl = URL.createObjectURL(file);
    this.uploadFileName = file.name;
    this.previewUrl.set(this.previewBlobUrl);
    this.zoom.set(1);
    this.uploadError.set(null);
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.zoom.update(z => Math.min(3, Math.max(1, z + (event.deltaY > 0 ? -0.1 : 0.1))));
  }

  onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 2) {
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      this.lastTouchDist = Math.hypot(dx, dy);
    }
  }

  onTouchMove(event: TouchEvent): void {
    if (event.touches.length !== 2 || this.lastTouchDist === null) return;
    event.preventDefault();
    const dx = event.touches[0].clientX - event.touches[1].clientX;
    const dy = event.touches[0].clientY - event.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    this.zoom.update(z => Math.min(3, Math.max(1, z * (dist / this.lastTouchDist!))));
    this.lastTouchDist = dist;
  }

  onTouchEnd(): void { this.lastTouchDist = null; }

  async confirmUpload(): Promise<void> {
    const src = this.previewUrl();
    if (!src) return;
    this.uploading.set(true);
    this.uploadError.set(null);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = src;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
      });
      const z = Math.min(3, Math.max(1, this.zoom()));
      const side = Math.min(img.width, img.height) / z;
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      canvas.getContext('2d')!.drawImage(img, sx, sy, side, side, 0, 0, 256, 256);
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob(b => (b ? res(b) : rej(new Error('Error al procesar imagen.'))), 'image/webp'),
      );
      const { error } = await this.auth.uploadAvatar(blob, this.uploadFileName);
      if (error) {
        this.uploadError.set(error.message);
        return;
      }
      this.avatarImgError = false;
      this.closeUploadModal();
    } catch (e: unknown) {
      this.uploadError.set((e as Error)?.message ?? 'Error al subir la imagen.');
    } finally {
      this.uploading.set(false);
    }
  }

  openNameModal(): void {
    this.closeProfileMenu();
    this.nameInput = this.auth.displayName();
    this.nameError.set(null);
    this.nameModalOpen = true;
  }

  closeNameModal(): void {
    this.nameModalOpen = false;
    this.nameError.set(null);
  }

  async saveName(): Promise<void> {
    if (!this.nameInput.trim()) return;
    this.nameSaving.set(true);
    this.nameError.set(null);
    const { error } = await this.auth.updateProfile(this.nameInput.trim());
    this.nameSaving.set(false);
    if (error) {
      this.nameError.set(error.message);
      return;
    }
    this.closeNameModal();
  }

  async logout(): Promise<void> {
    this.closeProfileMenu();
    await this.auth.signOut();
    void this.router.navigateByUrl('/login');
  }

  finishWorkout(): void {
    this.openWorkoutConfirm('finish');
  }

  cancelWorkout(): void {
    this.openWorkoutConfirm('cancel');
  }

  openWorkoutConfirm(action: 'cancel' | 'finish'): void {
    this.pendingWorkoutAction = action;
    this.showWorkoutConfirmModal = true;
  }

  closeWorkoutConfirm(): void {
    this.showWorkoutConfirmModal = false;
    this.pendingWorkoutAction = null;
  }

  openActiveWorkoutSession(): void {
    if (!this.activeWorkout.isActive()) {
      return;
    }
    this.closeProfileMenu();
    const path = this.router.url.split('?')[0];
    if (path === '/workouts') {
      this.activeWorkout.requestResumeWorkoutPanel();
    } else {
      void this.router.navigate(['/workouts']);
    }
  }

  async confirmWorkoutAction(): Promise<void> {
    if (this.pendingWorkoutAction === 'finish') {
      this.activeWorkout.requestFinalize();
      setTimeout(() => {
        if (this.activeWorkout.isActive()) {
          this.activeWorkout.finishWorkout();
        }
      }, 250);
    } else if (this.pendingWorkoutAction === 'cancel') {
      const workoutId = this.activeWorkout.workoutId();
      if (workoutId) {
        await this.workoutRecordService.deleteWorkout(workoutId);
      }
      this.activeWorkout.finishWorkout();
    }
    this.closeWorkoutConfirm();
  }

  private revokeBlobUrl(): void {
    if (this.previewBlobUrl) {
      URL.revokeObjectURL(this.previewBlobUrl);
      this.previewBlobUrl = null;
    }
  }
}
