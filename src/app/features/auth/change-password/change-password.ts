import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { errorMessage } from '../../../core/auth/error.interceptor';
import { I18nService } from '../../../core/i18n/i18n.service';
import { NotificationService } from '../../../core/notification.service';
import { LanguageToggle } from '../../../shared/language-toggle';

interface Requirement {
  /** Clave de traducción del requisito. */
  key: string;
  ok: boolean;
}

interface Strength {
  key: 'empty' | 'weak' | 'medium' | 'strong';
  labelKey: string;
  percent: number;
}

/**
 * Cambio de contraseña. Se llega desde el menú de usuario o porque el backend lo exige (credencial inicial): en ese
 * caso la página es la única accesible y solo ofrece "Cerrar sesión" además del formulario.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-change-password',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    LanguageToggle,
  ],
  templateUrl: './change-password.html',
  styleUrl: './change-password.scss',
})
export class ChangePassword {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);

  protected readonly mandatory = computed(() => this.auth.mustChangePassword());
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly hideCurrent = signal(true);
  protected readonly hideNew = signal(true);
  protected readonly hideConfirm = signal(true);

  protected readonly form = inject(NonNullableFormBuilder).group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(10)]],
    confirmPassword: ['', [Validators.required]],
  });

  private readonly current = toSignal(this.form.controls.currentPassword.valueChanges, { initialValue: '' });
  private readonly next = toSignal(this.form.controls.newPassword.valueChanges, { initialValue: '' });
  private readonly confirmation = toSignal(this.form.controls.confirmPassword.valueChanges, {
    initialValue: '',
  });

  /** Lista de requisitos en vivo (misma política que el backend). */
  protected readonly requirements = computed<Requirement[]>(() => {
    const value = this.next();
    const current = this.current();
    return [
      { key: 'pwd.req.length', ok: value.length >= 10 },
      { key: 'pwd.req.upper', ok: /[A-ZÁÉÍÓÚÑ]/.test(value) },
      { key: 'pwd.req.lower', ok: /[a-záéíóúñ]/.test(value) },
      { key: 'pwd.req.digit', ok: /\d/.test(value) },
      { key: 'pwd.req.different', ok: value.length > 0 && value !== current },
    ];
  });

  protected readonly matches = computed(() => this.next().length > 0 && this.next() === this.confirmation());

  protected readonly strength = computed<Strength>(() => {
    const value = this.next();
    if (!value) return { key: 'empty', labelKey: 'pwd.strength.empty', percent: 0 };
    let points = 0;
    if (value.length >= 10) points++;
    if (value.length >= 14) points++;
    if (/[A-Z]/.test(value)) points++;
    if (/[a-z]/.test(value)) points++;
    if (/\d/.test(value)) points++;
    if (/[^A-Za-z0-9]/.test(value)) points++;
    // Por debajo del mínimo de la política siempre es débil, por mucha variedad que tenga.
    if (value.length < 10 || points <= 2) return { key: 'weak', labelKey: 'pwd.strength.weak', percent: 33 };
    if (points <= 4) return { key: 'medium', labelKey: 'pwd.strength.medium', percent: 66 };
    return { key: 'strong', labelKey: 'pwd.strength.strong', percent: 100 };
  });

  protected readonly canSubmit = computed(
    () =>
      !this.submitting() &&
      this.current().length > 0 &&
      this.requirements().every((r) => r.ok) &&
      this.matches(),
  );

  protected readonly lastChangeText = computed(() => {
    const iso = this.auth.passwordChangedAt();
    if (!iso) return null;
    const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
    if (minutes < 1) return this.i18n.t('pwd.ago.now');
    if (minutes < 60) return this.i18n.t('pwd.ago.minutes', { n: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return this.i18n.t('pwd.ago.hours', { n: hours });
    const days = Math.floor(hours / 24);
    return days === 1 ? this.i18n.t('pwd.ago.oneDay') : this.i18n.t('pwd.ago.days', { n: days });
  });

  constructor() {
    // Si se entra directo a la página, trae la fecha del último cambio.
    if (!this.auth.passwordChangedAt()) {
      this.auth.refresh().subscribe();
    }
  }

  protected submit(): void {
    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.serverError.set(null);
    const { currentPassword, newPassword } = this.form.getRawValue();
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.submitting.set(false);
        this.notify.success(this.i18n.t('pwd.success'));
        void this.router.navigateByUrl('/');
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        // El mensaje del backend viene en español y no se traduce.
        const message = errorMessage(err);
        if (/actual|current/i.test(message)) {
          this.form.controls.currentPassword.setErrors({ server: message });
        } else {
          this.serverError.set(message);
        }
      },
    });
  }

  protected logout(): void {
    this.auth.logout();
  }
}
