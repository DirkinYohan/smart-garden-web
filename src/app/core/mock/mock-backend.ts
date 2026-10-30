import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import {
  AiStatsDto,
  AnalysisDto,
  ConfigDto,
  CropProfileDto,
  DeviceStatusDto,
  HistoryResponseDto,
  IrrigationEventDto,
  StatusResponseDto,
  TelemetryReadingDto,
  WeatherDto,
} from '../../models/api.models';
import { HealthStatus, IrrigationMode, MoistureLevel, NextAction, RiskLevel } from '../../models/garden.models';
import { classifyMoisture } from '../../shared/moisture-level';

const FIVE_MIN = 5 * 60_000;
const DEVICE_ID = 'esp32-huerta-01';

interface Sample {
  t: number;
  moisture: number;
  pumpOn: boolean;
}

@Injectable({ providedIn: 'root' })
export class MockBackend {
  readonly telemetry$ = new Subject<TelemetryReadingDto>();
  readonly config$ = new Subject<ConfigDto>();
  readonly analysis$ = new Subject<AnalysisDto>();
  readonly deviceStatus$ = new Subject<DeviceStatusDto>();

  private crops: CropProfileDto[] = [
    { id: 1, name: 'Genérico', minMoisture: 30, maxMoisture: 70, description: 'Rango general para la mayoría de hortalizas' },
    { id: 2, name: 'Tomate', minMoisture: 40, maxMoisture: 70, description: 'Riego regular; evitar encharcamiento para prevenir hongos' },
    { id: 3, name: 'Lechuga', minMoisture: 50, maxMoisture: 80, description: 'Raíz superficial; necesita humedad constante' },
    { id: 4, name: 'Cilantro', minMoisture: 45, maxMoisture: 75, description: 'Sensible al estrés hídrico; espiga con calor y sequía' },
    { id: 5, name: 'Pimentón', minMoisture: 40, maxMoisture: 70, description: 'Riego moderado y uniforme durante la floración' },
    { id: 6, name: 'Fresa', minMoisture: 50, maxMoisture: 75, description: 'Humedad constante; evitar mojar frutos y hojas' },
  ];

  private config: ConfigDto = {
    mode: 'AUTO',
    crop: this.crops[1],
    minMoisture: 40,
    maxMoisture: 70,
    rainPause: false,
    aiEnabled: true,
    updatedAt: new Date().toISOString(),
    updatedBy: 'SYSTEM',
    lastAnalysisId: null,
  };

  private samples: Sample[] = [];
  private events: IrrigationEventDto[] = [];
  private analyses: AnalysisDto[] = [];
  private nextEventId = 1;
  private moisture = 55;
  private pumpOn = false;
  private manualUntil = 0;
  private lastReading: TelemetryReadingDto | null = null;
  private lastManualAnalysis = 0;
  private timer: ReturnType<typeof setInterval> | undefined;

  private username = 'admin';
  private password = 'admin123';

  private mustChange = true;
  private passwordChangedAt: string | null = null;
  private failedAttempts = 0;
  private lockedUntil = 0;
  private tokenVersion = 0;

  constructor() {
    this.seedHistory();
    this.seedAnalyses();
    this.analyses.unshift(this.buildAnalysis('SCHEDULED', Date.now() - 20 * 60_000));
  }

  start(): void {
    if (this.timer) return;
    this.tick();
    this.deviceStatus$.next({ deviceId: DEVICE_ID, online: true, reason: 'telemetry', changedAt: new Date().toISOString() });
    this.timer = setInterval(() => this.tick(), 5000);
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  login(username: string, password: string): {
    token: string;
    expiresAt: string;
    mustChangePassword: boolean;
    username: string;
  } {
    const now = Date.now();
    if (this.lockedUntil > now) {
      throw new MockHttpError(423, `Cuenta bloqueada por intentos fallidos. Intenta de nuevo en ${Math.ceil(
        (this.lockedUntil - now) / 60_000,
      )} minutos`);
    }
    if (username !== this.username || password !== this.password) {
      this.failedAttempts++;
      if (this.failedAttempts >= 5) {
        this.failedAttempts = 0;
        this.lockedUntil = now + 15 * 60_000;
        throw new MockHttpError(
          423,
          'Cuenta bloqueada por intentos fallidos. Intenta de nuevo en 15 minutos',
        );
      }
      throw new MockHttpError(401, 'Usuario o contraseña incorrectos');
    }
    this.failedAttempts = 0;
    this.lockedUntil = 0;
    return {
      token: `mock-token-${this.tokenVersion}`,
      expiresAt: new Date(now + 12 * 3600_000).toISOString(),
      mustChangePassword: this.mustChange,
      username: this.username,
    };
  }

  me(): { username: string; role: string; mustChangePassword: boolean; passwordChangedAt: string | null } {
    return {
      username: this.username,
      role: 'ADMIN',
      mustChangePassword: this.mustChange,
      passwordChangedAt: this.passwordChangedAt,
    };
  }

  changePassword(current: string, next: string): { token: string; expiresAt: string } {
    if (current !== this.password) {
      throw new MockHttpError(400, 'La contraseña actual no es correcta');
    }
    const problem = mockPolicyProblem(this.username, current, next);
    if (problem) {
      throw new MockHttpError(400, problem);
    }
    this.password = next;
    this.mustChange = false;
    this.passwordChangedAt = new Date().toISOString();
    this.tokenVersion++;
    return {
      token: `mock-token-${this.tokenVersion}`,
      expiresAt: new Date(Date.now() + 12 * 3600_000).toISOString(),
    };
  }

  requiresPasswordChange(): boolean {
    return this.mustChange;
  }

  status(): StatusResponseDto {
    this.start();
    return {
      deviceOnline: true,
      deviceStatus: 'online',
      lastSeen: this.lastReading?.receivedAt ?? null,
      reading: this.lastReading,
    };
  }

  history(range: string): HistoryResponseDto {
    const spec: Record<string, [number, number]> = {
      '24h': [24 * 3600_000, 5],
      '7d': [7 * 24 * 3600_000, 60],
      '30d': [30 * 24 * 3600_000, 360],
    };
    const [window, minutes] = spec[range] ?? spec['24h'];
    const since = Date.now() - window;
    const interval = minutes * 60_000;
    const buckets = new Map<number, Sample[]>();
    for (const s of this.samples) {
      if (s.t < since) continue;
      const key = Math.floor(s.t / interval) * interval;
      (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(s);
    }
    return {
      range,
      intervalMinutes: minutes,
      points: [...buckets.entries()]
        .sort(([a], [b]) => a - b)
        .map(([t, list]) => ({
          timestamp: new Date(t).toISOString(),
          avgMoisture: Math.round((list.reduce((sum, s) => sum + s.moisture, 0) / list.length) * 10) / 10,
          minMoisture: Math.round(Math.min(...list.map((s) => s.moisture))),
          maxMoisture: Math.round(Math.max(...list.map((s) => s.moisture))),
          samples: list.length,
          pumpActive: list.some((s) => s.pumpOn),
        })),
    };
  }

  irrigationEvents(limit: number): IrrigationEventDto[] {
    return [...this.events].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit);
  }

  getConfig(): ConfigDto {
    return { ...this.config };
  }

  updateConfig(body: Partial<{ mode: IrrigationMode; cropProfileId: number; minMoisture: number; maxMoisture: number; rainPause: boolean; aiEnabled: boolean }>): ConfigDto {
    const next = { ...this.config };
    if (body.mode) {
      next.mode = body.mode;
      if (body.mode === 'AI') next.aiEnabled = true;
    }
    if (body.cropProfileId !== undefined) {
      const crop = this.crops.find((c) => c.id === body.cropProfileId);
      if (!crop) throw new MockHttpError(404, `No existe el perfil de cultivo ${body.cropProfileId}`);
      next.crop = crop;

      if (body.minMoisture === undefined && body.maxMoisture === undefined) {
        next.minMoisture = crop.minMoisture;
        next.maxMoisture = crop.maxMoisture;
      }
    }
    if (body.minMoisture !== undefined) next.minMoisture = body.minMoisture;
    if (body.maxMoisture !== undefined) next.maxMoisture = body.maxMoisture;
    if (body.rainPause !== undefined) next.rainPause = body.rainPause;
    if (body.aiEnabled !== undefined && body.mode !== 'AI') {
      if (!body.aiEnabled && next.mode === 'AI') {
        throw new MockHttpError(400, 'No se puede desactivar la IA mientras el modo sea AI');
      }
      next.aiEnabled = body.aiEnabled;
    }
    validateThresholds(next.minMoisture, next.maxMoisture);
    next.updatedAt = new Date().toISOString();
    next.updatedBy = 'USER';
    this.config = next;
    if (next.mode !== 'MANUAL') this.manualUntil = 0;
    this.config$.next(this.getConfig());
    return this.getConfig();
  }

  getCrops(): CropProfileDto[] {
    return [...this.crops].sort((a, b) => a.name.localeCompare(b.name));
  }

  updateCrop(id: number, body: Omit<CropProfileDto, 'id'>): CropProfileDto {
    const crop = this.crops.find((c) => c.id === id);
    if (!crop) throw new MockHttpError(404, `No existe el perfil de cultivo ${id}`);
    if (!body.name?.trim()) throw new MockHttpError(400, 'El nombre es obligatorio');
    validateThresholds(body.minMoisture, body.maxMoisture);
    Object.assign(crop, { ...body, name: body.name.trim() });
    if (this.config.crop?.id === id) {
      this.config = { ...this.config, crop: { ...crop } };

      this.config = { ...this.config, minMoisture: crop.minMoisture, maxMoisture: crop.maxMoisture, updatedBy: 'SYSTEM' };
      this.config$.next(this.getConfig());
    }
    return { ...crop };
  }

  pump(action: 'ON' | 'OFF', durationSec = 0): { accepted: boolean; message: string } {
    if (this.config.mode !== 'MANUAL') {
      throw new MockHttpError(409, 'El riego manual solo está permitido en modo MANUAL');
    }
    if (action === 'ON') {
      if (durationSec < 1 || durationSec > 120) {
        throw new MockHttpError(400, 'durationSec debe estar entre 1 y 120');
      }
      this.manualUntil = Date.now() + durationSec * 1000;
      this.setPump(true);
      this.tick();
      return { accepted: true, message: `Bomba encendida por ${durationSec} s` };
    }
    this.manualUntil = 0;
    this.setPump(false);
    this.tick();
    return { accepted: true, message: 'Bomba apagada' };
  }

  latestAnalysis(): AnalysisDto {
    if (!this.analyses.length) throw new MockHttpError(404, 'Aún no hay análisis disponibles');
    return this.analyses[0];
  }

  listAnalyses(limit: number): AnalysisDto[] {
    return this.analyses.slice(0, limit);
  }

  requestAnalysis(): AnalysisDto {
    const wait = 60_000 - (Date.now() - this.lastManualAnalysis);
    if (wait > 0) {
      throw new MockHttpError(429, `Solo se permite un análisis manual por minuto. Intenta de nuevo en ${Math.ceil(wait / 1000)} s`);
    }
    this.lastManualAnalysis = Date.now();
    const analysis = this.buildAnalysis('MANUAL', Date.now());
    this.analyses.unshift(analysis);
    if (this.config.mode === 'AI') {
      const crop = this.config.crop;
      const [min, max] = crop
        ? clampToCrop(analysis.recommendedMin, analysis.recommendedMax, crop.minMoisture, crop.maxMoisture)
        : [analysis.recommendedMin, analysis.recommendedMax];
      this.config = {
        ...this.config,
        minMoisture: min,
        maxMoisture: max,
        rainPause: analysis.pauseForRain,
        updatedBy: 'AI',
        lastAnalysisId: analysis.id,
        updatedAt: new Date().toISOString(),
      };
      analysis.applied = true;
      this.config$.next(this.getConfig());
    }
    this.analysis$.next(analysis);
    return analysis;
  }

  weather(): WeatherDto {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const hourly = Array.from({ length: 12 }, (_, i) => {
      const hour = (now.getHours() + i) % 24;
      const rain = Math.round(Math.max(0, Math.min(100, 20 + 55 * Math.sin(((hour - 10) / 24) * Math.PI * 2))));
      return {
        time: new Date(now.getTime() + i * 3600_000).toISOString(),
        temperature: Math.round((14 + 6 * Math.sin(((hour - 8) / 24) * Math.PI * 2)) * 10) / 10,
        relativeHumidity: 60 + (rain > 50 ? 20 : 5),
        precipitationProbability: rain,
        precipitation: rain > 60 ? Math.round((rain / 40) * 10) / 10 : 0,
      };
    });
    return {
      fetchedAt: new Date().toISOString(),
      latitude: 4.711,
      longitude: -74.0721,
      current: { time: hourly[0].time, temperature: hourly[0].temperature, relativeHumidity: hourly[0].relativeHumidity, precipitation: 0, weatherCode: 3 },
      hourly,
      maxRainProbability12h: Math.max(...hourly.map((h) => h.precipitationProbability)),
      totalPrecipitation12h: Math.round(hourly.reduce((s, h) => s + h.precipitation, 0) * 10) / 10,
    };
  }

  private tick(): void {
    const now = Date.now();
    const { mode, minMoisture, maxMoisture, rainPause } = this.config;
    if (mode === 'MANUAL') {
      if (this.pumpOn && now >= this.manualUntil) this.setPump(false);
    } else if (!this.pumpOn && this.moisture < minMoisture && (!rainPause || this.moisture < 15)) {
      this.setPump(true);
    } else if (this.pumpOn && this.moisture >= maxMoisture) {
      this.setPump(false);
    }

    this.moisture += this.pumpOn ? 2.5 + Math.random() : -(0.15 + Math.random() * 0.25);
    this.moisture = Math.max(5, Math.min(95, this.moisture));

    const reading: TelemetryReadingDto = {
      deviceId: DEVICE_ID,
      raw: Math.round(3200 - this.moisture * 20),
      moisture: Math.round(this.moisture),
      pumpOn: this.pumpOn,
      sensorOk: true,
      mode,
      minMoisture,
      maxMoisture,
      rainPause,
      uptimeMs: Math.round(performance.now()),
      receivedAt: new Date(now).toISOString(),
    };
    this.lastReading = reading;
    this.samples.push({ t: now, moisture: this.moisture, pumpOn: this.pumpOn });
    this.telemetry$.next(reading);
  }

  private setPump(on: boolean): void {
    if (on === this.pumpOn) return;
    const nowIso = new Date().toISOString();
    if (on) {
      this.events.push({
        id: this.nextEventId++,
        deviceId: DEVICE_ID,
        startedAt: nowIso,
        endedAt: null,
        durationSec: null,
        startMoisture: Math.round(this.moisture),
        endMoisture: null,
        mode: this.config.mode,
        inProgress: true,
      });
    } else {
      const open = this.events.find((e) => e.inProgress);
      if (open) {
        open.endedAt = nowIso;
        open.durationSec = Math.round((Date.parse(nowIso) - Date.parse(open.startedAt)) / 1000);
        open.endMoisture = Math.round(this.moisture);
        open.inProgress = false;
      }
    }
    this.pumpOn = on;
  }

  private seedHistory(): void {
    const end = Date.now() - FIVE_MIN;
    let m = 60;
    let pump = false;
    let pumpStart = 0;
    let startMoisture = 0;
    for (let t = end - 30 * 24 * 3600_000; t <= end; t += FIVE_MIN) {
      const hour = new Date(t).getHours();
      const sun = hour >= 9 && hour <= 16 ? 0.35 : 0.12;
      if (!pump && m < 40) {
        pump = true;
        pumpStart = t;
        startMoisture = m;
      }
      m += pump ? 9 : -(sun + Math.random() * 0.1);
      if (pump && m >= 70) {
        pump = false;
        this.events.push({
          id: this.nextEventId++,
          deviceId: DEVICE_ID,
          startedAt: new Date(pumpStart).toISOString(),
          endedAt: new Date(t).toISOString(),
          durationSec: Math.round((t - pumpStart) / 1000 / 10),
          startMoisture: Math.round(startMoisture),
          endMoisture: Math.round(m),
          mode: 'AUTO',
          inProgress: false,
        });
      }
      this.samples.push({ t, moisture: Math.max(5, Math.min(95, m)), pumpOn: pump });
    }
    this.moisture = Math.max(42, Math.min(65, m));
  }

  stats(days: number): AiStatsDto {
    if (days !== 7 && days !== 30) throw new MockHttpError(400, 'days debe ser 7 o 30');
    const since = Date.now() - days * 24 * 3600_000;
    const list = this.analyses.filter((a) => Date.parse(a.createdAt) >= since);
    const count = <T extends string>(key: (a: AnalysisDto) => T | null | undefined) =>
      list.reduce<Record<string, number>>((acc, a) => {
        const k = key(a);
        if (k) acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});
    const gemini = list.filter((a) => a.source === 'GEMINI').length;
    return {
      days,
      totalAnalyses: list.length,
      geminiCount: gemini,
      rulesCount: list.length - gemini,
      riskDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0, ...count((a) => a.riskLevel) },
      healthDistribution: { GOOD: 0, ATTENTION: 0, CRITICAL: 0, ...count((a) => a.healthStatus) },
      rainPauses: list.filter((a) => a.pauseForRain).length,
      thresholdHistory: [...list]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((a) => ({
          timestamp: a.createdAt,
          min: a.recommendedMin,
          max: a.recommendedMax,
          source: a.source,
          riskLevel: a.riskLevel,
        })),
      dailyMoisture: this.dailyMoisture(days),
    };
  }

  private dailyMoisture(days: number): NonNullable<AiStatsDto['dailyMoisture']> {
    const key = (t: number) => new Date(t).toLocaleDateString('en-CA');
    const result = new Map<string, { sum: number; n: number; min: number; max: number; irr: number; pump: number }>();
    for (let i = days - 1; i >= 0; i--) {
      result.set(key(Date.now() - i * 24 * 3600_000), { sum: 0, n: 0, min: 100, max: 0, irr: 0, pump: 0 });
    }
    for (const s of this.samples) {
      const acc = result.get(key(s.t));
      if (!acc) continue;
      acc.sum += s.moisture;
      acc.n++;
      acc.min = Math.min(acc.min, s.moisture);
      acc.max = Math.max(acc.max, s.moisture);
    }
    for (const e of this.events) {
      const acc = result.get(key(Date.parse(e.startedAt)));
      if (!acc) continue;
      acc.irr++;
      acc.pump += (e.durationSec ?? 0) / 60;
    }
    return [...result.entries()].map(([date, a]) => ({
      date,
      avg: a.n ? Math.round((a.sum / a.n) * 10) / 10 : null,
      min: a.n ? Math.round(a.min) : null,
      max: a.n ? Math.round(a.max) : null,
      irrigations: a.irr,
      pumpMinutes: Math.round(a.pump * 10) / 10,
    }));
  }

  private seedAnalyses(): void {
    const crop = this.crops[1];
    const end = Date.now() - 40 * 60_000;
    let i = 0;
    const rainyDay = (t: number) => Math.sin(t / 8.64e7) > 0.75;
    for (let t = end - 30 * 24 * 3600_000; t <= end; t += 30 * 60_000, i++) {
      const sample = this.sampleAt(t);
      const m = Math.round(sample?.moisture ?? 55);
      const rainy = rainyDay(t);
      const level = classifyMoisture(m, crop.minMoisture, crop.maxMoisture);
      const health: HealthStatus =
        level === 'OPTIMAL' ? 'GOOD' : level === 'DRY' || level === 'WET' ? 'ATTENTION' : 'CRITICAL';
      const risk: RiskLevel =
        level === 'VERY_DRY' || level === 'SATURATED' || level === 'SENSOR_ERROR'
          ? 'HIGH'
          : level === 'OPTIMAL'
            ? 'LOW'
            : 'MEDIUM';
      const source = i % 9 === 0 ? 'RULES' : 'GEMINI';
      const shift = Math.round(Math.sin(i / 40) * 3);
      const [recMin, recMax] = clampToCrop(
        crop.minMoisture + shift,
        crop.maxMoisture + shift,
        crop.minMoisture,
        crop.maxMoisture,
      );
      this.analyses.unshift({
        id: crypto.randomUUID(),
        createdAt: new Date(t).toISOString(),
        source,
        trigger: 'SCHEDULED',
        recommendedMin: recMin,
        recommendedMax: recMax,
        pauseForRain: rainy,
        hoursUntilNextIrrigation: null,
        riskLevel: risk,
        summary: summaryFor(level, m, crop.minMoisture, crop.maxMoisture, crop.name, '0', rainy),
        recommendations: ['Mantén la humedad dentro del rango recomendado.'],
        applied: false,
        fallbackReason: source === 'RULES' ? 'QUOTA_EXCEEDED' : null,
        headline: headlineFor(level, crop.name.toLowerCase(), rainy),
        healthStatus: health,
        moistureLevel: level,
        nextAction:
          level === 'VERY_DRY' || level === 'DRY'
            ? rainy
              ? 'PAUSED_FOR_RAIN'
              : 'IRRIGATE_NOW'
            : level === 'OPTIMAL' && rainy
              ? 'PAUSED_FOR_RAIN'
              : 'WAIT',
        recommendationDetails: [],
        inputSnapshot: null,
        projection: null,
      });
    }
  }

  private sampleAt(t: number): Sample | undefined {
    let lo = 0;
    let hi = this.samples.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.samples[mid].t < t) lo = mid + 1;
      else hi = mid;
    }
    return this.samples[lo];
  }

  private buildAnalysis(trigger: string, at: number): AnalysisDto {
    const weather = this.weather();
    const rainProb = weather.maxRainProbability12h;
    const rainMm = weather.totalPrecipitation12h;
    const rainExpected = rainProb >= 70 && rainMm > 0;
    const crop = this.config.crop ?? this.crops[0];
    const cfg = this.config;
    const m = Math.round(this.moisture);
    const min = cfg.minMoisture;
    const max = cfg.maxMoisture;

    const recent = this.samples.filter((s) => s.t >= at - 6 * 3600_000 && !s.pumpOn);
    const rate = recent.length >= 4 ? slopePerHour(recent) : null;
    const confidence = rate === null ? 'LOW' : recent.length >= 40 ? 'HIGH' : 'MEDIUM';

    const points: { timestamp: string; moisture: number }[] = [];
    let value = m;
    let rainTotal = 0;
    let previousTime = at;
    let estimated: number | null = m < min ? at : null;
    const hourStart = Math.floor(at / 3600_000) * 3600_000;
    for (let k = 1; k <= 24; k++) {
      const time = hourStart + k * 3600_000;
      const h = weather.hourly.find((x) => Date.parse(x.time) === time - 3600_000);
      let gain = 0;
      if (h && h.precipitationProbability >= 70 && h.precipitation > 0 && rainTotal < 15) {
        gain = Math.min(2.5 * h.precipitation, 5, 15 - rainTotal);
        rainTotal += gain;
      }
      const next = Math.max(0, Math.min(100, value + (rate ?? 0) * ((time - previousTime) / 3600_000) + gain));
      if (estimated === null && next < min && value >= min) {
        estimated = previousTime + ((value - min) / (value - next)) * (time - previousTime);
      }
      points.push({ timestamp: new Date(time).toISOString(), moisture: Math.round(next * 10) / 10 });
      value = next;
      previousTime = time;
    }

    const pauseApplies = rainExpected && cfg.rainPause;

    const level = classifyMoisture(m, min, max);
    const health: HealthStatus =
      level === 'OPTIMAL' ? 'GOOD' : level === 'DRY' || level === 'WET' ? 'ATTENTION' : 'CRITICAL';
    const nextAction: NextAction =
      level === 'VERY_DRY'
        ? pauseApplies && m >= 15
          ? 'PAUSED_FOR_RAIN'
          : 'IRRIGATE_NOW'
        : level === 'DRY'
          ? pauseApplies && m >= 15
            ? 'PAUSED_FOR_RAIN'
            : 'IRRIGATE_NOW'
          : level === 'OPTIMAL' && pauseApplies
            ? 'PAUSED_FOR_RAIN'
            : 'WAIT';
    const risk: RiskLevel =
      level === 'VERY_DRY' || level === 'SATURATED' || level === 'SENSOR_ERROR'
        ? 'HIGH'
        : level === 'OPTIMAL'
          ? 'LOW'
          : 'MEDIUM';

    const [recMin, recMax] = clampToCrop(
      crop.minMoisture + (rainExpected ? -2 : 0),
      crop.maxMoisture,
      crop.minMoisture,
      crop.maxMoisture,
    );
    const rainText = rainMm.toLocaleString('es-CO');

    const notAi = cfg.mode !== 'AI';
    const details: NonNullable<AnalysisDto['recommendationDetails']> = [];
    if (level === 'VERY_DRY') {
      details.push({
        title: 'Riega ahora',
        detail: `La humedad (${m} %) está ${min - m} puntos por debajo del mínimo (${min} %).`,
        category: 'IRRIGATION',
        priority: 'HIGH',
        action: null,
      });
    }
    if (level === 'DRY') {
      details.push({
        title: rainExpected ? 'Humedad un poco baja' : 'Humedad baja',
        detail: rainExpected
          ? `La humedad (${m} %) está por debajo del mínimo de ${crop.name} (${min}–${max} %), pero la lluvia prevista la recuperará.`
          : `La humedad (${m} %) está ${min - m} puntos por debajo del mínimo de ${crop.name} (${min}–${max} %).`,
        category: 'IRRIGATION',
        priority: 'HIGH',
        action: null,
      });
    }
    if (level === 'WET') {
      details.push({
        title: 'No riegues',
        detail: 'La humedad supera el máximo del cultivo; deja que la tierra se seque un poco antes de volver a regar.',
        category: 'IRRIGATION',
        priority: 'MEDIUM',
        action: null,
      });
    }
    if (level === 'SATURATED') {
      details.push({
        title: 'Revisa el drenaje',
        detail: 'El agua no se está evacuando bien; el exceso puede pudrir la raíz y ahogar el cultivo.',
        category: 'CROP',
        priority: 'HIGH',
        action: null,
      });
    }
    if (rainExpected) {
      details.push({
        title: 'Lluvia prevista',
        detail:
          level === 'VERY_DRY' || level === 'DRY'
            ? `Se esperan ${rainText} mm (probabilidad ${rainProb} %), pero el suelo está por debajo del mínimo: la lluvia no reemplaza el riego.`
            : `Se esperan ${rainText} mm en las próximas 12 h (probabilidad ${rainProb} %); no hace falta regar.`,
        category: 'WEATHER',
        priority: level === 'VERY_DRY' || level === 'DRY' ? 'HIGH' : 'MEDIUM',
        action:
          level !== 'VERY_DRY' && notAi && !cfg.rainPause
            ? { type: 'ENABLE_RAIN_PAUSE', label: 'Activar la pausa por lluvia' }
            : null,
      });
    } else if (cfg.rainPause && notAi && rainProb < 40 && (level === 'DRY' || level === 'OPTIMAL')) {
      details.push({
        title: 'Pausa por lluvia activa',
        detail: 'No se espera lluvia importante en las próximas 12 h; la pausa podría dejar el suelo seco.',
        category: 'WEATHER',
        priority: 'LOW',
        action: { type: 'DISABLE_RAIN_PAUSE', label: 'Desactivar la pausa por lluvia' },
      });
    }
    if (notAi && (recMin !== min || recMax !== max)) {
      details.push({
        title: 'Ajusta los umbrales',
        detail: `Para ${crop.name} se recomienda mantener la humedad entre ${recMin} % y ${recMax} %.`,
        category: 'CROP',
        priority: 'MEDIUM',
        action: { type: 'APPLY_THRESHOLDS', label: 'Aplicar umbrales recomendados' },
      });
    }
    if (notAi && cfg.mode === 'AUTO') {
      details.push({
        title: 'Deja que la IA ajuste el riego',
        detail: 'En modo IA los umbrales se adaptan solos al clima y a tu cultivo cada 30 minutos.',
        category: 'IRRIGATION',
        priority: 'LOW',
        action: { type: 'ENABLE_AI_MODE', label: 'Activar el modo IA' },
      });
    }
    if (!details.length) {
      details.push({
        title: 'Todo en orden',
        detail: `Mantén los umbrales del perfil de ${crop.name} y revisa la huerta a diario.`,
        category: 'CROP',
        priority: 'LOW',
        action: null,
      });
    }

    const day = this.samples.filter((s) => s.t >= at - 24 * 3600_000).map((s) => s.moisture);
    const events24h = this.events.filter((e) => Date.parse(e.startedAt) >= at - 24 * 3600_000);
    const useGemini = Math.random() > 0.25;
    const limited = details.slice(0, 4);
    return {
      id: crypto.randomUUID(),
      createdAt: new Date(at).toISOString(),
      source: useGemini ? 'GEMINI' : 'RULES',
      trigger,
      recommendedMin: recMin,
      recommendedMax: recMax,
      pauseForRain: rainExpected,
      hoursUntilNextIrrigation: estimated === null ? null : Math.max(0, Math.round((estimated - at) / 360_000) / 10),
      riskLevel: risk,
      summary: summaryFor(level, m, min, max, crop.name, rainText, rainExpected),
      recommendations: limited.map((d) => d.detail!),
      applied: false,
      fallbackReason: useGemini ? null : 'QUOTA_EXCEEDED',
      headline: headlineFor(level, crop.name.toLowerCase(), rainExpected),
      moistureLevel: level,
      healthStatus: health,
      nextAction,
      recommendationDetails: limited,
      inputSnapshot: {
        currentMoisture: m,
        avgMoisture24h: day.length ? Math.round((day.reduce((a, b) => a + b, 0) / day.length) * 10) / 10 : null,
        minMoisture24h: day.length ? Math.round(Math.min(...day)) : null,
        maxMoisture24h: day.length ? Math.round(Math.max(...day)) : null,
        dryingRatePerHour: rate,
        irrigations24h: events24h.length,
        pumpMinutes24h: Math.round(events24h.reduce((a, e) => a + (e.durationSec ?? 0), 0) / 6) / 10,
        rainProbability12h: rainProb,
        precipitation12h: rainMm,
        temperature: weather.current.temperature,
        airHumidity: weather.current.relativeHumidity,
        cropName: crop.name,
        cropMin: crop.minMoisture,
        cropMax: crop.maxMoisture,
        currentMin: min,
        currentMax: max,
        mode: cfg.mode,
        sensorOk: true,
        rainPause: cfg.rainPause,
        readingAgeMinutes: 0.1,
        cropId: crop.id,
        moistureLevel: level,
      },
      projection: {
        points,
        dryingRatePerHour: rate,
        estimatedNextIrrigationAt: estimated === null ? null : new Date(estimated).toISOString(),
        confidence,
      },
      fallbackDetail: useGemini ? null : '429 . Quota exceeded (simulación)',
    };
  }
}

function slopePerHour(samples: Sample[]): number {
  const n = samples.length;
  const t0 = samples[0].t;
  const xs = samples.map((s) => (s.t - t0) / 3600_000);
  const xm = xs.reduce((a, b) => a + b, 0) / n;
  const ym = samples.reduce((a, s) => a + s.moisture, 0) / n;
  let sxy = 0;
  let sxx = 0;
  samples.forEach((s, i) => {
    sxy += (xs[i] - xm) * (s.moisture - ym);
    sxx += (xs[i] - xm) ** 2;
  });
  return sxx === 0 ? 0 : Math.round(Math.max(-10, Math.min(5, sxy / sxx)) * 100) / 100;
}

function headlineFor(level: MoistureLevel, crop: string, rain: boolean): string {
  switch (level) {
    case 'VERY_DRY':
      return `¡Tu ${crop} necesita agua ya!`;
    case 'DRY':
      return rain ? `${crop[0].toUpperCase()}${crop.slice(1)} puede aprovechar la lluvia` : `Tu ${crop} necesita un poco de agua`;
    case 'WET':
      return 'Humedad alta, no riegues';
    case 'SATURATED':
      return rain ? 'Suelo saturado: cuidado con el encharcamiento' : 'Suelo saturado: no riegues';
    case 'SENSOR_ERROR':
      return 'Revisa el sensor de humedad';
    default:
      return `Tu ${crop} está en su punto`;
  }
}

function summaryFor(
  level: MoistureLevel,
  m: number,
  min: number,
  max: number,
  crop: string,
  rainMm: string,
  rain: boolean,
): string {
  switch (level) {
    case 'VERY_DRY':
      return `La humedad está en ${m} %, muy por debajo del mínimo de ${crop} (${min}–${max} %). Riega ahora${rain ? ': aunque llueva, la tierra está demasiado seca' : ''}.`;
    case 'DRY':
      return rain
        ? `La humedad (${m} %) está un poco baja, pero se esperan ${rainMm} mm de lluvia en las próximas 12 h. Se pausa el riego para aprovechar el agua natural.`
        : `La humedad (${m} %) está por debajo del mínimo ideal para ${crop} (${min}–${max} %). Conviene regar pronto.`;
    case 'WET':
      return `La tierra tiene ${m} %, por encima del ${max} % ideal para ${crop} (${min}–${max} %). Espera a que baje para evitar hongos en la raíz.`;
    case 'SATURATED':
      return rain
        ? `La humedad está en ${m} % y viene más lluvia: el suelo está saturado. Revisa que la maceta drene bien o protégela de la lluvia.`
        : `La humedad está en ${m} %: el suelo está saturado, muy por encima del máximo de ${crop} (${min}–${max} %). Revisa el drenaje y no riegues hasta que baje.`;
    case 'SENSOR_ERROR':
      return 'No hay una lectura válida del sensor en los últimos 5 minutos; revisa la conexión.';
    default:
      return `La humedad (${m} %) está dentro del rango ideal de ${crop} (${min}–${max} %). No hace falta regar.`;
  }
}

function clampToCrop(min: number, max: number, profileMin: number, profileMax: number): [number, number] {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const floor = clamp(profileMin - 10, 10, 90);
  const ceil = clamp(profileMax + 10, 10, 90);
  let newMin = clamp(Math.min(min, max), floor, ceil);
  let newMax = clamp(Math.max(min, max), floor, ceil);
  if (newMax - newMin < 10) {
    if (newMin + 10 <= ceil) newMax = newMin + 10;
    else {
      newMax = ceil;
      newMin = ceil - 10;
    }
  }
  return [newMin, newMax];
}

export class MockHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,

    readonly code?: string,
  ) {
    super(message);
  }
}

function mockPolicyProblem(username: string, current: string, next: string): string | null {
  if (next.length < 10) return 'La contraseña debe tener al menos 10 caracteres';
  if (!/[A-ZÁÉÍÓÚÑ]/.test(next)) return 'La contraseña debe incluir al menos una mayúscula';
  if (!/[a-záéíóúñ]/.test(next)) return 'La contraseña debe incluir al menos una minúscula';
  if (!/\d/.test(next)) return 'La contraseña debe incluir al menos un número';
  if (next === current) return 'La contraseña nueva debe ser distinta de la actual';
  if (next.toLowerCase() === username.toLowerCase()) return 'La contraseña no puede ser igual al nombre de usuario';
  const common = ['admin123', 'admin1234', 'password', 'password1', '12345678', '123456789', 'qwerty123', 'smartgarden'];
  if (common.includes(next.toLowerCase())) return 'Esa contraseña es demasiado común; elige otra';
  return null;
}

function validateThresholds(min: number, max: number): void {
  if (min < 0 || max > 100 || min >= max) {
    throw new MockHttpError(400, 'La humedad mínima debe ser menor que la máxima (0–100 %)');
  }
  if (max - min < 10) {
    throw new MockHttpError(400, 'La diferencia entre humedad máxima y mínima debe ser de al menos 10 puntos');
  }
}
