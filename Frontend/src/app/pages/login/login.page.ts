import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss'
})
export class LoginPage {
  constructor(public readonly auth: AuthService, private readonly router: Router) {}

  mode: 'login' | 'register' = 'login';
  fullName = '';
  email = '';
  password = '';
  confirmPassword = '';
  message = '';
  readonly minPasswordLength = 8;

  switchMode(mode: 'login' | 'register'): void {
    this.mode = mode;
    this.message = '';
    this.auth.error.set(null);
  }

  async submit(): Promise<void> {
    this.message = '';
    if (!this.email.trim()) {
      this.auth.error.set('Introduce un email valido.');
      return;
    }
    if (this.mode === 'register' && this.fullName.trim().length < 2) {
      this.auth.error.set('El nombre es obligatorio (minimo 2 caracteres).');
      return;
    }
    if (this.password.length < this.minPasswordLength) {
      this.auth.error.set(`La contrasena debe tener minimo ${this.minPasswordLength} caracteres.`);
      return;
    }
    if (this.mode === 'register' && this.password !== this.confirmPassword) {
      this.auth.error.set('Las contrasenas no coinciden.');
      return;
    }
    const ok =
      this.mode === 'login'
        ? await this.auth.signIn(this.email.trim(), this.password)
        : await this.auth.signUp(this.email.trim(), this.password, this.fullName.trim());

    if (!ok) {
      return;
    }
    if (this.mode === 'register') {
      this.message = 'Cuenta creada. Revisa tu email para confirmar si aplica.';
      this.password = '';
      this.confirmPassword = '';
    } else {
      void this.router.navigateByUrl('/workouts');
    }
  }
}
