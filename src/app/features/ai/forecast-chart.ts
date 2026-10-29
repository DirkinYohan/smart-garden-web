import { BreakpointObserver } from '@angular/cdk/layout';
import { I18nService } from '../../core/i18n/i18n.service';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ChartConfiguration, ChartDataset } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { map } from 'rxjs';
import { ThemeService } from '../../core/theme.service';
import { Analysis, HistoryPoint, Weather } from '../../models/garden.models';

import { verticalMarkersPlugin } from '../../shared/chart-plugins';
import { cssVar, withAlpha } from '../../shared/labels';
import { EmptyState } from '../../shared/state-views';

type XY = { x: number; y: number };
const HOUR = 3600_000;

/** Timestamps between min and max that fall on local hours ≡ offset (mod step): step 6 → 0:00, 6:00, 12:00… */
export function localHourTicks(min: number, max: number, step: number, offset = 0): number[] {
  const start = new Date(min);
  start.setMinutes(0, 0, 0);
  const ticks: number[] = [];
  for (let t = start.getTime(); t <= max; t += HOUR) {
    if (t >= min && new Date(t).getHours() % step === offset) ticks.push(t);
  }
  return ticks;
}

/**
 * C. "¿Cuándo hay que regar?": last 24 h (solid) + 24 h projection (dashed), recommended band, hourly rain
 * probability bars (secondary axis), "Ahora" and "Riego estimado" markers, and a plain-language reading below.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ai-forecast-chart',
  imports: [BaseChartDirective, EmptyState],
  template: `
    @if (hasData()) {
      <div class="chart" role="img" [attr.aria-label]="ariaLabel()">
        <canvas baseChart type="line" [data]="data()" [options]="options()" [plugins]="plugins"></canvas>
      </div>
      <p class="reading">{{ reading() }}</p>
    } @else {
      <app-empty-state message="Sin datos suficientes para mostrar el pronóstico" icon="show_chart" />
    }
  `,
  styles: `
    .chart {
      position: relative;
      height: 340px;
    }
    .reading {
      margin: 8px 0 0;
      font: var(--mat-sys-body-large);
    }
    @media (max-width: 599px) {
      .chart {
        height: 330px;
      }
    }
  `,
})
export class ForecastChart {
  private readonly i18n = inject(I18nService);

  readonly analysis = input.required<Analysis>();
  readonly history = input<HistoryPoint[]>([]);
  readonly weather = input<Weather | null>(null);
  readonly now = input.required<number>();

  private readonly theme = inject(ThemeService);
  protected readonly plugins = [verticalMarkersPlugin];

  /** Compact layout on phones: legend at the bottom, no axis titles, fewer ticks. */
  private readonly narrow = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 599px)')
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  private readonly past = computed<XY[]>(() => {
    const since = this.now() - 24 * HOUR;
    return this.history()
      .map((p) => ({ x: Date.parse(p.timestamp), y: p.avgMoisture }))
      .filter((p) => p.x >= since);
  });

  private readonly future = computed<XY[]>(() => {
    const points = this.analysis().projection?.points ?? [];
    if (!points.length) return [];
    const current = this.analysis().inputSnapshot?.currentMoisture;
    const start = current ?? this.past().at(-1)?.y;
    const head = start !== undefined && start !== null ? [{ x: Date.parse(this.analysis().createdAt), y: start }] : [];
    return [...head, ...points.map((p) => ({ x: Date.parse(p.timestamp), y: p.moisture }))];
  });

  protected readonly hasData = computed(() => this.past().length > 1 || this.future().length > 1);

  protected readonly data = computed<ChartConfiguration<'line'>['data']>(() => {
    this.theme.dark();
    const primary = cssVar('--mat-sys-primary', 'rgb(46, 125, 50)');
    const ok = cssVar('--sg-ok', 'rgb(46, 125, 50)');
    const dry = cssVar('--sg-dry', 'rgb(198, 40, 40)');
    const wet = cssVar('--sg-wet', 'rgb(21, 101, 192)');
    const a = this.analysis();
    const activeMin = this.activeMin();
    const from = this.now() - 24 * HOUR;
    const to = this.now() + 24 * HOUR;
    const band = (y: number): XY[] => [
      { x: from, y },
      { x: to, y },
    ];
    const rain: XY[] = (this.weather()?.hourly ?? []).map((h) => ({
      x: Date.parse(h.time) + HOUR / 2,
      y: h.rainProbability,
    }));
    const datasets: ChartDataset<'line', XY[]>[] = [
      {
        label: 'Rango recomendado',
        data: band(a.recommendedMax),
        borderColor: 'transparent',
        backgroundColor: withAlpha(ok, 0.14),
        pointRadius: 0,
        fill: '+1',
        order: 5,
      },
      {
        label: `Mínimo de riego (${activeMin} %)`,
        data: band(activeMin),
        borderColor: dry,
        borderDash: [6, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        order: 4,
      },
      {
        label: 'Humedad real',
        data: this.past(),
        borderColor: primary,
        backgroundColor: primary,
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.25,
        order: 1,
      },
      {
        label: 'Pronóstico',
        data: this.future(),
        borderColor: primary,
        backgroundColor: primary,
        borderDash: [6, 5],
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.25,
        order: 2,
      },
    ];
    if (rain.length) {
      datasets.push({
        type: 'bar' as never,
        label: 'Probabilidad de lluvia',
        data: rain,
        yAxisID: 'y1',
        backgroundColor: withAlpha(wet, 0.35),
        borderColor: 'transparent',
        barThickness: 'flex',
        barPercentage: 0.9,
        categoryPercentage: 1,
        order: 6,
      } as never);
    }
    return { datasets };
  });

  protected readonly options = computed<ChartConfiguration<'line'>['options']>(() => {
    this.theme.dark();
    const text = cssVar('--mat-sys-on-surface-variant', 'rgb(80, 80, 80)');
    const grid = cssVar('--mat-sys-outline-variant', 'rgb(220, 220, 220)');
    const dry = cssVar('--sg-dry', 'rgb(198, 40, 40)');
    const now = this.now();
    const narrow = this.narrow();
    const estimated = this.analysis().projection?.estimatedNextIrrigationAt;
    const markers = [{ x: now, label: 'Ahora', color: text }];
    if (estimated && Date.parse(estimated) > now + 5 * 60_000) {
      markers.push({ x: Date.parse(estimated), label: 'Riego estimado', color: dry, dashed: true } as never);
    }
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      plugins: {
        legend: {
          position: narrow ? 'bottom' : 'top',
          labels: { color: text, boxWidth: narrow ? 10 : 14, font: { size: narrow ? 11 : 12 } },
        },
        tooltip: {
          callbacks: {
            title: (items) => (items.length ? this.i18n.formatDateTime(items[0].parsed.x ?? 0) : ''),
            label: (ctx) => `${ctx.dataset.label}: ${this.i18n.formatNumber(ctx.parsed.y ?? 0)} %`,
          },
        },
        sgMarkers: { markers },
      },
      scales: {
        x: {
          type: 'linear',
          min: now - 24 * HOUR,
          max: now + 24 * HOUR,
          // the rain bars would turn on the bar-chart offset and squeeze the time axis
          offset: false,
          // Ticks on local clock hours labelled "6:00 p. m. / ayer": every 6 h, only noon on phones.
          afterBuildTicks: (axis) => {
            const ticks = narrow ? localHourTicks(axis.min, axis.max, 24, 12) : localHourTicks(axis.min, axis.max, 6);
            axis.ticks = ticks.map((value) => ({ value }));
          },
          ticks: {
            color: text,
            maxRotation: 0,
            autoSkip: false,
            callback: (v) => [this.i18n.formatClock(Number(v)), this.i18n.dayWord(Number(v), now)],
          },
          grid: { color: grid },
        },
        y: {
          min: 0,
          max: 100,
          title: { display: !narrow, text: 'Humedad del suelo', color: text },
          ticks: { color: text, callback: (v) => `${v} %` },
          grid: { color: grid },
        },
        y1: {
          position: 'right',
          min: 0,
          max: 100,
          display: (this.weather()?.hourly.length ?? 0) > 0,
          title: { display: !narrow, text: 'Lluvia', color: text },
          ticks: { color: text, callback: (v) => `${v} %` },
          grid: { display: false },
        },
      },
    };
  });

  /** Minimum the ESP32 is using now (the projection crosses this one), else the recommended one. */
  private readonly activeMin = computed(
    () => this.analysis().inputSnapshot?.currentMin || this.analysis().recommendedMin,
  );

  /** "Si no llueve, la humedad bajará del 45 % cerca de las 6:00 p. m." */
  protected readonly reading = computed(() => {
    const a = this.analysis();
    const p = a.projection;
    const min = this.activeMin();
    const current = a.inputSnapshot?.currentMoisture;
    if (!p || current === null || current === undefined) {
      return 'No hay una lectura válida reciente del sensor, así que no se puede pronosticar la humedad.';
    }
    if (current < min) return `La humedad ya está por debajo del ${min} %: hace falta regar.`;
    const rate = p.dryingRatePerHour;
    if (rate === null) {
      return 'Todavía no hay suficientes lecturas sin riego para calcular qué tan rápido se seca la tierra, así que aún no se puede pronosticar el próximo riego.';
    }
    const estimated = p.estimatedNextIrrigationAt;
    const rainy = (a.inputSnapshot?.rainProbability12h ?? 0) >= 70 && (a.inputSnapshot?.precipitation12h ?? 0) > 0;
    if (rate !== null && rate < 0) {
      const noRain = Date.parse(a.createdAt) + ((current - min) / -rate) * HOUR;
      const noRainText = `Si no llueve, la humedad bajará del ${min} % cerca de las ${this.i18n.formatClock(noRain)} (${this.i18n.relativeFuture(new Date(noRain).toISOString(), this.now())}).`;
      if (rainy && (!estimated || Date.parse(estimated) > noRain + HOUR)) {
        return `${noRainText} Con la lluvia prevista el riego se retrasará${estimated ? ` hasta cerca de las ${this.i18n.formatClock(estimated)}` : ' más allá de 24 h'}.`;
      }
      return noRainText;
    }
    return `Con los datos actuales no se espera que la humedad baje del ${min} % en las próximas 24 horas.`;
  });

  protected readonly ariaLabel = computed(() => {
    const a = this.analysis();
    const last = this.future().at(-1)?.y;
    return `Gráfica de humedad del suelo de las últimas 24 horas y pronóstico de las próximas 24. Rango recomendado ${a.recommendedMin} a ${a.recommendedMax} %.${last !== undefined ? ` En 24 horas se espera ${this.i18n.formatNumber(last)} %.` : ''} ${this.reading()}`;
  });
}
