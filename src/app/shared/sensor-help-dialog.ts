import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-sensor-help-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Cómo revisar el sensor de humedad</h2>
    <mat-dialog-content>
      <ol>
        <li>Verifica que el ESP32 esté encendido (la pantalla OLED debe mostrar datos).</li>
        <li>Comprueba que el sensor esté enterrado en la tierra hasta la línea marcada, no al aire.</li>
        <li>Revisa los tres cables del sensor (VCC, GND y señal) y que no estén sueltos ni mojados.</li>
        <li>Confirma que el ESP32 tenga Wi-Fi: el indicador del Panel debe decir «En línea».</li>
        <li>Si la humedad marca 0 % o 100 % de forma constante, el sensor puede estar desconectado o dañado.</li>
      </ol>
      <p class="muted">Cuando vuelvan a llegar lecturas válidas, la IA lo detectará en el siguiente análisis.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" mat-dialog-close cdkFocusInitial>Entendido</button>
    </mat-dialog-actions>
  `,
  styles: `
    ol {
      padding-left: 20px;
      margin: 0 0 12px;
    }
    li {
      margin: 6px 0;
    }
  `,
})
export class SensorHelpDialog {}
