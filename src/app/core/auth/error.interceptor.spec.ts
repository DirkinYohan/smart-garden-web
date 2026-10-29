import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SILENT_ERRORS } from '../api/garden-api';
import { NotificationService } from '../notification.service';
import { AuthService } from './auth.service';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let notify: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };
  let auth: {
    logout: ReturnType<typeof vi.fn>;
    isAuthenticated: () => boolean;
    requirePasswordChange: ReturnType<typeof vi.fn>;
    goToPasswordChange: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    notify = { error: vi.fn(), success: vi.fn() };
    auth = {
      logout: vi.fn(),
      isAuthenticated: () => true,
      requirePasswordChange: vi.fn(),
      goToPasswordChange: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notify },
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  const apiError = (status: number, message: string, error = 'Error') => ({
    timestamp: '2026-10-21T12:00:00Z',
    status,
    error,
    message,
    path: '/api/v1/pump/start',
  });

  it('shows the backend message in a snackbar', () => {
    http.post('/api/v1/pump/start', {}).subscribe({ error: () => undefined });
    controller
      .expectOne('/api/v1/pump/start')
      .flush(apiError(409, 'La contraseña actual no es correcta'), { status: 409, statusText: 'Conflict' });

    expect(notify.error).toHaveBeenCalledWith('La contraseña actual no es correcta');
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('ends the session on 401 and explains that the password changed', () => {
    http.get('/api/v1/status').subscribe({ error: () => undefined });
    controller.expectOne('/api/v1/status').flush(apiError(401, 'Tu sesión se cerró porque la contraseña cambió'), {
      status: 401,
      statusText: 'Unauthorized',
    });

    expect(auth.logout).toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith('Tu sesión se cerró porque la contraseña cambió');
  });

  it('sends the user to /cambiar-contrasena on 403 PASSWORD_CHANGE_REQUIRED', () => {
    http.get('/api/v1/status').subscribe({ error: () => undefined });
    controller.expectOne('/api/v1/status').flush(apiError(403, 'Debes cambiar la contraseña antes de continuar', 'PASSWORD_CHANGE_REQUIRED'), {
      status: 403,
      statusText: 'Forbidden',
    });

    expect(auth.requirePasswordChange).toHaveBeenCalled();
    expect(auth.goToPasswordChange).toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('keeps login and password-change errors inside the form (no snackbar)', () => {
    http.post('/api/v1/auth/login', {}).subscribe({ error: () => undefined });
    controller
      .expectOne('/api/v1/auth/login')
      .flush(apiError(423, 'Cuenta bloqueada por intentos fallidos. Intenta de nuevo en 12 minutos'), {
        status: 423,
        statusText: 'Locked',
      });
    http.put('/api/v1/auth/password', {}).subscribe({ error: () => undefined });
    controller
      .expectOne('/api/v1/auth/password')
      .flush(apiError(400, 'La contraseña actual no es correcta'), { status: 400, statusText: 'Bad Request' });

    expect(notify.error).not.toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('reports network errors in Spanish', () => {
    http.get('/api/v1/status').subscribe({ error: () => undefined });
    controller.expectOne('/api/v1/status').error(new ProgressEvent('error'), { status: 0 });

    expect(notify.error).toHaveBeenCalledWith('No se pudo conectar con el servidor');
  });

  it('stays silent when the request asks for it', () => {
    http
      .get('/api/v1/ai/analysis/latest', { context: new HttpContext().set(SILENT_ERRORS, true) })
      .subscribe({ error: () => undefined });
    controller.expectOne('/api/v1/ai/analysis/latest').flush(apiError(404, 'x'), { status: 404, statusText: 'Not Found' });

    expect(notify.error).not.toHaveBeenCalled();
  });
});
