import { HttpClient, HttpContext, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AiStatsDto,
  AnalysisDto,
  ConfigDto,
  CropProfileDto,
  HistoryResponseDto,
  IrrigationEventDto,
  LoginResponseDto,
  MeDto,
  StatusResponseDto,
  TokenDto,
  WeatherDto,
} from '../../models/api.models';
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
import { ApiMappers } from './api-mappers';
import { GardenApi, SILENT_ERRORS } from './garden-api';

@Injectable()
export class HttpGardenApi extends GardenApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponseDto>(`${this.base}/auth/login`, { username, password })
      .pipe(map(ApiMappers.login));
  }

  me(): Observable<AuthUser> {
    return this.http.get<MeDto>(`${this.base}/auth/me`).pipe(map(ApiMappers.me));
  }

  changePassword(change: PasswordChange): Observable<PasswordChangedResponse> {
    return this.http.put<TokenDto>(`${this.base}/auth/password`, change).pipe(map(ApiMappers.token));
  }

  getStatus(): Observable<DeviceStatus> {
    return this.http.get<StatusResponseDto>(`${this.base}/status`).pipe(map(ApiMappers.status));
  }

  getHistory(range: HistoryRange): Observable<HistoryPoint[]> {
    return this.http
      .get<HistoryResponseDto>(`${this.base}/telemetry/history`, { params: { range } })
      .pipe(map(ApiMappers.history));
  }

  getEvents(limit: number): Observable<IrrigationEvent[]> {
    return this.http
      .get<IrrigationEventDto[]>(`${this.base}/irrigation/events`, {
        params: new HttpParams().set('limit', limit),
      })
      .pipe(map((events) => events.map(ApiMappers.event)));
  }

  getConfig(): Observable<IrrigationConfig> {
    return this.http.get<ConfigDto>(`${this.base}/config`).pipe(map(ApiMappers.config));
  }

  updateConfig(update: ConfigUpdate): Observable<IrrigationConfig> {
    return this.http
      .put<ConfigDto>(`${this.base}/config`, ApiMappers.configUpdate(update))
      .pipe(map(ApiMappers.config));
  }

  getCrops(): Observable<CropProfile[]> {
    return this.http
      .get<CropProfileDto[]>(`${this.base}/crops`)
      .pipe(map((crops) => crops.map(ApiMappers.crop)));
  }

  updateCrop(id: number, crop: CropProfileInput): Observable<CropProfile> {
    return this.http
      .put<CropProfileDto>(`${this.base}/crops/${id}`, crop)
      .pipe(map(ApiMappers.crop));
  }

  startPump(durationSec: number): Observable<PumpResult> {
    return this.http.post<PumpResult>(`${this.base}/pump/start`, { durationSec });
  }

  stopPump(): Observable<PumpResult> {
    return this.http.post<PumpResult>(`${this.base}/pump/stop`, {});
  }

  getLatestAnalysis(): Observable<Analysis | null> {
    return this.http
      .get<AnalysisDto>(`${this.base}/ai/analysis/latest`, {
        context: new HttpContext().set(SILENT_ERRORS, true),
      })
      .pipe(
        map(ApiMappers.analysis),
        catchError((err: HttpErrorResponse) => (err.status === 404 ? of(null) : throwError(() => err))),
      );
  }

  listAnalyses(limit: number): Observable<Analysis[]> {
    return this.http
      .get<AnalysisDto[]>(`${this.base}/ai/analysis`, { params: new HttpParams().set('limit', limit) })
      .pipe(map((list) => list.map(ApiMappers.analysis)));
  }

  requestAnalysis(): Observable<Analysis> {
    return this.http.post<AnalysisDto>(`${this.base}/ai/analysis`, {}).pipe(map(ApiMappers.analysis));
  }

  getAiStats(days: 7 | 30): Observable<AiStats> {
    return this.http
      .get<AiStatsDto>(`${this.base}/ai/stats`, {
        params: new HttpParams().set('days', days),

        context: new HttpContext().set(SILENT_ERRORS, true),
      })
      .pipe(map(ApiMappers.stats));
  }

  getWeather(): Observable<Weather> {
    return this.http.get<WeatherDto>(`${this.base}/weather`).pipe(map(ApiMappers.weather));
  }
}
