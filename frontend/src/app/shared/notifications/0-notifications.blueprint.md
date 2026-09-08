# Notifications (Frontend) — Blueprint

Parent story: GitHub Issue #243. Frontend sub-issue: #250 (angular-frontend-agent).

Status: **Implemented.**

## 1. Summary

A cross-role notification bell/panel surface wired into the single shared
`app-navbar` (`frontend/src/app/shared/navbar/navbar.ts`/`.html`), visible to
every authenticated role (Org-Admin, Manager, Employee, and Web-Admin —
including while Web-Admin is emulating another role). It lets a user see
their own notifications, mark a single one as read, and mark all as read,
calling the existing backend slice at `backend/src/functions/shared/notifications`.

This mirrors the backend's own `shared/notifications` precedent: recipients
are cross-role (a notification belongs to a Cognito `sub`, not to a role
folder), so this frontend code lives under `frontend/src/app/shared/notifications/`
rather than under any single role's `features/<role>/` directory.

## 2. Why this location

- `frontend/src/app/shared/notifications/` — chosen to mirror
  `backend/src/functions/shared/notifications/`'s own justification (cross-role
  entity, not role-owned), and because the navbar that hosts it
  (`frontend/src/app/shared/navbar/`) is itself already in `shared/`.
- The model (`PublicNotification`, `NotificationType`, `MarkAllReadResponse`)
  lives at `frontend/src/app/core/models/notification.model.ts`, matching this
  repo's existing convention of co-locating all entity model files under
  `core/models/` (see `manager-shift-needed.model.ts`,
  `web-admin-employee.model.ts`, etc.) rather than inside the feature
  directory — kept separate from the feature directory itself but still
  hand-mirrored 1:1 against the backend's `notification.model.ts` (frontend
  and backend are separate TypeScript projects in this repo, so types cannot
  be imported across the package boundary; they are kept manually in sync).

## 3. Files

```
frontend/src/app/core/models/notification.model.ts        # PublicNotification, NotificationType, MarkAllReadResponse
frontend/src/app/shared/notifications/
  notifications.service.ts        # GET list / PATCH mark-all / PATCH mark-one, role-prefixed
  notification-display.util.ts    # type -> {label, icon} mapping + generic fallback, timestamp formatting
  notification-bell.ts            # standalone component: bell + dropdown panel
  notification-bell.html
  0-notifications.blueprint.md
  *.spec.ts                       # unit tests (service, component, display util)
```

Integration point: `frontend/src/app/shared/navbar/navbar.ts`/`.html` renders
`<app-notification-bell [role]="effectiveRole()!" />` once, outside the
collapsible `mainNav` block, so it's reachable at every breakpoint (including
collapsed-mobile) and bound to the exact same `effectiveRole()` signal the
navbar already uses for role-specific nav links and Web-Admin emulation.

## 4. Role routing / Web-Admin emulation parity

The component takes a single `role: UserRole` input (the caller's
`effectiveRole()`). `NotificationsService` maps that role to the backend's
kebab-case URL segment (`'OrgAdmin' -> 'org-admin'`, etc.) and always builds
the request against that role's real route — e.g.
`GET /org-admin/notifications`.

This service has **no impersonation-specific logic at all** — that's
intentional. `frontend/src/app/core/interceptors/impersonation.interceptor.ts`
already transparently rewrites any `/org-admin|manager|employee/...` request
into the Web-Admin impersonation proxy
(`/web-admin/impersonate/{userId}/org-admin/...`) whenever
`ImpersonationService.viewingAs()` is set. Because the navbar's
`effectiveRole()` already returns the _impersonated_ role while Web-Admin is
emulating, the notifications service automatically calls the impersonated
role's notifications route, and the interceptor automatically proxies it —
giving exact parity with zero notifications-specific impersonation code. This
was confirmed by reading the interceptor before wiring this feature in, per
the explicit instruction not to assume parity "just works."

## 5. The `encodeURIComponent` landmine — handled once, in the service

The backend's public `notification_id` is the composite
`<ISO-timestamp>#<uuid>` (e.g. `2026-06-18T12:00:00.000Z#a1b2c3d4-...`),
containing literal `#` and `:` characters. `NotificationsService.markOneAsRead()`
calls `encodeURIComponent(notificationId)` once, inside the service, before
interpolating it into `PATCH /{role}/notifications/${encodedId}` — so every
call site (today just `notification-bell.ts`, and any future call site) is
automatically safe without having to remember to encode it themselves.

If this were skipped, the literal `#` would be treated as a URL fragment
delimiter by the browser/HttpClient and everything after it would be
silently dropped from the outgoing request path — producing no HTTP error at
all, just a request to the wrong (truncated) URL. `notifications.service.spec.ts`
has an explicit test (`'encodes the notification_id before building the
request URL...'`) that asserts on the actual captured request's URL string
(via `HttpTestingController`), confirming the encoded `%23`/`%3A` substrings
are present and the URL is not truncated at `#` — not just that the call
completes without throwing.

## 6. Generic rendering / extensibility

The panel renders directly off each notification's `type` + `message`
fields. `notification-display.util.ts`'s `getNotificationDisplay(type)`
provides a nicer label + icon for today's 4 known `NotificationType` values
(`INFO`/`APPROVAL`/`REQUEST`/`SHIFT`) purely as cosmetic polish — but it
deliberately accepts a plain `string` (not the narrower `NotificationType`
union) and falls back to a generic `{ label: 'Notification', icon: '🔔' }`
for any value not in that map. The notification's raw `message` text is
**always** rendered regardless of `type` recognition; the component never
filters out, omits, or throws on an unrecognized type. This means a future
backend slice can call `createNotification(sub, 'NEW_TYPE', msg)` with a 5th
`NotificationType` literal and this frontend code requires zero changes to
keep working (it will simply show the generic icon/label until someone adds
a nicer mapping entry later, which is optional, not required).

`notification-display.util.spec.ts` and `notification-bell.spec.ts` both
include an explicit test constructing a notification with a `type` value
outside the 4 known literals (`'FUTURE_TYPE'`, cast through `unknown` since
TypeScript's union would otherwise reject constructing it) and assert the
component still renders it via the fallback path instead of throwing or
dropping it from the list.

## 7. UI states

- **Loading**: `LoadingSpinnerComponent` from `@common-daltime` while the list
  request is in flight.
- **Error**: `ErrorAlertComponent` from `@common-daltime` with a retry action
  wired to re-fetch.
- **Empty**: `EmptyStateComponent` from `@common-daltime` when the list is
  empty.
- **Unread state**: computed client-side via a `computed()` signal
  (`unreadCount`) over the list response's `read` field — there is no
  separate unread-count endpoint (confirmed by dynamodb-data-agent's #244
  review). Shown as a numeric badge on the bell plus a per-item dot, and
  exposed via an `aria-live="polite"` `sr-only` text alternative so it is
  never communicated by color alone.
- **Mark-one-as-read**: clicking/Enter/Space on a notification item
  optimistically flips it to read locally, calls the backend, and rolls back
  on failure.
- **Mark-all-as-read**: a button in the panel header, disabled when there is
  no unread notification, calls the backend then flips every item to read on
  success (rolls back to the previous snapshot on failure).
- Panel **refetches on every open** (per the story's "refresh on a reasonable
  trigger — e.g. panel open" requirement), not just once on first mount.

## 8. Accessibility

- Bell button: `aria-label` (dynamic — includes unread count when present),
  `aria-expanded`, `aria-controls="notificationPanel"` — same pattern as the
  navbar's existing hamburger toggle.
- Unread badge: never color-only — paired with an `sr-only`
  `aria-live="polite"` region announcing the unread count, and the bell's own
  `aria-label` also encodes the count as text.
- Panel: `role="region"` with `aria-label="Notifications"`; closes on
  Escape and on an outside click (backdrop), matching this app's existing
  modal/overlay pattern (`confirmation-modal.html`,
  `org-admin/locations/locations.html`).
- Each notification item: `role="button"`, `tabindex="0"`,
  Enter/Space-activatable, with an `aria-label` describing read/unread state
  plus the message — not relying on visual-only cues.

## 9. Out of scope (carried from backend blueprint)

Real-time/websocket delivery, pagination, push notifications, rate limiting,
an unread-count aggregate endpoint (client-derived instead, per #244's
review) — all explicitly deferred per the backend blueprint section 8 and
unchanged by this frontend work.
