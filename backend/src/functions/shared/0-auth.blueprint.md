# Shared Auth Utilities

## Overview

`backend/src/functions/shared/auth.ts` contains shared authorization helpers used across all Lambda handlers. Every handler must call the appropriate guard immediately after the OPTIONS short-circuit and before any routing or business logic — the API Gateway JWT authorizer only verifies that a token is well-signed and from the right User Pool; it does not enforce Cognito group membership or application-level provisioning.

## Functions

### `getCallerSub(event)`

Extracts the Cognito `sub` claim from the event. In production, API Gateway injects verified JWT claims into `event.requestContext.authorizer.jwt.claims`. In SAM local, those claims are not injected, so this function falls back to decoding the `Authorization` header directly (no signature verification — only used for local development).

### `getCallerGroups(event)`

Extracts the `cognito:groups` claim as a string array, handling both the real-array shape and the comma/space-joined string shape that API Gateway HTTP JWT authorizers produce. Uses the same SAM-local fallback as `getCallerSub`.

### `isWebAdmin(event)`

Returns `true` if the caller's groups include `'WebAdmin'`. Used internally by the group guards below.

### `requireWebAdmin(event)`

Synchronous group-only guard. Throws `ForbiddenError` if the caller is not in the `WebAdmin` Cognito group. Used as a fast pre-check inside `requireWebAdminWithLookup`, and available for any caller that only needs the Cognito group check without a DynamoDB lookup.

### `requireWebAdminWithLookup(event)` — async

Data-driven guard for all web-admin route handlers. Enforces two layers of authorization in sequence:

1. **Cognito group check** — delegates to `requireWebAdmin`. Throws `ForbiddenError('WebAdmin role required')` immediately if the caller is not in the WebAdmin group. No DynamoDB call is made.

2. **DynamoDB record check** — calls `getWebAdminLookup(sub)` to fetch the caller's `USER#<sub>/METADATA` item. Throws `ForbiddenError('WebAdmin record not found')` if no record exists (fail closed — a Cognito user with the WebAdmin group but no provisioned DynamoDB record is not allowed through). Throws `ForbiddenError('WebAdmin account is disabled')` if the record's `status` is not `ACTIVE`.

Returns a `WebAdminCaller` (`{ sub, web_admin_id, email, status }`) on success. Handlers should thread `web_admin_id` into every mutating service call so `modified_by_web_admin_id` is stamped on affected DynamoDB items for audit purposes.

**Why two layers?** The Cognito group check is fast and stateless — it short-circuits without a network call for non-WebAdmin callers. The DynamoDB check ensures that: (a) the caller has actually been provisioned as a WebAdmin in the application (not just added to the Cognito group), and (b) a disabled WebAdmin cannot call any API even while their Cognito token is still valid — disabling in DynamoDB takes effect immediately without needing to revoke the token.

## Auth Pattern by Role

| Role     | Guard function              | Sync/Async | DynamoDB lookup       |
| -------- | --------------------------- | ---------- | --------------------- |
| WebAdmin | `requireWebAdminWithLookup` | Async      | `USER#<sub>/METADATA` |
| OrgAdmin | (per-handler lookup)        | Async      | `USER#<sub>/METADATA` |
| Manager  | (per-handler lookup)        | Async      | `USER#<sub>/METADATA` |
| Employee | (per-handler lookup)        | Async      | `USER#<sub>/METADATA` |

All four roles now follow the same pattern: Cognito group check first, then DynamoDB provisioning check, then business logic.
