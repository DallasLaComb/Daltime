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
    const role = authData?.user?.role;
    if (role === 'employee') {
      this.router.navigate(['/employee/dashboard']);
    } else if (role === 'manager') {
      this.router.navigate(['/manager/dashboard']);
    } else if (role === 'admin') {
      this.router.navigate(['/admin/dashboard']);
    } else {
      this.router.navigate(['/auth/login']);
    }
  }
}
