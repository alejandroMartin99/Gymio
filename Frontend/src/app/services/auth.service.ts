import { Injectable, computed, signal } from '@angular/core';
import { User } from '@supabase/supabase-js';

import { supabase } from '../core/supabase.client';
import { WorkoutsRouteReuseStrategy } from '../route-reuse/workouts-route-reuse.strategy';
import { WorkoutRecordService } from './workout-record.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<User | null>(null);
  readonly loading = signal(false);
  readonly initialized = signal(false);
  readonly error = signal<string | null>(null);

  readonly displayName = computed(() => {
    const u = this.user();
    if (!u) return '';
    const meta = u.user_metadata;
    return (meta?.['full_name'] || meta?.['name'] || meta?.['user_name'] || '')?.trim()
      || (u.email ? u.email.split('@')[0] : '');
  });

  readonly avatarUrl = computed((): string | null => {
    const u = this.user() as any;
    const meta = u?.user_metadata ?? {};
    const url: string | undefined = meta['avatar_url'] || meta['picture'] || meta['avatar'];
    return typeof url === 'string' && url.trim().length > 0 ? url.trim() : null;
  });

  readonly avatarInitials = computed((): string => {
    const name = this.displayName() || (this.user()?.email ?? '');
    const trimmed = name.trim();
    if (!trimmed) return '?';
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts[0].includes('@')) {
      const local = parts[0].split('@')[0];
      return local.length >= 2 ? (local[0] + local[1]).toUpperCase() : local[0].toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  });

  constructor(
    private readonly workoutsRouteReuse: WorkoutsRouteReuseStrategy,
    private readonly workoutRecord: WorkoutRecordService
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized()) return;
    const { data, error } = await supabase.auth.getSession();
    if (error) this.error.set(error.message);
    this.user.set(data.session?.user ?? null);
    this.initialized.set(true);
    supabase.auth.onAuthStateChange((_event, session) => {
      const prevId = this.user()?.id ?? null;
      const nextId = session?.user?.id ?? null;
      if (prevId !== nextId) {
        this.workoutsRouteReuse.clearStored();
        this.workoutRecord.clearDetailCaches();
      }
      this.user.set(session?.user ?? null);
    });
  }

  async signIn(email: string, password: string): Promise<boolean> {
    this.loading.set(true);
    this.error.set(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    this.loading.set(false);
    if (error) { this.error.set(this.mapAuthError(error.message)); return false; }
    return true;
  }

  async signUp(email: string, password: string, fullName: string): Promise<boolean> {
    this.loading.set(true);
    this.error.set(null);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } }
    });
    this.loading.set(false);
    if (error) { this.error.set(this.mapAuthError(error.message)); return false; }
    return true;
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
    this.user.set(null);
  }

  async updateProfile(fullName: string): Promise<{ error: Error | null }> {
    const name = fullName.trim();
    if (!name) return { error: null };
    const { data, error } = await supabase.auth.updateUser({ data: { full_name: name } });
    if (!error && data.user) this.user.set(data.user);
    return { error: error as Error | null };
  }

  async uploadAvatar(blob: Blob, fileName = 'avatar.webp'): Promise<{ publicUrl: string | null; error: Error | null }> {
    const currentUser = this.user();
    if (!currentUser) return { publicUrl: null, error: new Error('No hay usuario autenticado') };

    const rawExt = (fileName.split('.').pop() ?? 'webp').toLowerCase();
    const allowed = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
    const fileExt = allowed.has(rawExt) ? rawExt : 'webp';
    const filePath = `user-${currentUser.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, blob, { upsert: true, cacheControl: '3600' });

    if (uploadError) return { publicUrl: null, error: uploadError as Error };

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const publicUrl = data?.publicUrl ?? null;
    if (!publicUrl) return { publicUrl: null, error: new Error('No se pudo obtener la URL pública') };

    const { data: updated, error: metaError } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
    if (!metaError && updated.user) this.user.set(updated.user);

    return { publicUrl, error: null };
  }

  private mapAuthError(rawMessage: string): string {
    const message = rawMessage.toLowerCase();
    if (message.includes('email rate limit exceeded')) return 'Has hecho demasiados intentos. Espera un minuto.';
    if (message.includes('user already registered')) return 'Este email ya está registrado. Prueba iniciar sesión.';
    if (message.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
    if (message.includes('email not confirmed')) return 'Debes confirmar tu email antes de iniciar sesión.';
    return rawMessage;
  }
}
