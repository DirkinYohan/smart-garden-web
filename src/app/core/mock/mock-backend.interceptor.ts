import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, defer, delay, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError } from '../../models/garden.models';
import { MockBackend, MockHttpError } from './mock-backend';



/**
 * Answers api-gateway requests from MockBackend (environment.useMock). Registered last, so the
 * auth and error interceptors run as with the real backend.
 */
export const mockBackendInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.useMock || !req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }
  const backend = inject(MockBackend);
  const path = req.url.substring(environment.apiUrl.length);
  return defer(() => {
    try {
      return respond(req, path, handle(backend, req, path));
    } catch (e) {
      const status = e instanceof MockHttpError ? e.status : 500;
      const message = e instanceof Error ? e.message : 'Error interno del servidor';
      const code = e instanceof MockHttpError ? e.code : undefined;
      return fail(req, path, status, message, code);
    }
  });
};

function handle(backend: MockBackend, req: HttpRequest<unknown>, path: string): unknown {
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (path === '/auth/login' && req.method === 'POST') {
    return backend.login(String(body['username'] ?? ''), String(body['password'] ?? ''));
  }
  if (!req.headers.get('Authorization')?.startsWith('Bearer ')) {
    throw new MockHttpError(401, 'Se requiere autenticación');
  }
  if (path === '/auth/me' && req.method === 'GET') {
    return backend.me();
  }
  if (path === '/auth/password' && req.method === 'PUT') {
    return backend.changePassword(String(body['currentPassword'] ?? ''), String(body['newPassword'] ?? ''));
  }
  if (backend.requiresPasswordChange()) {
    throw new MockHttpError(403, 'Debes cambiar la contraseña antes de continuar', 'PASSWORD_CHANGE_REQUIRED');
  }
  const limit = Number(req.params.get('limit') ?? 20);
  const crop = /^\/crops\/(\d+)$/.exec(path);
  switch (`${req.method} ${crop ? '/crops/:id' : path}`) {
    case 'GET /status':
      return backend.status();
    case 'GET /telemetry/history':
      return backend.history(req.params.get('range') ?? '24h');
    case 'GET /irrigation/events':
      return backend.irrigationEvents(limit);
    case 'GET /config':
      return backend.getConfig();
    case 'PUT /config':
      return backend.updateConfig(body);
    case 'GET /crops':
      return backend.getCrops();
    case 'PUT /crops/:id':
      return backend.updateCrop(Number(crop![1]), body as never);
    case 'POST /pump/start':
      return backend.pump('ON', Number(body['durationSec']));
    case 'POST /pump/stop':
      return backend.pump('OFF');
    case 'GET /ai/analysis/latest':
      return backend.latestAnalysis();
    case 'GET /ai/analysis':
      return backend.listAnalyses(limit);
    case 'POST /ai/analysis':
      return backend.requestAnalysis();
    case 'GET /ai/stats':
      return backend.stats(Number(req.params.get('days') ?? 7));
    case 'GET /weather':
      return backend.weather();
    default:
      throw new MockHttpError(404, 'Recurso no encontrado');
  }
}

function respond(req: HttpRequest<unknown>, path: string, body: unknown): Observable<HttpResponse<unknown>> {
  // An AI analysis takes a few seconds with the real backend.
  const latency = path === '/ai/analysis' && req.method === 'POST' ? 2500 : 250 + Math.random() * 250;
  return of(new HttpResponse({ status: 200, body, url: req.url })).pipe(delay(latency));
}

function fail(
  req: HttpRequest<unknown>,
  path: string,
  status: number,
  message: string,
  code?: string,
): Observable<never> {
  const error: ApiError = {
    timestamp: new Date().toISOString(),
    status,
    error: code ?? (status === 401 ? 'Unauthorized' : status === 404 ? 'Not Found' : 'Error'),
    message,
    path: '/api/v1' + path,
  };
  return throwError(() => new HttpErrorResponse({ status, error, url: req.url })).pipe(delay(300));
}
