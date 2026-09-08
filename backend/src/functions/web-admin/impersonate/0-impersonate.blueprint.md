# Blueprint: Web Admin Impersonation

Web admins need to navigate the app _as_ any other user (OrgAdmin, Manager, Employee) to debug issues and verify what those users see. The web-admin's own JWT is always used for network calls. The frontend uses an `ImpersonationInterceptor` to rewrite outbound role-prefixed URLs through these proxy endpoints.

---

## Routes

| Method  | Path                                                    | Auth         | Description                              |
| ------- | ------------------------------------------------------- | ------------ | ---------------------------------------- |
| GET     | `/web-admin/impersonate/users?orgId=&role=`             | WebAdmin JWT | List users available to impersonate      |
| GET     | `/web-admin/impersonate/{userId}/context`               | WebAdmin JWT | Fetch a user's profile + resolved role   |
| GET     | `/web-admin/impersonate/{userId}/manager/shifts-needed` | WebAdmin JWT | Proxy: list manager's shifts for a month |
| OPTIONS | `/web-admin/impersonate`                                | NONE         | CORS preflight                           |
| OPTIONS | `/web-admin/impersonate/{userId}`                       | NONE         | CORS preflight                           |
| OPTIONS | `/web-admin/impersonate/{userId}/{proxy+}`              | NONE         | CORS preflight                           |

Query params for `GET /users`:

- `orgId` (required) — restrict to a single organisation
- `role` (required) — `OrgAdmin` | `Manager` | `Employee`

Query params for proxy `/manager/shifts-needed`:

- `month` (optional) — `YYYY-MM`, defaults to next calendar month

---

## DynamoDB Key Patterns Used (read-only)

Listing users by org + role uses the primary record key structure:

| Role     | PK            | SK prefix   |
| -------- | ------------- | ----------- |
| OrgAdmin | `ORG#<orgId>` | `USER#`     |
| Manager  | `ORG#<orgId>` | `MANAGER#`  |
| Employee | `ORG#<orgId>` | `EMPLOYEE#` |

Fetching a single user's context uses the reverse-lookup record:

```
PK = USER#<userId>
SK = METADATA
```

This record exists for all three role types and contains at minimum:
`user_id` / `manager_id` / `employee_id`, `org_id`, `email`, `first_name` / `name`, `last_name`, `status`.

Role is resolved by calling Cognito `AdminListGroupsForUser` on the user's Cognito sub.

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

### GET /web-admin/impersonate/{userId}/manager/shifts-needed

Proxied response — identical shape to `GET /manager/shifts-needed`. The manager's `user_id` (= `manager_id` in the reverse-lookup) is used to scope the GSI query.

---

## IAM / Cognito Permissions Required

```
cognito-idp:AdminGetUser
cognito-idp:AdminListGroupsForUser
dynamodb:GetItem
dynamodb:Query
```

---

## Error Handling

- `ValidationError` → 400
- `NotFoundError` → 404
- All others → 500 with logged stack trace
