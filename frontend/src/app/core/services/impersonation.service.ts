import { Injectable, signal } from '@angular/core';
import type { UserRole } from '../auth/user-role.model';

const SESSION_KEY = 'daltime_impersonation';

export interface ImpersonateContext {
  userId: string;
  role: Extract<UserRole, 'OrgAdmin' | 'Manager' | 'Employee'>;
  displayName: string;
  email: string;
  orgId: string;
}

@Injectable({ providedIn: 'root' })
export class ImpersonationService {
  private readonly _viewingAs = signal<ImpersonateContext | null>(null);

  /** Read-only signal — null when not impersonating. */
  readonly viewingAs = this._viewingAs.asReadonly();

  constructor() {
    // Restore from sessionStorage so impersonation survives a page refresh.
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        this._viewingAs.set(JSON.parse(stored) as ImpersonateContext);
      }
    } catch {
      // Malformed storage — ignore.
    }
  }

  startImpersonation(ctx: ImpersonateContext): void {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(ctx));
    this._viewingAs.set(ctx);
  }

  endImpersonation(): void {
    sessionStorage.removeItem(SESSION_KEY);
    this._viewingAs.set(null);
  }
}
