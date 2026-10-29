/**
 * UI models. They follow the contracts of the frontend specification; the real api-gateway DTOs
 * (see api.models.ts) are translated in core/api/api-mappers.ts.
 */

export type IrrigationMode = 'AUTO' | 'MANUAL' | 'AI';
export type HistoryRange = '24h' | '7d' | '30d';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Nivel de humedad calculado por el backend respecto al rango del cultivo activo.
 * VERY_DRY < min-10, DRY < min, OPTIMAL dentro del rango, WET hasta max+15, SATURATED por encima (o >= 95 %).
 */
export type MoistureLevel = 'SENSOR_ERROR' | 'VERY_DRY' | 'DRY' | 'OPTIMAL' | 'WET' | 'SATURATED';
export type AnalysisSource = 'GEMINI' | 'RULES';
export type ConnectionState = 'connected' | 'connecting' | 'disconnected';

export interface LoginResponse {
  token: string;
  expiresAt: string;
  /** true cuando la contraseña es inicial: hay que cambiarla antes de usar la aplicación. */
  mustChangePassword: boolean;
  username: string;
}

/** GET /auth/me */
export interface AuthUser {
  username: string;
  role: string;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
}

/** PUT /auth/password */
export interface PasswordChange {
  currentPassword: string;
  newPassword: string;
}

/** Respuesta de PUT /auth/password: token nuevo (las demás sesiones quedan cerradas). */
export interface PasswordChangedResponse {
  token: string;
  expiresAt: string;
}

/** GET /status and /topic/telemetry. `hasReading` is false when the device never reported. */
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
  /** Time of the reading (ISO-8601) or null. */
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
  /** 'USER' | 'AI' | 'SYSTEM' */
  updatedBy?: string;
}

/** PUT /config: partial update. */
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
  /** 'SCHEDULED' | 'MANUAL' */
  trigger?: string;
  /** Code (see FallbackReason) when source = RULES. */
  fallbackReason?: string | null;
  // --- v1.1 (null / empty for analyses created before) ---
  headline: string | null;
  healthStatus: HealthStatus | null;
  nextAction: NextAction | null;
  recommendationDetails: RecommendationDetail[];
  inputSnapshot: InputSnapshot | null;
  projection: Projection | null;
  /** Technical detail of the fallback (not shown to end users). */
  fallbackDetail?: string | null;
  /** v1.2: nivel de humedad con el que se redactó este análisis (null en análisis antiguos). */
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

/** Data the analysis used ("¿Por qué la IA decidió esto?"). Nullable values were not available. */
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
  /** v1.2: cultivo con el que se hizo el análisis (null en análisis antiguos). */
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

/** GET /ai/stats?days=7|30 */
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

/** /topic/device-status */
export interface DeviceStatusEvent {
  deviceOnline: boolean;
  timestamp: string;
}

/** Uniform error body of the api-gateway. */
export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
}
