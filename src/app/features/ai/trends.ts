import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ThemeService } from '../../core/theme.service';
import { AiStats } from '../../models/garden.models';

import { centerTextPlugin } from '../../shared/chart-plugins';
import { cssVar, withAlpha } from '../../shared/labels';
import { StatTile } from '../../shared/stat-tile';
import { EmptyState, ErrorState, Loading } from '../../shared/state-views';

export type StatsState = { state: 'loading' } | { state: 'error' } | { state: 'ready'; data: AiStats };

const MAX_THRESHOLD_POINTS = 120;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ai-trends',
  imports: [MatButtonToggleModule, BaseChartDirective, StatTile, EmptyState, ErrorState, Loading],
  templateUrl: './trends.html',
  styleUrl: './trends.scss',
})
export class Trends {
  private readonly i18n = inject(I18nService);

  readonly stats = input.required<StatsState>();
  readonly days = input.required<7 | 30>();
  readonly daysChange = output<7 | 30>();
  readonly retry = output<void>();

  private readonly theme = inject(ThemeService);
  protected readonly donutPlugins = [centerTextPlugin];

  protected readonly data = computed(() => {
    const s = this.stats();
    return s.state === 'ready' ? s.data : null;
  });

  protected readonly tiles = computed(() => {
    const d = this.data();
    if (!d) return null;
    const geminiPct = d.totalAnalyses ? Math.round((d.geminiCount / d.totalAnalyses) * 100) : 0;
    const pump = d.dailyMoisture.reduce((sum, x) => sum + x.pumpMinutes, 0);
    const irrigations = d.dailyMoisture.reduce((sum, x) => sum + x.irrigations, 0);
    return {
      analyses: String(d.totalAnalyses),
      gemini: `${geminiPct} %`,
      geminiSub: `${d.geminiCount} con Gemini · ${d.rulesCount} con reglas de respaldo`,
      rainPauses: String(d.rainPauses),
      pump: `${this.i18n.formatNumber(pump)} min`,
      pumpSub: `${irrigations} riegos en ${d.days} días`,
    };
  });

  private readonly days_ = computed(() => this.data()?.dailyMoisture ?? []);
  protected readonly hasDaily = computed(() => this.days_().some((d) => d.avg !== null || d.irrigations > 0));

  protected readonly dailyData = computed<ChartConfiguration<'line'>['data']>(() => {
    this.theme.dark();
    const primary = cssVar('--mat-sys-primary', 'rgb(46, 125, 50)');
    const wet = cssVar('--sg-wet', 'rgb(21, 101, 192)');
    const d = this.days_();
    return {
      labels: d.map((x) => new Date(x.date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })),
      datasets: [
        { label: 'Máxima', data: d.map((x) => x.max), borderColor: 'transparent', backgroundColor: withAlpha(primary, 0.15), pointRadius: 0, fill: '+1' },
        { label: 'Mínima', data: d.map((x) => x.min), borderColor: 'transparent', pointRadius: 0, fill: false },
        { label: 'Promedio', data: d.map((x) => x.avg), borderColor: primary, backgroundColor: primary, borderWidth: 2.5, pointRadius: 3, spanGaps: true, tension: 0.2 },
        { type: 'bar' as never, label: 'Riegos', data: d.map((x) => x.irrigations), yAxisID: 'y1', backgroundColor: withAlpha(wet, 0.55), borderRadius: 4, maxBarThickness: 28, order: 5 } as never,
      ],
    };
  });

  protected readonly dailyOptions = computed<ChartConfiguration<'line'>['options']>(() =>
    this.baseOptions({
      y: { min: 0, max: 100, ticks: { callback: (v: string | number) => `${v} %` } },

      y1: {
        position: 'right',
        min: 0,
        max: Math.max(3, Math.max(...this.days_().map((d) => d.irrigations)) * 3),
        ticks: { precision: 0 },
        grid: { display: false },
        title: { display: true, text: 'Riegos' },
      },
    }),
  );

  protected readonly dailyReading = computed(() => {
    const valid = this.days_().filter((d) => d.avg !== null);
    if (!valid.length) return '';
    const avg = valid.reduce((s, d) => s + d.avg!, 0) / valid.length;
    const irrigations = this.days_().reduce((s, d) => s + d.irrigations, 0);
    return `En promedio el suelo estuvo al ${this.i18n.formatNumber(avg, 0)} % y se regó ${irrigations} ${irrigations === 1 ? 'vez' : 'veces'}.`;
  });

  private readonly thresholds = computed(() => {
    const t = this.data()?.thresholdHistory ?? [];
    const step = Math.max(1, Math.ceil(t.length / MAX_THRESHOLD_POINTS));
    return t.filter((_, i) => i % step === 0 || i === t.length - 1);
  });

  protected readonly thresholdData = computed<ChartConfiguration<'line'>['data']>(() => {
    this.theme.dark();
    const ok = cssVar('--sg-ok', 'rgb(46, 125, 50)');
    const warn = cssVar('--sg-warn', 'rgb(178, 106, 0)');
    const dry = cssVar('--sg-dry', 'rgb(198, 40, 40)');
    const muted = cssVar('--mat-sys-outline', 'rgb(120, 120, 120)');
    const t = this.thresholds();
    const riskColor = { LOW: ok, MEDIUM: warn, HIGH: dry };
    return {
      datasets: [
        {
          label: 'Máximo recomendado',
          data: t.map((p) => ({ x: Date.parse(p.timestamp), y: p.max })),
          borderColor: muted,
          backgroundColor: withAlpha(ok, 0.15),
          pointRadius: 0,
          fill: '+1',
          stepped: true,
        },
        {
          label: 'Mínimo recomendado (color = riesgo)',
          data: t.map((p) => ({ x: Date.parse(p.timestamp), y: p.min })),
          borderColor: muted,
          pointBackgroundColor: t.map((p) => riskColor[p.riskLevel]),
          pointBorderColor: t.map((p) => riskColor[p.riskLevel]),
          pointRadius: 3,
          stepped: true,
        },
      ],
    };
  });

  protected readonly thresholdOptions = computed<ChartConfiguration<'line'>['options']>(() =>
    this.baseOptions({
      x: {
        type: 'linear',
        min: Date.parse(this.thresholds()[0]?.timestamp ?? '') || undefined,
        max: Date.parse(this.thresholds().at(-1)?.timestamp ?? '') || undefined,
        ticks: { maxTicksLimit: 6, callback: (v: string | number) => new Date(Number(v)).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) },
      },
      y: { min: 0, max: 100, ticks: { callback: (v: string | number) => `${v} %` } },
    }, (x) => this.i18n.formatDateTime(x)),
  );

  protected readonly thresholdReading = computed(() => {
    const t = this.data()?.thresholdHistory ?? [];
    if (!t.length) return '';
    const mins = t.map((p) => p.min);
    const maxs = t.map((p) => p.max);
    const lo = Math.min(...mins);
    const hi = Math.max(...maxs);
    const risky = t.filter((p) => p.riskLevel === 'HIGH').length;
    return `El rango recomendado se movió entre ${lo} % y ${hi} %. ${risky ? `Hubo ${risky} análisis con riesgo alto.` : 'No hubo análisis con riesgo alto.'}`;
  });

  protected readonly healthTotal = computed(() => {
    const h = this.data()?.healthDistribution;
    return h ? h.GOOD + h.ATTENTION + h.CRITICAL : 0;
  });

  protected readonly goodPct = computed(() => {
    const h = this.data()?.healthDistribution;
    return h && this.healthTotal() ? Math.round((h.GOOD / this.healthTotal()) * 100) : 0;
  });

  protected readonly donutData = computed<ChartConfiguration<'doughnut'>['data']>(() => {
    this.theme.dark();
    const h = this.data()?.healthDistribution ?? { GOOD: 0, ATTENTION: 0, CRITICAL: 0 };
    return {
      labels: ['Bien', 'Atención', 'Crítico'],
      datasets: [
        {
          data: [h.GOOD, h.ATTENTION, h.CRITICAL],
          backgroundColor: [cssVar('--sg-ok', 'green'), cssVar('--sg-warn', 'orange'), cssVar('--sg-dry', 'red')],
          borderColor: cssVar('--mat-sys-surface', 'white'),
          borderWidth: 2,
        },
      ],
    };
  });

  protected readonly donutOptions = computed<ChartConfiguration<'doughnut'>['options']>(() => {
    this.theme.dark();
    const text = cssVar('--mat-sys-on-surface', 'rgb(30, 30, 30)');
    const muted = cssVar('--mat-sys-on-surface-variant', 'rgb(80, 80, 80)');
    const total = this.healthTotal();
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { color: muted, boxWidth: 14 } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.parsed} (${total ? Math.round((ctx.parsed / total) * 100) : 0} %)`,
          },
        },
        sgCenterText: { text: `${this.goodPct()} %`, sub: 'en buen estado', color: text, subColor: muted },
      },
    };
  });

  protected readonly healthReading = computed(
    () => `${this.goodPct()} % del tiempo en buen estado (${this.healthTotal()} análisis evaluados).`,
  );

  private baseOptions(
    scales: Record<string, object>,
    title?: (x: number) => string,
  ): ChartConfiguration<'line'>['options'] {
    this.theme.dark();
    const text = cssVar('--mat-sys-on-surface-variant', 'rgb(80, 80, 80)');
    const grid = cssVar('--mat-sys-outline-variant', 'rgb(220, 220, 220)');
    const withColors = (s: Record<string, object>) =>
      Object.fromEntries(
        Object.entries(s).map(([k, v]) => [
          k,
          {
            ...v,
            ticks: { color: text, maxRotation: 0, ...((v as { ticks?: object }).ticks ?? {}) },
            grid: { color: grid, ...((v as { grid?: object }).grid ?? {}) },
            title: { color: text, ...((v as { title?: object }).title ?? {}) },
          },
        ]),
      );
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: text, boxWidth: 14, filter: (i) => i.text !== 'Mínima' && i.text !== 'Máxima' } },
        tooltip: {
          callbacks: title ? { title: (items) => (items.length ? title(items[0].parsed.x ?? 0) : '') } : {},
        },
      },
      scales: withColors({ x: { grid: { display: false } }, ...scales }) as never,
    };
  }
}
