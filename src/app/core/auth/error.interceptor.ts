import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../../models/garden.models';
import { SILENT_ERRORS } from '../api/garden-api';
import { NotificationService } from '../notification.service';
import { AuthService } from './auth.service';

export function errorMessage(err: HttpErrorResponse): string {
  if (err.status === 0) {
    return 'No se pudo conectar con el servidor';
  }
  const body = err.error as Partial<ApiError> | null;
  if (body && typeof body === 'object' && typeof body.message === 'string' && body.message) {
    return body.message;
  }
  if (err.status === 423) {
    return 'Cuenta bloqueada por intentos fallidos';
  }
  return `Error ${err.status}: ${err.statusText || 'solicitud fallida'}`;
}

export function errorCode(err: HttpErrorResponse): string | null {
  const body = err.error as Partial<ApiError> | null;
  return body && typeof body === 'object' && typeof body.error === 'string' ? body.error : null;
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(NotificationService);
  const auth = inject(AuthService);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const isLogin = req.url.endsWith('/auth/login');
        const isPasswordChange = req.url.endsWith('/auth/password');
        if (err.status === 403 && errorCode(err) === 'PASSWORD_CHANGE_REQUIRED') {
          auth.requirePasswordChange();
          auth.goToPasswordChange();
        } else if (err.status === 401 && !isLogin) {

          if (auth.isAuthenticated()) {
            auth.logout();
            notifications.error(errorMessage(err));
          }
        } else if (isLogin || isPasswordChange) {

        } else if (!req.context.get(SILENT_ERRORS)) {
          notifications.error(errorMessage(err));
        }
      }
      return throwError(() => err);
    }),
  );
};
