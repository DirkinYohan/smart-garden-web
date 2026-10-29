import { ChangeDetectionStrategy, inject, Component, computed, input } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { MatIconModule } from '@angular/material/icon';
import { HealthStatus } from '../models/garden.models';
import { HEALTH_UI } from './ai-labels';

/** Traffic-light health indicator: icon + text + color (never color alone). */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-health-badge',
  imports: [MatIconModule],
  template: `
    @if (ui(); as h) {
      <span class="badge" [class]="'tone-' + h.tone" [class.large]="size() === 'large'" role="status">
        <mat-icon aria-hidden="true">{{ h.icon }}</mat-icon>
        <span>{{ i18n.t(h.labelKey) }}</span>
      </span>
    } @else {
      <span class="badge tone-neutral" [class.large]="size() === 'large'" role="status">
        <mat-icon aria-hidden="true">help</mat-icon>
        <span>Sin evaluar</span>
      </span>
    }
  `,
  styleUrls: ['./tone.scss'],
  styles: `
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 20px;
      font: var(--mat-sys-label-large);
      color: var(--tone);
      background: color-mix(in srgb, var(--tone) 16%, transparent);
      border: 1px solid color-mix(in srgb, var(--tone) 40%, transparent);
    }
    .badge.large {
      padding: 8px 18px 8px 12px;
      font: var(--mat-sys-title-large);
      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
      }
    }
  `,
})
export class HealthBadge {
  protected readonly i18n = inject(I18nService);

  readonly status = input<HealthStatus | null>(null);
  readonly size = input<'large' | 'small'>('small');
  protected readonly ui = computed(() => {
    const s = this.status();
    return s ? HEALTH_UI[s] : null;
  });
}
