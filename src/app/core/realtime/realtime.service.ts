import { Signal } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Analysis,
  ConnectionState,
  DeviceStatus,
  DeviceStatusEvent,
  IrrigationConfig,
} from '../../models/garden.models';

/**
 * Real-time updates (STOMP topics of the api-gateway). Implemented by StompRealtimeService and
 * MockRealtimeService.
 */
export abstract class RealtimeService {
  abstract readonly state: Signal<ConnectionState>;
  /** /topic/telemetry */
  abstract readonly telemetry$: Observable<DeviceStatus>;
  /** /topic/config */
  abstract readonly config$: Observable<IrrigationConfig>;
  /** /topic/analysis */
  abstract readonly analysis$: Observable<Analysis>;
  /** /topic/device-status */
  abstract readonly deviceStatus$: Observable<DeviceStatusEvent>;

  abstract connect(): void;
  abstract disconnect(): void;
}
