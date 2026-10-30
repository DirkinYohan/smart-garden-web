import { TestBed } from '@angular/core/testing';
import { MoistureLevel } from '../models/garden.models';
import { MoistureGauge } from './moisture-gauge';

function gauge(value: number, min = 40, max = 70, sensorOk = true) {
  const fixture = TestBed.createComponent(MoistureGauge);
  fixture.componentRef.setInput('value', value);
  fixture.componentRef.setInput('min', min);
  fixture.componentRef.setInput('max', max);
  fixture.componentRef.setInput('sensorOk', sensorOk);
  fixture.detectChanges();
  const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
  const path = fixture.nativeElement.querySelector('path.value') as SVGPathElement;
  const caption = fixture.nativeElement.querySelector('text.caption') as SVGTextElement;
  const number = fixture.nativeElement.querySelector('text.number') as SVGTextElement | null;
  return { fixture, svg, path, caption, number };
}

describe('MoistureGauge', () => {
  it('draws the value arc as a stroke, never as a filled shape', () => {
    const { path, svg } = gauge(77);

    expect(path.getAttribute('class')).toBe('value');
    expect(path.getAttribute('data-level')).toBe('WET');
    expect(svg.style.getPropertyValue('--level-color')).toBe('var(--sg-wet)');
  });

  it('shows the percentage and the level text', () => {
    const { caption, number } = gauge(77);

    expect(number?.textContent).toContain('77');
    expect(caption.textContent).toBe('Alta');
  });

  it.each<[number, MoistureLevel, string, string]>([
    [22, 'VERY_DRY', 'Muy seca', 'var(--sg-dry)'],
    [35, 'DRY', 'Baja', 'var(--sg-warn)'],
    [55, 'OPTIMAL', 'Ideal', 'var(--sg-ok)'],
    [77, 'WET', 'Alta', 'var(--sg-wet)'],
    [99, 'SATURATED', 'Saturada', 'var(--sg-saturated)'],
  ])('maps %s %% to %s with its own colour', (value, level, label, color) => {
    const { svg, path, caption } = gauge(value);

    expect(path.getAttribute('data-level')).toBe(level);
    expect(caption.textContent).toBe(label);
    expect(svg.style.getPropertyValue('--level-color')).toBe(color);
  });

  it('hides the number and greys the gauge when the sensor fails', () => {
    const { svg, caption, number } = gauge(60, 40, 70, false);

    expect(number).toBeNull();
    expect(caption.textContent).toBe('Error de sensor');
    expect(svg.style.getPropertyValue('--level-color')).toBe('var(--mat-sys-on-surface-variant)');
  });

  it('still draws the arc for 0 % and 100 %', () => {
    expect(gauge(0).path.getAttribute('d')).toContain('M ');
    expect(gauge(100).path.getAttribute('d')).toContain('A 80 80');
  });
});
