import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { errorMessage } from '../../../core/auth/error.interceptor';
import { I18nService } from '../../../core/i18n/i18n.service';
import { LanguageToggle } from '../../../shared/language-toggle';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-login',
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
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  /** Query params (component input binding). */
  readonly returnUrl = input<string>();
  readonly reason = input<string>();

  protected readonly mock = environment.useMock;
  protected readonly submitting = signal(false);
  protected readonly hidePassword = signal(true);
  /** Mensaje del backend (401 credenciales o 423 cuenta bloqueada). */
  protected readonly failure = signal<string | null>(null);
  /** Segundos que quedan de espera obligatoria tras un 423. */
  protected readonly cooldown = signal(0);
  protected readonly canSubmit = computed(() => !this.submitting() && this.cooldown() === 0);
  private cooldownTimer: ReturnType<typeof setInterval> | undefined;

  protected readonly form = inject(NonNullableFormBuilder).group({
    username: ['', [Validators.required, Validators.maxLength(64)]],
    password: ['', [Validators.required, Validators.minLength(4)]],
  });

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.failure.set(null);
    const { username, password } = this.form.getRawValue();
    this.auth.login(username.trim(), password).subscribe({
      next: (res) => {
        this.submitting.set(false);
        // Credencial inicial: no se entra a la aplicación hasta cambiarla.
        if (res.mustChangePassword) {
          this.auth.goToPasswordChange();
          return;
        }
        const target = this.returnUrl();
        void this.router.navigateByUrl(target && target.startsWith('/') ? target : '/');
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.failure.set(errorMessage(err));
        if (err.status === 423) {
          this.startCooldown(15);
        }
      },
    });
  }

  /** Tras una cuenta bloqueada el botón queda deshabilitado unos segundos. */
  private startCooldown(seconds: number): void {
    clearInterval(this.cooldownTimer);
    this.cooldown.set(seconds);
    this.cooldownTimer = setInterval(() => {
      const next = this.cooldown() - 1;
      this.cooldown.set(Math.max(0, next));
      if (next <= 0) clearInterval(this.cooldownTimer);
    }, 1000);
  }
}
