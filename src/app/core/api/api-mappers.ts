import {
  AiStatsDto,
  AnalysisDto,
  ConfigDto,
  CropProfileDto,
  DeviceStatusDto,
  HistoryResponseDto,
  InputSnapshotDto,
  IrrigationEventDto,
  LoginResponseDto,
  MeDto,
  StatusResponseDto,
  TelemetryReadingDto,
  TokenDto,
  UpdateConfigRequestDto,
  WeatherDto,
} from '../../models/api.models';
import {
  ActionType,
  AiStats,
  Analysis,
  AuthUser,
  Confidence,
  ConfigUpdate,
  CropProfile,
  DeviceStatus,
  DeviceStatusEvent,
  HealthStatus,
  HistoryPoint,
  InputSnapshot,
  IrrigationConfig,
  IrrigationEvent,
  LoginResponse,
  MoistureLevel,
  NextAction,
  PasswordChangedResponse,
  Priority,
  RecommendationCategory,
  RiskLevel,
  Weather,
} from '../../models/garden.models';

const HEALTH: readonly HealthStatus[] = ['GOOD', 'ATTENTION', 'CRITICAL'];
const NEXT_ACTIONS: readonly NextAction[] = ['IRRIGATE_NOW', 'WAIT', 'PAUSED_FOR_RAIN', 'CHECK_SENSOR'];
const CATEGORIES: readonly RecommendationCategory[] = ['IRRIGATION', 'WEATHER', 'SENSOR', 'CROP'];
const PRIORITIES: readonly Priority[] = ['HIGH', 'MEDIUM', 'LOW'];
const ACTIONS: readonly ActionType[] = [
  'APPLY_THRESHOLDS',
  'ENABLE_AI_MODE',
  'DISABLE_RAIN_PAUSE',
  'ENABLE_RAIN_PAUSE',
  'CHECK_SENSOR',
];
const CONFIDENCES: readonly Confidence[] = ['LOW', 'MEDIUM', 'HIGH'];
const MOISTURE_LEVELS: readonly MoistureLevel[] = ['SENSOR_ERROR', 'VERY_DRY', 'DRY', 'OPTIMAL', 'WET', 'SATURATED'];
const RISKS: readonly RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];

function oneOf<T extends string>(value: string | null | undefined, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export const ApiMappers = {
  login(dto: LoginResponseDto): LoginResponse {
    return {
      token: dto.token,
      expiresAt: dto.expiresAt,

      mustChangePassword: dto.mustChangePassword === true,
      username: dto.username ?? '',
    };
  },

  me(dto: MeDto): AuthUser {
    return {
      username: dto.username,
      role: dto.role,
      mustChangePassword: dto.mustChangePassword === true,
      passwordChangedAt: dto.passwordChangedAt ?? null,
    };
  },

  token(dto: TokenDto): PasswordChangedResponse {
    return { token: dto.token, expiresAt: dto.expiresAt };
  },

  status(dto: StatusResponseDto): DeviceStatus {
    if (!dto.reading) {
      return {
        deviceId: '',
        moisture: 0,
        raw: 0,
        pumpOn: false,
        sensorOk: true,
        mode: 'AUTO',
        minMoisture: 0,
        maxMoisture: 0,
        rainPause: false,
        deviceOnline: dto.deviceOnline,
        timestamp: dto.lastSeen,
        hasReading: false,
      };
    }
    return ApiMappers.reading(dto.reading, dto.deviceOnline);
  },

  reading(r: TelemetryReadingDto, deviceOnline = true): DeviceStatus {
    return {
      deviceId: r.deviceId,
      moisture: r.moisture,
      raw: r.raw,
      pumpOn: r.pumpOn,
      sensorOk: r.sensorOk,
      mode: r.mode,
      minMoisture: r.minMoisture,
      maxMoisture: r.maxMoisture,
      rainPause: r.rainPause,
      deviceOnline,
      timestamp: r.receivedAt,
      hasReading: true,
    };
  },

  history(dto: HistoryResponseDto): HistoryPoint[] {
    return dto.points.map((p) => ({
      timestamp: p.timestamp,
      avgMoisture: p.avgMoisture,
      minMoisture: p.minMoisture,
      maxMoisture: p.maxMoisture,
    }));
  },

  event(e: IrrigationEventDto): IrrigationEvent {
    return {
      id: e.id,
      startedAt: e.startedAt,
      endedAt: e.endedAt,
      durationSec: e.durationSec,
      moistureStart: e.startMoisture,
      moistureEnd: e.endMoisture,
      mode: e.mode,
      inProgress: e.inProgress,
    };
  },

  config(dto: ConfigDto): IrrigationConfig {
    return {
      mode: dto.mode,
      cropId: dto.crop?.id ?? null,
      minMoisture: dto.minMoisture,
      maxMoisture: dto.maxMoisture,
      rainPause: dto.rainPause,
      aiEnabled: dto.aiEnabled,
      updatedAt: dto.updatedAt,
      updatedBy: dto.updatedBy,
    };
  },

  configUpdate(update: ConfigUpdate): UpdateConfigRequestDto {
    const body: UpdateConfigRequestDto = {};
    if (update.mode !== undefined) body.mode = update.mode;
    if (update.cropId !== undefined && update.cropId !== null) body.cropProfileId = update.cropId;
    if (update.minMoisture !== undefined) body.minMoisture = update.minMoisture;
    if (update.maxMoisture !== undefined) body.maxMoisture = update.maxMoisture;
    if (update.rainPause !== undefined) body.rainPause = update.rainPause;
    if (update.aiEnabled !== undefined) body.aiEnabled = update.aiEnabled;
    return body;
  },

  crop(c: CropProfileDto): CropProfile {
    return { ...c, description: c.description ?? '' };
  },

  analysis(a: AnalysisDto): Analysis {
    return {
      id: a.id,
      createdAt: a.createdAt,
      source: a.source,
      recommendedMin: a.recommendedMin,
      recommendedMax: a.recommendedMax,
      pauseForRain: a.pauseForRain,
      hoursUntilNextIrrigation: a.hoursUntilNextIrrigation,
      riskLevel: a.riskLevel,
      summary: a.summary,
      recommendations: a.recommendations,
      applied: a.applied,
      trigger: a.trigger,
      fallbackReason: a.fallbackReason,
      headline: a.headline || null,
      healthStatus: oneOf(a.healthStatus, HEALTH),
      nextAction: oneOf(a.nextAction, NEXT_ACTIONS),
      recommendationDetails: (a.recommendationDetails ?? [])
        .filter((d) => !!d?.detail)
        .map((d) => ({
          title: d.title || d.detail!.split(' ').slice(0, 5).join(' '),
          detail: d.detail!,
          category: oneOf(d.category, CATEGORIES) ?? 'IRRIGATION',
          priority: oneOf(d.priority, PRIORITIES) ?? 'MEDIUM',
          action:
            d.action && oneOf(d.action.type, ACTIONS)
              ? { type: oneOf(d.action.type, ACTIONS)!, label: d.action.label || d.action.type }
              : null,
        })),
      inputSnapshot: a.inputSnapshot ? ApiMappers.snapshot(a.inputSnapshot) : null,
      projection: a.projection
        ? {
            points: (a.projection.points ?? []).filter((p) => p && Number.isFinite(p.moisture)),
            dryingRatePerHour: a.projection.dryingRatePerHour ?? null,
            estimatedNextIrrigationAt: a.projection.estimatedNextIrrigationAt ?? null,
            confidence: oneOf(a.projection.confidence, CONFIDENCES),
          }
        : null,
      fallbackDetail: a.fallbackDetail ?? null,
      moistureLevel: oneOf(a.moistureLevel, MOISTURE_LEVELS),
    };
  },

  snapshot(s: InputSnapshotDto): InputSnapshot {
    return {
      currentMoisture: s.currentMoisture ?? null,
      avgMoisture24h: s.avgMoisture24h ?? null,
      minMoisture24h: s.minMoisture24h ?? null,
      maxMoisture24h: s.maxMoisture24h ?? null,
      dryingRatePerHour: s.dryingRatePerHour ?? null,
      irrigations24h: s.irrigations24h ?? 0,
      pumpMinutes24h: s.pumpMinutes24h ?? 0,
      rainProbability12h: s.rainProbability12h ?? null,
      precipitation12h: s.precipitation12h ?? null,
      temperature: s.temperature ?? null,
      airHumidity: s.airHumidity ?? null,
      cropName: s.cropName ?? '',
      cropMin: s.cropMin ?? 0,
      cropMax: s.cropMax ?? 0,
      currentMin: s.currentMin ?? 0,
      currentMax: s.currentMax ?? 0,
      mode: s.mode ?? '',
      sensorOk: s.sensorOk ?? false,
      rainPause: s.rainPause ?? null,
      readingAgeMinutes: s.readingAgeMinutes ?? null,
      cropId: s.cropId ?? null,
      moistureLevel: oneOf(s.moistureLevel, MOISTURE_LEVELS),
    };
  },

  stats(s: AiStatsDto): AiStats {
    return {
      days: s.days,
      totalAnalyses: s.totalAnalyses ?? 0,
      geminiCount: s.geminiCount ?? 0,
      rulesCount: s.rulesCount ?? 0,
      riskDistribution: {
        LOW: s.riskDistribution?.['LOW'] ?? 0,
        MEDIUM: s.riskDistribution?.['MEDIUM'] ?? 0,
        HIGH: s.riskDistribution?.['HIGH'] ?? 0,
      },
      healthDistribution: {
        GOOD: s.healthDistribution?.['GOOD'] ?? 0,
        ATTENTION: s.healthDistribution?.['ATTENTION'] ?? 0,
        CRITICAL: s.healthDistribution?.['CRITICAL'] ?? 0,
      },
      rainPauses: s.rainPauses ?? 0,
      thresholdHistory: (s.thresholdHistory ?? []).map((t) => ({
        timestamp: t.timestamp,
        min: t.min,
        max: t.max,
        source: t.source === 'GEMINI' ? 'GEMINI' : 'RULES',
        riskLevel: oneOf(t.riskLevel, RISKS) ?? 'LOW',
      })),
      dailyMoisture: (s.dailyMoisture ?? []).map((d) => ({
        date: d.date,
        avg: d.avg ?? null,
        min: d.min ?? null,
        max: d.max ?? null,
        irrigations: d.irrigations ?? 0,
        pumpMinutes: d.pumpMinutes ?? 0,
      })),
    };
  },

  weather(w: WeatherDto): Weather {
    return {
      temperature: w.current.temperature,
      airHumidity: w.current.relativeHumidity,
      rainProbabilityNext12h: w.maxRainProbability12h,
      precipitationNext12h: w.totalPrecipitation12h,
      hourly: w.hourly.map((h) => ({
        time: h.time,
        rainProbability: h.precipitationProbability,
        temperature: h.temperature,
        precipitation: h.precipitation,
      })),
    };
  },

  deviceStatus(dto: DeviceStatusDto): DeviceStatusEvent {
    return { deviceOnline: dto.online, timestamp: dto.changedAt };
  },
};
