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
      this.error.set(error.message);
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
      this.error.set(error.message);
      return false;
    }
    return true;
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
    this.user.set(null);
  }
}
