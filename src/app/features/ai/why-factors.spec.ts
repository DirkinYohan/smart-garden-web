import { InputSnapshot } from '../../models/garden.models';
import { localHourTicks } from './forecast-chart';
import { I18nService } from '../../core/i18n/i18n.service';
import { factorsFor } from './why-factors';

localStorage.clear();
const i18n = new I18nService();
const localized = (snapshot: InputSnapshot, recommendedMin: number) =>
  factorsFor(snapshot, recommendedMin, i18n);

const base: InputSnapshot = {
  currentMoisture: 60,
  avgMoisture24h: 62,
  minMoisture24h: 50,
  maxMoisture24h: 70,
  dryingRatePerHour: -1,
  irrigations24h: 1,
  pumpMinutes24h: 2,
  rainProbability12h: 10,
  precipitation12h: 0,
  temperature: 20,
  airHumidity: 60,
  cropName: 'Lechuga',
  cropMin: 50,
  cropMax: 80,
  currentMin: 40,
  currentMax: 70,
  mode: 'AUTO',
  sensorOk: true,
  rainPause: false,
  readingAgeMinutes: 1,
  cropId: 3,
  moistureLevel: 'OPTIMAL',
};

const influences = (s: InputSnapshot) =>
  Object.fromEntries(localized(s, 45).map((f) => [f.label, f.influence]));

describe('factorsFor (¿Por qué la IA decidió esto?)', () => {
  it('highlights nothing when everything is normal', () => {
    expect(localized(base, 45).filter((f) => f.influence)).toEqual([]);
  });

  it('highlights low moisture, fast drying, rain and heat', () => {
    const hits = influences({
      ...base,
      currentMoisture: 35,
      minMoisture24h: 30,
      dryingRatePerHour: -4,
      rainProbability12h: 80,
      precipitation12h: 6,
      temperature: 31,
      irrigations24h: 7,
    });

    expect(hits['Humedad actual']).toBe('Está por debajo del mínimo (40 %)');
    expect(hits['Humedad últimas 24 h']).toBe('Bajó del mínimo en algún momento');
    expect(hits['Velocidad de secado']).toBe('La tierra se seca rápido');
    expect(hits['Lluvia próximas 12 h']).toBe('Se espera lluvia suficiente');
    expect(hits['Temperatura']).toBe('Hace calor: el suelo se seca más');
    expect(hits['Riegos en 24 h']).toBe('Se regó muchas veces');
  });

  it('degrades null data to readable text and uses the recommended minimum when the current one is unknown', () => {
    const factors = localized(
      {
        ...base,
        currentMoisture: null,
        avgMoisture24h: null,
        minMoisture24h: null,
        maxMoisture24h: null,
        dryingRatePerHour: null,
        rainProbability12h: null,
        precipitation12h: null,
        temperature: null,
        airHumidity: null,
        cropName: '',
        currentMin: 0,
        sensorOk: false,
      },
      45,
    );
    const byLabel = Object.fromEntries(factors.map((f) => [f.label, f]));

    expect(byLabel['Humedad actual'].value).toBe('Sin lectura válida');
    expect(byLabel['Humedad actual'].influence).toBe('Sin lectura reciente del sensor');
    expect(byLabel['Sensor'].influence).toBe('No hay lecturas válidas');
    expect(byLabel['Velocidad de secado'].value).toBe('Sin datos suficientes');
    expect(byLabel['Lluvia próximas 12 h'].value).toBe('Sin pronóstico');
    expect(byLabel['Cultivo'].value).toContain('Sin cultivo');
    expect(localized({ ...base, currentMin: 0, currentMoisture: 44 }, 45)[0].influence).toBe('Está por debajo del mínimo (45 %)');
  });
});

describe('localHourTicks', () => {
  it('returns local clock hours multiple of the step inside the range', () => {
    const min = new Date(2026, 9, 28, 1, 30).getTime();
    const max = new Date(2026, 9, 28, 19, 0).getTime();

    expect(localHourTicks(min, max, 6).map((t) => new Date(t).getHours())).toEqual([6, 12, 18]);
    expect(localHourTicks(min, max, 24, 12).map((t) => new Date(t).getHours())).toEqual([12]);
  });
});
