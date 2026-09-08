# Blueprint: Web Admin Impersonation

Web admins need to navigate the app _as_ any other user (OrgAdmin, Manager, Employee) to debug issues and verify what those users see. The web-admin's own JWT is always used for network calls and is what API Gateway authenticates — only the _identity the downstream business logic sees_ is substituted. The frontend uses an `ImpersonationInterceptor` to rewrite outbound role-prefixed URLs through these proxy endpoints; that interceptor is fully generic and required no change for this mechanism.

---

## How the generic dispatch works (plain language)

Historically, every real feature route (e.g. `manager/shifts`, `org-admin/notifications`) needed a second, hand-written copy registered here — both a matching `if`/regex case in this handler and a matching event in `infra/template.yaml`. That hand-maintained whitelist chronically lagged behind real feature growth: entire route groups went unreachable through impersonation for months at a time.

The proxy now works like this instead:

1. A single catch-all API Gateway route, `/web-admin/impersonate/{userId}/{proxy+}`, accepts GET/POST/PUT/PATCH/DELETE for any path shape under it.
2. The handler strips the `/impersonate/{userId}/` prefix to get the "real" sub-path (e.g. `manager/shifts/abc123`).
3. It confirms `{userId}` resolves to a real user (fail-closed — no widening of who can be impersonated).
4. A route registry (`route-registry.ts`) matches that sub-path against a table of API-Gateway-style patterns (e.g. `manager/shifts/{shiftId}`) — the same pattern syntax already used in `infra/template.yaml`. The first match wins and identifies which real Lambda handler module owns that route.
5. The handler **dynamically imports the real handler module and calls it in-process**, passing a cloned copy of the original event with the impersonated `userId` substituted for the Web-Admin's own resolved Cognito sub in the JWT claims, and the path/pathParameters rewritten to look exactly like a direct call to the real route.
6. The real handler runs completely unmodified — it cannot tell the difference between a direct call and an impersonated one. Its own authz/data-scoping logic (which always derives the caller from `getCallerSub(event)`) operates on the impersonated user's identity.

**Net effect:** adding a new real feature route only ever requires ONE new entry in `route-registry.ts` (the path pattern + which handler module owns it) — never a second copy of the route's HTTP-method/path registration, and never any change to `infra/template.yaml`'s `ImpersonateFunction` events.

---

## Routes

| Method                    | Path                                        | Auth         | Description                                           |
| ------------------------- | ------------------------------------------- | ------------ | ----------------------------------------------------- |
| GET                       | `/web-admin/impersonate/users?orgId=&role=` | WebAdmin JWT | List users available to impersonate                   |
| GET                       | `/web-admin/impersonate/{userId}/context`   | WebAdmin JWT | Fetch a user's profile + resolved role                |
| GET/POST/PUT/PATCH/DELETE | `/web-admin/impersonate/{userId}/{proxy+}`  | WebAdmin JWT | Generic dispatch to the real role handler (see above) |
| OPTIONS                   | `/web-admin/impersonate`                    | NONE         | CORS preflight                                        |
| OPTIONS                   | `/web-admin/impersonate/{userId}`           | NONE         | CORS preflight                                        |
| OPTIONS                   | `/web-admin/impersonate/{userId}/{proxy+}`  | NONE         | CORS preflight                                        |

Query params for `GET /users`:

- `orgId` (required) — restrict to a single organisation
- `role` (required) — `OrgAdmin` | `Manager` | `Employee`

The generic proxy's query params, request body, and response shape are **identical** to the real (non-impersonated) route it forwards to — there is no separate contract to document per route. See `bruno/web-admin/impersonate/generic-proxy.bru` for examples and the current list of route families reachable this way.

---

## DynamoDB Key Patterns Used (read-only, for `/users` and `/context`)

Listing users by org + role uses the primary record key structure:

| Role     | PK            | SK prefix   |
| -------- | ------------- | ----------- |
| OrgAdmin | `ORG#<orgId>` | `USER#`     |
| Manager  | `ORG#<orgId>` | `MANAGER#`  |
| Employee | `ORG#<orgId>` | `EMPLOYEE#` |

Fetching a single user's context, and the existence check the generic dispatcher runs before forwarding any proxied request, both use the reverse-lookup record:

```
PK = USER#<userId>
SK = METADATA
```

This record exists for all three role types and contains at minimum:
`user_id` / `manager_id` / `employee_id`, `org_id`, `email`, `first_name` / `name`, `last_name`, `status`.

Role is resolved by calling Cognito `AdminListGroupsForUser` on the user's Cognito sub.

The generic dispatch itself issues **no new DynamoDB calls** of its own — once it forwards to a real handler, all data access is whatever that real handler's own service/db layer already does, unchanged.

---

## Request / Response Shapes

### GET /web-admin/impersonate/users?orgId=&role=

Response `200`:

```json
[
  {
    "user_id": "abc-123",
    "display_name": "Jane Smith",
    "email": "jane@example.com",
    "status": "CONFIRMED",
    "org_id": "org-456"
  }
]
```

### GET /web-admin/impersonate/{userId}/context

Response `200`:

```json
{
  "user_id": "abc-123",
  "role": "Employee",
  "display_name": "Jane Smith",
  "email": "jane@example.com",
  "org_id": "org-456",
  "status": "CONFIRMED"
}
```

Errors:

- `404` — user not found in DynamoDB
- `400` — userId missing

### GET/POST/PUT/PATCH/DELETE /web-admin/impersonate/{userId}/{proxy+}

Response: identical to the real route it forwards to. See `route-registry.ts` for the current table of `{role}/...` patterns and which real handler module owns each; see `bruno/web-admin/impersonate/generic-proxy.bru` for representative examples.

---

## Authorization Pattern (Updated)

The impersonate handler now uses the data-driven `requireWebAdminWithLookup` guard (the same function used by the organizations, org-admins, and employees web-admin handlers) instead of the lightweight `requireWebAdmin` Cognito-group-only check.

This means two layers of authorization are enforced before any impersonation is permitted:

1. **Cognito group check** — the caller must be a member of the WebAdmin Cognito group.
2. **DynamoDB record check** — the caller's `USER#<sub>/METADATA` item must exist in DynamoDB with `status = ACTIVE`. A Cognito group membership alone is no longer sufficient; a provisioned, non-disabled WebAdmin record is required.

If either check fails, the handler returns `403 Forbidden` immediately — the impersonated user's identity is never resolved and no sub-handler is invoked.

**Synthesized event isolation:** The returned `WebAdminCaller` (which includes `web_admin_id`) is available in the handler for future audit logging. It is intentionally NOT threaded into synthesized events passed to real role handlers. Synthesized events carry only the impersonated user's `sub` in the JWT claims, so every downstream handler operates entirely on the impersonated user's identity — the web admin's identity is invisible to them.

---

## IAM / Cognito Permissions Required

```
cognito-idp:AdminGetUser
cognito-idp:AdminListGroupsForUser
dynamodb:GetItem
dynamodb:PutItem
dynamodb:UpdateItem
dynamodb:DeleteItem
dynamodb:Query
```

The `ImpersonateFunction` already carries `DynamoDBCrudPolicy` on the single `DalTimeTable` and the Cognito group-lookup permissions above. No additional IAM is required for in-process dispatch: every real handler module it dynamically imports talks to the same single table and the same Cognito user pool the `ImpersonateFunction` is already permissioned for. (If a future dispatch redesign moves to `lambda:InvokeFunction` against separate Lambda ARNs instead, that would need its own `lambda:InvokeFunction` resource-scoped policy — not needed today.)

---

## Error Handling

- `ValidationError` → 400
- `NotFoundError` → 404
- Impersonated `{userId}` does not resolve to a real user → 404 (`"Impersonated user not found"`), forwarding never happens
- `{role}/...` sub-path does not match any registered route → 400 (`"Unhandled proxy route: <method> <path>"`), never a 500
- All other unhandled errors → 500 with logged stack trace (server-side only — response body never leaks internals)
