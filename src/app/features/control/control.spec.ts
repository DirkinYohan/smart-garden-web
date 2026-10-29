import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { GardenApi } from '../../core/api/garden-api';
import { NotificationService } from '../../core/notification.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { GardenStore } from '../../core/state/garden-store';
import { CropProfile, IrrigationConfig } from '../../models/garden.models';
import { Control } from './control';

const CROPS: CropProfile[] = [
  { id: 2, name: 'Tomate', minMoisture: 40, maxMoisture: 70, description: '' },
  { id: 3, name: 'Lechuga', minMoisture: 50, maxMoisture: 80, description: '' },
  { id: 4, name: 'Cilantro', minMoisture: 45, maxMoisture: 75, description: '' },
];

function config(overrides: Partial<IrrigationConfig> = {}): IrrigationConfig {
  return {
    mode: 'AUTO',
    cropId: 4,
    minMoisture: 45,
    maxMoisture: 75,
    rainPause: false,
    aiEnabled: true,
    updatedAt: '2026-10-28T12:00:00Z',
    updatedBy: 'USER',
    ...overrides,
  };
}

describe('Control · umbrales por cultivo', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<Control>>;
  let component: Control;
  let store: GardenStore;
  let notify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  let pendingUpdate: Subject<IrrigationConfig>;

  const draftMin = () => (component as unknown as { draftMin: () => number }).draftMin();
  const draftMax = () => (component as unknown as { draftMax: () => number }).draftMax();
  const isAi = () => (component as unknown as { isAi: () => boolean }).isAi();

  beforeEach(() => {
    pendingUpdate = new Subject<IrrigationConfig>();
    notify = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    const api = {
      updateConfig: vi.fn(() => pendingUpdate.asObservable()),
      updateCrop: vi.fn(() => of(CROPS[0])),
      startPump: vi.fn(() => of({ accepted: true, message: 'ok' })),
      stopPump: vi.fn(() => of({ accepted: true, message: 'ok' })),
    } as unknown as GardenApi;
    const realtime = {
      state: signal('connected'),
      telemetry$: new Subject(),
      config$: new Subject(),
      analysis$: new Subject(),
      deviceStatus$: new Subject(),
      connect: () => undefined,
      disconnect: () => undefined,
    } as unknown as RealtimeService;

    TestBed.configureTestingModule({
      imports: [Control],
      providers: [
        { provide: GardenApi, useValue: api },
        { provide: RealtimeService, useValue: realtime },
        { provide: NotificationService, useValue: notify },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(false) }) } },
      ],
    });

    store = TestBed.inject(GardenStore);
    store.setCrops(CROPS);
    store.setConfig(config());

    fixture = TestBed.createComponent(Control);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('moves the sliders to the new crop range as soon as the crop changes', () => {
    expect([draftMin(), draftMax()]).toEqual([45, 75]);

    (component as unknown as { setCrop: (id: number) => void }).setCrop(3);

    // Antes incluso de que el backend confirme
    expect([draftMin(), draftMax()]).toEqual([50, 80]);

    // Y al confirmar, se anuncia el rango aplicado
    pendingUpdate.next(config({ cropId: 3, minMoisture: 50, maxMoisture: 80 }));
    fixture.detectChanges();

    expect([draftMin(), draftMax()]).toEqual([50, 80]);
    expect(notify.success).toHaveBeenCalledWith('Cultivo Lechuga: umbrales 50–80 % aplicados');
  });

  it('shows the recommended range of the selected crop', () => {
    const hint = fixture.nativeElement.querySelector('.crop-range') as HTMLElement;

    expect(hint.textContent).toContain('Rango recomendado para Cilantro: 45–75 %');
  });

  it('follows a threshold adjustment made by the AI and announces it', () => {
    store.setConfig(config({ minMoisture: 42, maxMoisture: 68, updatedBy: 'AI' }));
    fixture.detectChanges();

    expect([draftMin(), draftMax()]).toEqual([42, 68]);
    expect(notify.info).toHaveBeenCalledWith('La IA ajustó los umbrales a 42–68 %');
  });

  it('locks the sliders in AI mode with an explanatory note', () => {
    store.setConfig(config({ mode: 'AI' }));
    fixture.detectChanges();

    expect(isAi()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      'Los umbrales los ajusta la IA dentro del rango del cultivo',
    );
  });
});
