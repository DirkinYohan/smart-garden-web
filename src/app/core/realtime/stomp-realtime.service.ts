import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { RxStomp, RxStompState } from '@stomp/rx-stomp';
import { Observable, map, share } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AnalysisDto,
  ConfigDto,
  DeviceStatusDto,
  TelemetryReadingDto,
} from '../../models/api.models';
import {
  Analysis,
  ConnectionState,
  DeviceStatus,
  DeviceStatusEvent,
  IrrigationConfig,
} from '../../models/garden.models';
import { ApiMappers } from '../api/api-mappers';
import { AuthService } from '../auth/auth.service';
import { RealtimeService } from './realtime.service';

@Injectable()
export class StompRealtimeService extends RealtimeService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly rxStomp = new RxStomp();
  private readonly connection = signal<ConnectionState>('disconnected');
  private active = false;

  readonly state = this.connection.asReadonly();

  readonly telemetry$: Observable<DeviceStatus> = this.watch<TelemetryReadingDto, DeviceStatus>(
    '/topic/telemetry',
    (r) => ApiMappers.reading(r),
  );
  readonly config$: Observable<IrrigationConfig> = this.watch<ConfigDto, IrrigationConfig>(
    '/topic/config',
    ApiMappers.config,
  );
  readonly analysis$: Observable<Analysis> = this.watch<AnalysisDto, Analysis>(
    '/topic/analysis',
    ApiMappers.analysis,
  );
  readonly deviceStatus$: Observable<DeviceStatusEvent> = this.watch<DeviceStatusDto, DeviceStatusEvent>(
    '/topic/device-status',
    ApiMappers.deviceStatus,
  );

  constructor() {
    super();
    this.rxStomp.connectionState$.subscribe((s) => {
      if (!this.active) {
        this.connection.set('disconnected');
      } else {
        this.connection.set(s === RxStompState.OPEN ? 'connected' : 'connecting');
      }
    });
    this.rxStomp.stompErrors$.subscribe((frame) => {
      console.warn('STOMP error:', frame.headers['message']);
    });
  }

  connect(): void {
    if (this.active) return;
    this.active = true;
    this.connection.set('connecting');
    this.rxStomp.configure({
      brokerURL: environment.wsUrl,
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      beforeConnect: (client) => {
        const token = this.auth.validToken();
        if (!token) {
          void this.disconnect();
          return;
        }
        client.configure({ connectHeaders: { Authorization: `Bearer ${token}` } });
      },
    });
    this.rxStomp.activate();
  }

  disconnect(): void {
    if (!this.active) return;
    this.active = false;
    this.connection.set('disconnected');
    void this.rxStomp.deactivate();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private watch<D, M>(topic: string, mapper: (dto: D) => M): Observable<M> {
    return this.rxStomp.watch(topic).pipe(
      map((message) => mapper(JSON.parse(message.body) as D)),
      share(),
    );
  }
}
