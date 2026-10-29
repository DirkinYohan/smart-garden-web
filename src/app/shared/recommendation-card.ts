import { ChangeDetectionStrategy, inject, Component, computed, input, output } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RecommendationDetail } from '../models/garden.models';
import { CATEGORY_UI, PRIORITY_UI } from './ai-labels';

/** One recommendation with its category icon, priority chip and optional one-click action. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-recommendation-card',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    @let d = detail();
    <article class="card" [class]="'tone-' + priority().tone">
      <div class="icon" aria-hidden="true">
        <mat-icon>{{ category().icon }}</mat-icon>
      </div>
      <div class="body">
        <div class="head">
          <h3>{{ d.title }}</h3>
          <span class="tone-chip">{{ i18n.t(priority().labelKey) }}</span>
        </div>
        <p>{{ d.detail }}</p>
        @if (d.action) {
          <button
            mat-stroked-button
            type="button"
            (click)="act.emit(d)"
            [disabled]="busy()"
            [attr.aria-label]="d.action.label + ': ' + d.title"
          >
            @if (busy()) {
              <mat-progress-spinner diameter="16" mode="indeterminate" aria-hidden="true" />
            } @else {
              <mat-icon>{{ d.action.type === 'CHECK_SENSOR' ? 'help' : 'bolt' }}</mat-icon>
            }
            {{ d.action.label }}
          </button>
        }
      </div>
    </article>
  `,
  styleUrls: ['./tone.scss'],
  styles: `
    .card {
      display: flex;
      gap: 12px;
      height: 100%;
      padding: 14px;
      border-radius: 12px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-left: 4px solid var(--tone);
      background: var(--mat-sys-surface-container-low);
    }
    .icon {
      flex-shrink: 0;
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .body {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    h3 {
      font: var(--mat-sys-title-small);
    }
    p {
      margin: 0;
    }
    button {
      align-self: flex-start;
    }
    mat-progress-spinner {
      display: inline-block;
      margin-right: 6px;
    }
  `,
})
export class RecommendationCard {
  protected readonly i18n = inject(I18nService);

  readonly detail = input.required<RecommendationDetail>();
  readonly busy = input(false);
  readonly act = output<RecommendationDetail>();

  protected readonly category = computed(() => CATEGORY_UI[this.detail().category]);
  protected readonly priority = computed(() => PRIORITY_UI[this.detail().priority]);
}
