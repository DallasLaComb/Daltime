// Mirrors backend/src/functions/shared/models/notifications/notification.model.ts exactly.
// Keep these two files in sync manually — frontend and backend are separate
// TypeScript projects in this repo, so types are hand-mirrored, not imported
// across the package boundary (matches the existing pattern for every other
// shared entity in this codebase, e.g. ShiftNeeded/CreateShiftBody).

/**
 * Known notification trigger categories. This union is expected to grow as
 * future backend slices call the shared `createNotification()` helper with
 * new types (e.g. a future approvals/requests feature) — the frontend must
 * never assume this list is exhaustive. See notification-display.util.ts for
 * the generic fallback rendering that handles any value not in this union.
 */
export type NotificationType = 'INFO' | 'APPROVAL' | 'REQUEST' | 'SHIFT';

/**
 * Shape returned by GET/PATCH /{role}/notifications routes. `notification_id`
 * is an opaque composite `${created_at}#${rawId}` string — it must always be
 * `encodeURIComponent`-ed before being placed in a URL path segment (see
 * notifications.service.ts `markOneAsRead`), never treated as a plain id.
 */
export interface PublicNotification {
  notification_id: string;
  recipient_sub: string;
  type: NotificationType;
  message: string;
  read: boolean;
  created_at: string;
}

/** Response shape for PATCH /{role}/notifications (mark-all-as-read). */
export interface MarkAllReadResponse {
  success: true;
  marked_count: number;
}
