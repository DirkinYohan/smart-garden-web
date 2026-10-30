import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, PASSWORD_CHANGE_PATH } from './auth.service';

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

export const passwordChangeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.validToken()) {
    return true;
  }
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: PASSWORD_CHANGE_PATH } });
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.validToken()) {
    return true;
  }
  return router.createUrlTree([auth.mustChangePassword() ? PASSWORD_CHANGE_PATH : '/']);
};
