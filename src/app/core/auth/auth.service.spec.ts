import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { GardenApi } from '../api/garden-api';
import { AuthService, PASSWORD_CHANGE_PATH, SESSION_KEY } from './auth.service';

describe('AuthService', () => {
  const inOneHour = () => new Date(Date.now() + 3600_000).toISOString();
  let api: { login: ReturnType<typeof vi.fn>; me: ReturnType<typeof vi.fn>; changePassword: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  function setup(): AuthService {
    TestBed.configureTestingModule({
      providers: [
        { provide: GardenApi, useValue: api },
        { provide: Router, useValue: router },
      ],
    });
    return TestBed.inject(AuthService);
  }

  const loginResult = (overrides: Partial<{ mustChangePassword: boolean; token: string }> = {}) => ({
    token: overrides.token ?? 'jwt-1',
    expiresAt: inOneHour(),
    mustChangePassword: overrides.mustChangePassword ?? false,
    username: 'admin',
  });

  beforeEach(() => {
    localStorage.clear();
    api = { login: vi.fn(), me: vi.fn(), changePassword: vi.fn() };
    router = { navigate: vi.fn().mockResolvedValue(true) };
  });

  it('stores the session after login', () => {
    api.login.mockReturnValue(of(loginResult()));
    const auth = setup();

    auth.login('admin', 'secret').subscribe();

    expect(api.login).toHaveBeenCalledWith('admin', 'secret');
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.username()).toBe('admin');
    expect(auth.validToken()).toBe('jwt-1');
    expect(auth.mustChangePassword()).toBe(false);
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!).token).toBe('jwt-1');
  });

  it('remembers that the initial password must be changed', () => {
    api.login.mockReturnValue(of(loginResult({ mustChangePassword: true })));
    const auth = setup();

    auth.login('admin', 'admin123').subscribe();

    expect(auth.mustChangePassword()).toBe(true);

    expect(JSON.stringify(localStorage.getItem(SESSION_KEY))).not.toContain('admin123');
  });

  it('replaces the token after the password change and clears the pending flag', () => {
    api.login.mockReturnValue(of(loginResult({ mustChangePassword: true })));
    api.changePassword.mockReturnValue(of({ token: 'jwt-2', expiresAt: inOneHour() }));
    const auth = setup();
    auth.login('admin', 'admin123').subscribe();

    auth.changePassword('admin123', 'ClaveNueva2026').subscribe();

    expect(api.changePassword).toHaveBeenCalledWith({
      currentPassword: 'admin123',
      newPassword: 'ClaveNueva2026',
    });
    expect(auth.validToken()).toBe('jwt-2');
    expect(auth.mustChangePassword()).toBe(false);
    expect(auth.passwordChangedAt()).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!).token).toBe('jwt-2');
  });

  it('refresh syncs the pending flag and the last change date from /auth/me', () => {
    api.login.mockReturnValue(of(loginResult()));
    api.me.mockReturnValue(
      of({
        username: 'admin',
        role: 'ADMIN',
        mustChangePassword: true,
        passwordChangedAt: '2026-10-20T12:00:00Z',
      }),
    );
    const auth = setup();
    auth.login('admin', 'secret').subscribe();

    auth.refresh().subscribe();

    expect(auth.mustChangePassword()).toBe(true);
    expect(auth.passwordChangedAt()).toBe('2026-10-20T12:00:00Z');
  });

  it('requirePasswordChange flags the session and goToPasswordChange navigates', () => {
    api.login.mockReturnValue(of(loginResult()));
    const auth = setup();
    auth.login('admin', 'secret').subscribe();

    auth.requirePasswordChange();
    auth.goToPasswordChange();

    expect(auth.mustChangePassword()).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith([PASSWORD_CHANGE_PATH]);
  });

  it('restores a valid session from localStorage', () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token: 'saved', expiresAt: inOneHour(), username: 'ana' }));
    const auth = setup();

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.username()).toBe('ana');
    expect(auth.mustChangePassword()).toBe(false);
  });

  it('ignores and removes an expired session', () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ token: 'old', expiresAt: new Date(Date.now() - 1000).toISOString(), username: 'ana' }),
    );
    const auth = setup();

    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('logout clears the session and goes to the login page', () => {
    api.login.mockReturnValue(of(loginResult()));
    const auth = setup();
    auth.login('admin', 'secret').subscribe();

    auth.logout('expired');

    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'expired' } });
  });

  it('isExpired handles past, future and invalid dates', () => {
    const now = Date.parse('2026-10-21T12:00:00Z');
    expect(AuthService.isExpired('2026-10-21T11:59:59Z', now)).toBe(true);
    expect(AuthService.isExpired('2026-10-21T12:00:01Z', now)).toBe(false);
    expect(AuthService.isExpired('not-a-date', now)).toBe(true);
  });
});
