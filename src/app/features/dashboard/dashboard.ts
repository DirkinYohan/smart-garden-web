import { DatePipe, DecimalPipe } from '@angular/common';
import { I18nService } from '../../core/i18n/i18n.service';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { GardenStore } from '../../core/state/garden-store';
import { ThemeService } from '../../core/theme.service';
import { MODE_ICONS, cssVar, withAlpha } from '../../shared/labels';
import { IrrigationMode, RiskLevel } from '../../models/garden.models';
import { MoistureGauge } from '../../shared/moisture-gauge';
import { MoistureLevelChip } from '../../shared/moisture-level-chip';
import { EmptyState, ErrorState, Loading } from '../../shared/state-views';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-dashboard',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
    BaseChartDirective,
    MoistureGauge,
    MoistureLevelChip,
    EmptyState,
    ErrorState,
    Loading,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected readonly i18n = inject(I18nService);

  protected readonly store = inject(GardenStore);
  private readonly theme = inject(ThemeService);

  protected readonly modeLabel = (m: IrrigationMode | null | undefined) => this.i18n.modeLabel(m);
  protected readonly modeIcons = MODE_ICONS;
  protected readonly riskLabel = (r: RiskLevel | null | undefined) => this.i18n.riskLabel(r);

  protected readonly status = computed(() => this.store.status().value);
  protected readonly lastReading = computed(() => this.i18n.relativeTime(this.store.secondsSinceLastReading()));

  protected readonly thresholds = computed(() => {
    const c = this.store.config().value;
    if (c) return { min: c.minMoisture, max: c.maxMoisture };
    const s = this.status();
    if (s?.hasReading && s.maxMoisture > 0) return { min: s.minMoisture, max: s.maxMoisture };
    return { min: 30, max: 70 };
  });

  protected readonly nextIrrigation = computed(() => {
    const h = this.store.latestAnalysis().value?.hoursUntilNextIrrigation;
    if (h === null || h === undefined) return this.i18n.t('ai.kpi.noEstimate');
    if (h <= 0) return this.i18n.t('kpi.now');
    if (h < 1) return this.i18n.t('time.inMinutes', { n: Math.round(h * 60) });
    return this.i18n.t('time.inHours', { n: h.toFixed(1) });
  });

  protected readonly chartData = computed<ChartConfiguration<'line'>['data']>(() => {
    this.theme.dark();
    const samples = this.store.liveSamples();
    const { min, max } = this.thresholds();
    const labels = samples.map((s) =>
      new Date(s.time).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    );
    const primary = cssVar('--mat-sys-primary', '#2e7d32');
    const muted = cssVar('--mat-sys-outline', '#888');
    return {
      labels,
      datasets: [
        {
          label: 'Humedad (%)',
          data: samples.map((s) => s.moisture),
          borderColor: primary,
          backgroundColor: withAlpha(primary, 0.2),
          fill: true,
          pointRadius: 0,
          tension: 0.3,
          borderWidth: 2,
        },
        {
          label: 'Mínimo',
          data: samples.map(() => min),
          borderColor: muted,
          borderDash: [4, 4],
          pointRadius: 0,
          borderWidth: 1,
        },
        {
          label: 'Máximo',
          data: samples.map(() => max),
          borderColor: muted,
          borderDash: [4, 4],
          pointRadius: 0,
          borderWidth: 1,
        },
      ],
    };
  });

  protected readonly chartOptions = computed<ChartConfiguration<'line'>['options']>(() => {
    this.theme.dark();
    const text = cssVar('--mat-sys-on-surface-variant', '#555');
    const grid = cssVar('--mat-sys-outline-variant', '#ddd');
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} %` } },
      },
      scales: {
        x: { ticks: { color: text, maxTicksLimit: 6, maxRotation: 0 }, grid: { display: false } },
        y: {
          min: 0,
          max: 100,
          ticks: { color: text, stepSize: 25, callback: (v) => `${v} %` },
          grid: { color: grid },
        },
      },
    };
  });
}
