import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, share } from 'rxjs';
import {
  Analysis,
  ConnectionState,
  DeviceStatus,
  DeviceStatusEvent,
  IrrigationConfig,
} from '../../models/garden.models';
import { ApiMappers } from '../api/api-mappers';
import { MockBackend } from '../mock/mock-backend';
import { RealtimeService } from './realtime.service';

/** Real-time feed of the simulated backend (environment.useMock). */
@Injectable()
export class MockRealtimeService extends RealtimeService {
  private readonly backend = inject(MockBackend);
  private readonly connection = signal<ConnectionState>('disconnected');
  private connectTimer: ReturnType<typeof setTimeout> | undefined;

  readonly state = this.connection.asReadonly();

  readonly telemetry$: Observable<DeviceStatus> = this.backend.telemetry$.pipe(
    map((r) => ApiMappers.reading(r)),
    share(),
  );
  readonly config$: Observable<IrrigationConfig> = this.backend.config$.pipe(map(ApiMappers.config), share());
  readonly analysis$: Observable<Analysis> = this.backend.analysis$.pipe(map(ApiMappers.analysis), share());
  readonly deviceStatus$: Observable<DeviceStatusEvent> = this.backend.deviceStatus$.pipe(
    map(ApiMappers.deviceStatus),
    share(),
  );

  connect(): void {
    if (this.connection() !== 'disconnected') return;
    this.connection.set('connecting');
    this.connectTimer = setTimeout(() => {
      this.connection.set('connected');
      this.backend.start();
    }, 600);
  }

  disconnect(): void {
    clearTimeout(this.connectTimer);
    this.connection.set('disconnected');
  }
}
