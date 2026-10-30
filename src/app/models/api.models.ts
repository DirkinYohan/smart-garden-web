import { AnalysisSource, IrrigationMode, RiskLevel } from './garden.models';

export interface TelemetryReadingDto {
  deviceId: string;
  raw: number;
  moisture: number;
  pumpOn: boolean;
  sensorOk: boolean;
  mode: IrrigationMode;
  minMoisture: number;
  maxMoisture: number;
  rainPause: boolean;
  uptimeMs: number;
  receivedAt: string;
}

export interface LoginResponseDto {
  token: string;
  expiresAt: string;
  mustChangePassword?: boolean;
  username?: string;
}

export interface MeDto {
  username: string;
  role: string;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
}

export interface TokenDto {
  token: string;
  expiresAt: string;
}

export interface StatusResponseDto {
  deviceOnline: boolean;
  deviceStatus: string;
  lastSeen: string | null;
  reading: TelemetryReadingDto | null;
}

export interface HistoryResponseDto {
  range: string;
  intervalMinutes: number;
  points: {
    timestamp: string;
    avgMoisture: number;
    minMoisture: number;
    maxMoisture: number;
    samples: number;
    pumpActive: boolean;
  }[];
}

export interface IrrigationEventDto {
  id: number;
  deviceId: string;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
  startMoisture: number;
  endMoisture: number | null;
  mode: IrrigationMode;
  inProgress: boolean;
}

export interface CropProfileDto {
  id: number;
  name: string;
  minMoisture: number;
  maxMoisture: number;
  description: string;
}

export interface ConfigDto {
  mode: IrrigationMode;
  crop: CropProfileDto | null;
  minMoisture: number;
  maxMoisture: number;
  rainPause: boolean;
  aiEnabled: boolean;
  updatedAt: string | null;
  updatedBy: string;
  lastAnalysisId: string | null;
}

export interface UpdateConfigRequestDto {
  mode?: IrrigationMode;
  cropProfileId?: number;
  minMoisture?: number;
  maxMoisture?: number;
  rainPause?: boolean;
  aiEnabled?: boolean;
}

export interface AnalysisDto {
  id: string;
  createdAt: string;
  source: AnalysisSource;
  trigger: string;
  recommendedMin: number;
  recommendedMax: number;
  pauseForRain: boolean;
  hoursUntilNextIrrigation: number | null;
  riskLevel: RiskLevel;
  summary: string;
  recommendations: string[];
  applied: boolean;
  fallbackReason: string | null;

  headline?: string | null;
  healthStatus?: string | null;
  nextAction?: string | null;
  recommendationDetails?: RecommendationDetailDto[] | null;
  inputSnapshot?: InputSnapshotDto | null;
  projection?: ProjectionDto | null;
  fallbackDetail?: string | null;

  moistureLevel?: string | null;
}

export interface RecommendationDetailDto {
  title: string | null;
  detail: string | null;
  category: string | null;
  priority: string | null;
  action: { type: string; label: string } | null;
}

export interface InputSnapshotDto {
  currentMoisture: number | null;
  avgMoisture24h: number | null;
  minMoisture24h: number | null;
  maxMoisture24h: number | null;
  dryingRatePerHour: number | null;
  irrigations24h: number | null;
  pumpMinutes24h: number | null;
  rainProbability12h: number | null;
  precipitation12h: number | null;
  temperature: number | null;
  airHumidity: number | null;
  cropName: string | null;
  cropMin: number | null;
  cropMax: number | null;
  currentMin: number | null;
  currentMax: number | null;
  mode: string | null;
  sensorOk: boolean | null;
  rainPause?: boolean | null;
  readingAgeMinutes?: number | null;

  cropId?: number | null;
  moistureLevel?: string | null;
}

export interface ProjectionDto {
  points: { timestamp: string; moisture: number }[] | null;
  dryingRatePerHour: number | null;
  estimatedNextIrrigationAt: string | null;
  confidence: string | null;
}

export interface AiStatsDto {
  days: number;
  totalAnalyses: number;
  geminiCount: number;
  rulesCount: number;
  riskDistribution: Record<string, number> | null;
  healthDistribution: Record<string, number> | null;
  rainPauses: number;
  thresholdHistory: { timestamp: string; min: number; max: number; source: string; riskLevel: string }[] | null;
  dailyMoisture:
    | {
        date: string;
        avg: number | null;
        min: number | null;
        max: number | null;
        irrigations: number;
        pumpMinutes: number;
      }[]
    | null;
}

export interface WeatherDto {
  fetchedAt: string;
  latitude: number;
  longitude: number;
  current: {
    time: string;
    temperature: number;
    relativeHumidity: number;
    precipitation: number;
    weatherCode: number;
  };
  hourly: {
    time: string;
    temperature: number;
    relativeHumidity: number;
    precipitationProbability: number;
    precipitation: number;
  }[];
  maxRainProbability12h: number;
  totalPrecipitation12h: number;
}

export interface DeviceStatusDto {
  deviceId: string;
  online: boolean;
  reason: string;
  changedAt: string;
}
