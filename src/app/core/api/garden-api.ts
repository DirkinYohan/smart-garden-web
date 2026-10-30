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

export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);

export abstract class GardenApi {
  abstract login(username: string, password: string): Observable<LoginResponse>;

  abstract me(): Observable<AuthUser>;

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

  abstract getLatestAnalysis(): Observable<Analysis | null>;
  abstract listAnalyses(limit: number): Observable<Analysis[]>;
  abstract requestAnalysis(): Observable<Analysis>;
  abstract getWeather(): Observable<Weather>;

  abstract getAiStats(days: 7 | 30): Observable<AiStats>;
}
