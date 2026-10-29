import { Analysis, IrrigationConfig } from '../models/garden.models';
import { configUpdateForAction, isActionStillUseful } from './ai-actions';

const analysis = { recommendedMin: 45, recommendedMax: 75 } as Analysis;

const config = (patch: Partial<IrrigationConfig> = {}): IrrigationConfig => ({
  mode: 'AUTO',
  cropId: 1,
  minMoisture: 40,
  maxMoisture: 70,
  rainPause: false,
  aiEnabled: true,
  ...patch,
});

describe('AI recommendation actions', () => {
  it('builds the PUT /config body of each action', () => {
    expect(configUpdateForAction('APPLY_THRESHOLDS', analysis)).toEqual({ minMoisture: 45, maxMoisture: 75 });
    expect(configUpdateForAction('ENABLE_AI_MODE', analysis)).toEqual({ mode: 'AI' });
    expect(configUpdateForAction('ENABLE_RAIN_PAUSE', analysis)).toEqual({ rainPause: true });
    expect(configUpdateForAction('DISABLE_RAIN_PAUSE', analysis)).toEqual({ rainPause: false });
    expect(configUpdateForAction('CHECK_SENSOR', analysis)).toBeNull();
  });

  it('keeps every action while the configuration is unknown', () => {
    expect(isActionStillUseful('APPLY_THRESHOLDS', analysis, null)).toBe(true);
    expect(isActionStillUseful('DISABLE_RAIN_PAUSE', analysis, null)).toBe(true);
  });

  it('hides APPLY_THRESHOLDS once applied or when the AI already manages them', () => {
    expect(isActionStillUseful('APPLY_THRESHOLDS', analysis, config())).toBe(true);
    expect(isActionStillUseful('APPLY_THRESHOLDS', analysis, config({ minMoisture: 45, maxMoisture: 75 }))).toBe(false);
    expect(isActionStillUseful('APPLY_THRESHOLDS', analysis, config({ mode: 'AI' }))).toBe(false);
  });

  it('hides mode and rain-pause actions that are already in place', () => {
    expect(isActionStillUseful('ENABLE_AI_MODE', analysis, config())).toBe(true);
    expect(isActionStillUseful('ENABLE_AI_MODE', analysis, config({ mode: 'AI' }))).toBe(false);
    expect(isActionStillUseful('ENABLE_RAIN_PAUSE', analysis, config({ rainPause: true }))).toBe(false);
    expect(isActionStillUseful('DISABLE_RAIN_PAUSE', analysis, config({ rainPause: true }))).toBe(true);
    expect(isActionStillUseful('DISABLE_RAIN_PAUSE', analysis, config())).toBe(false);
  });

  it('always keeps CHECK_SENSOR', () => {
    expect(isActionStillUseful('CHECK_SENSOR', analysis, config())).toBe(true);
  });
});
