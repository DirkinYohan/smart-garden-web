import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../../models/garden.models';
import { SILENT_ERRORS } from '../api/garden-api';
import { NotificationService } from '../notification.service';
import { AuthService } from './auth.service';

/** Extracts the user-facing message from an api-gateway error. */
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

/** Código del error del gateway (`error: PASSWORD_CHANGE_REQUIRED`), si viene. */
export function errorCode(err: HttpErrorResponse): string | null {
  const body = err.error as Partial<ApiError> | null;
  return body && typeof body === 'object' && typeof body.error === 'string' ? body.error : null;
}

/**
 * Shows the backend `message` in a snackbar y aplica las reglas de sesión:
 * - 403 PASSWORD_CHANGE_REQUIRED → marca el cambio pendiente y lleva a /cambiar-contrasena;
 * - 401 con sesión activa → la cierra y avisa (la contraseña cambió en otra sesión);
 * - login y cambio de contraseña muestran sus errores en el propio formulario.
 */
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
          // Varias peticiones en paralelo pueden fallar a la vez: cerrar sesión una sola vez.
          if (auth.isAuthenticated()) {
            auth.logout();
            notifications.error(errorMessage(err));
          }
        } else if (isLogin || isPasswordChange) {
          // El formulario muestra el mensaje junto al campo (401/423/400).
        } else if (!req.context.get(SILENT_ERRORS)) {
          notifications.error(errorMessage(err));
        }
      }
      return throwError(() => err);
    }),
  );
};
