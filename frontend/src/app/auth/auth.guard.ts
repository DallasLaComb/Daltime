import { Injectable } from '@angular/core';
import {
  CanActivate,
  CanLoad,
  Route,
  UrlSegment,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate, CanLoad {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    return this.checkAccess(state.url);
  }

  canLoad(route: Route, segments: UrlSegment[]): boolean {
    const url = '/' + segments.map((s) => s.path).join('/');
    return this.checkAccess(url);
  }

  private checkAccess(url: string): boolean {
    const authData = this.auth.getAuthData();
    console.log('AuthGuard checkAccess, authData:', authData);

    if (!authData) {
      console.warn('No auth data found, redirecting to login.');
      this.router.navigate(['/auth/login']);
      return false;
    }

    const role = authData?.data?.user?.role?.toLowerCase();
    console.log('AuthGuard checkAccess, role:', role, 'url:', url);

    if (
      (role === 'employee' && url.startsWith('/employee')) ||
      (role === 'manager' && url.startsWith('/manager')) ||
      (role === 'admin' && url.startsWith('/admin'))
    ) {
      return true;
    }

    console.warn('Role mismatch or unauthorized access, redirecting to dashboard.');
    if (role === 'employee') {
      this.router.navigate(['/employee/dashboard']);
    } else if (role === 'manager') {
      this.router.navigate(['/manager/dashboard']);
    } else if (role === 'admin') {
      this.router.navigate(['/admin/dashboard']);
    } else {
      this.router.navigate(['/auth/login']);
    }
    return false;
  }
}
