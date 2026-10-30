import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-bullet-gauge',
  template: `
    <svg viewBox="0 0 200 58" role="img" [attr.aria-label]="ariaLabel()">
      <rect class="track" x="6" y="22" width="188" height="14" rx="7" />
      <rect class="band" [attr.x]="x(min())" y="22" [attr.width]="x(max()) - x(min())" height="14" />
      @if (cropMin() !== null && cropMax() !== null) {
        <line class="crop" [attr.x1]="x(cropMin()!)" [attr.x2]="x(cropMin()!)" y1="17" y2="41" />
        <line class="crop" [attr.x1]="x(cropMax()!)" [attr.x2]="x(cropMax()!)" y1="17" y2="41" />
      }
      @if (value() !== null) {
        <g class="marker" [class]="state()" [attr.transform]="'translate(' + x(value()!) + ',0)'">
          <rect x="-3" y="13" width="6" height="32" rx="3" />
          <text x="0" y="9" text-anchor="middle">{{ value() }} %</text>
        </g>
      }
      <text class="tick" [attr.x]="x(min())" y="56" text-anchor="middle">{{ min() }} %</text>
      <text class="tick" [attr.x]="x(max())" y="56" text-anchor="middle">{{ max() }} %</text>
    </svg>
  `,
  styles: `
    :host {
      display: block;
      max-width: 320px;
    }
    svg {
      width: 100%;
      height: auto;
      overflow: visible;
    }
    .track {
      fill: var(--mat-sys-surface-container-highest);
    }
    .band {
      fill: color-mix(in srgb, var(--sg-ok) 35%, transparent);
    }
    .crop {
      stroke: var(--mat-sys-on-surface-variant);
      stroke-width: 2;
      stroke-dasharray: 3 2;
    }
    .marker rect {
      fill: var(--sg-ok);
      stroke: var(--mat-sys-surface);
      stroke-width: 1.5;
    }
    .marker text {
      font: 600 12px Roboto, sans-serif;
      fill: var(--mat-sys-on-surface);
    }
    .marker.dry rect {
      fill: var(--sg-dry);
    }
    .marker.wet rect {
      fill: var(--sg-wet);
    }
    .marker {
      transition: transform 0.6s ease;
    }
    .tick {
      font: 11px Roboto, sans-serif;
      fill: var(--mat-sys-on-surface-variant);
    }
    @media (prefers-reduced-motion: reduce) {
      .marker {
        transition: none;
      }
    }
  `,
})
export class BulletGauge {
  readonly value = input<number | null>(null);
  readonly min = input.required<number>();
  readonly max = input.required<number>();
  readonly cropMin = input<number | null>(null);
  readonly cropMax = input<number | null>(null);

  protected readonly state = computed(() => {
    const v = this.value();
    if (v === null) return '';
    return v < this.min() ? 'dry' : v > this.max() ? 'wet' : 'ok';
  });

  protected readonly ariaLabel = computed(() => {
    const v = this.value();
    const range = `rango recomendado ${this.min()} a ${this.max()} %`;
    if (v === null) return `Humedad actual desconocida, ${range}`;
    const where = v < this.min() ? 'por debajo del' : v > this.max() ? 'por encima del' : 'dentro del';
    return `Humedad actual ${v} %, ${where} ${range}`;
  });

  protected x(v: number): number {
    return 6 + (Math.max(0, Math.min(100, v)) / 100) * 188;
  }
}
