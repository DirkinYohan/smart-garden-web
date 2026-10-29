import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { I18nService } from '../core/i18n/i18n.service';
import { ConnectionState } from '../models/garden.models';

/** "Conectado / Reconectando / Desconectado" pill for the real-time channel. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-connection-indicator',
  imports: [MatIconModule, MatTooltipModule],
  template: `
    <span
      class="pill"
      [class]="state()"
      role="status"
      aria-live="polite"
      [matTooltip]="tooltip()"
    >
      <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
      <span class="label">{{ label() }}</span>
    </span>
  `,
  styles: `
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 10px 2px 6px;
      border-radius: 16px;
      font: var(--mat-sys-label-medium);
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface);
    }
    mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .connected mat-icon {
      color: var(--sg-ok);
    }
    .connecting mat-icon {
      color: var(--sg-warn);
      animation: spin 1.2s linear infinite;
    }
    .disconnected mat-icon {
      color: var(--sg-dry);
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (max-width: 599px) {
      .label {
        display: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .connecting mat-icon {
        animation: none;
      }
    }
  `,
})
export class ConnectionIndicator {
  private readonly i18n = inject(I18nService);
  readonly state = input.required<ConnectionState>();

  protected readonly label = computed(() => this.i18n.t('conn.' + this.state()));
  protected readonly icon = computed(
    () => ({ connected: 'wifi', connecting: 'sync', disconnected: 'wifi_off' })[this.state()],
  );
  protected readonly tooltip = computed(() =>
    this.i18n.t(this.state() === 'connected' ? 'conn.tooltip.connected' : 'conn.tooltip.connecting'),
  );
}
