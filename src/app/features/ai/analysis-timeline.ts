import { ChangeDetectionStrategy, inject, Component, computed, input, output, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Analysis } from '../../models/garden.models';
import { HEALTH_UI } from '../../shared/ai-labels';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-analysis-timeline',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <ol class="timeline">
      @for (a of visible(); track a.id) {
        <li>
          <button type="button" class="entry" (click)="open.emit(a)" [attr.aria-label]="'Ver análisis del ' + date(a)">
            <span class="dot" [class]="'tone-' + tone(a)" aria-hidden="true">
              <mat-icon>{{ icon(a) }}</mat-icon>
            </span>
            <span class="body">
              <span class="title">{{ a.headline ?? a.summary }}</span>
              <span class="meta">
                <time [attr.datetime]="a.createdAt">{{ date(a) }}</time>
                <span class="tag">{{ a.source === 'GEMINI' ? 'Gemini' : 'Reglas' }}</span>
                <span class="tag">{{ i18n.riskLabel(a.riskLevel) }}</span>
              </span>
            </span>
            <mat-icon class="chevron" aria-hidden="true">chevron_right</mat-icon>
          </button>
        </li>
      }
    </ol>
    @if (analyses().length > shown()) {
      <button mat-button type="button" (click)="shown.set(shown() + step)">
        <mat-icon>expand_more</mat-icon> Ver más
      </button>
    }
  `,
  styleUrls: ['../../shared/tone.scss'],
  styles: `
    .timeline {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .entry {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 8px 4px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .entry:hover {
      background: var(--mat-sys-surface-container-high);
    }
    .dot {
      flex-shrink: 0;
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      color: var(--tone);
      background: color-mix(in srgb, var(--tone) 16%, transparent);
      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }
    .body {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }
    .title {
      font: var(--mat-sys-title-small);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .tag {
      padding: 0 8px;
      border-radius: 8px;
      font: var(--mat-sys-label-small);
      background: var(--mat-sys-surface-container-high);
    }
    .chevron {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class AnalysisTimeline {
  protected readonly i18n = inject(I18nService);

  readonly analyses = input.required<Analysis[]>();
  readonly open = output<Analysis>();

  protected readonly step = 8;
  protected readonly shown = signal(this.step);
  protected readonly visible = computed(() => this.analyses().slice(0, this.shown()));
  protected readonly riskLabel = (r: string) => this.i18n.riskLabel(r as never);

  protected icon(a: Analysis): string {
    return a.healthStatus ? HEALTH_UI[a.healthStatus].icon : 'psychology';
  }

  protected tone(a: Analysis): string {
    if (a.healthStatus) return HEALTH_UI[a.healthStatus].tone;
    return a.riskLevel === 'HIGH' ? 'bad' : a.riskLevel === 'MEDIUM' ? 'warn' : 'good';
  }

  protected date(a: Analysis): string {
    return this.i18n.formatDateTime(a.createdAt);
  }
}
