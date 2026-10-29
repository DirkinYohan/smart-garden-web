import { TestBed } from '@angular/core/testing';
import { MOISTURE_LEVELS, MOISTURE_LEVEL_UI } from './moisture-level';
import { MoistureLevelChip } from './moisture-level-chip';

describe('MoistureLevelChip', () => {
  it('renders icon, text and tone for the six levels', () => {
    const fixture = TestBed.createComponent(MoistureLevelChip);
    fixture.detectChanges();

    for (const level of MOISTURE_LEVELS) {
      fixture.componentRef.setInput('level', level);
      fixture.detectChanges();
      const chip = fixture.nativeElement.querySelector('.tone-chip') as HTMLElement;
      const ui = MOISTURE_LEVEL_UI[level];

      expect(chip).toBeTruthy();
      expect(chip.classList).toContain(`tone-${ui.tone}`);
      expect(chip.getAttribute('data-level')).toBe(level);
      expect(chip.textContent).toContain(ui.label);
      expect(chip.querySelector('mat-icon')?.textContent).toContain(ui.icon);
    }
  });

  it('renders nothing without a level', () => {
    const fixture = TestBed.createComponent(MoistureLevelChip);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.tone-chip')).toBeNull();
  });
});
