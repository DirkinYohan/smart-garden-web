import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { I18nService } from '../core/i18n/i18n.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-language-toggle',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <button
      mat-button
      type="button"
      class="lang-toggle"
      (click)="i18n.toggle()"
      [matTooltip]="i18n.t('lang.switch')"
      [attr.aria-label]="i18n.t('lang.switch')"
    >
      <mat-icon aria-hidden="true">translate</mat-icon>
      <span class="code" [class.active]="!i18n.isEnglish()">ES</span>
      <span class="sep" aria-hidden="true">/</span>
      <span class="code" [class.active]="i18n.isEnglish()">EN</span>
    </button>
  `,
  styles: `
    .lang-toggle {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .code {
      font: var(--mat-sys-label-large);
      opacity: 0.6;
    }
    .code.active {
      opacity: 1;
      font-weight: 700;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .sep {
      opacity: 0.4;
    }
    @media (max-width: 599px) {
      .sep {
        display: none;
      }
      .code:not(.active) {
        display: none;
      }
    }
  `,
})
export class LanguageToggle {
  protected readonly i18n = inject(I18nService);
  protected readonly isEnglish = computed(() => this.i18n.isEnglish());
}
