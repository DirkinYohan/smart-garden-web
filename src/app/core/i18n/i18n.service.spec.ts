import { TestBed } from '@angular/core/testing';
import { I18nService, LANGUAGE_STORAGE_KEY } from './i18n.service';

describe('I18nService', () => {
  function create(): I18nService {
    TestBed.configureTestingModule({});
    return TestBed.inject(I18nService);
  }

  beforeEach(() => localStorage.clear());

  it('defaults to Spanish', () => {
    const i18n = create();

    expect(i18n.lang()).toBe('es');
    expect(i18n.isEnglish()).toBe(false);
    expect(i18n.t('nav.panel')).toBe('Panel');
    expect(i18n.modeLabel('AUTO')).toBe('Automático');
    expect(i18n.t('level.SATURATED')).toBe('Saturada');
  });

  it('switches to English and remembers the choice', () => {
    const i18n = create();

    i18n.toggle();

    expect(i18n.lang()).toBe('en');
    expect(i18n.isEnglish()).toBe(true);
    expect(i18n.t('nav.panel')).toBe('Dashboard');
    expect(i18n.modeLabel('AUTO')).toBe('Automatic');
    expect(i18n.t('level.SATURATED')).toBe('Saturated');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('restores the stored language on startup', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');

    const i18n = create();

    expect(i18n.lang()).toBe('en');
    expect(i18n.t('nav.panel')).toBe('Dashboard');
  });

  it('replaces placeholders and escapes nothing else', () => {
    const i18n = create();

    expect(i18n.t('ctrl.recommendedRange', { crop: 'Tomate', min: 40, max: 70 })).toBe(
      'Rango recomendado para Tomate: 40–70 %',
    );
    i18n.set('en');
    expect(i18n.t('ctrl.recommendedRange', { crop: 'Tomato', min: 40, max: 70 })).toBe(
      'Recommended range for Tomato: 40–70 %',
    );
  });

  it('falls back to Spanish and then to the key', () => {
    const i18n = create();
    i18n.set('en');

    expect(i18n.t('no.such.key')).toBe('no.such.key');
  });

  it('formats dates and numbers with the active locale', () => {
    const i18n = create();

    expect(i18n.formatNumber(1234.5, 1)).toContain('1');
    i18n.set('en');
    expect(i18n.formatNumber(1234.5, 1)).toBe('1,234.5');
  });

  it('builds the fallback sentence in both languages', () => {
    const i18n = create();

    expect(i18n.fallbackText('TIMEOUT')).toContain('tardó demasiado');
    i18n.set('en');
    expect(i18n.fallbackText('TIMEOUT')).toContain('took too long');
  });
});
