# Coverage Audit

**Date:** 2026-06-06
**Companion docs:** [testing-philosophy.md](testing-philosophy.md) · [coverage-roadmap.md](coverage-roadmap.md) · [testing-backlog.md](testing-backlog.md)

This audit captures a snapshot of test coverage across the backend (`backend/src/functions`)
and frontend (`frontend/src/app`), explains what each significantly-uncovered file does, and
assigns each a risk level so that testing effort can be spent where it buys the most
confidence — not where it moves a percentage the most.

> Coverage percentages below come from `cd backend && npx vitest run --project unit --coverage`.
> The frontend figure is derived from the ratio of `.spec.ts` files to source files (26 / 110);
> Angular's coverage tool was not run for this audit — see [coverage-roadmap.md](coverage-roadmap.md)
> for how to refresh these numbers.

## Snapshot

| Layer | Statement coverage | Notes |
|---|---|---|
| Backend (`backend/src/functions`) | **12.43%** (250/2010 statements) | 9 test files, all targeting `handler.ts`. Every `service.ts` and `db.ts` in the codebase is at **0%** except where exercised incidentally through a handler test. |
| Frontend (`frontend/src/app`) | Not yet measured precisely | 26 of 110 source files have a `.spec.ts`. Coverage clusters around shared UI components and a handful of feature components; **no Angular service, guard, interceptor, or core util currently has a spec**. |

### The pattern that matters more than the percentage

The existing backend tests all target the **handler** layer (HTTP routing, status codes,
auth wiring) via mocked services — a reasonable and valuable layer to test. But this means
**100% of the actual business logic — the code that decides what happens, not just how it's
exposed over HTTP — is untested**: every `service.ts`, every `db.ts`, every validation
helper, every scheduling algorithm. That is the inverse of where the risk lives. A bug in
`generateDraftSchedule`'s assignment algorithm, in a permission check inside a `service.ts`,
or in a DynamoDB key construction in a `db.ts` will not be caught by any test in the suite
today — yet those are exactly the kinds of bugs that produce wrong schedules, cross-tenant
data leaks, or silent data corruption in production.

This audit — and the resulting roadmap — is built around closing that gap, in priority order.

---

## Risk classification key

- **Critical** — direct path to data corruption, cross-tenant data leakage, authorization bypass, payroll/scheduling errors that affect real people's work hours, or production outages. Bugs here are expensive, hard to detect after the fact, and erode user trust.
- **High** — incorrect business outcomes (wrong shift assignments, wrong permissions, wrong location bindings) that are visible to users and costly to unwind, but contained to a single feature area.
- **Medium** — incorrect behavior that degrades UX or creates support burden, but is low-blast-radius and easy to detect/fix once noticed.
- **Low** — cosmetic, narrow, or low-complexity code where a defect would be trivial to spot and fix; includes most DTOs, constants, and pure pass-through code.

---

## 1. Scheduling logic (Critical area)

### `backend/src/functions/manager/schedule/service.ts` — 298 lines, 0% covered

**What it does:** This is the heart of DalTime's product — the algorithm that turns a
manager's "shifts needed" requests into a draft schedule of actual shifts assigned to
specific employees. `generateDraftSchedule` pulls every employee's weekly availability and
date-specific overrides, computes how "constrained" each employee is (fewest available days
first), sorts open shifts chronologically, and greedily assigns the most-constrained
eligible employee to each open slot — respecting per-day `max_shifts` limits and avoiding
double-booking. It also enforces a hard cap of 10 draft generations per manager per month,
tracks draft metadata, and exposes `publishSchedule` (promotes drafts to published shifts)
and `getDraftSummary`/`getScheduleMetaForCaller`.

**Why it's Critical:**
- **Business impact** — this *is* the product. If it assigns people to shifts they can't work, double-books them, or silently drops shifts, the nonprofits that depend on DalTime get a broken schedule that real people show up to (or don't).
- **Complexity & branching** — `generateDraftSchedule` alone has a dozen+ independent decision points: draft-limit enforcement, empty-input short-circuits, availability-window overlap math (`overlaps`, `timeToMinutes`), weekly-vs-override resolution (`effectiveAvailability`), constraint-based sorting, per-day assignment caps, and partial-fill bookkeeping (`unfilled` counts).
- **Regression-proneness** — this is exactly the kind of greedy, stateful, loop-heavy algorithm that silently breaks under refactors (e.g., changing the sort comparator, the slot-key format, or the availability-resolution order) without throwing any error — it just produces a *plausible-looking but wrong* schedule.
- **Data integrity** — it writes `Shift` records directly to DynamoDB; a bug here creates bad data that downstream code (publish, employee views, payroll-adjacent reporting) will treat as ground truth.

| | |
|---|---|
| **Current coverage** | 0% |
| **Recommended test type** | Unit (pure-function helpers: `overlaps`, `effectiveAvailability`, `isAvailableForShift`, `countAvailableDays`, `datesInMonth`, `dayOfWeek`, `inferType`, `parseMonth`) + Unit-with-mocked-db (`generateDraftSchedule`, `publishSchedule`, draft-limit logic) |
| **Estimated meaningful tests** | 18–24 |
| **Risk level** | **Critical** |
| **Priority** | **1** |

---

### `backend/src/functions/manager/schedule/db.ts` — 134 lines, 0% covered

**What it does:** Data-access layer backing the scheduling service: `getCallerLookup`,
`listAllShiftsByManager`, `listDraftShiftsByManager`, `getEmployeeAvailability`/
`getEmployeeAvailabilityOverrides`, `getScheduleMeta`/`upsertScheduleMeta`, `createShift`,
`publishShift`. Encodes the DynamoDB key shapes and GSI query patterns that the scheduling
algorithm depends on.

**Why it's High (not Critical):** it's "merely" plumbing — but it's plumbing the Critical
algorithm above depends on entirely, and DynamoDB key-shape bugs (wrong `PK`/`SK`/`GSI1PK`
prefixes, wrong status filters in `listDraftShiftsByManager`) fail silently: queries return
empty results or the wrong rows rather than throwing.

| | |
|---|---|
| **Current coverage** | 0% |
| **Recommended test type** | Integration (against local/dev DynamoDB — per `testing-philosophy.md`'s Model & Query Contract rules) |
| **Estimated meaningful tests** | 8–10 (one per access pattern: list-by-manager, list-drafts, get/upsert meta, publish, availability lookups) |
| **Risk level** | **High** |
| **Priority** | **2** |

---

### `backend/src/functions/manager/schedule/handler.ts` — 50 lines, 0% covered

**What it does:** Routes `GET /manager/schedule`, `POST /manager/schedule/generate`,
`POST /manager/schedule/publish`, and meta/summary endpoints to the service functions above.

| | |
|---|---|
| **Current coverage** | 0% |
| **Recommended test type** | Unit (handler routing, mirroring the existing `org-admin/locations/handler.test.ts` pattern: mock the service, assert status codes/auth wiring/error mapping) |
| **Estimated meaningful tests** | 6–8 |
| **Risk level** | **Medium** (routing bugs are visible immediately as 4xx/CORS errors — much easier to catch than silent algorithm bugs) |
| **Priority** | **6** |

---

## 2. Shift assignment logic (Critical/High area)

### `backend/src/functions/manager/shifts/service.ts` — 181 lines, 0% covered

**What it does:** CRUD for actual assigned shifts: `createShift` (validates date/time/type,
confirms the target employee belongs to the calling manager's team, persists the shift),
`updateShift`, `removeShift`, `listShifts`. This is where a manager directly assigns (or
edits/cancels) an individual employee's shift, distinct from the bulk draft-generation
algorithm above.

**Why High:** wrong-employee assignment, cross-team assignment (a manager assigning a shift
to an employee who isn't theirs), or invalid time-range bugs translate directly into wrong
schedules and potential authorization violations (`Employee not found in your team` is a
security-relevant check, not just a UX nicety).

| | |
|---|---|
| **Current coverage** | 0% |
| **Recommended test type** | Unit (validation branches, ownership/`ForbiddenError` checks) with mocked `db` |
| **Estimated meaningful tests** | 12–16 |
| **Risk level** | **High** |
| **Priority** | **3** |

### `backend/src/functions/manager/shifts/db.ts` — 113 lines, 0% covered
Data access for the above (`listShiftsByManager`, `getShift`, `createShift`, `updateShift`,
`removeShift`, `getEmployee`, `getCallerLookup`).

| | |
|---|---|
| **Current coverage** | 0% |
| **Recommended test type** | Integration |
| **Estimated meaningful tests** | 6–8 |
| **Risk level** | **Medium** |
| **Priority** | **7** |

---

### `backend/src/functions/manager/shifts-needed/service.ts` — 188 lines, 0% covered

**What it does:** CRUD for "shifts needed" — the staffing requirements a manager defines
*before* generating a draft schedule (`date`, `start_time`/`end_time`, `employee_count`,
`location_id`, optional `notes`). Validates dates aren't in the past, time ranges are
ordered, `employee_count` is a sane integer (1–50), and notes are length-bounded. These
records are the direct input to `generateDraftSchedule` — a malformed "shift needed" record
propagates straight into the scheduling algorithm.

**Why High:** this is the upstream contract for the Critical scheduling algorithm. If
validation here is wrong (e.g., allows `employee_count: 0` or a past date through), the
draft generator either produces nonsensical output or silently skips the request.

| | |
|---|---|
| **Current coverage** | 0% |
| **Recommended test type** | Unit (validation matrix is large and almost entirely untested: date-in-past, time ordering, count bounds, notes length, partial-update validation) |
| **Estimated meaningful tests** | 14–18 |
| **Risk level** | **High** |
| **Priority** | **4** |

### `backend/src/functions/manager/shifts-needed/db.ts` — 111 lines, 0% covered

| | |
|---|---|
| **Current coverage** | 0% |
| **Recommended test type** | Integration |
| **Estimated meaningful tests** | 6–8 |
| **Risk level** | **Medium** |
| **Priority** | **8** |

---

### `backend/src/functions/employee/shifts/service.ts` — 0% covered (~23 lines)

**What it does:** `listMyShifts` — an employee's read-only view of their own assigned
shifts, scoped to their `employee_id`.

**Why Medium, not High:** small surface area, read-only, and the scoping bug class
("employee sees someone else's shifts") is the kind of thing that would surface quickly in
manual QA or a support ticket — but it *is* a tenant-isolation concern, which keeps it out
of "Low".

| | |
|---|---|
| **Current coverage** | 0% |
| **Recommended test type** | Unit |
| **Estimated meaningful tests** | 4–5 |
| **Risk level** | **Medium** |
| **Priority** | **9** |

### `backend/src/functions/org-admin/shifts/service.ts` — 0% covered (~27 lines)

**What it does:** `listShifts` for org admins — an org-wide read view across all managers'
shifts, used (among other things) by the impersonation feature (see below).

| | |
|---|---|
| **Current coverage** | 0% |
| **Recommended test type** | Unit |
| **Estimated meaningful tests** | 3–4 |
| **Risk level** | **Medium** |
| **Priority** | **10** |

---

## 3. Authorization / permission enforcement (Critical area — cross-cutting)

### `backend/src/functions/shared/auth.ts` — 31 lines, 40% covered

**What it does:** `getCallerSub` — extracts the authenticated caller's Cognito `sub` from
the API Gateway JWT authorizer claims, with a local-development fallback that manually
decodes the bearer token. **Every single authenticated request in the system flows through
this function.**

**Why Critical:** this is the root of the authorization chain. Every `resolveCallerOrg`
check in every service ultimately trusts whatever `getCallerSub` returns. The
local-dev fallback path — manually parsing a JWT without signature verification — is
explicitly *not* exercised by the existing `auth.spec` coverage (40%, lines 17 & 20-26
uncovered), and is exactly the kind of code that's easy to accidentally make reachable in a
non-local environment during a refactor.

| | |
|---|---|
| **Current coverage** | 40% (lines 17, 20–26 uncovered — the entire local-fallback decode path and its error handling) |
| **Recommended test type** | Unit |
| **Estimated meaningful tests** | 6–8 (claims present / claims absent+valid bearer / malformed bearer / non-JSON payload / missing `sub` claim / missing Authorization header) |
| **Risk level** | **Critical** |
| **Priority** | **5** |

---

### `resolveCallerOrg` / org-membership checks (cross-cutting pattern)

**What it is:** Nearly every `service.ts` in the codebase implements the same
shape of check: resolve the caller's `org_id` (and often `manager_id`) from their `sub` via
`db.getCallerLookup`, then verify that the entity being acted on (`employee`, `manager`,
`shift`, `location`, …) belongs to that `org_id` (and, for managers, to *their* team)
before allowing the operation — throwing `ForbiddenError`/`NotFoundError` otherwise. This
is DalTime's multi-tenancy boundary.

**Why Critical:** this is the difference between "Org A's manager can only see Org A's
data" and a cross-tenant data leak — one of the worst classes of bug a multi-tenant SaaS
product can ship. It is currently **completely untested** outside of the handful of cases
incidentally exercised by the existing handler tests (which mock the service entirely, so
the *actual* check never runs).

| | |
|---|---|
| **Current coverage** | ~0% (the checks live inside untested `service.ts` files) |
| **Recommended test type** | Unit, one matrix per service: "caller's org owns the entity" / "entity belongs to a different org → Forbidden/NotFound" / "entity doesn't exist → NotFound" / (for managers) "entity belongs to a different manager on the same org → Forbidden" |
| **Estimated meaningful tests** | Covered as part of each service's test suite (see entries above/below) — called out separately here because it is the single most important *behavior* to verify, not just the most important *file* |
| **Risk level** | **Critical** |
| **Priority** | **3 (folded into each service's test plan, prioritized by that service's overall ranking)** |

---

### `backend/src/functions/web-admin/impersonate/service.ts` — 425 lines, 0% covered

**What it does:** Lets web-admins (DalTime's own staff) "become" any org-admin, manager, or
employee for support/debugging purposes — listing impersonatable users, resolving their
Cognito role via `AdminListGroupsForUserCommand`, and proxying nearly every
manager/employee/org-admin operation (shifts, schedule generation, availability,
publishing) through an `ImpersonateContext`.

**Why Critical:** this is the most *powerful* and most *dangerous* code path in the system —
by design, it lets one party act as another. A bug that resolves the wrong role, leaks an
`ImpersonateContext` across orgs, or fails to scope a proxied operation to the impersonated
user's actual permissions is a direct authorization bypass. It is also DalTime's largest
single untested file (425 lines, 0%).

| | |
|---|---|
| **Current coverage** | 0% |
| **Recommended test type** | Unit (role resolution, context-building, `VALID_ROLES` enforcement, display-name fallbacks, proxy delegation) with mocked Cognito client and downstream services |
| **Estimated meaningful tests** | 16–20 |
| **Risk level** | **Critical** |
| **Priority** | **5 (paired with `auth.ts`)** |

### `backend/src/functions/web-admin/impersonate/handler.ts` — 274 lines, 0% covered
### `backend/src/functions/web-admin/impersonate/db.ts` — 156 lines, 0% covered

Routing and data access for the above. The handler is unusually large for this codebase
(274 lines vs. the ~50–90 line norm), suggesting it carries logic that arguably belongs in
the service layer — worth a look during test-writing, not as a refactor mandate.

| | |
|---|---|
| **Current coverage** | 0% / 0% |
| **Recommended test type** | Unit (handler) / Integration (db) |
| **Estimated meaningful tests** | 10–12 / 6–8 |
| **Risk level** | **High** |
| **Priority** | **11** |

---

## 4. Employee and manager location assignment

*(See [ADR-002](architecture/adr-002-reject-generic-location-assignment-layer.md) for why
these two slices remain separate implementations — that decision makes their test plans
near-identical and easy to write as a pair.)*

### `backend/src/functions/org-admin/employee-locations/service.ts` — 78 lines, 0% covered
### `backend/src/functions/org-admin/manager-locations/service.ts` — 78 lines, 0% covered

**What they do:** `listLocations`/`assignLocation`/`removeLocation` for binding an employee
(or manager) to one or more physical locations they can be scheduled at — with org-membership
checks, duplicate-assignment conflict checks (`ConflictError`), and location-existence
checks.

**Why High:** a bug here either silently fails to bind a worker to a location they need
(they can't be scheduled there) or allows binding to a location outside their org (a minor
tenant-isolation leak). The conflict-check (`getEmployeeLocation`/`getManagerLocation`)
and org-membership-check branches are exactly the kind of "looks right, isn't" logic that
regresses silently.

| | |
|---|---|
| **Current coverage** | 0% / 0% |
| **Recommended test type** | Unit (mocked `db`) — write once, mirror for the pair, per ADR-002 |
| **Estimated meaningful tests** | 9–11 each (≈20 total for the pair) |
| **Risk level** | **High** |
| **Priority** | **12** |

### `backend/src/functions/org-admin/employee-locations/db.ts` / `manager-locations/db.ts` — 81 / 78 lines, 0% covered

| | |
|---|---|
| **Current coverage** | 0% / 0% |
| **Recommended test type** | Integration (DynamoDB key-shape contract — `USER#<id>`/`LOCATION#<id>`, `user_type` discriminator) |
| **Estimated meaningful tests** | 5–6 each |
| **Risk level** | **Medium** |
| **Priority** | **13** |

### `backend/src/functions/org-admin/locations/service.ts` — 85 lines, 0% covered
### `backend/src/functions/manager/locations/service.ts` — 0% covered (~9 lines)

**What they do:** CRUD for the locations themselves (org-admin: full CRUD; manager:
presumably read-scoped — small file, worth confirming during analysis whether it's a thin
delegate or has its own logic).

| | |
|---|---|
| **Current coverage** | 0% / 0% |
| **Recommended test type** | Unit |
| **Estimated meaningful tests** | 8–10 / 2–3 |
| **Risk level** | **Medium** |
| **Priority** | **14** |

---

## 5. Backend service layers (general)

Beyond the areas singled out above, the following service layers are at 0% and contain
real (if lower-blast-radius) business logic:

| File | Purpose | Lines | Risk | Recommended type | Est. tests | Priority |
|---|---|---|---|---|---|---|
| `org-admin/managers/service.ts` | Manager CRUD via Cognito (create/disable/enable, org scoping) | 179 | **High** (Cognito + auth + user-management) | Unit | 14–18 | 15 |
| `org-admin/employees/service.ts` | Employee CRUD via Cognito (parallel to managers) | 133 | **High** | Unit | 12–14 | 16 |
| `manager/employees/service.ts` | Manager's view/management of their own team | 167 | **High** | Unit | 12–14 | 17 |
| `web-admin/org-admins/service.ts` | Web-admin management of org-admin accounts | 124 | **High** (privilege-escalation surface — creates accounts with elevated roles) | Unit | 10–12 | 18 |
| `web-admin/organizations/service.ts` | Org lifecycle (create/list/update orgs) | 64 | **Medium** | Unit | 6–8 | 21 |
| `web-admin/employees/service.ts` | Web-admin cross-org employee listing | ~7 | **Medium** | Unit | 3–4 | 22 |
| `employee/availability-overrides/service.ts` | Date-specific availability exceptions | 126 | **High** (feeds directly into `generateDraftSchedule`) | Unit | 10–12 | 19 |
| `org-admin/organization/service.ts` | An org-admin's view of their own org | 38 | **Low** | Unit | 3–4 | 23 |
| `org-admin/profile/service.ts`, `manager/profile/service.ts`, `employee/profile/service.ts` | Self-service profile read/update (thin wrappers around `shared/profile-service.ts`) | ~50 each | **Low** | Unit | 2–3 each | 24 |

---

## 6. Validation and business-rule helpers

### `backend/src/functions/employee/availability/service.ts` — 144 lines, 0% covered

**What it does:** Validates and persists an employee's weekly availability schedule —
`validateSchedule`/`validateDayEntry`/`validateSlots` enforce that each day is either
unavailable or has a non-empty array of valid, non-overlapping `{from, to}` time slots with
sane `max_shifts` bounds. **This validation directly determines what data the scheduling
algorithm later treats as "available."**

**Why High:** if invalid availability data slips through (e.g., overlapping slots,
`max_shifts` greater than the slot count), `generateDraftSchedule`'s assignment logic
operates on bad assumptions — a subtle, hard-to-trace source of "why was I scheduled when
I said I wasn't available" bugs.

| | |
|---|---|
| **Current coverage** | 0% |
| **Recommended test type** | Unit — this validation logic is a textbook case for an exhaustive table-driven test matrix |
| **Estimated meaningful tests** | 14–18 |
| **Risk level** | **High** |
| **Priority** | **4 (grouped with shifts-needed validation — both feed the scheduler)** |

### `backend/src/functions/shared/validation.ts` — 20 lines, 0% covered

**What it does:** `validateCreateUserBody` — shared validation for creating any
Cognito-backed user (employee, manager, org-admin): email format, required names, temp
password presence. Used across at least three "create user" service flows.

**Why Medium-High:** small, but it's a shared gate reused across every user-creation flow
in the system — a regression here silently weakens validation everywhere it's used at once.

| | |
|---|---|
| **Current coverage** | 0% |
| **Recommended test type** | Unit (table-driven: each required field missing/blank/invalid) |
| **Estimated meaningful tests** | 6–8 |
| **Risk level** | **Medium** |
| **Priority** | **20** |

### `backend/src/functions/shared/cognito.ts` — 127 lines, 0% covered

**What it does:** Shared Cognito helpers — `enrichWithCognitoStatus`, `createCognitoEmployee`,
`adminDisableUser`/`adminEnableUser` — wrapping AWS SDK calls with this app's
conflict/validation error mapping (`UsernameExistsException` → `ConflictError`,
`InvalidPasswordException` → `ValidationError`).

**Why High:** the exception-mapping branches are exactly the kind of code that looks
correct, is rarely exercised in dev (duplicate emails are rare in testing), and silently
returns the wrong error type to the user when it drifts — turning a "this email is taken"
into an unhelpful 500.

| | |
|---|---|
| **Current coverage** | 0% |
| **Recommended test type** | Unit (mocked Cognito client, asserting exception → domain-error mapping and the "merge status, swallow errors" behavior of `enrichWithCognitoStatus`) |
| **Estimated meaningful tests** | 8–10 |
| **Risk level** | **High** |
| **Priority** | **15 (paired with the user-management services that depend on it)** |

### `backend/src/functions/shared/dynamo.ts` — 275 lines, 22% covered

**What it does:** `stripKeys`, `buildEmployeeRecord`, plus (per the uncovered-line range
56–274) a substantial body of additional shared DynamoDB helpers not yet identified by
name in this pass — worth a closer read when this file is picked up.

| | |
|---|---|
| **Current coverage** | 22% (lines 56–274 — the bulk of the file — uncovered) |
| **Recommended test type** | Unit (pure helpers like `stripKeys`/`buildEmployeeRecord`) + Integration (anything that issues DynamoDB commands) |
| **Estimated meaningful tests** | 10–14 |
| **Risk level** | **High** (shared by nearly everything; a subtle bug here has the widest possible blast radius) |
| **Priority** | **15** |

---

## 7. Shared handler factories

### `backend/src/functions/shared/handler-factories.ts` — 157 lines, 0% covered

**What it does:** `createShiftCrudHandler`, `createSubEntityLocationsHandler`,
`createProfileHandler` — three factories that generate HTTP handlers for entire families of
routes (shifts, sub-entity locations, profiles) from a service object. As of the most recent
refactor (see [ADR-002](architecture/adr-002-reject-generic-location-assignment-layer.md)),
this file is now relied upon by **at least seven** concrete handlers.

**Why High:** because this code is shared, a single bug here propagates to every handler
built from it simultaneously — the opposite of the contained, single-slice bugs elsewhere.
It is also, structurally, the most "infrastructure-like" code in the request path: routing,
OPTIONS handling, body parsing, error mapping — exactly the kind of code that's easy to
verify in isolation and expensive to leave unverified.

| | |
|---|---|
| **Current coverage** | 0% |
| **Recommended test type** | Unit (one test suite per factory: method routing, OPTIONS short-circuit, missing-path-param handling, body-parse failure, service-error → HTTP-error mapping) — these tests *replace the need* for near-identical per-handler routing tests once the factory is proven correct |
| **Estimated meaningful tests** | 12–16 (4–6 per factory) |
| **Risk level** | **High** |
| **Priority** | **5 (high leverage — test once, trust everywhere)** |

---

## 8. Angular state management (frontend)

No spec files exist for any of the following. These are the frontend's equivalent of the
backend "service layer" gap — the code that decides *what data the UI shows and how it
reacts*, as opposed to how it's laid out.

| File | Purpose | Risk | Recommended type | Est. tests | Priority |
|---|---|---|---|---|---|
| `core/utils/schedule-base.ts` | Shared base class for manager/org-admin schedule components — signals, computed filters, navigation (`prevPeriod`/`nextPeriod`/`goToToday`), shift-grouping helpers | **High** (drives what schedule data users see and how they navigate it — silent breakage here looks like "the calendar is just wrong") | Unit (signal/computed assertions, navigation math) | 12–16 | 25 |
| `core/utils/schedule.utils.ts` | `filterShifts`, `groupShiftsByDate`, `getVisibleShifts` — pure data-shaping functions for the schedule views | **High** (pure functions = highest test ROI; directly determines what shifts render where) | Unit | 10–14 | 26 |
| `core/utils/employee-crud-base.ts` | Shared register/edit/disable/enable/modal state machine for employee & manager CRUD pages | **High** (state-machine bugs cause stuck modals, double-submits, or accounts left in inconsistent disabled/enabled states) | Unit/Component | 10–12 | 27 |
| `core/auth/auth.ts` | Auth/session state — login, token handling, role resolution | **Critical** (frontend half of the authorization boundary) | Unit | 10–14 | 5 (paired with backend `auth.ts`) |
| `core/guards/auth.guard.ts`, `core/guards/role.guard.ts` | Route guards enforcing authentication and role-based access | **Critical** (the only thing standing between an unauthenticated/wrong-role user and a protected route in the SPA) | Unit | 6–8 combined | 5 |
| `core/interceptors/auth.interceptor.ts`, `core/interceptors/impersonation.interceptor.ts` | HTTP interceptors attaching auth tokens / impersonation context to outgoing requests | **Critical** (a bug here either leaks tokens, attaches the wrong identity, or silently drops auth — affecting *every* API call) | Unit | 6–8 combined | 5 |
| `core/services/impersonation.service.ts` | Frontend impersonation session state | **Critical** (frontend half of the impersonation feature audited above) | Unit | 6–8 | 5 |
| `core/utils/profile-base.ts` | Shared profile-page state/handlers | **Medium** | Unit | 4–6 | 28 |
| `core/utils/user-status.ts` | Status-label/formatting helpers | **Low** | Unit | 2–3 | 30 |
| Feature services without specs (`employees.service.ts`, `managers.service.ts`, `shifts.service.ts`, `*-locations.service.ts`, `availability.service.ts`, `impersonate.service.ts`, `org-admins.service.ts`, `web-admin-employees.service.ts`, `organization.service.ts`, …) | Thin HTTP-client wrappers around backend endpoints — the frontend's data-access layer | **Medium** (mostly thin, but they're the seam where API contract drift first becomes visible) | Unit (mock `HttpClient`, assert request shape and response mapping) | 3–5 each | 29 |

---

## 9. Angular components (frontend)

Component coverage is the most *uneven* layer: shared UI primitives (`button`, `data-table`,
`card-list`, `confirmation-modal`, etc.) are reasonably well-specced, but several large,
logic-heavy feature components have no spec at all:

| File | Purpose | Lines | Risk | Recommended type | Est. tests | Priority |
|---|---|---|---|---|---|---|
| `features/employee/availability/availability.ts` | Employee availability editor — the UI counterpart to the heavily-validated backend availability service | 532 | **High** | Component | 10–14 | 31 |
| `features/manager/shifts-needed/shifts-needed.ts` | Manager's "shifts needed" management UI — feeds the scheduling algorithm | 243 | **High** | Component | 8–10 | 32 |
| `features/web-admin/impersonate/impersonate.ts` | Impersonation UI — start/stop impersonation, user search | 136 | **Critical** (UI half of the impersonation feature) | Component | 8–10 | 33 |
| `features/org-admin/schedule/schedule.ts`, `features/employee/schedule/schedule.ts` | Schedule views per role | 250 / 117 | **Medium** (mostly extends `ScheduleBaseComponent`, which carries the real logic — see §8) | Component | 6–8 each | 34 |
| `shared/components/register-employee-modal/`, `edit-employee-modal/`, `locations-modal/`, `employee-status-modals/` | User-management & location-binding modals | 88/71/78/30 | **Medium** | Component | 5–7 each | 35 |

Components not listed here (informational pages like `home`, `footer`, `contact`, `privacy`,
`terms`, `cookies`, `about`, `help`, `not-found`, `unauthorized`) are **Low** risk —
static content with no business logic. Per this audit's "don't test for coverage's sake"
principle, these should remain untested unless they gain interactive behavior.

---

## 10. DTOs / interfaces / constants (Low priority — mostly skip)

The following are **intentionally excluded from the testing backlog** as low-value targets:

- All files under `backend/src/functions/shared/models/**/*.model.ts` (pure TypeScript
  type definitions — nothing to execute, nothing to break in a way a test would catch)
- All files under `frontend/src/app/core/models/*.model.ts` **that contain only interfaces/types**
- `frontend/src/app/shared/components/data-table/column-def.model.ts`
- `frontend/src/app/core/auth/user-role.model.ts` (if a pure type/enum)

**Exception:** per `testing-philosophy.md`'s "Frontend Model Layer" guidance, any model file
that contains actual **parsing, normalization, or default-value logic** (not just type
shapes) should be promoted out of this category and tested as a normal unit — e.g., if
`employee-availability.model.ts` (38 lines) or `manager-shift-needed.model.ts` (25 lines)
contain response-parsing helpers rather than pure interfaces, they belong in §8 instead.
**Action item:** confirm during backlog grooming which model files are pure types vs. which
contain logic, and reclassify accordingly.

---

## Summary table — files by priority

| Pri. | File(s) | Risk | Type |
|---|---|---|---|
| 1 | `manager/schedule/service.ts` | Critical | Unit |
| 2 | `manager/schedule/db.ts` | High | Integration |
| 3 | `manager/shifts/service.ts` (+ org-membership matrix) | High | Unit |
| 4 | `manager/shifts-needed/service.ts`, `employee/availability/service.ts` | High | Unit |
| 5 | `shared/auth.ts`, `shared/handler-factories.ts`, `web-admin/impersonate/service.ts`, frontend auth/guards/interceptors/impersonation | Critical | Unit |
| 6 | `manager/schedule/handler.ts` | Medium | Unit |
| 7–8 | `manager/shifts/db.ts`, `manager/shifts-needed/db.ts` | Medium | Integration |
| 9–10 | `employee/shifts/service.ts`, `org-admin/shifts/service.ts` | Medium | Unit |
| 11 | `web-admin/impersonate/{handler,db}.ts` | High | Unit/Integration |
| 12–14 | location-assignment service/db pairs, `*/locations/service.ts` | High/Medium | Unit/Integration |
| 15–22 | remaining backend service layers (`managers`, `employees`, `org-admins`, `cognito.ts`, `dynamo.ts`, `validation.ts`, `availability-overrides`, `organizations`, …) | High/Medium | Unit |
| 23–24 | thin profile/organization services | Low | Unit |
| 25–30 | Angular state (`schedule-base`, `schedule.utils`, `employee-crud-base`, feature services, `profile-base`, `user-status`) | High→Low | Unit |
| 31–35 | Angular feature components (`availability`, `shifts-needed`, `impersonate`, schedules, modals) | High→Medium | Component |
| — | DTOs, interfaces, constants, static pages | Low | *(generally skip — see §10)* |
