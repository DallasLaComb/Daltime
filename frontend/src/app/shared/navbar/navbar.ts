import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ButtonComponent, ConfirmationModalComponent } from '@common-daltime';
import { AuthService } from '../../core/auth/auth';
import { ImpersonationService } from '../../core/services/impersonation.service';
import { ImpersonationBannerComponent } from '../components/impersonation-banner/impersonation-banner';
import { ROLE_DASHBOARD_MAP } from '../../core/auth/user-role.model';

@Component({
  selector: 'app-navbar',
  imports: [
    RouterLink,
    RouterLinkActive,
    ButtonComponent,
    ConfirmationModalComponent,
    ImpersonationBannerComponent,
  ],
  templateUrl: './navbar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Navbar {
  protected readonly authService = inject(AuthService);
  protected readonly impersonationService = inject(ImpersonationService);
  private readonly router = inject(Router);

  protected readonly menuOpen = signal(false);
  protected readonly showSignOutModal = signal(false);
  protected readonly signingOut = signal(false);

  /**
   * When impersonating, show the impersonated user's role in the nav so
   * the web-admin sees the same nav links as the target user.
   */
  protected readonly effectiveRole = computed(
    () => this.impersonationService.viewingAs()?.role ?? this.authService.roleSignal(),
  );

  protected readonly dashboardRoute = computed(() => {
    const r = this.effectiveRole();
    return r ? ROLE_DASHBOARD_MAP[r] : '/';
  });

  protected readonly profileRoute = computed(() => {
    const r = this.effectiveRole();
    return r ? `${ROLE_DASHBOARD_MAP[r]}/profile` : '/';
  });

  protected endImpersonation(): void {
    this.impersonationService.endImpersonation();
    void this.router.navigate(['/web-admin']);
  }

  protected navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  protected navigateToProfile(): void {
    this.closeMenu();
    this.router.navigate([this.profileRoute()]);
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected openSignOutModal(): void {
    this.closeMenu();
    this.showSignOutModal.set(true);
  }

  protected closeSignOutModal(): void {
    this.showSignOutModal.set(false);
  }

  protected confirmSignOut(): void {
    this.impersonationService.endImpersonation();
    this.showSignOutModal.set(false);
    this.signingOut.set(false);
    this.authService.logout();
  }
}
