import { MockBackend, MockHttpError } from './mock-backend';

describe('MockBackend', () => {
  let backend: MockBackend;

  beforeEach(() => {
    backend = new MockBackend();
  });

  afterEach(() => backend.stop());

  it('seeds 30 days of history aggregated by range', () => {
    expect(backend.history('24h').intervalMinutes).toBe(5);
    expect(backend.history('7d').points.length).toBeGreaterThan(100);
    expect(backend.history('30d').intervalMinutes).toBe(360);
    expect(backend.irrigationEvents(20).length).toBeGreaterThan(0);
  });

  it('rejects manual pump commands outside MANUAL mode with 409', () => {
    expect(() => backend.pump('ON', 30)).toThrowError(MockHttpError);
    try {
      backend.pump('ON', 30);
    } catch (e) {
      expect((e as MockHttpError).status).toBe(409);
    }
  });

  it('waters in MANUAL mode and records an irrigation event', () => {
    backend.updateConfig({ mode: 'MANUAL' });
    const before = backend.irrigationEvents(500).length;

    expect(backend.pump('ON', 30).accepted).toBe(true);
    expect(backend.status().reading?.pumpOn).toBe(true);
    backend.pump('OFF');

    const events = backend.irrigationEvents(500);
    expect(events.length).toBe(before + 1);
    expect(events.find((e) => e.mode === 'MANUAL')?.inProgress).toBe(false);
  });

  it('validates thresholds like the backend', () => {
    expect(() => backend.updateConfig({ minMoisture: 60, maxMoisture: 65 })).toThrowError(/10 puntos/);
  });

  it('applies the crop thresholds when the crop changes in AUTO', () => {
    const config = backend.updateConfig({ mode: 'AUTO', cropProfileId: 3 });
    expect(config.minMoisture).toBe(50);
    expect(config.maxMoisture).toBe(80);
  });

  it('serves /ai/stats for 7 and 30 days and rejects other ranges', () => {
    const week = backend.stats(7);
    const month = backend.stats(30);

    expect(week.totalAnalyses).toBe(week.geminiCount + week.rulesCount);
    expect(month.totalAnalyses).toBeGreaterThan(week.totalAnalyses);
    expect(week.dailyMoisture?.length).toBe(7);
    expect(month.dailyMoisture?.length).toBe(30);
    expect(week.thresholdHistory?.length).toBe(week.totalAnalyses);
    expect(() => backend.stats(5)).toThrowError(MockHttpError);
  });

  it('builds analyses with the v1.1 fields', () => {
    const a = backend.latestAnalysis();

    expect(a.headline).toBeTruthy();
    expect(['GOOD', 'ATTENTION', 'CRITICAL']).toContain(a.healthStatus);
    expect(a.nextAction).toBeTruthy();
    expect(a.inputSnapshot?.currentMoisture).not.toBeNull();
    expect(a.projection?.points?.length).toBeGreaterThan(0);
    expect(a.recommendationDetails?.length).toBeGreaterThan(0);
  });

  it('limits manual analyses to one per minute', () => {
    expect(backend.requestAnalysis().trigger).toBe('MANUAL');
    expect(() => backend.requestAnalysis()).toThrowError(/un análisis manual por minuto/);
  });
});
