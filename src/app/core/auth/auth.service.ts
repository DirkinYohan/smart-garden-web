import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, of, tap } from 'rxjs';
import { AuthUser, LoginResponse, PasswordChangedResponse } from '../../models/garden.models';
import { GardenApi } from '../api/garden-api';

export const SESSION_KEY = 'smart-garden.session';

/** Pantalla de cambio de contraseña (también es la única accesible cuando el cambio es obligatorio). */
export const PASSWORD_CHANGE_PATH = '/cambiar-contrasena';

interface Session {
  token: string;
  expiresAt: string;
  username: string;
  /** Credencial inicial: solo se permite /auth/me y /auth/password hasta cambiarla. */
  mustChangePassword: boolean;
}

/**
 * JWT session stored in localStorage. La sesión se descarta cuando el token expira, cuando el backend responde
 * 401 (por ejemplo porque la contraseña cambió en otra sesión) o al cerrar sesión.
 *
 * La contraseña nunca se guarda: solo el token y el nombre de usuario.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(GardenApi);
  private readonly router = inject(Router);

  private readonly session = signal<Session | null>(this.restore());
  /** Fecha del último cambio de contraseña (de /auth/me). */
  readonly passwordChangedAt = signal<string | null>(null);
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;

  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly username = computed(() => this.session()?.username ?? '');
  readonly token = computed(() => this.session()?.token ?? null);
  /** true cuando el usuario debe cambiar la contraseña antes de usar la aplicación. */
  readonly mustChangePassword = computed(() => this.session()?.mustChangePassword ?? false);

  constructor() {
    this.scheduleExpiry();
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.api.login(username, password).pipe(
      tap((res) => {
        const session: Session = {
          token: res.token,
          expiresAt: res.expiresAt,
          username: res.username || username,
          mustChangePassword: res.mustChangePassword,
        };
        this.write(session);
        this.session.set(session);
        this.scheduleExpiry();
      }),
    );
  }

  /** Cambia la contraseña y guarda el token nuevo (el anterior queda invalidado en el servidor). */
  changePassword(currentPassword: string, newPassword: string): Observable<PasswordChangedResponse> {
    return this.api.changePassword({ currentPassword, newPassword }).pipe(
      tap((res) => this.applyNewToken(res.token, res.expiresAt)),
    );
  }

  /** Guarda un token nuevo manteniendo el usuario; el cambio obligatorio queda resuelto. */
  applyNewToken(token: string, expiresAt: string): void {
    const current = this.session();
    if (!current) return;
    const next: Session = { ...current, token, expiresAt, mustChangePassword: false };
    this.write(next);
    this.session.set(next);
    this.passwordChangedAt.set(new Date().toISOString());
    this.scheduleExpiry();
  }

  /** Marca que hace falta cambiar la contraseña (lo usa el interceptor con el 403 PASSWORD_CHANGE_REQUIRED). */
  requirePasswordChange(): void {
    const current = this.session();
    if (!current || current.mustChangePassword) return;
    const next: Session = { ...current, mustChangePassword: true };
    this.write(next);
    this.session.set(next);
  }

  /** Refresca el estado del usuario desde /auth/me (rol, cambio pendiente, fecha del último cambio). */
  refresh(): Observable<AuthUser | null> {
    return this.api.me().pipe(
      tap((user) => {
        this.passwordChangedAt.set(user.passwordChangedAt);
        const current = this.session();
        if (current && current.mustChangePassword !== user.mustChangePassword) {
          const next: Session = { ...current, mustChangePassword: user.mustChangePassword };
          this.write(next);
          this.session.set(next);
        }
      }),
      catchError(() => of(null)),
    );
  }

  goToPasswordChange(): void {
    void this.router.navigate([PASSWORD_CHANGE_PATH]);
  }

  /** Clears the session and goes to the login page. */
  logout(reason?: 'expired'): void {
    clearTimeout(this.expiryTimer);
    this.write(null);
    this.session.set(null);
    this.passwordChangedAt.set(null);
    void this.router.navigate(['/login'], reason ? { queryParams: { reason } } : {});
  }

  /** Current token if still valid (used by the HTTP interceptor and the WebSocket). */
  validToken(): string | null {
    const s = this.session();
    if (!s) return null;
    if (AuthService.isExpired(s.expiresAt)) {
      this.logout('expired');
      return null;
    }
    return s.token;
  }

  static isExpired(expiresAt: string, now = Date.now()): boolean {
    const t = Date.parse(expiresAt);
    return Number.isNaN(t) || t <= now;
  }

  private scheduleExpiry(): void {
    clearTimeout(this.expiryTimer);
    const s = this.session();
    if (!s) return;
    const ms = Date.parse(s.expiresAt) - Date.now();
    // setTimeout overflows above ~24.8 days; tokens last hours.
    this.expiryTimer = setTimeout(() => this.logout('expired'), Math.max(0, Math.min(ms, 2 ** 31 - 1)));
  }

  private restore(): Session | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Session;
      if (!s.token || AuthService.isExpired(s.expiresAt)) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return { ...s, mustChangePassword: s.mustChangePassword === true, username: s.username ?? '' };
    } catch {
      return null;
    }
  }

  private write(s: Session | null): void {
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      // storage unavailable (private mode): the session lives only in memory
    }
  }
}
