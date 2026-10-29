import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';

const THEME_KEY = 'smart-garden.theme';

/** Light / dark mode toggle (persisted). Material 3 tokens follow `color-scheme`. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly dark = signal(this.initial());

  constructor() {
    effect(() => {
      const dark = this.dark();
      this.document.documentElement.classList.toggle('dark-theme', dark);
      try {
        localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
      } catch {
        // ignore unavailable storage
      }
    });
  }

  toggle(): void {
    this.dark.update((d) => !d);
  }

  private initial(): boolean {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved) return saved === 'dark';
    } catch {
      // ignore unavailable storage
    }
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
