import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { classifyMoisture, moistureLevelUi } from './moisture-level';

const START_ANGLE = 135;
const SWEEP = 270;

function point(cx: number, cy: number, r: number, angle: number): [number, number] {
  const rad = (angle * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const [x1, y1] = point(cx, cy, r, from);
  const [x2, y2] = point(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-moisture-gauge',
  template: `
    <svg
      viewBox="0 0 200 200"
      role="meter"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-valuenow]="value()"
      [attr.aria-valuetext]="ariaText()"
      [attr.aria-label]="'Humedad del suelo'"
      [style.--level-color]="color()"
    >
      <path class="track" [attr.d]="trackPath" />
      <path class="range" [attr.d]="rangePath()" />
      <path class="value" [attr.d]="valuePath()" [attr.data-level]="level()" />
      @for (tick of ticks(); track tick.label) {
        <line class="tick" [attr.x1]="tick.x1" [attr.y1]="tick.y1" [attr.x2]="tick.x2" [attr.y2]="tick.y2" />
        <text class="tick-label" [attr.x]="tick.tx" [attr.y]="tick.ty">{{ tick.label }}</text>
      }
      @if (showValue()) {
        <text class="number" x="100" y="104">{{ value() }}<tspan class="pct">%</tspan></text>
      }
      <text class="caption" x="100" y="130" [attr.data-level]="level()">{{ caption() }}</text>
    </svg>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      max-width: 280px;
      margin: 0 auto;
    }
    svg {
      width: 100%;
      height: auto;
      overflow: visible;
    }
    /* Los arcos son trazos, nunca superficies rellenas. */
    path {
      fill: none;
      stroke-linecap: round;
    }
    .track {
      stroke: var(--mat-sys-surface-container-highest);
      stroke-width: 16;
    }
    .range {
      stroke: var(--sg-ok);
      stroke-width: 4;
      opacity: 0.45;
    }
    .value {
      fill: none;
      stroke: var(--level-color, var(--sg-ok));
      stroke-width: 16;
      transition:
        d 0.6s ease,
        stroke 0.3s;
    }
    .tick {
      stroke: var(--mat-sys-on-surface);
      stroke-width: 2;
    }
    .tick-label {
      font: 600 10px Roboto, sans-serif;
      fill: var(--mat-sys-on-surface-variant);
      text-anchor: middle;
      dominant-baseline: middle;
    }
    .number {
      font: 500 44px Roboto, sans-serif;
      fill: var(--level-color, var(--sg-ok));
      text-anchor: middle;
    }
    .pct {
      font-size: 22px;
    }
    .caption {
      font: 600 13px Roboto, sans-serif;
      fill: var(--level-color, var(--mat-sys-on-surface-variant));
      text-anchor: middle;
    }
    @media (prefers-reduced-motion: reduce) {
      .value {
        transition: none;
      }
    }
  `,
})
export class MoistureGauge {
  private readonly i18n = inject(I18nService);

  readonly value = input.required<number>();
  readonly min = input.required<number>();
  readonly max = input.required<number>();
  readonly sensorOk = input(true);

  protected readonly trackPath = arc(100, 100, 80, START_ANGLE, START_ANGLE + SWEEP);

  protected readonly level = computed(() =>
    classifyMoisture(this.value(), this.min(), this.max(), this.sensorOk()),
  );

  protected readonly color = computed(() => moistureLevelUi(this.level()).color);

  protected readonly caption = computed(() => this.i18n.moistureLevelLabel(this.level()));

  protected readonly showValue = computed(() => this.level() !== 'SENSOR_ERROR');

  protected readonly valuePath = computed(() => {
    const v = Math.max(0, Math.min(100, this.value()));
    return arc(100, 100, 80, START_ANGLE, START_ANGLE + Math.max(0.5, (v / 100) * SWEEP));
  });

  protected readonly rangePath = computed(() =>
    arc(100, 100, 94, this.angle(this.min()), this.angle(Math.max(this.min() + 0.5, this.max()))),
  );

  protected readonly ticks = computed(() =>
    [this.min(), this.max()].map((v, i) => {
      const a = this.angle(v);
      const [x1, y1] = point(100, 100, 68, a);
      const [x2, y2] = point(100, 100, 98, a);
      const [tx, ty] = point(100, 100, 56, a);
      return { x1, y1, x2, y2, tx, ty, label: `${i === 0 ? 'mín' : 'máx'} ${v}` };
    }),
  );

  protected readonly ariaText = computed(
    () => `${this.value()} %, ${this.caption()}, rango ${this.min()} a ${this.max()} %`,
  );

  private angle(v: number): number {
    return START_ANGLE + (Math.max(0, Math.min(100, v)) / 100) * SWEEP;
  }
}
