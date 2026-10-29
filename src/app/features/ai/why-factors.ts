import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../../core/i18n/i18n.service';
import { InputSnapshot } from '../../models/garden.models';

export interface Factor {
  icon: string;
  label: string;
  value: string;
  /** Por qué influyó este factor (null = no resaltado). */
  influence: string | null;
}

/** Convierte la foto de datos de entrada en factores legibles, resaltando los que motivaron la decisión. */
export function factorsFor(s: InputSnapshot, recommendedMin: number, i18n: I18nService): Factor[] {
  const t = (key: string, params?: Record<string, string | number>) => i18n.t(key, params);
  const pct = (v: number | null) => (v === null ? t('why.noData') : `${i18n.formatNumber(v, 0)} %`);
  const min = s.currentMin || recommendedMin;
  const rainy = (s.rainProbability12h ?? 0) >= 70 && (s.precipitation12h ?? 0) > 0;
  return [
    {
      icon: 'water_drop',
      label: t('why.moisture'),
      value: s.currentMoisture === null ? t('why.noReading') : pct(s.currentMoisture),
      influence:
        s.currentMoisture === null
          ? t('why.noReadingInfluence')
          : s.currentMoisture < min
            ? t('why.belowMin', { min })
            : s.currentMoisture < min + 5
              ? t('why.nearMin')
              : null,
    },
    {
      icon: 'sensors',
      label: t('why.sensor'),
      value: s.sensorOk ? t('why.sensorOk') : t('why.sensorFault'),
      influence: s.sensorOk ? null : t('why.noValidReadings'),
    },
    {
      icon: 'show_chart',
      label: t('why.last24h'),
      value:
        s.avgMoisture24h === null
          ? t('why.noData')
          : t('why.avgMinMax', {
              avg: pct(s.avgMoisture24h),
              min: pct(s.minMoisture24h),
              max: pct(s.maxMoisture24h),
            }),
      influence: s.minMoisture24h !== null && s.minMoisture24h < min ? t('why.droppedBelowMin') : null,
    },
    {
      icon: 'trending_down',
      label: t('why.dryingRate'),
      value:
        s.dryingRatePerHour === null
          ? t('why.notEnoughData')
          : t('why.perHour', { value: i18n.formatNumber(s.dryingRatePerHour) }),
      influence: s.dryingRatePerHour !== null && s.dryingRatePerHour <= -3 ? t('why.driesFast') : null,
    },
    {
      icon: 'shower',
      label: t('why.irrigations24h'),
      value: t('why.pumpMinutes', { n: s.irrigations24h, minutes: i18n.formatNumber(s.pumpMinutes24h) }),
      influence: s.irrigations24h >= 6 ? t('why.manyIrrigations') : null,
    },
    {
      icon: 'rainy',
      label: t('why.rain12h'),
      value:
        s.rainProbability12h === null
          ? t('why.noForecast')
          : `${pct(s.rainProbability12h)} · ${i18n.formatNumber(s.precipitation12h ?? 0)} mm`,
      influence: rainy ? t('why.enoughRain') : null,
    },
    {
      icon: 'thermostat',
      label: t('why.temperature'),
      value: s.temperature === null ? t('why.noData') : `${i18n.formatNumber(s.temperature)} °C`,
      influence: s.temperature !== null && s.temperature >= 28 ? t('why.hot') : null,
    },
    {
      icon: 'humidity_percentage',
      label: t('why.airHumidity'),
      value: pct(s.airHumidity),
      influence: null,
    },
    {
      icon: 'eco',
      label: t('why.crop'),
      value: t('why.cropIdeal', {
        crop: s.cropName || t('why.noCrop'),
        min: s.cropMin,
        max: s.cropMax,
      }),
      influence: null,
    },
  ];
}

/** E. Lista de factores que la IA tuvo en cuenta. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-why-factors',
  imports: [MatIconModule],
  template: `
    <ul class="factors">
      @for (f of factors(); track f.label) {
        <li [class.hit]="f.influence">
          <mat-icon aria-hidden="true">{{ f.icon }}</mat-icon>
          <div>
            <span class="label">{{ f.label }}</span>
            <span class="value">{{ f.value }}</span>
            @if (f.influence) {
              <span class="influence"
                ><mat-icon aria-hidden="true">priority_high</mat-icon>{{ i18n.t('why.influenced') }}:
                {{ f.influence }}</span
              >
            }
          </div>
        </li>
      }
    </ul>
  `,
  styles: `
    .factors {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    }
    li {
      display: flex;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      background: var(--mat-sys-surface-container);
      > mat-icon {
        color: var(--mat-sys-primary);
        flex-shrink: 0;
      }
      div {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
    }
    li.hit {
      outline: 2px solid var(--sg-warn);
      background: color-mix(in srgb, var(--sg-warn) 12%, var(--mat-sys-surface-container));
    }
    .label {
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .value {
      font: var(--mat-sys-title-small);
    }
    .influence {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      margin-top: 2px;
      font: var(--mat-sys-label-small);
      color: var(--mat-sys-on-surface);
      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        color: var(--sg-warn);
      }
    }
  `,
})
export class WhyFactors {
  protected readonly i18n = inject(I18nService);
  readonly snapshot = input.required<InputSnapshot>();
  readonly recommendedMin = input.required<number>();
  protected readonly factors = computed(() => factorsFor(this.snapshot(), this.recommendedMin(), this.i18n));
}
