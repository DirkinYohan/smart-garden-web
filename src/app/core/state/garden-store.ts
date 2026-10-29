import { Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { Observable, Subscription, catchError, interval, of } from 'rxjs';
import {
  Analysis,
  CropProfile,
  DeviceStatus,
  IrrigationConfig,
  Weather,
} from '../../models/garden.models';
import { GardenApi } from '../api/garden-api';
import { RealtimeService } from '../realtime/realtime.service';

/** Async slice: value + loading + error flag, for the loading / empty / error states of the UI. */
export interface Slice<T> {
  value: T | null;
  loading: boolean;
  error: boolean;
}

export interface LiveSample {
  time: number;
  moisture: number;
}

const OFFLINE_AFTER_MS = 30_000;
const LIVE_WINDOW_MS = 3 * 3600_000;

function slice<T>(): Slice<T> {
  return { value: null, loading: false, error: false };
}

/**
 * Shared application state (signals): initial REST load + live updates from the STOMP topics.
 * Started by the shell after login and stopped on logout.
 */
@Injectable({ providedIn: 'root' })
export class GardenStore {
  private readonly api = inject(GardenApi);
  private readonly realtime = inject(RealtimeService);
  private subscriptions = new Subscription();
  private started = false;

  readonly status = signal<Slice<DeviceStatus>>(slice());
  readonly config = signal<Slice<IrrigationConfig>>(slice());
  readonly crops = signal<Slice<CropProfile[]>>(slice());
  readonly latestAnalysis = signal<Slice<Analysis>>(slice());
  readonly weather = signal<Slice<Weather>>(slice());
  /** Readings of the last hours for the live mini chart. */
  readonly liveSamples = signal<LiveSample[]>([]);
  /** Analyses received over WebSocket (newest first) so the AI page can prepend them. */
  readonly analysisFeed = signal<Analysis[]>([]);
  /** Ticks every second to refresh relative times ("hace 12 s"). */
  readonly now = signal(Date.now());

  readonly connection = this.realtime.state;

  readonly currentCrop = computed(() => {
    const cropId = this.config().value?.cropId;
    return this.crops().value?.find((c) => c.id === cropId) ?? null;
  });

  /** Nombre del cultivo vigente en la configuración (/config + /topic/config), nunca el del último análisis. */
  readonly currentCropName = computed(() => this.currentCrop()?.name ?? null);

  /**
   * True cuando el último análisis se hizo con otro cultivo que el actual. En ese caso la UI muestra
   * "Actualizando análisis para <cultivo>…" en lugar del texto viejo.
   */
  readonly analysisMatchesCrop = computed(() => {
    const analysis = this.latestAnalysis().value;
    const cropId = this.config().value?.cropId ?? null;
    if (!analysis) return true;
    if (cropId === null) return true;
    const analysisCropId = analysis.inputSnapshot?.cropId ?? null;
    if (analysisCropId !== null) return analysisCropId === cropId;
    // Análisis anterior a v1.2 (sin cropId): se compara por nombre.
    const name = this.currentCrop()?.name ?? null;
    const analysedName = analysis.inputSnapshot?.cropName ?? null;
    return !name || !analysedName || name === analysedName;
  });

  /** Online per backend and with a recent reading (the backend timeout is also 30 s). */
  readonly deviceOnline = computed(() => {
    const s = this.status().value;
    if (!s?.deviceOnline || !s.timestamp) return false;
    return this.now() - Date.parse(s.timestamp) <= OFFLINE_AFTER_MS + 5000;
  });

  readonly secondsSinceLastReading = computed(() => {
    const ts = this.status().value?.timestamp;
    return ts ? Math.max(0, Math.round((this.now() - Date.parse(ts)) / 1000)) : null;
  });

  start(): void {
    if (this.started) return;
    this.started = true;
    this.subscriptions = new Subscription();
    this.realtime.connect();
    this.reload();

    this.subscriptions.add(
      this.realtime.telemetry$.subscribe((reading) => {
        this.status.set({ value: reading, loading: false, error: false });
        this.pushSample(reading);
      }),
    );
    this.subscriptions.add(
      this.realtime.deviceStatus$.subscribe((e) =>
        this.status.update((s) =>
          s.value ? { ...s, value: { ...s.value, deviceOnline: e.deviceOnline } } : s,
        ),
      ),
    );
    this.subscriptions.add(
      this.realtime.config$.subscribe((c) => this.config.set({ value: c, loading: false, error: false })),
    );
    this.subscriptions.add(
      this.realtime.analysis$.subscribe((a) => {
        this.latestAnalysis.set({ value: a, loading: false, error: false });
        this.analysisFeed.update((list) => [a, ...list.filter((x) => x.id !== a.id)]);
      }),
    );
    this.subscriptions.add(interval(1000).subscribe(() => this.now.set(Date.now())));
    this.subscriptions.add(interval(10 * 60_000).subscribe(() => this.loadWeather()));
  }

  stop(): void {
    this.started = false;
    this.subscriptions.unsubscribe();
    this.realtime.disconnect();
    this.status.set(slice());
    this.config.set(slice());
    this.crops.set(slice());
    this.latestAnalysis.set(slice());
    this.weather.set(slice());
    this.liveSamples.set([]);
    this.analysisFeed.set([]);
  }

  /** (Re)loads every slice from the REST API. */
  reload(): void {
    this.load(this.status, this.api.getStatus());
    this.load(this.config, this.api.getConfig());
    this.load(this.crops, this.api.getCrops());
    this.load(this.latestAnalysis, this.api.getLatestAnalysis());
    this.loadWeather();
    this.api
      .getHistory('24h')
      .pipe(catchError(() => of([])))
      .subscribe((points) => {
        const since = Date.now() - LIVE_WINDOW_MS;
        const seeded = points
          .map((p) => ({ time: Date.parse(p.timestamp), moisture: p.avgMoisture }))
          .filter((p) => p.time >= since);
        this.liveSamples.update((live) => [...seeded, ...live.filter((l) => l.time > (seeded.at(-1)?.time ?? 0))]);
      });
  }

  loadWeather(): void {
    this.load(this.weather, this.api.getWeather());
  }

  /** Applies a config returned by PUT /config without waiting for the WebSocket echo. */
  setConfig(config: IrrigationConfig): void {
    this.config.set({ value: config, loading: false, error: false });
  }

  setCrops(crops: CropProfile[]): void {
    this.crops.set({ value: crops, loading: false, error: false });
  }

  private pushSample(reading: DeviceStatus): void {
    if (!reading.timestamp) return;
    const time = Date.parse(reading.timestamp);
    const since = time - LIVE_WINDOW_MS;
    this.liveSamples.update((list) => [...list.filter((s) => s.time >= since), { time, moisture: reading.moisture }]);
  }

  private load<T>(target: WritableSignal<Slice<T>>, source: Observable<T | null>): void {
    target.update((s) => ({ ...s, loading: true, error: false }));
    source.subscribe({
      next: (value) => target.set({ value, loading: false, error: false }),
      error: () => target.update((s) => ({ ...s, loading: false, error: true })),
    });
  }
}
