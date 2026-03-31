import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ActiveWorkoutService } from '../services/active-workout.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss'
})
export class AppShellComponent {
  constructor(
    private readonly router: Router,
    private readonly auth: AuthService,
    readonly activeWorkout: ActiveWorkoutService
  ) {}

  profileMenuOpen = false;

  user = {
    name: 'Perfil',
    tagline: 'Entrena simple. Progresa constante.',
    photoUrl: 'https://i.pravatar.cc/80?img=12'
  };

  navItems = [
    { label: 'New Workout', path: '/workouts', icon: '+' }
  ];
  showWorkoutConfirmModal = false;
  pendingWorkoutAction: 'cancel' | 'finish' | null = null;

  toggleProfileMenu(): void {
    this.profileMenuOpen = !this.profileMenuOpen;
  }

  closeProfileMenu(): void {
    this.profileMenuOpen = false;
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

  confirmWorkoutAction(): void {
    if (this.pendingWorkoutAction === 'finish') {
      this.activeWorkout.requestFinalize();
      setTimeout(() => {
        if (this.activeWorkout.isActive()) {
          this.activeWorkout.finishWorkout();
        }
      }, 250);
    } else if (this.pendingWorkoutAction === 'cancel') {
      this.activeWorkout.finishWorkout();
    }
    this.closeWorkoutConfirm();
  }
}
