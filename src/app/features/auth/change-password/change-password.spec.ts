import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificationService } from '../../../core/notification.service';
import { ChangePassword } from './change-password';

describe('ChangePassword', () => {
  let mustChange: ReturnType<typeof signal<boolean>>;
  let auth: {
    username: ReturnType<typeof signal<string>>;
    mustChangePassword: ReturnType<typeof signal<boolean>>;
    passwordChangedAt: ReturnType<typeof signal<string | null>>;
    refresh: ReturnType<typeof vi.fn>;
    changePassword: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };
  let notify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };

  function create(passwordChangedAt: string | null = null) {
    mustChange = signal(true);
    auth = {
      username: signal('admin'),
      mustChangePassword: mustChange,
      passwordChangedAt: signal(passwordChangedAt),
      refresh: vi.fn(() => of(null)),
      changePassword: vi.fn(() => of({ token: 'jwt-2', expiresAt: '2099-01-01T00:00:00Z' })),
      logout: vi.fn(),
    };
    notify = { success: vi.fn(), error: vi.fn() };
    router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({
      imports: [ChangePassword],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: NotificationService, useValue: notify },
        { provide: Router, useValue: router },
      ],
    });
    const fixture = TestBed.createComponent(ChangePassword);
    fixture.detectChanges();
    return fixture;
  }

  const controls = (fixture: ReturnType<typeof create>) =>
    (fixture.componentInstance as unknown as {
      form: { controls: Record<string, { setValue: (v: string) => void; hasError: (e: string) => boolean }> };
      requirements: () => { key: string; ok: boolean }[];
      strength: () => { key: string; labelKey: string };
      canSubmit: () => boolean;
      submit: () => void;
      serverError: () => string | null;
    }).form.controls;

  const internals = (fixture: ReturnType<typeof create>) =>
    fixture.componentInstance as unknown as {
      requirements: () => { key: string; ok: boolean }[];
      strength: () => { key: string; labelKey: string };
      canSubmit: () => boolean;
      submit: () => void;
      serverError: () => string | null;
    };

  it('shows the mandatory notice on the first login', () => {
    const fixture = create();

    expect(fixture.nativeElement.textContent).toContain(
      'Por seguridad, crea una contraseña nueva antes de continuar.',
    );
    expect(fixture.nativeElement.textContent).toContain('Cerrar sesión');
  });

  it('checks the requirements live', () => {
    const fixture = create();
    const form = controls(fixture);

    form['currentPassword'].setValue('admin123');
    form['newPassword'].setValue('corta');
    fixture.detectChanges();

    const labels = internals(fixture).requirements();
    expect(labels.find((r) => r.key === 'pwd.req.length')?.ok).toBe(false);

    form['newPassword'].setValue('ClaveNueva2026');
    fixture.detectChanges();

    expect(internals(fixture).requirements().every((r) => r.ok)).toBe(true);
  });

  it('marks the requirement that compares with the current password', () => {
    const fixture = create();
    const form = controls(fixture);

    form['currentPassword'].setValue('ClaveNueva2026');
    form['newPassword'].setValue('ClaveNueva2026');
    fixture.detectChanges();

    const different = internals(fixture).requirements().find((r) => r.key === 'pwd.req.different');
    expect(different?.ok).toBe(false);
  });

  it('rates the strength with a text, not only a colour', () => {
    const fixture = create();
    const form = controls(fixture);

    form['newPassword'].setValue('ClaveNueva2026');
    fixture.detectChanges();
    expect(internals(fixture).strength().labelKey).toBe('pwd.strength.strong');

    form['newPassword'].setValue('Clave1');
    fixture.detectChanges();
    expect(internals(fixture).strength().labelKey).toBe('pwd.strength.weak');
  });

  it('keeps the button disabled until everything is valid', () => {
    const fixture = create();
    const form = controls(fixture);
    const button = fixture.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement;

    expect(button.disabled).toBe(true);

    form['currentPassword'].setValue('admin123');
    form['newPassword'].setValue('ClaveNueva2026');
    form['confirmPassword'].setValue('ClaveNueva2026');
    fixture.detectChanges();

    expect(button.disabled).toBe(false);
  });

  it('does not submit when the confirmation does not match', () => {
    const fixture = create();
    const form = controls(fixture);
    form['currentPassword'].setValue('admin123');
    form['newPassword'].setValue('ClaveNueva2026');
    form['confirmPassword'].setValue('otraCosa2026');
    fixture.detectChanges();

    expect(internals(fixture).canSubmit()).toBe(false);
  });

  it('replaces the token, announces it and goes to the panel', () => {
    const fixture = create();
    const form = controls(fixture);
    form['currentPassword'].setValue('admin123');
    form['newPassword'].setValue('ClaveNueva2026');
    form['confirmPassword'].setValue('ClaveNueva2026');
    fixture.detectChanges();

    internals(fixture).submit();

    expect(auth.changePassword).toHaveBeenCalledWith('admin123', 'ClaveNueva2026');
    expect(notify.success).toHaveBeenCalledWith('Contraseña actualizada. Las demás sesiones se cerraron');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('shows a wrong current password next to the field', () => {
    const fixture = create();
    const form = controls(fixture);
    auth.changePassword.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { message: 'La contraseña actual no es correcta' },
          }),
      ),
    );
    form['currentPassword'].setValue('mala');
    form['newPassword'].setValue('ClaveNueva2026');
    form['confirmPassword'].setValue('ClaveNueva2026');
    fixture.detectChanges();

    internals(fixture).submit();
    fixture.detectChanges();

    expect(form['currentPassword'].hasError('server')).toBe(true);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('shows policy errors from the backend', () => {
    const fixture = create();
    const form = controls(fixture);
    auth.changePassword.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { message: 'Esa contraseña es demasiado común; elige otra' },
          }),
      ),
    );
    form['currentPassword'].setValue('admin123');
    form['newPassword'].setValue('ClaveNueva2026');
    form['confirmPassword'].setValue('ClaveNueva2026');
    fixture.detectChanges();

    internals(fixture).submit();
    fixture.detectChanges();

    expect(internals(fixture).serverError()).toBe('Esa contraseña es demasiado común; elige otra');
  });

  it('shows the last password change in days', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600_000).toISOString();
    const fixture = create(threeDaysAgo);
    mustChange.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Último cambio: hace 3 días');
  });
});
