import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, DetachedRouteHandle, RouteReuseStrategy } from '@angular/router';

/**
 * Mantiene vivo el componente de /workouts al cambiar entre pestañas del shell
 * (perfil, histórico) para evitar destruir estado y repetir carga completa.
 */
@Injectable()
export class WorkoutsRouteReuseStrategy extends RouteReuseStrategy {
  private readonly handles = new Map<string, DetachedRouteHandle>();

  /** Cerrar sesión o cambiar de usuario: no reutilizar la pantalla de entrenos. */
  clearStored(): void {
    this.handles.clear();
  }

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return this.isWorkoutsTab(route);
  }

  store(_route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    if (handle && this.isWorkoutsTab(_route)) {
      this.handles.set('workouts', handle);
    }
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    return this.isWorkoutsTab(route) && this.handles.has('workouts');
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    if (!this.isWorkoutsTab(route)) {
      return null;
    }
    return this.handles.get('workouts') ?? null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig;
  }

  private isWorkoutsTab(route: ActivatedRouteSnapshot): boolean {
    return route.routeConfig?.path === 'workouts';
  }
}
