import { ChangeDetectionStrategy, inject, Component, computed, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Analysis } from '../../models/garden.models';
import { NEXT_ACTION_UI } from '../../shared/ai-labels';
import { classifyMoisture } from '../../shared/moisture-level';
import { MoistureLevelChip } from '../../shared/moisture-level-chip';
import { HealthBadge } from '../../shared/health-badge';

const OUTDATED_MINUTES = 40;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ai-status-card',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    HealthBadge,
    MoistureLevelChip,
  ],
  template: `
    @let a = analysis();
    <section class="card" [class.flash]="flash()" aria-labelledby="status-title">
      <header class="top">
        <h2 id="status-title">{{ i18n.t('ai.statusTitle') }}</h2>
        <button mat-flat-button type="button" (click)="analyze.emit()" [disabled]="analyzing()" [attr.aria-busy]="analyzing()">
          @if (analyzing()) {
            <mat-progress-spinner diameter="18" mode="indeterminate" aria-hidden="true" class="spin" />
          } @else {
            <mat-icon>auto_awesome</mat-icon>
          }
          {{ analyzing() ? i18n.t('ai.analyzing') : i18n.t('ai.analyze') }}
        </button>
      </header>

      <div class="main">
        <app-health-badge [status]="a.healthStatus" size="large" />
        <div class="texts">
          <p class="headline">{{ a.headline ?? a.summary }}</p>
          @if (a.headline) {
            <p class="summary">{{ a.summary }}</p>
          }
        </div>
      </div>

      <div class="chips">
        <app-moisture-level-chip [level]="a.moistureLevel" />
        @if (nextAction(); as n) {
          <span class="tone-chip" [class]="'tone-' + n.tone">
            <mat-icon aria-hidden="true">{{ n.icon }}</mat-icon>{{ i18n.t(n.labelKey) }}
          </span>
        }
        @if (a.source === 'GEMINI') {
          <span class="tone-chip tone-water"><mat-icon aria-hidden="true">auto_awesome</mat-icon>{{ i18n.t('ai.gemini') }}</span>
        } @else {
          <span class="tone-chip tone-neutral"><mat-icon aria-hidden="true">rule</mat-icon>{{ i18n.t('ai.rules') }}</span>
        }
        <span class="when" [matTooltip]="absolute()">
          <mat-icon aria-hidden="true">schedule</mat-icon>
          {{ i18n.t('ai.analyzed', { when: relative() }) }}
        </span>
      </div>

      @if (liveChanged()) {
        <p class="note">
          <mat-icon aria-hidden="true">trending_up</mat-icon> {{ i18n.t('ai.levelChanged', { when: relative() }) }}
        </p>
      }
      @if (a.source === 'RULES') {
        <p class="note"><mat-icon aria-hidden="true">info</mat-icon>{{ fallback() }}</p>
      }
      @if (outdated()) {
        <p class="note warn" role="alert">
          <mat-icon aria-hidden="true">update</mat-icon>{{ i18n.t('ai.outdated') }}
        </p>
      }
    </section>
  `,
  styleUrls: ['../../shared/tone.scss', './status-card.scss'],
})
export class StatusCard {
  protected readonly i18n = inject(I18nService);

  readonly analysis = input.required<Analysis>();
  readonly now = input.required<number>();
  readonly analyzing = input(false);
  readonly flash = input(false);

  readonly liveMoisture = input<number | null>(null);
  readonly liveSensorOk = input(true);
  readonly analyze = output<void>();

  protected readonly nextAction = computed(() => {
    const n = this.analysis().nextAction;
    return n ? NEXT_ACTION_UI[n] : null;
  });
  protected readonly fallback = computed(() => this.i18n.fallbackText(this.analysis().fallbackReason));
  protected readonly relative = computed(() => this.i18n.relativePast(this.analysis().createdAt, this.now()));
  protected readonly absolute = computed(() => this.i18n.formatDateTime(this.analysis().createdAt));
  protected readonly outdated = computed(
    () => this.now() - Date.parse(this.analysis().createdAt) > OUTDATED_MINUTES * 60_000,
  );

  protected readonly liveLevel = computed(() => {
    const value = this.liveMoisture();
    if (value === null) return null;
    const a = this.analysis();
    const min = a.inputSnapshot?.currentMin || a.recommendedMin;
    const max = a.inputSnapshot?.currentMax || a.recommendedMax;
    return classifyMoisture(value, min, max, this.liveSensorOk());
  });

  protected readonly liveChanged = computed(() => {
    const analysed = this.analysis().moistureLevel;
    const live = this.liveLevel();
    return !!analysed && !!live && analysed !== live && live !== 'SENSOR_ERROR';
  });
}
