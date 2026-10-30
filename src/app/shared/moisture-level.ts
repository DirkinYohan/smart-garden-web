import { MoistureLevel } from '../models/garden.models';

export interface MoistureLevelUi {

  label: string;

  labelKey: string;
  icon: string;

  tone: 'good' | 'warn' | 'bad' | 'water' | 'deep' | 'neutral';

  color: string;
}

export const MOISTURE_LEVELS: readonly MoistureLevel[] = [
  'SENSOR_ERROR',
  'VERY_DRY',
  'DRY',
  'OPTIMAL',
  'WET',
  'SATURATED',
];

export const MOISTURE_LEVEL_UI: Record<MoistureLevel, MoistureLevelUi> = {
  VERY_DRY: {
    label: 'Muy seca',
    labelKey: 'level.VERY_DRY',
    icon: 'local_fire_department',
    tone: 'bad',
    color: 'var(--sg-dry)',
  },
  DRY: { label: 'Baja', labelKey: 'level.DRY', icon: 'water_drop', tone: 'warn', color: 'var(--sg-warn)' },
  OPTIMAL: { label: 'Ideal', labelKey: 'level.OPTIMAL', icon: 'check_circle', tone: 'good', color: 'var(--sg-ok)' },
  WET: { label: 'Alta', labelKey: 'level.WET', icon: 'water', tone: 'water', color: 'var(--sg-wet)' },
  SATURATED: {
    label: 'Saturada',
    labelKey: 'level.SATURATED',
    icon: 'water_damage',
    tone: 'deep',
    color: 'var(--sg-saturated)',
  },
  SENSOR_ERROR: {
    label: 'Error de sensor',
    labelKey: 'level.SENSOR_ERROR',
    icon: 'sensors_off',
    tone: 'neutral',
    color: 'var(--mat-sys-on-surface-variant)',
  },
};

export const VERY_DRY_MARGIN = 10;

export const SATURATED_MARGIN = 15;

export const SATURATED_FLOOR = 95;

export const DEFAULT_MIN = 30;
export const DEFAULT_MAX = 70;

export function classifyMoisture(
  moisture: number | null | undefined,
  min: number,
  max: number,
  sensorOk = true,
): MoistureLevel {
  if (!sensorOk || moisture === null || moisture === undefined || !Number.isFinite(moisture)) {
    return 'SENSOR_ERROR';
  }
  let lo = Math.min(min, max);
  let hi = Math.max(min, max);
  if (hi <= 0) {
    lo = DEFAULT_MIN;
    hi = DEFAULT_MAX;
  }
  if (moisture >= SATURATED_FLOOR || moisture > hi + SATURATED_MARGIN) return 'SATURATED';
  if (moisture > hi) return 'WET';
  if (moisture >= lo) return 'OPTIMAL';
  if (moisture >= lo - VERY_DRY_MARGIN) return 'DRY';
  return 'VERY_DRY';
}

export function moistureLevelUi(level: MoistureLevel | null | undefined): MoistureLevelUi {
  return MOISTURE_LEVEL_UI[level ?? 'SENSOR_ERROR'];
}
