import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, OnDestroy, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth/auth.service';
import { I18nService } from '../core/i18n/i18n.service';
import { GardenStore } from '../core/state/garden-store';
import { ThemeService } from '../core/theme.service';
import { ConnectionIndicator } from '../shared/connection-indicator';
import { LanguageToggle } from '../shared/language-toggle';

interface NavItem {
  path: string;

  labelKey: string;
  icon: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatMenuModule,
    ConnectionIndicator,
    LanguageToggle,
  ],

  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell implements OnDestroy {
  protected readonly auth = inject(AuthService);
  protected readonly store = inject(GardenStore);
  protected readonly theme = inject(ThemeService);
  protected readonly i18n = inject(I18nService);
  protected readonly mock = environment.useMock;

  protected readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 839px)')
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  protected readonly nav: NavItem[] = [
    { path: '/', labelKey: 'nav.panel', icon: 'dashboard' },
    { path: '/historial', labelKey: 'nav.history', icon: 'monitoring' },
    { path: '/control', labelKey: 'nav.control', icon: 'tune' },
    { path: '/ia', labelKey: 'nav.ai', icon: 'psychology' },
  ];

  constructor() {

    this.auth.refresh().subscribe();
    this.store.start();
  }

  ngOnDestroy(): void {
    this.store.stop();
  }

  protected logout(): void {
    this.auth.logout();
  }
}
