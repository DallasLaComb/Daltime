import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { UserRole } from '../../core/auth/user-role.model';
import type { MarkAllReadResponse, PublicNotification } from '../../core/models/notification.model';

/**
 * Maps the app's internal `UserRole` (PascalCase, e.g. `'OrgAdmin'`) to the
 * kebab-case URL path segment the backend's `{role}`-prefixed routes expect
 * (e.g. `'org-admin'`). Kept local to this service rather than reusing
 * `ROLE_DASHBOARD_MAP` because that map returns full dashboard routes
 * (`'/org-admin'`) intended for Angular `routerLink`, not bare path segments
 * for building API URLs.
 */
const ROLE_PATH_SEGMENT: Record<UserRole, string> = {
  WebAdmin: 'web-admin',
  OrgAdmin: 'org-admin',
  Manager: 'manager',
  Employee: 'employee',
};

/**
 * Calls the cross-role Notifications backend slice
 * (`backend/src/functions/shared/notifications`). One service used by all
 * four roles — the caller's `effectiveRole()` (same signal the navbar already
 * uses for Web-Admin emulation parity) determines which `{role}`-prefixed
 * route is hit. When Web-Admin is impersonating, `impersonationInterceptor`
 * (registered in app.config.ts) transparently rewrites the resulting
 * `/org-admin|manager|employee/...` URL into the web-admin impersonation
 * proxy — this service does not need to know about impersonation itself,
 * it always builds the URL for the real effective role, exactly like every
 * other role-scoped service in this app.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);

  /** Builds the role-prefixed base URL, e.g. `${baseUrl}/org-admin/notifications`. */
  private baseUrl(role: UserRole): string {
    return `${environment.api.baseUrl}/${ROLE_PATH_SEGMENT[role]}/notifications`;
  }

  /** GET /{role}/notifications — list the caller's notifications, newest first. */
  list(role: UserRole): Observable<PublicNotification[]> {
    return this.http.get<PublicNotification[]>(this.baseUrl(role));
  }

  /** PATCH /{role}/notifications — mark all of the caller's unread notifications as read. */
  markAllAsRead(role: UserRole): Observable<MarkAllReadResponse> {
    return this.http.patch<MarkAllReadResponse>(this.baseUrl(role), {});
  }

  /**
   * PATCH /{role}/notifications/{notificationId} — mark a single notification
   * as read. CRITICAL: `notificationId` is the opaque composite public id
   * `<ISO-timestamp>#<uuid>` (e.g. `2026-06-18T12:00:00.000Z#a1b2c3d4-...`),
   * which contains literal `#` and `:` characters. `#` is a URL fragment
   * delimiter — if not percent-encoded, everything from `#` onward is
   * stripped from the request path client-side before it ever reaches
   * HttpClient/the network, so the request silently goes to the wrong URL
   * with no error surfaced. `encodeURIComponent` is applied here, once, in
   * the service layer, so every call site is automatically safe regardless
   * of whether the caller remembers to encode it.
   */
  markOneAsRead(role: UserRole, notificationId: string): Observable<PublicNotification> {
    const encodedId = encodeURIComponent(notificationId);
    return this.http.patch<PublicNotification>(`${this.baseUrl(role)}/${encodedId}`, {});
  }
}
