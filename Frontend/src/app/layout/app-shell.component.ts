import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss'
})
export class AppShellComponent {
  constructor(private readonly router: Router, private readonly auth: AuthService) {}

  profileMenuOpen = false;

  user = {
    name: 'Perfil',
    tagline: 'Entrena simple. Progresa constante.',
    photoUrl: 'https://i.pravatar.cc/80?img=12'
  };

  navItems = [
    { label: 'New Workout', path: '/workouts', icon: '+' }
  ];

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
}
