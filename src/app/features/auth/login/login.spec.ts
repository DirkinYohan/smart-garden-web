import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { Login } from './login';

describe('Login', () => {
  let auth: { login: ReturnType<typeof vi.fn>; goToPasswordChange: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };

  function create() {
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    return fixture;
  }

  const internals = (fixture: ReturnType<typeof create>) =>
    fixture.componentInstance as unknown as {
      form: { controls: Record<string, { setValue: (v: string) => void }> };
      submit: () => void;
      failure: () => string | null;
      cooldown: () => number;
      canSubmit: () => boolean;
    };

  function fillAndSubmit(fixture: ReturnType<typeof create>) {
    const component = internals(fixture);
    component.form.controls['username'].setValue('admin');
    component.form.controls['password'].setValue('admin123');
    fixture.detectChanges();
    component.submit();
    fixture.detectChanges();
  }

  beforeEach(() => {
    auth = { login: vi.fn(), goToPasswordChange: vi.fn() };
    router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
  });

  it('explains a locked account and disables the button for a while', () => {
    auth.login.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 423,
            error: { message: 'Cuenta bloqueada por intentos fallidos. Intenta de nuevo en 12 minutos' },
          }),
      ),
    );
    const fixture = create();

    fillAndSubmit(fixture);

    expect(internals(fixture).failure()).toBe(
      'Cuenta bloqueada por intentos fallidos. Intenta de nuevo en 12 minutos',
    );
    expect(fixture.nativeElement.querySelector('.error-notice')?.textContent).toContain('Cuenta bloqueada');
    expect(internals(fixture).cooldown()).toBeGreaterThan(0);
    expect(internals(fixture).canSubmit()).toBe(false);
    expect((fixture.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows wrong credentials inline', () => {
    auth.login.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({ status: 401, error: { message: 'Usuario o contraseña incorrectos' } }),
      ),
    );
    const fixture = create();

    fillAndSubmit(fixture);

    expect(internals(fixture).failure()).toBe('Usuario o contraseña incorrectos');
    expect(internals(fixture).canSubmit()).toBe(true);
  });

  it('sends the user to the password screen when the credential is single-use', () => {
    auth.login.mockReturnValue(
      of({ token: 'jwt', expiresAt: '2099-01-01T00:00:00Z', mustChangePassword: true, username: 'admin' }),
    );
    const fixture = create();

    fillAndSubmit(fixture);

    expect(auth.goToPasswordChange).toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('goes to the dashboard with a normal login', () => {
    auth.login.mockReturnValue(
      of({ token: 'jwt', expiresAt: '2099-01-01T00:00:00Z', mustChangePassword: false, username: 'admin' }),
    );
    const fixture = create();

    fillAndSubmit(fixture);

    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
    expect(auth.goToPasswordChange).not.toHaveBeenCalled();
  });
});
