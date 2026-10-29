import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, PASSWORD_CHANGE_PATH } from './auth.service';

/**
 * Rutas protegidas: sin sesión al login; con sesión pero con contraseña inicial pendiente, a la pantalla de cambio
 * (no puede ver el resto de la aplicación hasta cambiarla).
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.validToken()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  if (auth.mustChangePassword()) {
    return router.createUrlTree([PASSWORD_CHANGE_PATH]);
  }
  return true;
};

/** La pantalla de cambio de contraseña solo pide sesión (es la única accesible con el cambio pendiente). */
export const passwordChangeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.validToken()) {
    return true;
  }
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: PASSWORD_CHANGE_PATH } });
};

/** Login: un usuario autenticado va al Panel o, si debe cambiar la contraseña, a esa pantalla. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.validToken()) {
    return true;
  }
  return router.createUrlTree([auth.mustChangePassword() ? PASSWORD_CHANGE_PATH : '/']);
};
