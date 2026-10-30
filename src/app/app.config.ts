import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeEsCo from '@angular/common/locales/es-CO';
import {
  ApplicationConfig,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { GardenApi } from './core/api/garden-api';
import { HttpGardenApi } from './core/api/http-garden-api';
import { authInterceptor } from './core/auth/auth.interceptor';
import { errorInterceptor } from './core/auth/error.interceptor';
import { mockBackendInterceptor } from './core/mock/mock-backend.interceptor';
import { MockRealtimeService } from './core/realtime/mock-realtime.service';
import { RealtimeService } from './core/realtime/realtime.service';
import { StompRealtimeService } from './core/realtime/stomp-realtime.service';

registerLocaleData(localeEsCo, 'es-CO');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

  provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),

    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor, mockBackendInterceptor])),

    { provide: LOCALE_ID, useFactory: () => (typeof localStorage !== 'undefined' && localStorage.getItem('smart-garden.lang') === 'en') ? 'en-US' : 'es-CO' },
    { provide: GardenApi, useClass: HttpGardenApi },
    { provide: RealtimeService, useClass: environment.useMock ? MockRealtimeService : StompRealtimeService },

    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },
    { provide: MAT_SNACK_BAR_DEFAULT_OPTIONS, useValue: { horizontalPosition: 'center', verticalPosition: 'bottom' } },
  ],
};
