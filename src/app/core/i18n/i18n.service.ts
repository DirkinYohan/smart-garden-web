import { Injectable, computed, signal } from '@angular/core';
import {
  Confidence,
  HealthStatus,
  IrrigationMode,
  MoistureLevel,
  NextAction,
  Priority,
  RecommendationCategory,
  RiskLevel,
} from '../../models/garden.models';
import { EN, ES } from './translations';

export type Language = 'es' | 'en';

export const LANGUAGES: readonly Language[] = ['es', 'en'];

export const LANGUAGE_STORAGE_KEY = 'smart-garden.lang';

/**
 * Traducciones de la interfaz en tiempo de ejecución (español / inglés).
 *
 * `t()` lee la señal del idioma, así que cualquier plantilla que la use se vuelve a pintar sola al cambiar de idioma:
 * no hace falta recargar ni crear una tubería impura. La elección se guarda en `localStorage` y se refleja en
 * `<html lang>`.
 *
 * El defecto es español (idioma original de la aplicación); el usuario lo cambia con el botón de la barra.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly current = signal<Language>(restore());
  private readonly dictionaries: Record<Language, Record<string, string>> = { es: ES, en: EN };

  /** Idioma activo. */
  readonly lang = this.current.asReadonly();
  readonly isEnglish = computed(() => this.current() === 'en');
  /** Locale para fechas y números. */
  readonly locale = computed(() => (this.current() === 'en' ? 'en-US' : 'es-CO'));

  constructor() {
    this.applyHtmlLang(this.current());
  }

  set(lang: Language): void {
    if (!LANGUAGES.includes(lang)) return;
    this.current.set(lang);
    this.applyHtmlLang(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // almacenamiento no disponible (modo privado): el idioma vive solo en memoria
    }
  }

  toggle(): void {
    this.set(this.current() === 'es' ? 'en' : 'es');
  }

  /**
   * Traduce una clave. Si falta en el idioma activo se usa el español y, como último recurso, la propia clave.
   * Los marcadores `{nombre}` se sustituyen con `params`.
   */
  t(key: string, params?: Record<string, string | number>): string {
    const dict = this.dictionaries[this.current()];
    let text = dict[key] ?? ES[key] ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.split('{' + name + '}').join(String(value));
      }
    }
    return text;
  }

  // --- etiquetas de enums (mantienen el tono y el icono en los módulos compartidos) ---

  modeLabel(mode: IrrigationMode | null | undefined): string {
    return mode ? this.t('mode.' + mode) : '';
  }

  riskLabel(risk: RiskLevel | null | undefined): string {
    return risk ? this.t('risk.' + risk) : '';
  }

  healthLabel(status: HealthStatus | null | undefined): string {
    return status ? this.t('health.' + status) : '';
  }

  nextActionLabel(action: NextAction | null | undefined): string {
    return action ? this.t('next.' + action) : '';
  }

  categoryLabel(category: RecommendationCategory | null | undefined): string {
    return category ? this.t('category.' + category) : '';
  }

  priorityLabel(priority: Priority | null | undefined): string {
    return priority ? this.t('priority.' + priority) : '';
  }

  confidenceLabel(confidence: Confidence | null | undefined): string {
    return confidence ? this.t('confidence.' + confidence) : '';
  }

  moistureLevelLabel(level: MoistureLevel | null | undefined): string {
    return this.t('level.' + (level ?? 'SENSOR_ERROR'));
  }

  /** Frase que explica por qué se usó el respaldo por reglas. */
  fallbackText(reason: string | null | undefined): string {
    const known = ['NO_API_KEY', 'QUOTA_EXCEEDED', 'TIMEOUT', 'INVALID_RESPONSE', 'AUTH_ERROR', 'MODEL_NOT_FOUND',
      'UNAVAILABLE', 'ERROR'];
    const key = reason && known.includes(reason) ? reason : 'unknown';
    return this.t('fallback.sentence', { why: this.t('fallback.' + key) });
  }

  /** Lectura en palabras de la velocidad de secado (puntos por hora, negativo = secándose). */
  dryingSentence(rate: number | null): string {
    if (rate === null) return this.t('drying.needData');
    if (rate >= 0.2) return this.t('drying.gaining');
    const abs = Math.abs(rate);
    if (abs < 0.5) return this.t('drying.almostNone');
    if (abs < 1.5) return this.t('drying.slow');
    if (abs < 3) return this.t('drying.normal');
    return this.t('drying.fast');
  }

  // --- fechas y números ---

  /** "6:00 p. m." / "6:00 PM" */
  formatClock(iso: string | number): string {
    return new Date(iso).toLocaleTimeString(this.locale(), { hour: 'numeric', minute: '2-digit' });
  }

  /** "28 oct, 6:00 p. m." / "Oct 28, 6:00 PM" */
  formatDateTime(iso: string | number): string {
    return new Date(iso).toLocaleString(this.locale(), {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  formatNumber(value: number, digits = 1): string {
    return value.toLocaleString(this.locale(), { maximumFractionDigits: digits });
  }

  /** "hace 12 s" / "12 s ago" a partir de una antigüedad en segundos. */
  relativeTime(seconds: number | null): string {
    if (seconds === null) return this.t('time.none');
    if (seconds < 60) return this.t('time.seconds', { n: seconds });
    if (seconds < 3600) return this.t('time.minutes', { n: Math.floor(seconds / 60) });
    if (seconds < 86400) return this.t('time.hours', { n: Math.floor(seconds / 3600) });
    return this.t('time.days', { n: Math.floor(seconds / 86400) });
  }

  /** "hace 5 min" / "5 min ago" a partir de una fecha ISO. */
  relativePast(iso: string, now: number): string {
    const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
    if (minutes < 1) return this.t('pwd.ago.now');
    if (minutes < 60) return this.t('time.minutes', { n: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return this.t('time.hours', { n: hours });
    return this.t('time.days', { n: Math.floor(hours / 24) });
  }

  /** "en 5 h" / "in 5 h" a partir de una fecha ISO. */
  relativeFuture(iso: string, now: number): string {
    const minutes = Math.round((Date.parse(iso) - now) / 60_000);
    if (minutes <= 1) return this.t('time.now');
    if (minutes < 60) return this.t('time.inMinutes', { n: minutes });
    return this.t('time.inHours', { n: Math.round(minutes / 6) / 10 });
  }

  /** "ayer", "hoy", "mañana" o la fecha corta. */
  dayWord(ts: number, now: number): string {
    const day = (t: number) => {
      const d = new Date(t);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    };
    const diff = Math.round((day(ts) - day(now)) / 86_400_000);
    if (diff === 0) return this.t('time.today');
    if (diff === -1) return this.t('time.yesterday');
    if (diff === 1) return this.t('time.tomorrow');
    return new Date(ts).toLocaleDateString(this.locale(), { day: 'numeric', month: 'short' });
  }

  /** "45 s" / "2 min 05 s" */
  formatDuration(seconds: number | null): string {
    if (seconds === null) return '—';
    if (seconds < 60) return seconds + ' s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m + ' min ' + String(s).padStart(2, '0') + ' s';
  }

  private applyHtmlLang(lang: Language): void {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }
}

function restore(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'es' || stored === 'en') return stored;
  } catch {
    // sin almacenamiento
  }
  return 'es';
}
