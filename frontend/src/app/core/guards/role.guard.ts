import { inject } from '@angular/core';
import { type CanMatchFn, type Route, Router } from '@angular/router';
import { AuthService } from '../auth/auth';
import { ImpersonationService } from '../services/impersonation.service';
import type { UserRole } from '../auth/user-role.model';

export const roleGuard: CanMatchFn = (route: Route) => {
  const auth = inject(AuthService);
  const impersonation = inject(ImpersonationService);
  const router = inject(Router);

  const allowedRoles = (route.data?.['roles'] ?? []) as UserRole[];
  const role = auth.roleSignal();

  // Web admin can navigate to any route that belongs to the role they are impersonating.
  const viewingAs = impersonation.viewingAs();
  if (role === 'WebAdmin' && viewingAs && allowedRoles.includes(viewingAs.role)) {
    return true;
  }

  if (role && allowedRoles.includes(role)) return true;

  return router.createUrlTree(['/unauthorized']);
};
