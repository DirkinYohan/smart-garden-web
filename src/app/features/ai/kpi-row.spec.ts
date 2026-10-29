import { TestBed } from '@angular/core/testing';
import { Analysis } from '../../models/garden.models';
import { KpiRow } from './kpi-row';

/**
 * La tarjeta "Humedad actual" (módulo de IA) debe mostrar el dato VIVO del sensor, no el que quedó congelado en el
 * último análisis, y avisar cuando el sensor deja de dar lecturas válidas (p. ej. al sacarlo del agua).
 */
function analysisWith(moisture: number | null): Analysis {
  return {
    id: 'a1',
    recommendedMin: 50,
    recommendedMax: 80,
    inputSnapshot: {
      currentMoisture: moisture,
      cropMin: 50,
      cropMax: 80,
      cropName: 'Lechuga',
      rainProbability12h: 10,
      precipitation12h: 0,
      dryingRatePerHour: -1,
    },
    projection: { points: [], dryingRatePerHour: -1, confidence: 'MEDIUM', estimatedNextIrrigationAt: null },
  } as unknown as Analysis;
}

function render(moisture: number | null, live: number | null, sensorOk = true) {
  const fixture = TestBed.configureTestingModule({ imports: [KpiRow] }).createComponent(KpiRow);
  fixture.componentRef.setInput('analysis', analysisWith(moisture));
  fixture.componentRef.setInput('liveMoisture', live);
  fixture.componentRef.setInput('sensorOk', sensorOk);
  fixture.componentRef.setInput('now', Date.now());
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
}

describe('KpiRow (humedad actual)', () => {
  it('shows the live reading instead of the analysis snapshot', () => {
    const text = render(86, 54);

    expect(text).toContain('54 %');
    expect(text).not.toContain('86 %');
  });

  it('falls back to the snapshot and says so when there is no live value yet', () => {
    const text = render(86, null);

    expect(text).toContain('86 %');
    expect(text).toContain('En el análisis');
  });

  it('never shows a stale value when the sensor is failing', () => {
    const text = render(86, null, false);

    expect(text).toContain('Sin lectura');
    expect(text).toContain('El sensor no envía lecturas válidas');
    expect(text).not.toContain('86 %');
  });
});
