import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Analysis } from '../../models/garden.models';
import { CATEGORY_UI, NEXT_ACTION_UI, PRIORITY_UI } from '../../shared/ai-labels';
import { HealthBadge } from '../../shared/health-badge';
import { WhyFactors } from './why-factors';

/** Full analysis from the timeline (read-only). */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-analysis-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, HealthBadge, WhyFactors],
  template: `
    <h2 mat-dialog-title>Análisis del {{ date }}</h2>
    <mat-dialog-content class="content">
      <div class="row">
        <app-health-badge [status]="a.healthStatus" />
        <span class="tag">{{ a.source === 'GEMINI' ? 'Gemini' : 'Reglas de respaldo' }}</span>
        <span class="tag">{{ riskLabel(a.riskLevel) }}</span>
        @if (a.nextAction) {
          <span class="tag">{{ i18n.t(nextAction[a.nextAction].labelKey) }}</span>
        }
      </div>
      @if (a.headline) {
        <p class="headline">{{ a.headline }}</p>
      }
      <p>{{ a.summary }}</p>
      <p class="muted">
        Umbrales recomendados {{ a.recommendedMin }}–{{ a.recommendedMax }} %{{ a.pauseForRain ? ' · pausa por lluvia' : '' }}{{ a.applied ? ' · aplicado al riego' : '' }}
      </p>
      @if (a.source === 'RULES') {
        <p class="muted">{{ fallback }}</p>
      }

      <h3>Recomendaciones</h3>
      @if (a.recommendationDetails.length) {
        <ul class="recs">
          @for (d of a.recommendationDetails; track $index) {
            <li>
              <mat-icon aria-hidden="true">{{ category[d.category].icon }}</mat-icon>
              <div>
                <strong>{{ d.title }}</strong> <span class="muted">({{ i18n.t(priority[d.priority].labelKey) }})</span>
                <p>{{ d.detail }}</p>
              </div>
            </li>
          }
        </ul>
      } @else {
        <ul>
          @for (r of a.recommendations; track $index) {
            <li>{{ r }}</li>
          }
        </ul>
      }

      @if (a.inputSnapshot; as s) {
        <h3>Datos que tuvo en cuenta</h3>
        <app-why-factors [snapshot]="s" [recommendedMin]="a.recommendedMin" />
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" mat-dialog-close cdkFocusInitial>Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .tag {
      padding: 2px 10px;
      border-radius: 10px;
      font: var(--mat-sys-label-medium);
      background: var(--mat-sys-surface-container-high);
    }
    .headline {
      font: var(--mat-sys-title-large);
      margin: 8px 0 0;
    }
    p {
      margin: 0;
    }
    h3 {
      font: var(--mat-sys-title-small);
      margin: 12px 0 4px;
    }
    .recs {
      list-style: none;
      padding: 0;
      margin: 0;
      li {
        display: flex;
        gap: 8px;
        margin: 6px 0;
      }
      mat-icon {
        color: var(--mat-sys-primary);
        flex-shrink: 0;
      }
    }
  `,
})
export class AnalysisDialog {
  protected readonly i18n = inject(I18nService);

  protected readonly a = inject<Analysis>(MAT_DIALOG_DATA);
  protected readonly date = this.i18n.formatDateTime(this.a.createdAt);
  protected readonly fallback = this.i18n.fallbackText(this.a.fallbackReason);
  protected readonly riskLabel = (r: string) => this.i18n.riskLabel(r as never);
  protected readonly nextAction = NEXT_ACTION_UI;
  protected readonly category = CATEGORY_UI;
  protected readonly priority = PRIORITY_UI;
}
