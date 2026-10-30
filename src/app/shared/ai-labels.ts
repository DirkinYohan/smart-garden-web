import { ActionType, HealthStatus, NextAction, Priority, RecommendationCategory } from '../models/garden.models';

export interface LabelUi {
  labelKey: string;
  icon: string;
  tone: Tone;
}

export type Tone = 'good' | 'warn' | 'bad' | 'water' | 'neutral';

export const HEALTH_UI: Record<HealthStatus, LabelUi> = {
  GOOD: { labelKey: 'health.GOOD', icon: 'check_circle', tone: 'good' },
  ATTENTION: { labelKey: 'health.ATTENTION', icon: 'warning', tone: 'warn' },
  CRITICAL: { labelKey: 'health.CRITICAL', icon: 'error', tone: 'bad' },
};

export const NEXT_ACTION_UI: Record<NextAction, LabelUi> = {
  IRRIGATE_NOW: { labelKey: 'next.IRRIGATE_NOW', icon: 'water_drop', tone: 'water' },
  WAIT: { labelKey: 'next.WAIT', icon: 'hourglass_empty', tone: 'good' },
  PAUSED_FOR_RAIN: { labelKey: 'next.PAUSED_FOR_RAIN', icon: 'rainy', tone: 'water' },
  CHECK_SENSOR: { labelKey: 'next.CHECK_SENSOR', icon: 'sensors_off', tone: 'bad' },
};

export const CATEGORY_UI: Record<RecommendationCategory, { labelKey: string; icon: string }> = {
  IRRIGATION: { labelKey: 'category.IRRIGATION', icon: 'water_drop' },
  WEATHER: { labelKey: 'category.WEATHER', icon: 'cloud' },
  SENSOR: { labelKey: 'category.SENSOR', icon: 'sensors' },
  CROP: { labelKey: 'category.CROP', icon: 'eco' },
};

export const PRIORITY_UI: Record<Priority, { labelKey: string; tone: Tone; order: number }> = {
  HIGH: { labelKey: 'priority.HIGH', tone: 'bad', order: 0 },
  MEDIUM: { labelKey: 'priority.MEDIUM', tone: 'warn', order: 1 },
  LOW: { labelKey: 'priority.LOW', tone: 'neutral', order: 2 },
};

export const ACTION_CONFIRM_KEY: Record<Exclude<ActionType, 'CHECK_SENSOR'>, string> = {
  APPLY_THRESHOLDS: 'action.confirm.APPLY_THRESHOLDS',
  ENABLE_AI_MODE: 'action.confirm.ENABLE_AI_MODE',
  DISABLE_RAIN_PAUSE: 'action.confirm.DISABLE_RAIN_PAUSE',
  ENABLE_RAIN_PAUSE: 'action.confirm.ENABLE_RAIN_PAUSE',
};
