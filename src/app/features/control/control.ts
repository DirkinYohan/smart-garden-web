import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, switchMap } from 'rxjs';
import { GardenApi } from '../../core/api/garden-api';
import { NotificationService } from '../../core/notification.service';
import { GardenStore } from '../../core/state/garden-store';
import { ConfigUpdate, CropProfile, CropProfileInput, IrrigationMode } from '../../models/garden.models';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog';
import { MODE_ICONS } from '../../shared/labels';
import { ErrorState, Loading } from '../../shared/state-views';
import { CropDialog } from './crop-dialog';

const MIN_GAP = 10;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-control',
  imports: [
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatSelectModule,
    MatSliderModule,
    MatSlideToggleModule,
    MatIconModule,
    MatListModule,
    MatDialogModule,
    MatProgressBarModule,
    MatTooltipModule,
    ErrorState,
    Loading,
  ],
  templateUrl: './control.html',
  styleUrl: './control.scss',
})
export class Control {
  protected readonly i18n = inject(I18nService);

  protected readonly store = inject(GardenStore);
  private readonly api = inject(GardenApi);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

  protected readonly modes: { value: IrrigationMode; descriptionKey: string }[] = [
    { value: 'AUTO', descriptionKey: 'ctrl.mode.AUTO.desc' },
    { value: 'MANUAL', descriptionKey: 'ctrl.mode.MANUAL.desc' },
    { value: 'AI', descriptionKey: 'ctrl.mode.AI.desc' },
  ];
  protected readonly modeLabel = (m: IrrigationMode) => this.i18n.modeLabel(m);
  protected readonly modeIcons = MODE_ICONS;

  protected readonly config = computed(() => this.store.config().value);
  protected readonly crops = computed(() => this.store.crops().value ?? []);
  protected readonly saving = signal(false);

  // Threshold sliders: local draft synced from the config until the user edits it.
  protected readonly draftMin = signal(30);
  protected readonly draftMax = signal(70);
  protected readonly thresholdsDirty = signal(false);
  /** Brief highlight after the crop (or the AI) moves the range. */
  protected readonly rangePulse = signal(false);
  protected readonly gapInvalid = computed(() => this.draftMax() - this.draftMin() < MIN_GAP);
  protected readonly isAi = computed(() => this.config()?.mode === 'AI');
  protected readonly isManual = computed(() => this.config()?.mode === 'MANUAL');

  /** "Rango recomendado para Tomate: 40–70 %" del cultivo seleccionado en Control. */
  protected readonly cropRangeHint = computed(() => {
    const crop = this.cropById(this.config()?.cropId);
    return crop
      ? this.i18n.t('ctrl.recommendedRange', { crop: crop.name, min: crop.minMoisture, max: crop.maxMoisture })
      : null;
  });

  // Manual irrigation
  protected readonly duration = signal(30);
  private readonly wateringUntil = signal<number | null>(null);
  protected readonly pumpBusy = signal(false);
  protected readonly remaining = computed(() => {
    const until = this.wateringUntil();
    return until ? Math.max(0, Math.ceil((until - this.store.now()) / 1000)) : 0;
  });
  protected readonly pumpOn = computed(() => this.store.status().value?.pumpOn ?? false);
  protected readonly wateringProgress = computed(() => {
    const until = this.wateringUntil();
    return until ? 100 - (this.remaining() / this.wateringTotal) * 100 : 0;
  });
  private wateringTotal = 30;

  private lastConfig: { min: number; max: number; updatedBy?: string; cropId: number | null } | null = null;

  constructor() {
    // The sliders follow the confirmed config. An adjustment made by the AI always wins, even if the user had
    // unsaved changes, and is announced with a snackbar.
    effect(() => {
      const c = this.config();
      if (!c) return;
      const previous = untracked(() => this.lastConfig);
      this.lastConfig = { min: c.minMoisture, max: c.maxMoisture, updatedBy: c.updatedBy, cropId: c.cropId };
      const aiAdjusted =
        !!previous && c.updatedBy === 'AI' && (previous.min !== c.minMoisture || previous.max !== c.maxMoisture);
      if (aiAdjusted) untracked(() => this.thresholdsDirty.set(false));
      if (aiAdjusted || !untracked(this.thresholdsDirty)) {
        this.draftMin.set(c.minMoisture);
        this.draftMax.set(c.maxMoisture);
      }
      if (aiAdjusted) {
        untracked(() => this.notify.info(`La IA ajustó los umbrales a ${c.minMoisture}–${c.maxMoisture} %`));
      }
      if (previous && previous.cropId !== c.cropId) untracked(() => this.pulseRange());
    });
    // Countdown ends: forget it once the time is over.
    effect(() => {
      if (this.wateringUntil() !== null && this.remaining() === 0) {
        untracked(() => this.wateringUntil.set(null));
      }
    });
  }

  protected cropById(id: number | null | undefined): CropProfile | undefined {
    return this.crops().find((c) => c.id === id);
  }

  protected setMode(mode: IrrigationMode): void {
    if (mode === this.config()?.mode) return;
    this.update({ mode }, this.i18n.t('ctrl.snack.mode', { mode: this.i18n.modeLabel(mode) }));
  }

  /** Changing crop moves the sliders to the new range immediately (the backend applies it in every mode). */
  protected setCrop(cropId: number): void {
    const crop = this.cropById(cropId);
    if (crop) {
      this.draftMin.set(crop.minMoisture);
      this.draftMax.set(crop.maxMoisture);
      this.thresholdsDirty.set(false);
      this.pulseRange();
    }
    this.update(
      { cropId },
      crop
        ? this.i18n.t('ctrl.snack.crop', { crop: crop.name, min: crop.minMoisture, max: crop.maxMoisture })
        : this.i18n.t('ctrl.snack.cropChanged'),
    );
  }

  protected onThresholdInput(which: 'min' | 'max', value: number): void {
    (which === 'min' ? this.draftMin : this.draftMax).set(value);
    this.thresholdsDirty.set(true);
  }

  protected saveThresholds(): void {
    if (this.gapInvalid()) return;
    this.update({ minMoisture: this.draftMin(), maxMoisture: this.draftMax() }, this.i18n.t('ctrl.snack.thresholds'), () =>
      this.thresholdsDirty.set(false),
    );
  }

  protected resetThresholds(): void {
    this.thresholdsDirty.set(false);
    const c = this.config();
    if (c) {
      this.draftMin.set(c.minMoisture);
      this.draftMax.set(c.maxMoisture);
    }
  }

  protected setRainPause(rainPause: boolean): void {
    this.update({ rainPause }, this.i18n.t(rainPause ? 'ctrl.snack.rainOn' : 'ctrl.snack.rainOff'));
  }

  protected setAiEnabled(aiEnabled: boolean): void {
    this.update({ aiEnabled }, this.i18n.t(aiEnabled ? 'ctrl.snack.aiOn' : 'ctrl.snack.aiOff'));
  }

  protected startWatering(): void {
    const seconds = this.duration();
    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
        data: {
          title: this.i18n.t('ctrl.confirmWaterTitle'),
          message: this.i18n.t('ctrl.confirmWater', { seconds }),
          confirmText: this.i18n.t('ctrl.confirmWaterOk'),
        },
      })
      .afterClosed()
      .pipe(
        filter(Boolean),
        switchMap(() => {
          this.pumpBusy.set(true);
          return this.api.startPump(seconds);
        }),
      )
      .subscribe({
        next: (res) => {
          this.pumpBusy.set(false);
          this.wateringTotal = seconds;
          this.wateringUntil.set(Date.now() + seconds * 1000);
          this.notify.success(res.message);
        },
        error: () => this.pumpBusy.set(false),
      });
  }

  protected stopWatering(): void {
    this.pumpBusy.set(true);
    this.api.stopPump().subscribe({
      next: (res) => {
        this.pumpBusy.set(false);
        this.wateringUntil.set(null);
        this.notify.success(res.message);
      },
      error: () => this.pumpBusy.set(false),
    });
  }

  protected editCrop(crop: CropProfile): void {
    this.dialog
      .open<CropDialog, CropProfile, CropProfileInput>(CropDialog, { data: crop, width: '480px', maxWidth: '95vw' })
      .afterClosed()
      .pipe(
        filter((v): v is CropProfileInput => !!v),
        switchMap((input) => this.api.updateCrop(crop.id, input)),
      )
      .subscribe((saved) => {
        this.store.setCrops(this.crops().map((c) => (c.id === saved.id ? saved : c)));
        this.notify.success(this.i18n.t('ctrl.snack.profileSaved', { name: saved.name }));
      });
  }

  private pulseRange(): void {
    this.rangePulse.set(true);
    setTimeout(() => this.rangePulse.set(false), 1200);
  }

  private update(change: ConfigUpdate, successMessage: string, after?: () => void): void {
    this.saving.set(true);
    this.api.updateConfig(change).subscribe({
      next: (config) => {
        this.saving.set(false);
        this.store.setConfig(config);
        after?.();
        this.notify.success(successMessage);
      },
      // The error interceptor shows the message; the UI keeps the last confirmed config.
      error: () => {
        this.saving.set(false);
        this.store.setConfig({ ...this.config()! });
      },
    });
  }
}
