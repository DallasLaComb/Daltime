import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import {
  ButtonComponent,
  EmptyStateComponent,
  ErrorAlertComponent,
  LoadingSpinnerComponent,
} from '@common-daltime';
import type { UserRole } from '../../core/auth/user-role.model';
import type { PublicNotification } from '../../core/models/notification.model';
import { NotificationsService } from './notifications.service';
import { formatNotificationTimestamp, getNotificationDisplay } from './notification-display.util';

/**
 * Bell icon + dropdown panel showing the caller's notifications. Used once
 * in the shared navbar for all four roles — the role to call the backend
 * with is passed in via `role` (bound to the navbar's `effectiveRole()`
 * signal), giving Web-Admin exact emulation parity: while impersonating, the
 * navbar passes the impersonated role here, and `impersonationInterceptor`
 * transparently proxies the resulting request, so this component never has
 * to special-case Web-Admin itself.
 */
@Component({
  selector: 'app-notification-bell',
  imports: [ButtonComponent, EmptyStateComponent, ErrorAlertComponent, LoadingSpinnerComponent],
  templateUrl: './notification-bell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationBellComponent {
  private readonly notificationsService = inject(NotificationsService);

  /** Effective role driving which `{role}/notifications` route is called. Required — the navbar only renders this component when authenticated. */
  role = input.required<UserRole>();

  protected readonly panelOpen = signal(false);
  protected readonly notifications = signal<PublicNotification[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly markingAll = signal(false);

  /** Count of unread notifications, derived client-side from the list payload — no separate unread-count endpoint exists. */
  protected readonly unreadCount = computed(
    () => this.notifications().filter((n) => !n.read).length,
  );

  protected readonly hasUnread = computed(() => this.unreadCount() > 0);

  /** Exposes the display label/icon helper to the template (kept as a pure function so it's independently unit-testable). */
  protected readonly getDisplay = getNotificationDisplay;
  protected readonly formatTimestamp = formatNotificationTimestamp;

  /** Opens the panel and (re)loads notifications fresh each time it's opened, per the story's "refresh on panel open" requirement. Closes instead if already open. */
  protected togglePanel(): void {
    const opening = !this.panelOpen();
    this.panelOpen.set(opening);
    if (opening) {
      this.loadNotifications();
    }
  }

  protected closePanel(): void {
    this.panelOpen.set(false);
  }

  /** Fetches the caller's notifications for the current effective role, newest first (backend already sorts). */
  private loadNotifications(): void {
    this.loading.set(true);
    this.error.set(null);
    this.notificationsService.list(this.role()).subscribe({
      next: (list) => {
        this.notifications.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load notifications. Please try again.');
        this.loading.set(false);
      },
    });
  }

  /** Retries loading after an error — wired to ErrorAlertComponent's retry output. */
  protected retryLoad(): void {
    this.loadNotifications();
  }

  /**
   * Marks a single notification as read on click. Uses an optimistic local
   * update (flips `read` in the signal immediately) so the badge/dot clears
   * without waiting on a refetch, then reconciles with the server response;
   * on failure the optimistic change is rolled back so the UI never shows a
   * read-state the server didn't actually persist.
   */
  protected markOneAsRead(notification: PublicNotification): void {
    if (notification.read) return;

    this.notifications.update((list) =>
      list.map((n) =>
        n.notification_id === notification.notification_id ? { ...n, read: true } : n,
      ),
    );

    this.notificationsService.markOneAsRead(this.role(), notification.notification_id).subscribe({
      next: (updated) => {
        this.notifications.update((list) =>
          list.map((n) => (n.notification_id === updated.notification_id ? updated : n)),
        );
      },
      error: () => {
        // Roll back the optimistic update — the server never actually marked it read.
        this.notifications.update((list) =>
          list.map((n) =>
            n.notification_id === notification.notification_id ? { ...n, read: false } : n,
          ),
        );
        this.error.set('Failed to mark notification as read. Please try again.');
      },
    });
  }

  /** Marks every notification as read via the dedicated mark-all route, then optimistically flips all local items to read. */
  protected markAllAsRead(): void {
    if (!this.hasUnread() || this.markingAll()) return;

    this.markingAll.set(true);
    const previous = this.notifications();

    this.notificationsService.markAllAsRead(this.role()).subscribe({
      next: () => {
        this.notifications.update((list) => list.map((n) => ({ ...n, read: true })));
        this.markingAll.set(false);
      },
      error: () => {
        this.notifications.set(previous);
        this.markingAll.set(false);
        this.error.set('Failed to mark all notifications as read. Please try again.');
      },
    });
  }

  protected trackByNotificationId(_: number, n: PublicNotification): string {
    return n.notification_id;
  }
}
