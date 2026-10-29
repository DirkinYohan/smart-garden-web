import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, of } from 'rxjs';
import { GardenApi } from '../api/garden-api';
import { RealtimeService } from '../realtime/realtime.service';
import { Analysis, CropProfile, IrrigationConfig } from '../../models/garden.models';
import { GardenStore } from './garden-store';

const CROPS: CropProfile[] = [
  { id: 2, name: 'Tomate', minMoisture: 40, maxMoisture: 70, description: '' },
  { id: 3, name: 'Lechuga', minMoisture: 50, maxMoisture: 80, description: '' },
  { id: 4, name: 'Cilantro', minMoisture: 45, maxMoisture: 75, description: '' },
];

function config(overrides: Partial<IrrigationConfig> = {}): IrrigationConfig {
  return {
    mode: 'AUTO',
    cropId: 2,
    minMoisture: 40,
    maxMoisture: 70,
    rainPause: false,
    aiEnabled: true,
    updatedAt: '2026-10-28T12:00:00Z',
    updatedBy: 'USER',
    ...overrides,
  };
}

function analysis(cropId: number | null, cropName: string | null): Analysis {
  return {
    id: 'a1',
    createdAt: '2026-10-28T12:00:00Z',
    source: 'GEMINI',
    recommendedMin: 45,
    recommendedMax: 75,
    pauseForRain: false,
    hoursUntilNextIrrigation: null,
    riskLevel: 'LOW',
    summary: 'resumen',
    recommendations: [],
    headline: 'titular',
    healthStatus: 'GOOD',
    nextAction: 'WAIT',
    recommendationDetails: [],
    inputSnapshot: {
      currentMoisture: 60,
      avgMoisture24h: 60,
      minMoisture24h: 40,
      maxMoisture24h: 70,
      dryingRatePerHour: null,
      irrigations24h: 0,
      pumpMinutes24h: 0,
      rainProbability12h: 0,
      precipitation12h: 0,
      temperature: 18,
      airHumidity: 60,
      cropName: cropName ?? '',
      cropMin: 45,
      cropMax: 75,
      currentMin: 45,
      currentMax: 75,
      mode: 'AUTO',
      sensorOk: true,
      rainPause: false,
      readingAgeMinutes: 1,
      cropId,
      moistureLevel: 'OPTIMAL',
    },
    projection: null,
    moistureLevel: 'OPTIMAL',
  };
}

describe('GardenStore · cultivo del análisis vs cultivo actual', () => {
  let store: GardenStore;

  beforeEach(() => {
    const api = {
      getStatus: () => new Subject(),
      getConfig: () => new Subject(),
      getCrops: () => new Subject(),
      getLatestAnalysis: () => new Subject(),
      getHistory: () => of([]),
      getWeather: () => new Subject(),
    } as unknown as GardenApi;
    const realtime = {
      state: signal('disconnected'),
      telemetry$: new Subject(),
      config$: new Subject(),
      analysis$: new Subject(),
      deviceStatus$: new Subject(),
      connect: () => undefined,
      disconnect: () => undefined,
    } as unknown as RealtimeService;

    TestBed.configureTestingModule({
      providers: [
        { provide: GardenApi, useValue: api },
        { provide: RealtimeService, useValue: realtime },
      ],
    });
    store = TestBed.inject(GardenStore);
    store.setCrops(CROPS);
  });

  it('does not flag anything without an analysis', () => {
    store.setConfig(config({ cropId: 2 }));

    expect(store.analysisMatchesCrop()).toBe(true);
  });

  it('flags an analysis made for another crop and clears it when the analysis catches up', () => {
    store.setConfig(config({ cropId: 2 }));
    store.latestAnalysis.set({ value: analysis(4, 'Cilantro'), loading: false, error: false });

    expect(store.analysisMatchesCrop()).toBe(false);

    store.latestAnalysis.set({ value: analysis(2, 'Tomate'), loading: false, error: false });

    expect(store.analysisMatchesCrop()).toBe(true);
  });

  it('compares by name for analyses stored before v1.2 (no cropId)', () => {
    store.setConfig(config({ cropId: 2 }));
    store.latestAnalysis.set({ value: analysis(null, 'Cilantro'), loading: false, error: false });

    expect(store.analysisMatchesCrop()).toBe(false);
  });

  it('takes the crop name from the configuration, never from the analysis', () => {
    store.setConfig(config({ cropId: 3 }));
    store.latestAnalysis.set({ value: analysis(4, 'Cilantro'), loading: false, error: false });

    expect(store.currentCropName()).toBe('Lechuga');
  });
});
