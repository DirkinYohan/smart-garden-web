import { DatePipe } from '@angular/common';
import { I18nService } from '../../core/i18n/i18n.service';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { GardenApi } from '../../core/api/garden-api';
import { GardenStore } from '../../core/state/garden-store';
import { ThemeService } from '../../core/theme.service';
import { HistoryPoint, HistoryRange, IrrigationEvent } from '../../models/garden.models';
import { cssVar, withAlpha } from '../../shared/labels';
import { IrrigationMode } from '../../models/garden.models';
import { EmptyState, ErrorState, Loading } from '../../shared/state-views';
import { SpanishPaginatorIntl } from '../../shared/spanish-paginator';

type Load<T> = { state: 'loading' } | { state: 'error' } | { state: 'ready'; data: T };

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-history',
  imports: [
    DatePipe,
    MatCardModule,
    MatButtonToggleModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    BaseChartDirective,
    EmptyState,
    ErrorState,
    Loading,
  ],
  providers: [{ provide: MatPaginatorIntl, useClass: SpanishPaginatorIntl }],
  templateUrl: './history.html',
  styleUrl: './history.scss',
})
export class History {
  protected readonly i18n = inject(I18nService);

  private readonly api = inject(GardenApi);
  private readonly store = inject(GardenStore);
  private readonly theme = inject(ThemeService);

  protected readonly ranges: { value: HistoryRange; label: string }[] = [
    { value: '24h', label: '24 h' },
    { value: '7d', label: '7 días' },
    { value: '30d', label: '30 días' },
  ];
  protected readonly range = signal<HistoryRange>('24h');
  protected readonly history = signal<Load<HistoryPoint[]>>({ state: 'loading' });
  protected readonly events = signal<Load<IrrigationEvent[]>>({ state: 'loading' });

  protected readonly modeLabel = (m: IrrigationMode | null | undefined) => this.i18n.modeLabel(m);
  protected readonly duration = (s: number | null) => this.i18n.formatDuration(s);
  protected readonly columns = ['startedAt', 'duration', 'moisture', 'mode'];
  protected readonly dataSource = new MatTableDataSource<IrrigationEvent>([]);
  private readonly paginator = viewChild(MatPaginator);

  constructor() {
    effect(() => this.loadHistory(this.range()));
    this.loadEvents();
    effect(() => {
      const paginator = this.paginator();
      if (paginator) this.dataSource.paginator = paginator;
    });
  }

  protected loadHistory(range: HistoryRange = this.range()): void {
    this.history.set({ state: 'loading' });
    this.api.getHistory(range).subscribe({
      next: (data) => this.history.set({ state: 'ready', data }),
      error: () => this.history.set({ state: 'error' }),
    });
  }

  protected loadEvents(): void {
    this.events.set({ state: 'loading' });
    this.api.getEvents(200).subscribe({
      next: (data) => {
        this.dataSource.data = data;
        this.events.set({ state: 'ready', data });
      },
      error: () => this.events.set({ state: 'error' }),
    });
  }

  protected readonly chartData = computed<ChartConfiguration<'line'>['data'] | null>(() => {
    this.theme.dark();
    const h = this.history();
    if (h.state !== 'ready' || h.data.length === 0) return null;
    const points = h.data;
    const config = this.store.config().value;
    const primary = cssVar('--mat-sys-primary', 'rgb(46, 125, 50)');
    const dry = cssVar('--sg-dry', 'rgb(198, 40, 40)');
    const wet = cssVar('--sg-wet', 'rgb(21, 101, 192)');
    const longRange = this.range() !== '24h';
    const labels = points.map((p) =>
      new Date(p.timestamp).toLocaleString(
        'es-CO',
        longRange
          ? { day: '2-digit', month: 'short', hour: '2-digit' }
          : { hour: '2-digit', minute: '2-digit' },
      ),
    );
    const datasets: ChartConfiguration<'line'>['data']['datasets'] = [
      {
        label: 'Máxima',
        data: points.map((p) => p.maxMoisture),
        borderColor: 'transparent',
        backgroundColor: withAlpha(primary, 0.18),
        pointRadius: 0,
        fill: '+1',
      },
      {
        label: 'Mínima',
        data: points.map((p) => p.minMoisture),
        borderColor: 'transparent',
        pointRadius: 0,
        fill: false,
      },
      {
        label: 'Promedio',
        data: points.map((p) => p.avgMoisture),
        borderColor: primary,
        pointRadius: 0,
        borderWidth: 2,
        tension: 0.25,
        fill: false,
      },
    ];
    if (config) {
      datasets.push(
        {
          label: `Umbral mínimo (${config.minMoisture} %)`,
          data: points.map(() => config.minMoisture),
          borderColor: dry,
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        },
        {
          label: `Umbral máximo (${config.maxMoisture} %)`,
          data: points.map(() => config.maxMoisture),
          borderColor: wet,
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        },
      );
    }
    return { labels, datasets };
  });

  protected readonly chartOptions = computed<ChartConfiguration<'line'>['options']>(() => {
    this.theme.dark();
    const text = cssVar('--mat-sys-on-surface-variant', 'rgb(80, 80, 80)');
    const grid = cssVar('--mat-sys-outline-variant', 'rgb(220, 220, 220)');
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: text,
            boxWidth: 14,
            filter: (item) => item.text !== 'Mínima',
          },
        },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} %` } },
      },
      scales: {
        x: { ticks: { color: text, maxTicksLimit: 8, maxRotation: 0 }, grid: { display: false } },
        y: {
          min: 0,
          max: 100,
          ticks: { color: text, callback: (v) => `${v} %` },
          grid: { color: grid },
        },
      },
    };
  });
}
