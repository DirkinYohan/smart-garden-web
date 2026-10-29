import { HttpContextToken } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AiStats,
  Analysis,
  AuthUser,
  ConfigUpdate,
  CropProfile,
  CropProfileInput,
  DeviceStatus,
  HistoryPoint,
  HistoryRange,
  IrrigationConfig,
  IrrigationEvent,
  LoginResponse,
  PasswordChange,
  PasswordChangedResponse,
  PumpResult,
  Weather,
} from '../../models/garden.models';

/** The error interceptor does not show a snackbar for requests flagged with this token. */
export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);

/**
 * Everything the UI needs from the backend. Implemented by HttpGardenApi (api-gateway) and
 * MockGardenApi (simulated backend, environment.useMock).
 */
export abstract class GardenApi {
  abstract login(username: string, password: string): Observable<LoginResponse>;
  /** GET /auth/me */
  abstract me(): Observable<AuthUser>;
  /** PUT /auth/password: devuelve un token nuevo e invalida los anteriores. */
  abstract changePassword(change: PasswordChange): Observable<PasswordChangedResponse>;
  abstract getStatus(): Observable<DeviceStatus>;
  abstract getHistory(range: HistoryRange): Observable<HistoryPoint[]>;
  abstract getEvents(limit: number): Observable<IrrigationEvent[]>;
  abstract getConfig(): Observable<IrrigationConfig>;
  abstract updateConfig(update: ConfigUpdate): Observable<IrrigationConfig>;
  abstract getCrops(): Observable<CropProfile[]>;
  abstract updateCrop(id: number, crop: CropProfileInput): Observable<CropProfile>;
  abstract startPump(durationSec: number): Observable<PumpResult>;
  abstract stopPump(): Observable<PumpResult>;
  /** Emits null when no analysis exists yet (backend 404). */
  abstract getLatestAnalysis(): Observable<Analysis | null>;
  abstract listAnalyses(limit: number): Observable<Analysis[]>;
  abstract requestAnalysis(): Observable<Analysis>;
  abstract getWeather(): Observable<Weather>;
  /** GET /ai/stats — days must be 7 or 30. */
  abstract getAiStats(days: 7 | 30): Observable<AiStats>;
}
