import { IrrigationMode } from '../models/garden.models';

export const MODE_ICONS: Record<IrrigationMode, string> = {
  AUTO: 'autorenew',
  MANUAL: 'back_hand',
  AI: 'psychology',
};

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

export function withAlpha(color: string, alpha: number): string {
  const m = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(color);
  return m ? `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})` : color;
}
