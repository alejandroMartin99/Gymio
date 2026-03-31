import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';
import { HistoricPage } from './pages/historic/historic.page';
import { ProfilePage } from './pages/profile/profile.page';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'workouts'
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: 'workouts',
        loadComponent: () => import('./pages/workouts/workouts.page').then((m) => m.WorkoutsPage)
      },
      {
        path: 'historic',
        component: HistoricPage
      },
      {
        path: 'profile',
        component: ProfilePage
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'workouts'
  }
];
