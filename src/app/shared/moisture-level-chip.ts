import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../core/i18n/i18n.service';
import { MoistureLevel } from '../models/garden.models';
import { moistureLevelUi } from './moisture-level';

/**
 * Chip del nivel de humedad: icono + texto + color (rojo muy seca, ámbar baja, verde ideal, azul alta,
 * azul oscuro saturada, gris error de sensor). El color siempre acompaña a un icono y a un texto.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-moisture-level-chip',
  imports: [MatIconModule],
  template: `
    @if (ui(); as u) {
      <span class="tone-chip" [class]="'tone-' + u.tone" [attr.data-level]="level()">
        <mat-icon aria-hidden="true">{{ u.icon }}</mat-icon>{{ i18n.t(u.labelKey) }}
      </span>
    }
  `,
  styleUrls: ['tone.scss'],
})
export class MoistureLevelChip {
  protected readonly i18n = inject(I18nService);
  readonly level = input<MoistureLevel | null>(null);

  protected readonly ui = computed(() => (this.level() ? moistureLevelUi(this.level()) : null));
}
