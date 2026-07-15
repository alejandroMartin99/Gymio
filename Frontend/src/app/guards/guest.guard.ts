import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.initialized()) {
    return router.parseUrl('/splash');
  }
  if (auth.user()) {
    return router.parseUrl('/workouts');
  }
  return true;
};
