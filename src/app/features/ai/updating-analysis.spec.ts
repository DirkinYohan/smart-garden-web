import { TestBed } from '@angular/core/testing';
import { UpdatingAnalysis } from './updating-analysis';

describe('UpdatingAnalysis', () => {
  it('announces the new crop instead of the old analysis', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [UpdatingAnalysis],
    }).createComponent(UpdatingAnalysis);
    fixture.componentRef.setInput('cropName', 'Tomate');
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.updating') as HTMLElement;
    expect(banner).toBeTruthy();
    expect(banner.getAttribute('role')).toBe('status');
    expect(banner.textContent).toContain('Actualizando análisis para Tomate…');
    expect(banner.querySelector('mat-progress-spinner')).toBeTruthy();
    // Con análisis automáticos activos no se ofrece el botón manual
    expect(banner.querySelector('button')).toBeNull();
  });

  it('offers a manual analysis when automatic ones are disabled', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [UpdatingAnalysis],
    }).createComponent(UpdatingAnalysis);
    fixture.componentRef.setInput('cropName', 'Fresa');
    fixture.componentRef.setInput('autoAnalysis', false);
    fixture.detectChanges();
    let requested = 0;
    fixture.componentInstance.analyze.subscribe(() => (requested += 1));

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.textContent).toContain('Analizar ahora');
    button.click();

    expect(requested).toBe(1);
  });
});
