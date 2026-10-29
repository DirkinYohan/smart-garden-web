import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../core/i18n/i18n.service';

/** "No data yet" placeholder. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-empty-state',
  imports: [MatIconModule],
  template: `
    <div class="state" role="status">
      <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
      <p>{{ text() }}</p>
      <ng-content />
    </div>
  `,
  styleUrl: './state-views.scss',
})
export class EmptyState {
  private readonly i18n = inject(I18nService);
  readonly message = input<string | null>(null);
  readonly icon = input('sensors_off');
  protected readonly text = () => this.message() ?? this.i18n.t('state.defaultEmpty');
}

/** Error placeholder with a retry button. */
@Component({
  selector: 'app-error-state',
  imports: [MatIconModule, MatButtonModule],
  template: `
    <div class="state error" role="alert">
      <mat-icon aria-hidden="true">cloud_off</mat-icon>
      <p>{{ text() }}</p>
      <button mat-stroked-button type="button" (click)="retry.emit()">
        <mat-icon>refresh</mat-icon> {{ i18n.t('common.retry') }}
      </button>
    </div>
  `,
  styleUrl: './state-views.scss',
})
export class ErrorState {
  protected readonly i18n = inject(I18nService);
  readonly message = input<string | null>(null);
  readonly retry = output<void>();
  protected readonly text = () => this.message() ?? this.i18n.t('state.defaultError');
}

/** Skeleton loading placeholder (lines of given height). */
@Component({
  selector: 'app-loading',
  template: `
    <div class="loading" role="status" aria-live="polite">
      <span class="visually-hidden">{{ i18n.t('common.loading') }}…</span>
      @for (line of lines(); track $index) {
        <div class="skeleton" [style.height.px]="height()"></div>
      }
    </div>
  `,
  styleUrl: './state-views.scss',
})
export class Loading {
  protected readonly i18n = inject(I18nService);
  readonly rows = input(3);
  readonly height = input(18);
  protected lines(): number[] {
    return Array.from({ length: this.rows() }, (_, i) => i);
  }
}
