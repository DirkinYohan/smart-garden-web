import { Routes } from '@angular/router';
import { authGuard, guestGuard, passwordChangeGuard } from './core/auth/auth.guard';
import { PASSWORD_CHANGE_PATH } from './core/auth/auth.service';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Iniciar sesión · Smart Garden',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {

    path: PASSWORD_CHANGE_PATH.slice(1),
    canActivate: [passwordChangeGuard],
    title: 'Cambiar contraseña · Smart Garden',
    loadComponent: () =>
      import('./features/auth/change-password/change-password').then((m) => m.ChangePassword),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Panel · Smart Garden',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'historial',
        title: 'Historial · Smart Garden',
        loadComponent: () => import('./features/history/history').then((m) => m.History),
      },
      {
        path: 'control',
        title: 'Control · Smart Garden',
        loadComponent: () => import('./features/control/control').then((m) => m.Control),
      },
      {
        path: 'ia',
        title: 'Inteligencia artificial · Smart Garden',
        loadComponent: () => import('./features/ai/ai').then((m) => m.Ai),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
