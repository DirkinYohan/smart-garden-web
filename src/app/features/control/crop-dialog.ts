import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CropProfile, CropProfileInput } from '../../models/garden.models';

/** Group validator: max - min >= 10. */
export function thresholdGapValidator(group: AbstractControl): ValidationErrors | null {
  const min = group.get('minMoisture')?.value as number | null;
  const max = group.get('maxMoisture')?.value as number | null;
  if (min === null || max === null) return null;
  return max - min >= 10 ? null : { gap: true };
}

/** Edits a crop profile; closes with the new values (CropProfileInput) or undefined. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-crop-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Editar perfil: {{ crop.name }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="content">
        <mat-form-field appearance="outline">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="name" maxlength="64" required />
          @if (form.controls.name.hasError('required')) {
            <mat-error>El nombre es obligatorio</mat-error>
          }
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Humedad mínima (%)</mat-label>
            <input matInput type="number" formControlName="minMoisture" min="0" max="100" required />
            @if (form.controls.minMoisture.invalid) {
              <mat-error>Entre 0 y 100</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Humedad máxima (%)</mat-label>
            <input matInput type="number" formControlName="maxMoisture" min="0" max="100" required />
            @if (form.controls.maxMoisture.invalid) {
              <mat-error>Entre 0 y 100</mat-error>
            }
          </mat-form-field>
        </div>
        @if (form.hasError('gap')) {
          <p class="gap-error" role="alert">La máxima debe superar a la mínima en al menos 10 puntos.</p>
        }
        <mat-form-field appearance="outline">
          <mat-label>Descripción</mat-label>
          <textarea matInput formControlName="description" rows="3" maxlength="255"></textarea>
          <mat-hint align="end">{{ form.controls.description.value.length }}/255</mat-hint>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid">Guardar</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-top: 8px !important;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .gap-error {
      color: var(--mat-sys-error);
      margin: 0 0 8px;
      font: var(--mat-sys-body-small);
    }
  `,
})
export class CropDialog {
  protected readonly crop = inject<CropProfile>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<CropDialog, CropProfileInput>);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      name: [this.crop.name, [Validators.required, Validators.maxLength(64)]],
      minMoisture: [this.crop.minMoisture, [Validators.required, Validators.min(0), Validators.max(100)]],
      maxMoisture: [this.crop.maxMoisture, [Validators.required, Validators.min(0), Validators.max(100)]],
      description: [this.crop.description ?? '', [Validators.maxLength(255)]],
    },
    { validators: thresholdGapValidator },
  );

  protected save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.ref.close({ ...v, name: v.name.trim(), description: v.description.trim() });
  }
}
