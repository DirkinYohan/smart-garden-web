import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Tone } from './ai-labels';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-stat-tile',
  imports: [MatIconModule],
  template: `
    <article class="tile" [class]="'tone-' + tone()" [attr.aria-label]="label() + ': ' + value()">
      <header>
        <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
        <h3>{{ label() }}</h3>
      </header>
      <p class="value">{{ value() }}</p>
      <ng-content />
      @if (sub()) {
        <p class="sub">{{ sub() }}</p>
      }
    </article>
  `,
  styleUrls: ['./tone.scss'],
  styles: `
    .tile {
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-low);
    }
    header {
      display: flex;
      align-items: center;
      gap: 6px;
      mat-icon {
        color: var(--tone);
      }
    }
    h3 {
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-on-surface-variant);
    }
    p {
      margin: 0;
    }
    .value {
      font: var(--mat-sys-headline-small);
      color: var(--mat-sys-on-surface);
    }
    .sub {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class StatTile {
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly sub = input<string | null>(null);
  readonly tone = input<Tone>('neutral');
}
