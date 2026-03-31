import { Injectable, signal } from '@angular/core';
import { User } from '@supabase/supabase-js';

import { supabase } from '../core/supabase.client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<User | null>(null);
  readonly loading = signal(false);
  readonly initialized = signal(false);
  readonly error = signal<string | null>(null);

  async initialize(): Promise<void> {
    if (this.initialized()) {
      return;
    }
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      this.error.set(error.message);
    }
    this.user.set(data.session?.user ?? null);
    this.initialized.set(true);

    supabase.auth.onAuthStateChange((_event, session) => {
      this.user.set(session?.user ?? null);
    });
  }

  async signIn(email: string, password: string): Promise<boolean> {
    this.loading.set(true);
    this.error.set(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    this.loading.set(false);
    if (error) {
      this.error.set(this.mapAuthError(error.message));
      return false;
    }
    return true;
  }

  async signUp(email: string, password: string, fullName: string): Promise<boolean> {
    this.loading.set(true);
    this.error.set(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });
    this.loading.set(false);
    if (error) {
      this.error.set(this.mapAuthError(error.message));
      return false;
    }
    return true;
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
    this.user.set(null);
  }

  private mapAuthError(rawMessage: string): string {
    const message = rawMessage.toLowerCase();

    if (message.includes('email rate limit exceeded')) {
      return 'Has hecho demasiados intentos de registro. Espera un minuto y vuelve a intentarlo.';
    }
    if (message.includes('user already registered')) {
      return 'Este email ya esta registrado. Prueba iniciar sesion.';
    }
    if (message.includes('invalid login credentials')) {
      return 'Email o contrasena incorrectos.';
    }
    if (message.includes('email not confirmed')) {
      return 'Debes confirmar tu email antes de iniciar sesion.';
    }

    return rawMessage;
  }
}
