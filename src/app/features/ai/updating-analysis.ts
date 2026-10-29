import { ChangeDetectionStrategy, inject, Component, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/**
 * Aviso que sustituye al texto viejo cuando el último análisis se hizo con otro cultivo:
 * «Actualizando análisis para Tomate…» con un indicador de carga.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-updating-analysis',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <article class="card updating" role="status" aria-live="polite">
      <mat-progress-spinner diameter="30" mode="indeterminate" aria-hidden="true" />
      <div>
        <p class="headline">{{ i18n.t('ai.updating', { crop: cropName() ?? '' }) }}</p>
        <p class="muted">
          {{ i18n.t('ai.updatingText') }}
        </p>
        @if (!autoAnalysis()) {
          <button mat-flat-button type="button" (click)="analyze.emit()" [disabled]="analyzing()">
            <mat-icon>auto_awesome</mat-icon> {{ i18n.t('ai.analyze') }}
          </button>
        } @else if (analyzing()) {
          <span class="muted small">{{ i18n.t('ai.updatingShort') }}</span>
        }
      </div>
    </article>
  `,
  styleUrls: ['./ai.scss'],
})
export class UpdatingAnalysis {
  protected readonly i18n = inject(I18nService);

  readonly cropName = input<string | null>(null);
  readonly autoAnalysis = input(true);
  readonly analyzing = input(false);
  readonly analyze = output<void>();
}
