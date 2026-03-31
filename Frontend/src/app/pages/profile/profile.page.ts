import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="profile-page">
      <h2>Perfil</h2>
      <p>Gestiona tu cuenta de Gymio.</p>

      <div class="card">
        <strong>Cuenta activa</strong>
        <small>{{ auth.user()?.email || 'Sin email' }}</small>
      </div>

      <button type="button" (click)="logout()">Cerrar sesion</button>
    </section>
  `,
  styles: [`
    .profile-page {
      display: grid;
      gap: 0.75rem;
    }

    h2 {
      margin: 0;
      font-size: 1.2rem;
      color: #111;
    }

    p {
      margin: 0;
      color: #6b7280;
      font-size: 0.88rem;
    }

    .card {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      background: #fff;
      padding: 0.75rem;
      display: grid;
      gap: 0.2rem;
    }

    .card strong {
      font-size: 0.9rem;
      color: #111827;
    }

    .card small {
      font-size: 0.8rem;
      color: #6b7280;
    }

    button {
      justify-self: start;
      border: 1px solid #111;
      border-radius: 10px;
      background: #111;
      color: #fff;
      padding: 0.55rem 0.85rem;
      font: inherit;
      font-size: 0.84rem;
      font-weight: 600;
      cursor: pointer;
    }
  `]
})
export class ProfilePage {
  constructor(readonly auth: AuthService, private readonly router: Router) {}

  async logout(): Promise<void> {
    await this.auth.signOut();
    void this.router.navigateByUrl('/login');
  }
}
