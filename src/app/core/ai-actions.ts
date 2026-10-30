import { Injectable, inject } from '@angular/core';
import { I18nService } from './i18n/i18n.service';
import { MatDialog } from '@angular/material/dialog';
import { Observable, filter, map, of, switchMap } from 'rxjs';
import { ActionType, Analysis, ConfigUpdate, IrrigationConfig, RecommendationDetail } from '../models/garden.models';
import { ACTION_CONFIRM_KEY } from '../shared/ai-labels';
import { ConfirmDialog, ConfirmDialogData } from '../shared/confirm-dialog';
import { SensorHelpDialog } from '../shared/sensor-help-dialog';
import { GardenApi } from './api/garden-api';
import { NotificationService } from './notification.service';
import { GardenStore } from './state/garden-store';

export function configUpdateForAction(type: ActionType, analysis: Analysis): ConfigUpdate | null {
  switch (type) {
    case 'APPLY_THRESHOLDS':
      return { minMoisture: analysis.recommendedMin, maxMoisture: analysis.recommendedMax };
    case 'ENABLE_AI_MODE':
      return { mode: 'AI' };
    case 'DISABLE_RAIN_PAUSE':
      return { rainPause: false };
    case 'ENABLE_RAIN_PAUSE':
      return { rainPause: true };
    case 'CHECK_SENSOR':
      return null;
  }
}

export function isActionStillUseful(type: ActionType, analysis: Analysis, config: IrrigationConfig | null): boolean {
  if (!config) return true;
  switch (type) {
    case 'APPLY_THRESHOLDS':
      return (
        config.mode !== 'AI' &&
        (config.minMoisture !== analysis.recommendedMin || config.maxMoisture !== analysis.recommendedMax)
      );
    case 'ENABLE_AI_MODE':
      return config.mode !== 'AI';
    case 'ENABLE_RAIN_PAUSE':
      return !config.rainPause;
    case 'DISABLE_RAIN_PAUSE':
      return config.rainPause;
    case 'CHECK_SENSOR':
      return true;
  }
}

const SUCCESS: Record<Exclude<ActionType, 'CHECK_SENSOR'>, string> = {
  APPLY_THRESHOLDS: 'Umbrales recomendados aplicados',
  ENABLE_AI_MODE: 'Modo IA activado',
  DISABLE_RAIN_PAUSE: 'Pausa por lluvia desactivada',
  ENABLE_RAIN_PAUSE: 'Pausa por lluvia activada',
};

@Injectable({ providedIn: 'root' })
export class AiActions {
  private readonly i18n = inject(I18nService);

  private readonly api = inject(GardenApi);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotificationService);
  private readonly store = inject(GardenStore);

  run(detail: RecommendationDetail, analysis: Analysis): Observable<boolean> {
    const type = detail.action?.type;
    if (!type) return of(false);
    if (type === 'CHECK_SENSOR') {
      this.dialog.open(SensorHelpDialog, { maxWidth: '95vw', width: '480px' });
      return of(false);
    }
    const update = configUpdateForAction(type, analysis);
    if (!update) return of(false);
    const extra =
      type === 'APPLY_THRESHOLDS' ? ` Nuevo rango: ${analysis.recommendedMin}–${analysis.recommendedMax} %.` : '';
    return this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
        data: { title: detail.action!.label, message: this.i18n.t(ACTION_CONFIRM_KEY[type]) + extra, confirmText: 'Aplicar' },
      })
      .afterClosed()
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.updateConfig(update)),
        map((config) => {
          this.store.setConfig(config);
          this.notify.success(SUCCESS[type]);
          return true;
        }),
      );
  }
}
