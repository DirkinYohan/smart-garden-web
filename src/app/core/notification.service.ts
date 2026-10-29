import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Success / error snackbars. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.snackBar.open(message, 'OK', { duration: 3500, panelClass: 'snack-success' });
  }

  error(message: string): void {
    this.snackBar.open(message, 'Cerrar', { duration: 6000, panelClass: 'snack-error' });
  }

  /** Neutral notice (e.g. "La IA ajustó los umbrales a 42–68 %"). */
  info(message: string): void {
    this.snackBar.open(message, 'OK', { duration: 4500, panelClass: 'snack-info' });
  }
}
