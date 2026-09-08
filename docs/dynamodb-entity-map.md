# DynamoDB Entity Map

Single-table design reference for DalTime. Documents every record type, where entities are referenced, and what must be cleaned up on delete.

In SQL, you'd have foreign keys and `ON DELETE CASCADE`. In DynamoDB single-table design, **you are the cascade**. This doc is the map.

---

## Record Types

### Organization

| Record       | PK             | SK         | GSI1PK | GSI1SK         |
| ------------ | -------------- | ---------- | ------ | -------------- |
| Org metadata | `ORG#<org_id>` | `METADATA` | `ORG`  | `<created_at>` |

### OrgAdmin

| Record              | PK                | SK                | GSI1PK      | GSI1SK         |
| ------------------- | ----------------- | ----------------- | ----------- | -------------- |
| Primary (under org) | `ORG#<org_id>`    | `USER#<user_sub>` | `ORG_ADMIN` | `<created_at>` |
| Reverse-lookup      | `USER#<user_sub>` | `METADATA`        | —           | —              |

### Manager

| Record              | PK                  | SK                     | GSI1PK    | GSI1SK         |
| ------------------- | ------------------- | ---------------------- | --------- | -------------- |
| Primary (under org) | `ORG#<org_id>`      | `MANAGER#<manager_id>` | `MANAGER` | `<created_at>` |
| Reverse-lookup      | `USER#<manager_id>` | `METADATA`             | —         | —              |

### Employee (future)

| Record                  | PK                   | SK                       | GSI1PK     | GSI1SK         |
| ----------------------- | -------------------- | ------------------------ | ---------- | -------------- |
| Primary (under manager) | `ORG#<org_id>`       | `EMPLOYEE#<employee_id>` | `EMPLOYEE` | `<created_at>` |
| Reverse-lookup          | `USER#<employee_id>` | `METADATA`               | —          | —              |

### Shift (future)

| Record           | PK             | SK                 | GSI1PK | GSI1SK |
| ---------------- | -------------- | ------------------ | ------ | ------ |
| Shift definition | `ORG#<org_id>` | `SHIFT#<shift_id>` | TBD    | TBD    |

### Schedule Assignment (future)

| Record     | PK  | SK  | Notes                                        |
| ---------- | --- | --- | -------------------------------------------- |
| Assignment | TBD | TBD | References employee_id, shift_id, manager_id |

### WebAdmin

| Record         | PK           | SK         | GSI1PK | GSI1SK |
| -------------- | ------------ | ---------- | ------ | ------ |
| Reverse-lookup | `USER#<sub>` | `METADATA` | —      | —      |

WebAdmin is a cross-org role with no org-scoped primary record. One METADATA item per provisioned WebAdmin Cognito user. No GSI1 entry — the only required read is a point-lookup by Cognito sub (GetItem on the base table), and there is no in-app "list all WebAdmins" query; cross-tenant WebAdmin enumeration belongs at the AWS/IAM layer, not the application query layer.

Full item shape:

| Attribute      | Type   | Value / Notes                             |
| -------------- | ------ | ----------------------------------------- |
| `PK`           | String | `USER#<sub>` (Cognito sub)                |
| `SK`           | String | `METADATA`                                |
| `web_admin_id` | String | `WADMIN#<uuid>` — stable audit identifier |
| `sub`          | String | Cognito sub (mirrors PK suffix)           |
| `email`        | String | WebAdmin's email address                  |
| `first_name`   | String | Given name                                |
| `last_name`    | String | Family name                               |
| `entity_type`  | String | Always `WEB_ADMIN`                        |
| `status`       | String | `ACTIVE` or `DISABLED`                    |
| `created_at`   | String | ISO 8601                                  |

Access patterns:

| Access pattern                   | Operation        | Key expression                     |
| -------------------------------- | ---------------- | ---------------------------------- |
| Auth gate (fail-closed per call) | `GetItem` (base) | `PK = USER#<sub>`, `SK = METADATA` |

`modified_by_web_admin_id` stamping: every mutating web-admin operation (create/update/delete on Organization, OrgAdmin, and Employee records) writes `modified_by_web_admin_id = <web_admin_id>` as a top-level attribute on the affected DynamoDB item. This field is additive — no existing attribute is renamed or removed. The `web_admin_id` value originates from the `WebAdminMetadata` record resolved at the start of each request.

Items that receive `modified_by_web_admin_id` on mutation:

| Item                                                 | Operations              |
| ---------------------------------------------------- | ----------------------- |
| `ORG#<org_id>` / `METADATA` (Organization)           | create, update, delete  |
| `ORG#<org_id>` / `USER#<sub>` (OrgAdmin primary)     | create, disable, enable |
| `USER#<sub>` / `METADATA` (OrgAdmin reverse-lookup)  | create, disable, enable |
| `ORG#<org_id>` / `EMPLOYEE#<sub>` (Employee primary) | create, disable, enable |
| `USER#<sub>` / `METADATA` (Employee reverse-lookup)  | create, disable, enable |

The Employee and OrgAdmin METADATA reverse-lookup records are updated in the same write operation as their primary records (already done via `setEntityStatus` / `updateOrgAndMetadataRecord`); `modified_by_web_admin_id` must be added to both writes.

Seed command for local dev (targeting `daltime-daltime-backend-dev`):

```bash
# Replace <your-sub> with your WebAdmin Cognito user's sub (visible in Cognito console or JWT),
# and <uuid> with any UUID (e.g. output of `uuidgen | tr '[:upper:]' '[:lower:]'`).
aws dynamodb put-item \
  --table-name daltime-daltime-backend-dev \
  --item '{
    "PK":           {"S": "USER#<your-sub>"},
    "SK":           {"S": "METADATA"},
    "web_admin_id": {"S": "WADMIN#<uuid>"},
    "sub":          {"S": "<your-sub>"},
    "email":        {"S": "webadmin@example.com"},
    "first_name":   {"S": "Web"},
    "last_name":    {"S": "Admin"},
    "entity_type":  {"S": "WEB_ADMIN"},
    "status":       {"S": "ACTIVE"},
    "created_at":   {"S": "2026-06-19T00:00:00.000Z"}
  }' \
  --region us-east-1
```

No new environment variable is needed for the lookup — the existing `TABLE_NAME` env var (already set in `backend/env.local.json` for every web-admin Lambda function) is sufficient.

---

### Notification

| Record       | PK                     | SK                                            | GSI1PK   | GSI1SK   |
| ------------ | ---------------------- | --------------------------------------------- | -------- | -------- |
| Notification | `USER#<recipient_sub>` | `NOTIFICATION#<created_at>#<notification_id>` | — (none) | — (none) |

Cross-role entity: recipient is identified by Cognito `sub`, independent of org/role hierarchy. `PK = USER#<recipient_sub>` reuses the existing reverse-lookup partition convention, so cross-user isolation is enforced structurally — a caller can only Query/GetItem within their own `USER#<callerSub>` partition. `SK` embeds the ISO `created_at` first so the partition is naturally time-sorted (`ScanIndexForward=false` gives "newest first" with no GSI), with the raw notification UUID appended to guarantee uniqueness on same-millisecond writes. No GSI1 entry — every required access pattern (list-by-recipient, get-one-and-verify-owner, mark-all-unread) is served by the base table; a speculative "by type across all users" index is deferred until an actual cross-tenant admin view is specced.

Access patterns:

| Access pattern                               | Operation                                                                        | Key expression                                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| List caller's notifications, newest first    | `Query` (base table)                                                             | `PK = USER#<callerSub>` AND `begins_with(SK, "NOTIFICATION#")`, `ScanIndexForward=false` |
| Mark one notification as read (verify owner) | `GetItem` then `UpdateItem` (base table)                                         | `PK = USER#<callerSub>`, `SK = NOTIFICATION#<created_at>#<notificationId>`               |
| Mark all unread as read                      | `Query` (base table, `FilterExpression: read = :unread`) + per-item `UpdateItem` | same Query as list                                                                       |
| Create                                       | `PutItem` (base table)                                                           | as above                                                                                 |

The public `notification_id` returned to API consumers is the encoded `<created_at>#<rawId>` SK suffix (not just the raw UUID), so a single mark-read `UpdateItem` can run without a prior lookup to resolve `created_at`.

---

## Entity Relationship Hierarchy

```
Organization
├── OrgAdmin (created by WebAdmin)
│   └── owns manager_count on their USER record
├── Manager (created by OrgAdmin)
│   └── owns employee_count on their MANAGER record
│   └── owns shift definitions (future)
│   └── owns schedule assignments (future)
└── Employee (created by Manager, future)
    └── owns availability submissions (future)
    └── referenced in schedule assignments (future)
    └── referenced in shift pickups (future)
```

---

## Deletion Cascade Map

What must happen when each entity is removed from the system.

### Delete Organization

| Step | Action                                            | Record Affected             |
| ---- | ------------------------------------------------- | --------------------------- |
| 1    | Disable all OrgAdmins in Cognito                  | Cognito users               |
| 2    | Disable all Managers in Cognito                   | Cognito users               |
| 3    | Disable all Employees in Cognito                  | Cognito users               |
| 4    | Delete/mark all records under `PK = ORG#<org_id>` | All SK prefixes             |
| 5    | Delete reverse-lookups for all users              | `USER#<sub>` / `METADATA`   |
| 6    | Delete org metadata                               | `ORG#<org_id>` / `METADATA` |

### Delete OrgAdmin

| Step | Action                                   | Record Affected               |
| ---- | ---------------------------------------- | ----------------------------- |
| 1    | Disable Cognito user                     | Cognito                       |
| 2    | Update `org_admin_count` on org metadata | `ORG#<org_id>` / `METADATA`   |
| 3    | Delete primary record                    | `ORG#<org_id>` / `USER#<sub>` |
| 4    | Delete reverse-lookup                    | `USER#<sub>` / `METADATA`     |
| 5    | Reassign or orphan their managers?       | **Decision needed**           |

### Delete Manager (e.g. John Smith quits)

This is the scenario where cascading matters most. A manager is referenced by:

| Where                          | Record                                  | Field                  |
| ------------------------------ | --------------------------------------- | ---------------------- |
| Primary record                 | `ORG#<org_id>` / `MANAGER#<mgr_id>`     | — (this IS the record) |
| Reverse-lookup                 | `USER#<mgr_id>` / `METADATA`            | —                      |
| OrgAdmin's counter             | `ORG#<org_id>` / `USER#<org_admin_sub>` | `manager_count`        |
| Every employee under them      | `ORG#<org_id>` / `EMPLOYEE#<emp_id>`    | `manager_id` (future)  |
| Shift definitions they created | `ORG#<org_id>` / `SHIFT#<shift_id>`     | `manager_id` (future)  |
| Schedule assignments           | TBD                                     | `manager_id` (future)  |

**Cascade steps:**

| Step | Action                                                       | Record Affected                               |
| ---- | ------------------------------------------------------------ | --------------------------------------------- |
| 1    | Disable Cognito user                                         | Cognito                                       |
| 2    | Decrement `manager_count` on OrgAdmin                        | `ORG#<org_id>` / `USER#<org_admin_sub>`       |
| 3    | Update status to `DISABLED` on primary                       | `ORG#<org_id>` / `MANAGER#<mgr_id>`           |
| 4    | Reassign employees to another manager OR disable them        | `ORG#<org_id>` / `EMPLOYEE#<emp_id>` (future) |
| 5    | Handle future shifts — cancel, reassign, or leave unassigned | Shift/schedule records (future)               |

> **Current behavior:** Managers are soft-deleted (Cognito disabled, status set to `DISABLED`). Records are preserved. No cascade to employees/shifts yet because those features don't exist.

### Delete Employee (future)

| Where                           | Record                               | Field                   |
| ------------------------------- | ------------------------------------ | ----------------------- |
| Primary record                  | `ORG#<org_id>` / `EMPLOYEE#<emp_id>` | —                       |
| Reverse-lookup                  | `USER#<emp_id>` / `METADATA`         | —                       |
| Manager's counter               | `ORG#<org_id>` / `MANAGER#<mgr_id>`  | `employee_count`        |
| Availability submissions        | TBD                                  | `employee_id`           |
| Schedule assignments            | TBD                                  | `employee_id`           |
| Shift pickups                   | TBD                                  | `employee_id`           |
| Notifications addressed to them | `USER#<emp_id>` / `NOTIFICATION#*`   | — (recipient partition) |

> **Notification deletion is currently unaddressed.** Disabling/deleting any user (Employee, Manager, OrgAdmin) does not purge their `USER#<sub>` / `NOTIFICATION#*` partition, and a notification's `message` text may contain another user's name (e.g. "approved by Jane Doe") copied at creation time — that copy is not scrubbed if the named person is later removed. Flagged by Compliance review on issue #209; tracked in Open Questions below rather than blocking that story, consistent with how Employee/Shift cascades are already deferred.

---

## Design Principles

1. **Soft delete over hard delete** — disable Cognito user, set `status: DISABLED` in DynamoDB. Preserves audit trail and avoids orphaned references.
2. **Counters are atomic** — `manager_count`, `employee_count` use DynamoDB `ADD` operations, not read-modify-write.
3. **Reverse-lookups enable cascade discovery** — `USER#<id>` / `METADATA` stores `org_id`, allowing you to find the primary record without knowing the org upfront.
4. **Future cascades should be transactional** — when employee/shift features are built, use `TransactWriteItems` to update multiple records atomically (DynamoDB supports up to 100 items per transaction).

---

## Open Questions (resolve when building future features)

- [ ] When a Manager is deleted, should their employees be reassigned to another manager or disabled?
- [ ] When a Manager is deleted, should their future shift definitions be cancelled or reassigned?
- [ ] Should schedule assignments reference manager_id at all, or only employee_id + shift_id?
- [ ] Do we need a `DELETED` status distinct from `DISABLED` for hard-removal scenarios?
- [ ] Notification cascade (flagged by Compliance review, issue #209): should disabling/deleting a user purge their `USER#<sub>` / `NOTIFICATION#*` partition? Should a notification's `message` text be scrubbed/redacted elsewhere if it names a user who is later removed, or is that accepted as a point-in-time historical record? Add a TTL (`expires_at`, native DynamoDB TTL) for unbounded notification retention?
