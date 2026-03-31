import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { ExerciseCatalogItem } from '../models/exercise-catalog.model';
import { supabase } from '../core/supabase.client';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
}

@Injectable({ providedIn: 'root' })
export class ExerciseCatalogService {
  readonly groups = signal<string[]>([]);
  readonly items = signal<ExerciseCatalogItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor(private readonly http: HttpClient) {}

  async loadGroups(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<string[]>>(`${environment.apiUrl}/api/exercises/groups`, {
          headers: await this.authHeaders()
        })
      );
      this.groups.set(res.data ?? []);
    } catch {
      this.error.set('No se pudieron cargar grupos musculares.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadByGroup(group: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<ExerciseCatalogItem[]>>(`${environment.apiUrl}/api/exercises/catalog`, {
          params: { group },
          headers: await this.authHeaders()
        })
      );
      this.items.set(res.data ?? []);
    } catch {
      this.error.set('No se pudo cargar el catalogo.');
    } finally {
      this.loading.set(false);
    }
  }

  async createCustom(name: string, muscleGroup: string): Promise<ExerciseCatalogItem | null> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<ExerciseCatalogItem>>(
          `${environment.apiUrl}/api/exercises/custom`,
          { name, muscle_group: muscleGroup },
          { headers: await this.authHeaders() }
        )
      );
      return res.data;
    } catch {
      this.error.set('No se pudo crear el ejercicio personalizado.');
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      throw new Error('No active session');
    }
    return { Authorization: `Bearer ${token}` };
  }
}
