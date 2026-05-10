import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, RouteReuseStrategy } from '@angular/router';

import { routes } from './app.routes';
import { WorkoutsRouteReuseStrategy } from './route-reuse/workouts-route-reuse.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    WorkoutsRouteReuseStrategy,
    { provide: RouteReuseStrategy, useExisting: WorkoutsRouteReuseStrategy }
  ]
};
