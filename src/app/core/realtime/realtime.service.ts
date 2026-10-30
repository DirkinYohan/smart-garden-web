import { Signal } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Analysis,
  ConnectionState,
  DeviceStatus,
  DeviceStatusEvent,
  IrrigationConfig,
} from '../../models/garden.models';

export abstract class RealtimeService {
  abstract readonly state: Signal<ConnectionState>;

  abstract readonly telemetry$: Observable<DeviceStatus>;

  abstract readonly config$: Observable<IrrigationConfig>;

  abstract readonly analysis$: Observable<Analysis>;

  abstract readonly deviceStatus$: Observable<DeviceStatusEvent>;

  abstract connect(): void;
  abstract disconnect(): void;
}
