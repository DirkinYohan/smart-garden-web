import { IrrigationMode } from '../models/garden.models';

/** Iconos de los modos de riego (el texto lo pone `I18nService.modeLabel`). */
export const MODE_ICONS: Record<IrrigationMode, string> = {
  AUTO: 'autorenew',
  MANUAL: 'back_hand',
  AI: 'psychology',
};

/**
 * Resuelve una variable CSS (típica de Material 3, con `light-dark(...)`) a un color concreto para Chart.js.
 * Canvas no entiende `light-dark()`, así que se lee el color ya calculado.
 */
export function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return fallback;
  const probe = document.createElement('span');
  probe.style.display = 'none';
  probe.style.color = `var(${name}, ${fallback})`;
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color || fallback;
}

/** `rgb(r, g, b)` → `rgba(r, g, b, a)`; otros formatos se devuelven sin cambios. */
export function withAlpha(color: string, alpha: number): string {
  const m = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(color);
  return m ? `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})` : color;
}
