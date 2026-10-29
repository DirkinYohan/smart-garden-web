import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { Analysis, DeviceStatus, HistoryPoint, IrrigationConfig, Weather } from '../../models/garden.models';
import { HttpGardenApi } from './http-garden-api';

describe('HttpGardenApi (api-gateway contract mapping)', () => {
  const base = environment.apiUrl;
  let api: HttpGardenApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), HttpGardenApi],
    });
    api = TestBed.inject(HttpGardenApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('flattens /status into the UI model', () => {
    let result: DeviceStatus | undefined;
    api.getStatus().subscribe((s) => (result = s));
    controller.expectOne(`${base}/status`).flush({
      deviceOnline: true,
      deviceStatus: 'online',
      lastSeen: '2026-10-21T12:00:00Z',
      reading: {
        deviceId: 'esp32-huerta-01',
        raw: 2350,
        moisture: 45,
        pumpOn: false,
        sensorOk: true,
        mode: 'AUTO',
        minMoisture: 30,
        maxMoisture: 70,
        rainPause: false,
        uptimeMs: 1000,
        receivedAt: '2026-10-21T12:00:00Z',
      },
    });

    expect(result).toEqual({
      deviceId: 'esp32-huerta-01',
      moisture: 45,
      raw: 2350,
      pumpOn: false,
      sensorOk: true,
      mode: 'AUTO',
      minMoisture: 30,
      maxMoisture: 70,
      rainPause: false,
      deviceOnline: true,
      timestamp: '2026-10-21T12:00:00Z',
      hasReading: true,
    });
  });

  it('reports hasReading=false when the device never sent data', () => {
    let result: DeviceStatus | undefined;
    api.getStatus().subscribe((s) => (result = s));
    controller.expectOne(`${base}/status`).flush({ deviceOnline: false, deviceStatus: 'unknown', lastSeen: null, reading: null });

    expect(result?.hasReading).toBe(false);
    expect(result?.deviceOnline).toBe(false);
  });

  it('maps the history points and sends the range', () => {
    let result: HistoryPoint[] | undefined;
    api.getHistory('7d').subscribe((h) => (result = h));
    const req = controller.expectOne((r) => r.url === `${base}/telemetry/history`);
    expect(req.request.params.get('range')).toBe('7d');
    req.flush({
      range: '7d',
      intervalMinutes: 60,
      points: [{ timestamp: '2026-10-21T12:00:00Z', avgMoisture: 50.5, minMoisture: 40, maxMoisture: 60, samples: 12, pumpActive: false }],
    });

    expect(result).toEqual([{ timestamp: '2026-10-21T12:00:00Z', avgMoisture: 50.5, minMoisture: 40, maxMoisture: 60 }]);
  });

  it('maps config crop → cropId and cropId → cropProfileId on update', () => {
    let result: IrrigationConfig | undefined;
    api.updateConfig({ cropId: 3, rainPause: true }).subscribe((c) => (result = c));
    const req = controller.expectOne(`${base}/config`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ cropProfileId: 3, rainPause: true });
    req.flush({
      mode: 'AUTO',
      crop: { id: 3, name: 'Lechuga', minMoisture: 50, maxMoisture: 80, description: '' },
      minMoisture: 50,
      maxMoisture: 80,
      rainPause: true,
      aiEnabled: true,
      updatedAt: '2026-10-21T12:00:00Z',
      updatedBy: 'USER',
      lastAnalysisId: null,
    });

    expect(result).toMatchObject({ mode: 'AUTO', cropId: 3, minMoisture: 50, maxMoisture: 80, rainPause: true });
  });

  it('returns null for the latest analysis when the backend answers 404', () => {
    let result: Analysis | null | undefined;
    api.getLatestAnalysis().subscribe((a) => (result = a));
    controller
      .expectOne(`${base}/ai/analysis/latest`)
      .flush({ message: 'Aún no hay análisis disponibles' }, { status: 404, statusText: 'Not Found' });

    expect(result).toBeNull();
  });

  it('maps the weather summary and hourly forecast', () => {
    let result: Weather | undefined;
    api.getWeather().subscribe((w) => (result = w));
    controller.expectOne(`${base}/weather`).flush({
      fetchedAt: '2026-10-21T12:00:00Z',
      latitude: 4.7,
      longitude: -74.1,
      current: { time: '2026-10-21T12:00:00Z', temperature: 18.5, relativeHumidity: 60, precipitation: 0, weatherCode: 3 },
      hourly: [
        { time: '2026-10-21T12:00:00Z', temperature: 18.5, relativeHumidity: 60, precipitationProbability: 80, precipitation: 1.2 },
      ],
      maxRainProbability12h: 80,
      totalPrecipitation12h: 1.2,
    });

    expect(result).toEqual({
      temperature: 18.5,
      airHumidity: 60,
      rainProbabilityNext12h: 80,
      precipitationNext12h: 1.2,
      hourly: [{ time: '2026-10-21T12:00:00Z', rainProbability: 80, temperature: 18.5, precipitation: 1.2 }],
    });
  });
});
