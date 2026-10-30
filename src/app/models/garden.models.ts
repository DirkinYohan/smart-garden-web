export type IrrigationMode = 'AUTO' | 'MANUAL' | 'AI';
export type HistoryRange = '24h' | '7d' | '30d';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type MoistureLevel = 'SENSOR_ERROR' | 'VERY_DRY' | 'DRY' | 'OPTIMAL' | 'WET' | 'SATURATED';
export type AnalysisSource = 'GEMINI' | 'RULES';
export type ConnectionState = 'connected' | 'connecting' | 'disconnected';

export interface LoginResponse {
  token: string;
  expiresAt: string;

  mustChangePassword: boolean;
  username: string;
}

export interface AuthUser {
  username: string;
  role: string;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
}

export interface PasswordChange {
  currentPassword: string;
  newPassword: string;
}

export interface PasswordChangedResponse {
  token: string;
  expiresAt: string;
}

export interface DeviceStatus {
  deviceId: string;
  moisture: number;
  raw: number;
  pumpOn: boolean;
  sensorOk: boolean;
  mode: IrrigationMode;
  minMoisture: number;
  maxMoisture: number;
  rainPause: boolean;
  deviceOnline: boolean;

  timestamp: string | null;
  hasReading: boolean;
}

export interface HistoryPoint {
  timestamp: string;
  avgMoisture: number;
  minMoisture: number;
  maxMoisture: number;
}

export interface IrrigationEvent {
  id: number;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
  moistureStart: number;
  moistureEnd: number | null;
  mode: IrrigationMode;
  inProgress: boolean;
}

export interface IrrigationConfig {
  mode: IrrigationMode;
  cropId: number | null;
  minMoisture: number;
  maxMoisture: number;
  rainPause: boolean;
  aiEnabled: boolean;
  updatedAt?: string | null;

  updatedBy?: string;
}

export type ConfigUpdate = Partial<Omit<IrrigationConfig, 'updatedAt' | 'updatedBy'>>;

export interface CropProfile {
  id: number;
  name: string;
  minMoisture: number;
  maxMoisture: number;
  description: string;
}

export type CropProfileInput = Omit<CropProfile, 'id'>;

export interface PumpResult {
  accepted: boolean;
  message: string;
}

export interface Analysis {
  id: string;
  createdAt: string;
  source: AnalysisSource;
  recommendedMin: number;
  recommendedMax: number;
  pauseForRain: boolean;
  hoursUntilNextIrrigation: number | null;
  riskLevel: RiskLevel;
  summary: string;
  recommendations: string[];
  applied?: boolean;

  trigger?: string;

  fallbackReason?: string | null;

  headline: string | null;
  healthStatus: HealthStatus | null;
  nextAction: NextAction | null;
  recommendationDetails: RecommendationDetail[];
  inputSnapshot: InputSnapshot | null;
  projection: Projection | null;

  fallbackDetail?: string | null;

  moistureLevel: MoistureLevel | null;
}

export type HealthStatus = 'GOOD' | 'ATTENTION' | 'CRITICAL';
export type NextAction = 'IRRIGATE_NOW' | 'WAIT' | 'PAUSED_FOR_RAIN' | 'CHECK_SENSOR';
export type RecommendationCategory = 'IRRIGATION' | 'WEATHER' | 'SENSOR' | 'CROP';
export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';
export type ActionType =
  | 'APPLY_THRESHOLDS'
  | 'ENABLE_AI_MODE'
  | 'DISABLE_RAIN_PAUSE'
  | 'ENABLE_RAIN_PAUSE'
  | 'CHECK_SENSOR';
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';
export type FallbackReason =
  | 'NO_API_KEY'
  | 'QUOTA_EXCEEDED'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'AUTH_ERROR'
  | 'MODEL_NOT_FOUND'
  | 'UNAVAILABLE'
  | 'ERROR';

export interface SuggestedAction {
  type: ActionType;
  label: string;
}

export interface RecommendationDetail {
  title: string;
  detail: string;
  category: RecommendationCategory;
  priority: Priority;
  action: SuggestedAction | null;
}

export interface InputSnapshot {
  currentMoisture: number | null;
  avgMoisture24h: number | null;
  minMoisture24h: number | null;
  maxMoisture24h: number | null;
  dryingRatePerHour: number | null;
  irrigations24h: number;
  pumpMinutes24h: number;
  rainProbability12h: number | null;
  precipitation12h: number | null;
  temperature: number | null;
  airHumidity: number | null;
  cropName: string;
  cropMin: number;
  cropMax: number;
  currentMin: number;
  currentMax: number;
  mode: string;
  sensorOk: boolean;
  rainPause: boolean | null;
  readingAgeMinutes: number | null;

  cropId: number | null;
  moistureLevel: MoistureLevel | null;
}

export interface ProjectionPoint {
  timestamp: string;
  moisture: number;
}

export interface Projection {
  points: ProjectionPoint[];
  dryingRatePerHour: number | null;
  estimatedNextIrrigationAt: string | null;
  confidence: Confidence | null;
}

export interface ThresholdHistoryPoint {
  timestamp: string;
  min: number;
  max: number;
  source: AnalysisSource;
  riskLevel: RiskLevel;
}

export interface DailyMoisture {
  date: string;
  avg: number | null;
  min: number | null;
  max: number | null;
  irrigations: number;
  pumpMinutes: number;
}

export interface AiStats {
  days: number;
  totalAnalyses: number;
  geminiCount: number;
  rulesCount: number;
  riskDistribution: Record<RiskLevel, number>;
  healthDistribution: Record<HealthStatus, number>;
  rainPauses: number;
  thresholdHistory: ThresholdHistoryPoint[];
  dailyMoisture: DailyMoisture[];
}

export interface HourlyWeather {
  time: string;
  rainProbability: number;
  temperature: number;
  precipitation: number;
}

export interface Weather {
  temperature: number;
  airHumidity: number;
  rainProbabilityNext12h: number;
  precipitationNext12h: number;
  hourly: HourlyWeather[];
}

export interface DeviceStatusEvent {
  deviceOnline: boolean;
  timestamp: string;
}

export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
}
