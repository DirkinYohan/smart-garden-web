import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { authGuard, guestGuard, passwordChangeGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard / guestGuard / passwordChangeGuard', () => {
  let token: string | null;
  let mustChange: boolean;

  beforeEach(() => {
    token = null;
    mustChange = false;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { validToken: () => token, mustChangePassword: () => mustChange } },
      ],
    });
  });

  const runAuth = (url: string) =>
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
  const runGuest = () =>
    TestBed.runInInjectionContext(() => guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
  const runPasswordChange = () =>
    TestBed.runInInjectionContext(() =>
      passwordChangeGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

  it('allows navigation with a valid session', () => {
    token = 'jwt';
    expect(runAuth('/control')).toBe(true);
  });

  it('redirects to /login with the return URL when not authenticated', () => {
    const result = runAuth('/control') as UrlTree;
    const router = TestBed.inject(Router);

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result)).toBe('/login?returnUrl=%2Fcontrol');
  });

  it('sends a user with a pending password change to /cambiar-contrasena', () => {
    token = 'jwt';
    mustChange = true;

    const result = runAuth('/control') as UrlTree;

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/cambiar-contrasena');
  });

  it('always lets an authenticated user open the password change screen', () => {
    token = 'jwt';
    mustChange = true;

    expect(runPasswordChange()).toBe(true);
  });

  it('passwordChangeGuard sends anonymous users to the login', () => {
    const result = runPasswordChange() as UrlTree;

    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login?returnUrl=%2Fcambiar-contrasena');
  });

  it('guestGuard sends an authenticated user to the dashboard', () => {
    token = 'jwt';
    const result = runGuest() as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/');
  });

  it('guestGuard sends an authenticated user with a pending change to that screen', () => {
    token = 'jwt';
    mustChange = true;
    const result = runGuest() as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/cambiar-contrasena');
  });

  it('guestGuard lets anonymous users see the login page', () => {
    expect(runGuest()).toBe(true);
  });
});
