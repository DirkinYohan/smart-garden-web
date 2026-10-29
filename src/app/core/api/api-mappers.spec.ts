import { AiStatsDto, AnalysisDto, InputSnapshotDto } from '../../models/api.models';
import { ApiMappers } from './api-mappers';

const legacy: AnalysisDto = {
  id: 'a1',
  createdAt: '2026-10-21T12:00:00Z',
  source: 'RULES',
  trigger: 'SCHEDULED',
  recommendedMin: 40,
  recommendedMax: 70,
  pauseForRain: false,
  hoursUntilNextIrrigation: 6,
  riskLevel: 'LOW',
  summary: 'Todo bien',
  recommendations: ['Mantén el riego actual'],
  applied: false,
  fallbackReason: null,
};

const snapshot: InputSnapshotDto = {
  currentMoisture: 51,
  avgMoisture24h: 55,
  minMoisture24h: 42,
  maxMoisture24h: 70,
  dryingRatePerHour: -1.5,
  irrigations24h: 2,
  pumpMinutes24h: 4,
  rainProbability12h: 30,
  precipitation12h: 0,
  temperature: 18,
  airHumidity: 60,
  cropName: 'Lechuga',
  cropMin: 50,
  cropMax: 80,
  currentMin: 40,
  currentMax: 70,
  mode: 'AUTO',
  sensorOk: true,
  rainPause: true,
  readingAgeMinutes: 2,
};

describe('ApiMappers (AI v1.1 contract)', () => {
  it('maps every new analysis field', () => {
    const a = ApiMappers.analysis({
      ...legacy,
      source: 'GEMINI',
      headline: 'Tu huerta está bien',
      healthStatus: 'GOOD',
      nextAction: 'WAIT',
      recommendationDetails: [
        {
          title: 'Ajusta los umbrales',
          detail: 'Sube el mínimo al 45 %.',
          category: 'CROP',
          priority: 'HIGH',
          action: { type: 'APPLY_THRESHOLDS', label: 'Aplicar umbrales' },
        },
      ],
      inputSnapshot: snapshot,
      projection: {
        points: [{ timestamp: '2026-10-21T13:00:00Z', moisture: 49.5 }],
        dryingRatePerHour: -1.5,
        estimatedNextIrrigationAt: '2026-10-21T19:00:00Z',
        confidence: 'HIGH',
      },
      fallbackDetail: null,
    });

    expect(a.headline).toBe('Tu huerta está bien');
    expect(a.healthStatus).toBe('GOOD');
    expect(a.nextAction).toBe('WAIT');
    expect(a.recommendationDetails).toEqual([
      {
        title: 'Ajusta los umbrales',
        detail: 'Sube el mínimo al 45 %.',
        category: 'CROP',
        priority: 'HIGH',
        action: { type: 'APPLY_THRESHOLDS', label: 'Aplicar umbrales' },
      },
    ]);
    expect(a.inputSnapshot).toMatchObject({ currentMoisture: 51, rainPause: true, readingAgeMinutes: 2, cropName: 'Lechuga' });
    expect(a.projection).toEqual({
      points: [{ timestamp: '2026-10-21T13:00:00Z', moisture: 49.5 }],
      dryingRatePerHour: -1.5,
      estimatedNextIrrigationAt: '2026-10-21T19:00:00Z',
      confidence: 'HIGH',
    });
  });

  it('degrades a legacy analysis (no v1.1 fields) to nulls and empty lists', () => {
    const a = ApiMappers.analysis(legacy);

    expect(a.headline).toBeNull();
    expect(a.healthStatus).toBeNull();
    expect(a.nextAction).toBeNull();
    expect(a.recommendationDetails).toEqual([]);
    expect(a.inputSnapshot).toBeNull();
    expect(a.projection).toBeNull();
    expect(a.fallbackDetail).toBeNull();
    expect(a.recommendations).toEqual(['Mantén el riego actual']);
  });

  it('turns explicit nulls and unknown enum values into safe defaults', () => {
    const a = ApiMappers.analysis({
      ...legacy,
      headline: '',
      healthStatus: 'SUPER_GOOD',
      nextAction: null,
      recommendationDetails: [
        { title: null, detail: 'Revisa la manguera del riego hoy mismo', category: 'PLUMBING', priority: null, action: { type: 'REBOOT', label: 'Reiniciar' } },
        { title: 'Vacía', detail: null, category: 'SENSOR', priority: 'LOW', action: null },
      ],
      projection: { points: null as never, dryingRatePerHour: null, estimatedNextIrrigationAt: null, confidence: 'MAYBE' },
    });

    expect(a.headline).toBeNull();
    expect(a.healthStatus).toBeNull();
    expect(a.nextAction).toBeNull();
    // entries without detail are dropped; title comes from the first words; unknown category/priority/action → defaults
    expect(a.recommendationDetails).toEqual([
      { title: 'Revisa la manguera del riego', detail: 'Revisa la manguera del riego hoy mismo', category: 'IRRIGATION', priority: 'MEDIUM', action: null },
    ]);
    expect(a.projection).toEqual({ points: [], dryingRatePerHour: null, estimatedNextIrrigationAt: null, confidence: null });
  });

  it('fills a snapshot with null fields', () => {
    const empty = Object.fromEntries(Object.keys(snapshot).map((k) => [k, null])) as unknown as InputSnapshotDto;
    const s = ApiMappers.snapshot(empty);

    expect(s.currentMoisture).toBeNull();
    expect(s.irrigations24h).toBe(0);
    expect(s.pumpMinutes24h).toBe(0);
    expect(s.cropName).toBe('');
    expect(s.currentMin).toBe(0);
    expect(s.sensorOk).toBe(false);
    expect(s.rainPause).toBeNull();
    expect(s.readingAgeMinutes).toBeNull();
  });

  it('maps the v1.2 moisture level and crop id', () => {
    const a = ApiMappers.analysis({
      ...legacy,
      moistureLevel: 'SATURATED',
      inputSnapshot: { ...snapshot, cropId: 4, moistureLevel: 'SATURATED' },
    });

    expect(a.moistureLevel).toBe('SATURATED');
    expect(a.inputSnapshot).toMatchObject({ cropId: 4, moistureLevel: 'SATURATED' });
  });

  it('degrades an unknown moisture level to null and a missing crop id to null', () => {
    const a = ApiMappers.analysis({ ...legacy, moistureLevel: 'VERY_WET', inputSnapshot: snapshot });

    expect(a.moistureLevel).toBeNull();
    expect(a.inputSnapshot?.cropId).toBeNull();
    expect(a.inputSnapshot?.moistureLevel).toBeNull();
  });

  it('maps /ai/stats and completes missing distributions', () => {
    const stats = ApiMappers.stats({
      days: 7,
      totalAnalyses: 10,
      geminiCount: 3,
      rulesCount: 7,
      riskDistribution: { HIGH: 2 },
      healthDistribution: null,
      rainPauses: null,
      thresholdHistory: [
        { timestamp: '2026-10-20T12:00:00Z', min: 40, max: 70, source: 'GEMINI', riskLevel: 'HIGH' },
        { timestamp: '2026-10-21T12:00:00Z', min: 45, max: 75, source: 'OTHER', riskLevel: 'UNKNOWN' },
      ],
      dailyMoisture: [{ date: '2026-10-21', avg: null, min: null, max: null, irrigations: null, pumpMinutes: null }],
    } as unknown as AiStatsDto);

    expect(stats.riskDistribution).toEqual({ LOW: 0, MEDIUM: 0, HIGH: 2 });
    expect(stats.healthDistribution).toEqual({ GOOD: 0, ATTENTION: 0, CRITICAL: 0 });
    expect(stats.rainPauses).toBe(0);
    expect(stats.thresholdHistory[1]).toEqual({ timestamp: '2026-10-21T12:00:00Z', min: 45, max: 75, source: 'RULES', riskLevel: 'LOW' });
    expect(stats.dailyMoisture[0]).toEqual({ date: '2026-10-21', avg: null, min: null, max: null, irrigations: 0, pumpMinutes: 0 });
  });

  it('maps an empty /ai/stats answer', () => {
    const stats = ApiMappers.stats({ days: 30 } as AiStatsDto);

    expect(stats.totalAnalyses).toBe(0);
    expect(stats.thresholdHistory).toEqual([]);
    expect(stats.dailyMoisture).toEqual([]);
  });
});
