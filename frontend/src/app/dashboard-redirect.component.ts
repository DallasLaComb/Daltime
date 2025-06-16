import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth/auth.service';

@Component({
  selector: 'dashboard-redirect',
  standalone: true,
  template: '',
})
export class DashboardRedirectComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  constructor() {
    const authData = this.auth.getAuthData();
    console.log('DashboardRedirectComponent loaded, authData:', authData);

    const role = authData?.data?.user?.role;
    if (typeof role === 'string' && role.trim()) {
      const normalizedRole = role.trim().toLowerCase();
      const target = `/${normalizedRole}/dashboard`;
      console.log('Redirecting to:', target);

      this.router.navigateByUrl(target).catch((err) => {
        console.error('Navigation error:', err);
        this.router.navigate(['/auth/login']).catch((loginErr) => {
          console.error('Fallback navigation error:', loginErr);
        });
      });
    } else {
      console.warn('Role is undefined or invalid, redirecting to login.');
      this.router.navigate(['/auth/login']).catch((err) => {
        console.error('Fallback navigation error:', err);
      });
    }
  }
}
