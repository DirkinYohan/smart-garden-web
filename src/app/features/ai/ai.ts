import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, interval } from 'rxjs';
import { AiActions, isActionStillUseful } from '../../core/ai-actions';
import { GardenApi } from '../../core/api/garden-api';
import { I18nService } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/notification.service';
import { GardenStore } from '../../core/state/garden-store';
import { Analysis, HistoryPoint, RecommendationDetail } from '../../models/garden.models';
import { PRIORITY_UI } from '../../shared/ai-labels';
import { RecommendationCard } from '../../shared/recommendation-card';
import { EmptyState, ErrorState, Loading } from '../../shared/state-views';
import { AnalysisDialog } from './analysis-dialog';
import { AnalysisTimeline } from './analysis-timeline';
import { ForecastChart } from './forecast-chart';
import { KpiRow } from './kpi-row';
import { RainChart } from './rain-chart';
import { StatusCard } from './status-card';
import { StatsState, Trends } from './trends';
import { UpdatingAnalysis } from './updating-analysis';
import { WhyFactors } from './why-factors';

type Load<T> = { state: 'loading' | 'error' | 'ready'; data: T };

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ai',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    StatusCard,
    KpiRow,
    ForecastChart,
    RecommendationCard,
    WhyFactors,
    Trends,
    UpdatingAnalysis,
    RainChart,
    AnalysisTimeline,
    EmptyState,
    ErrorState,
    Loading,
  ],
  templateUrl: './ai.html',
  styleUrl: './ai.scss',
})
export class Ai implements OnDestroy {
  protected readonly store = inject(GardenStore);
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(GardenApi);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly actions = inject(AiActions);

  protected readonly analyzing = signal(false);
  protected readonly flash = signal(false);
  protected readonly busyAction = signal<RecommendationDetail | null>(null);
  protected readonly history24h = signal<Load<HistoryPoint[]>>({ state: 'loading', data: [] });
  protected readonly list = signal<Load<Analysis[]>>({ state: 'loading', data: [] });
  protected readonly statsDays = signal<7 | 30>(7);
  protected readonly stats = signal<StatsState>({ state: 'loading' });

  private ownAnalysisId: string | null = null;
  private lastSeenFeedId: string | null = null;
  private readonly refresh: Subscription;

  protected readonly latest = computed(() => this.store.latestAnalysis().value);

  protected readonly cropName = computed(() => this.store.currentCropName());

  protected readonly updatingAnalysis = computed(() => !this.store.analysisMatchesCrop());

  protected readonly autoAnalysis = computed(() => this.store.config().value?.aiEnabled ?? true);

  protected readonly liveSensorOk = computed(() => this.store.status().value?.sensorOk ?? true);

  protected readonly nowMinute = computed(() => Math.floor(this.store.now() / 60_000) * 60_000);

  protected readonly liveMoisture = computed(() => {
    const s = this.store.status().value;
    return s?.hasReading && s.sensorOk && this.store.deviceOnline() ? s.moisture : null;
  });

  protected readonly details = computed(() => {
    const analysis = this.latest();
    const config = this.store.config().value;

    if (!analysis || !this.store.analysisMatchesCrop()) return [];
    return [...analysis.recommendationDetails]
      .sort((a, b) => PRIORITY_UI[a.priority].order - PRIORITY_UI[b.priority].order)
      .map((d) => (d.action && !isActionStillUseful(d.action.type, analysis, config) ? { ...d, action: null } : d));
  });

  protected readonly timeline = computed(() => {
    const seen = new Set<string>();
    return [...this.store.analysisFeed(), ...this.list().data]
      .filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  constructor() {
    this.loadHistory();
    this.loadList();
    effect(() => this.loadStats(this.statsDays()));

    effect(() => {
      const newest = this.store.analysisFeed()[0];
      if (!newest || newest.id === this.lastSeenFeedId) return;
      this.lastSeenFeedId = newest.id;
      untracked(() => {
        if (newest.id !== this.ownAnalysisId) {
          this.notify.success('Nuevo análisis de la IA');
        }
        this.highlight();
        this.loadStats(this.statsDays());
      });
    });
    this.refresh = interval(5 * 60_000).subscribe(() => this.loadHistory());
  }

  ngOnDestroy(): void {
    this.refresh.unsubscribe();
  }

  protected analyze(): void {
    if (this.analyzing()) return;
    this.analyzing.set(true);
    this.api.requestAnalysis().subscribe({
      next: (analysis) => {
        this.analyzing.set(false);
        this.ownAnalysisId = analysis.id;
        this.store.latestAnalysis.set({ value: analysis, loading: false, error: false });
        this.store.analysisFeed.update((list) => [analysis, ...list.filter((a) => a.id !== analysis.id)]);
        this.notify.success(
          analysis.source === 'GEMINI' ? 'Análisis completado con Gemini' : 'Análisis completado con las reglas de respaldo',
        );
      },

      error: () => this.analyzing.set(false),
    });
  }

  protected runAction(detail: RecommendationDetail): void {
    const analysis = this.latest();
    if (!analysis || this.busyAction()) return;
    this.busyAction.set(detail);
    this.actions.run(detail, analysis).subscribe({
      complete: () => this.busyAction.set(null),
      error: () => this.busyAction.set(null),
    });
  }

  protected openAnalysis(analysis: Analysis): void {
    this.dialog.open(AnalysisDialog, { data: analysis, width: '640px', maxWidth: '95vw', autoFocus: 'dialog' });
  }

  protected loadHistory(): void {
    this.history24h.update((h) => ({ ...h, state: h.data.length ? 'ready' : 'loading' }));
    this.api.getHistory('24h').subscribe({
      next: (data) => this.history24h.set({ state: 'ready', data }),
      error: () => this.history24h.update((h) => ({ ...h, state: 'error' })),
    });
  }

  protected loadList(): void {
    this.list.update((l) => ({ ...l, state: 'loading' }));
    this.api.listAnalyses(50).subscribe({
      next: (data) => this.list.set({ state: 'ready', data }),
      error: () => this.list.update((l) => ({ ...l, state: 'error' })),
    });
  }

  protected loadStats(days: 7 | 30): void {
    this.stats.set({ state: 'loading' });
    this.api.getAiStats(days).subscribe({
      next: (data) => this.stats.set({ state: 'ready', data }),
      error: () => this.stats.set({ state: 'error' }),
    });
  }

  private highlight(): void {
    this.flash.set(false);
    setTimeout(() => this.flash.set(true));
    setTimeout(() => this.flash.set(false), 1800);
  }
}
