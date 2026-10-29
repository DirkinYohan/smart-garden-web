import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { I18nService } from '../../core/i18n/i18n.service';
import { ThemeService } from '../../core/theme.service';
import { Weather } from '../../models/garden.models';
import { cssVar, withAlpha } from '../../shared/labels';

/** G. Hourly rain probability (bars) and temperature (line) for the next 12 h. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ai-rain-chart',
  imports: [BaseChartDirective],
  template: `
    <div class="chart" role="img" [attr.aria-label]="reading()">
      <canvas baseChart type="bar" [data]="data()" [options]="options()"></canvas>
    </div>
    <p class="reading">{{ reading() }}</p>
  `,
  styles: `
    .chart {
      position: relative;
      height: 240px;
    }
    .reading {
      margin: 8px 0 0;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class RainChart {
  readonly weather = input.required<Weather>();
  private readonly theme = inject(ThemeService);
  private readonly i18n = inject(I18nService);

  protected readonly data = computed<ChartConfiguration<'bar'>['data']>(() => {
    this.theme.dark();
    const wet = cssVar('--sg-wet', 'rgb(21, 101, 192)');
    const warn = cssVar('--sg-warn', 'rgb(178, 106, 0)');
    const w = this.weather();
    return {
      labels: w.hourly.map((h) => this.i18n.formatClock(h.time)),
      datasets: [
        {
          type: 'bar',
          label: this.i18n.t('chart.rainProbability'),
          data: w.hourly.map((h) => h.rainProbability),
          backgroundColor: w.hourly.map((h) => withAlpha(wet, h.rainProbability >= 70 ? 0.9 : 0.45)),
          borderRadius: 4,
          yAxisID: 'y',
        },
        {
          type: 'line' as never,
          label: this.i18n.t('chart.temperature'),
          data: w.hourly.map((h) => h.temperature),
          borderColor: warn,
          backgroundColor: warn,
          pointRadius: 2,
          tension: 0.3,
          yAxisID: 'y1',
        },
      ],
    };
  });

  protected readonly options = computed<ChartConfiguration<'bar'>['options']>(() => {
    this.theme.dark();
    const text = cssVar('--mat-sys-on-surface-variant', 'rgb(80, 80, 80)');
    const grid = cssVar('--mat-sys-outline-variant', 'rgb(220, 220, 220)');
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: text, boxWidth: 14 } } },
      scales: {
        x: { ticks: { color: text, maxRotation: 0, autoSkip: true }, grid: { display: false } },
        y: { min: 0, max: 100, ticks: { color: text, callback: (v) => `${v} %` }, grid: { color: grid } },
        y1: { position: 'right', ticks: { color: text, callback: (v) => `${v} °C` }, grid: { display: false } },
      },
    };
  });

  protected readonly reading = computed(() => {
    const w = this.weather();
    const rainy = w.hourly.filter((h) => h.rainProbability >= 70);
    if (!rainy.length) {
      return this.i18n.t('chart.rainNone', { max: this.i18n.formatNumber(w.rainProbabilityNext12h, 0) });
    }
    return this.i18n.t('chart.rainSome', {
      time: this.i18n.formatClock(rainy[0].time),
      max: this.i18n.formatNumber(w.rainProbabilityNext12h, 0),
      mm: this.i18n.formatNumber(w.precipitationNext12h),
    });
  });
}
