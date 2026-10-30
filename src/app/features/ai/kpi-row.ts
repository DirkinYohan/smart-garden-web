import { ChangeDetectionStrategy, inject, Component, computed, input } from '@angular/core';
import { Analysis, Weather } from '../../models/garden.models';
import { I18nService } from '../../core/i18n/i18n.service';
import { Tone } from '../../shared/ai-labels';
import { BulletGauge } from '../../shared/bullet-gauge';
import { StatTile } from '../../shared/stat-tile';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ai-kpi-row',
  imports: [StatTile, BulletGauge],
  template: `
    <div class="row">
      <app-stat-tile
        icon="water_drop"
        [label]="i18n.t('ai.kpi.moisture')"
        [value]="moistureText()"
        [sub]="moistureSub()"
        [tone]="moistureTone()"
      >
        <app-bullet-gauge
          [value]="moisture()"
          [min]="analysis().recommendedMin"
          [max]="analysis().recommendedMax"
          [cropMin]="analysis().inputSnapshot?.cropMin ?? null"
          [cropMax]="analysis().inputSnapshot?.cropMax ?? null"
        />
      </app-stat-tile>
      <app-stat-tile
        icon="event"
        [label]="i18n.t('ai.kpi.next')"
        [value]="next().value"
        [sub]="next().sub"
        [tone]="next().tone"
      />
      <app-stat-tile
        [icon]="drying().icon"
        [label]="i18n.t('ai.kpi.drying')"
        [value]="drying().value"
        [sub]="drying().sub"
        tone="neutral"
      />
      <app-stat-tile
        icon="rainy"
        [label]="i18n.t('ai.kpi.rain')"
        [value]="rain().value"
        [sub]="rain().sub"
        [tone]="rain().tone"
      />
    </div>
  `,
  styles: `
    .row {
      display: grid;
      gap: var(--sg-card-gap);
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    @media (max-width: 1099px) {
      .row {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 599px) {
      .row {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class KpiRow {
  private readonly i18n = inject(I18nService);

  readonly analysis = input.required<Analysis>();

  readonly liveMoisture = input<number | null>(null);

  readonly sensorOk = input<boolean>(true);
  readonly weather = input<Weather | null>(null);
  readonly now = input.required<number>();

  protected readonly moisture = computed(() => {
    if (!this.sensorOk()) return null;
    return this.liveMoisture() ?? this.analysis().inputSnapshot?.currentMoisture ?? null;
  });

  private readonly snapshotMoisture = computed(() => this.analysis().inputSnapshot?.currentMoisture ?? null);

  protected readonly moistureText = computed(() => {
    const m = this.moisture();
    return m !== null ? `${m} %` : this.i18n.t('ai.kpi.noReading');
  });

  protected readonly moistureTone = computed<Tone>(() => {
    const m = this.moisture();
    const a = this.analysis();
    if (m === null) return 'neutral';
    return m < a.recommendedMin ? 'bad' : m > a.recommendedMax ? 'water' : 'good';
  });

  protected readonly moistureSub = computed(() => {
    const a = this.analysis();
    const m = this.moisture();
    if (!this.sensorOk()) return this.i18n.t('ai.kpi.sensorFailing');
    if (m === null) {
      const snapshot = this.snapshotMoisture();
      return snapshot === null ? this.i18n.t('ai.kpi.noValid') : this.i18n.t('ai.kpi.snapshot', { value: snapshot });
    }
    const key =
      m < a.recommendedMin ? 'ai.kpi.below' : m > a.recommendedMax ? 'ai.kpi.above' : 'ai.kpi.inside';
    const range = this.i18n.t(key, { min: a.recommendedMin, max: a.recommendedMax });

    const snapshot = this.snapshotMoisture();
    return this.liveMoisture() === null && snapshot !== null
      ? `${range} · ${this.i18n.t('ai.kpi.snapshot', { value: snapshot })}`
      : range;
  });

  protected readonly next = computed<{ value: string; sub: string | null; tone: Tone }>(() => {
    const p = this.analysis().projection;
    if (!p || p.points.length === 0) {
      return { value: this.i18n.t('ai.kpi.noProjection'), sub: null, tone: 'neutral' };
    }
    if (p.dryingRatePerHour === null) {

      return {
        value: this.i18n.t('ai.kpi.noEstimate'),
        sub: this.i18n.t('ai.kpi.flat'),
        tone: 'neutral',
      };
    }
    const confidence = p.confidence ? this.i18n.confidenceLabel(p.confidence) : null;
    const at = p.estimatedNextIrrigationAt;
    if (!at) {
      const sub = confidence ? `${this.i18n.t('ai.kpi.next24h')} · ${confidence}` : this.i18n.t('ai.kpi.next24h');
      return { value: this.i18n.t('ai.kpi.notExpected'), sub, tone: 'good' };
    }
    const relative = this.i18n.relativeFuture(at, this.now());
    if (relative === this.i18n.t('time.now')) {
      return { value: this.i18n.t('kpi.now'), sub: confidence, tone: 'bad' };
    }
    return { value: `${relative} (≈ ${this.i18n.formatClock(at)})`, sub: confidence, tone: 'warn' };
  });

  protected readonly drying = computed(() => {
    const rate = this.analysis().projection?.dryingRatePerHour ?? this.analysis().inputSnapshot?.dryingRatePerHour ?? null;
    if (rate === null) return { value: this.i18n.t('kpi.noData'), icon: 'trending_flat', sub: this.i18n.dryingSentence(null) };
    const icon = rate <= -0.2 ? 'trending_down' : rate >= 0.2 ? 'trending_up' : 'trending_flat';
    return {
      value: this.i18n.t('why.perHour', { value: this.i18n.formatNumber(rate) }),
      icon,
      sub: this.i18n.dryingSentence(rate),
    };
  });

  protected readonly rain = computed<{ value: string; sub: string | null; tone: Tone }>(() => {
    const s = this.analysis().inputSnapshot;
    const w = this.weather();
    const probability = s?.rainProbability12h ?? w?.rainProbabilityNext12h ?? null;
    const mm = s?.precipitation12h ?? w?.precipitationNext12h ?? null;
    if (probability === null) return { value: this.i18n.t('why.noForecast'), sub: null, tone: 'neutral' };
    return {
      value: `${this.i18n.formatNumber(probability, 0)} %`,
      sub: mm !== null ? this.i18n.t('kpi.accumulated', { mm: this.i18n.formatNumber(mm) }) : null,
      tone: probability >= 70 ? 'water' : 'neutral',
    };
  });
}
