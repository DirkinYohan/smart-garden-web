import { classifyMoisture, MOISTURE_LEVELS, MOISTURE_LEVEL_UI } from './moisture-level';

describe('classifyMoisture', () => {
  const MIN = 45;
  const MAX = 75;

  it('classifies very dry below min - 10', () => {
    expect(classifyMoisture(34, MIN, MAX)).toBe('VERY_DRY');
    expect(classifyMoisture(0, MIN, MAX)).toBe('VERY_DRY');
  });

  it('classifies dry between min - 10 and min', () => {
    expect(classifyMoisture(35, MIN, MAX)).toBe('DRY');
    expect(classifyMoisture(44, MIN, MAX)).toBe('DRY');
  });

  it('classifies optimal inside the range, edges included', () => {
    expect(classifyMoisture(45, MIN, MAX)).toBe('OPTIMAL');
    expect(classifyMoisture(60, MIN, MAX)).toBe('OPTIMAL');
    expect(classifyMoisture(75, MIN, MAX)).toBe('OPTIMAL');
  });

  it('classifies wet up to max + 15', () => {
    expect(classifyMoisture(76, MIN, MAX)).toBe('WET');
    expect(classifyMoisture(80, MIN, MAX)).toBe('WET');
    expect(classifyMoisture(86, MIN, MAX)).toBe('WET');
    expect(classifyMoisture(90, MIN, MAX)).toBe('WET');
  });

  it('classifies saturated above max + 15 or from 95 %', () => {
    expect(classifyMoisture(91, MIN, MAX)).toBe('SATURATED');
    expect(classifyMoisture(95, MIN, MAX)).toBe('SATURATED');
    expect(classifyMoisture(99, MIN, MAX)).toBe('SATURATED');
  });

  it('reports a sensor error instead of inventing a value', () => {
    expect(classifyMoisture(null, MIN, MAX)).toBe('SENSOR_ERROR');
    expect(classifyMoisture(undefined, MIN, MAX)).toBe('SENSOR_ERROR');
    expect(classifyMoisture(60, MIN, MAX, false)).toBe('SENSOR_ERROR');
  });

  it('depends on the crop range', () => {
    expect(classifyMoisture(80, 45, 75)).toBe('WET');
    expect(classifyMoisture(80, 70, 85)).toBe('OPTIMAL');
  });

  it('labels and tones are defined for the six levels', () => {
    expect(MOISTURE_LEVELS).toHaveLength(6);
    for (const level of MOISTURE_LEVELS) {
      expect(MOISTURE_LEVEL_UI[level].label).toBeTruthy();
      expect(MOISTURE_LEVEL_UI[level].icon).toBeTruthy();
    }
    expect(MOISTURE_LEVEL_UI.VERY_DRY.tone).toBe('bad');
    expect(MOISTURE_LEVEL_UI.DRY.tone).toBe('warn');
    expect(MOISTURE_LEVEL_UI.OPTIMAL.tone).toBe('good');
    expect(MOISTURE_LEVEL_UI.WET.tone).toBe('water');
    expect(MOISTURE_LEVEL_UI.SATURATED.tone).toBe('deep');
    expect(MOISTURE_LEVEL_UI.SENSOR_ERROR.tone).toBe('neutral');
  });
});
