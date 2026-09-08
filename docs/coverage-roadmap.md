# Coverage Roadmap

**Date:** 2026-06-06
**Companion docs:** [testing-philosophy.md](testing-philosophy.md) · [coverage-audit.md](coverage-audit.md) · [testing-backlog.md](testing-backlog.md)

This roadmap sequences the work identified in [coverage-audit.md](coverage-audit.md) into
phases that can each be picked up, reviewed, and merged independently. It optimizes for
**confidence gained per phase**, not for the fastest path to a coverage number — phases are
ordered so that the riskiest, highest-leverage code is verified first, and so that later
phases can build on test infrastructure (factories, fixtures, mocking conventions)
established in earlier ones.

> **Process reminder:** per the workflow agreed for this effort, no phase below should go
> straight to implementation. For each file, the analysis → business rules → edge cases →
> proposed test cases → approval sequence in [testing-backlog.md](testing-backlog.md) must
> run first. This roadmap describes *what order* to work through, not a green light to
> start writing tests immediately.

## Why this order

The phase order below mirrors — and justifies — the prioritization given for this effort:
**scheduling → shift assignment → authorization → location assignment → service layers →
validation helpers → handler factories → Angular state → Angular components → DTOs.**
The reasoning:

1. **Scheduling and shift assignment come first** because they're both the highest-business-impact
   code (the actual product) *and* the most algorithmically complex — the combination that
   produces the most expensive, hardest-to-detect regressions.
2. **Authorization comes next, deliberately positioned alongside scheduling** rather than
   after it, because `shared/auth.ts` and the `resolveCallerOrg` pattern are *load-bearing
   dependencies* of every service tested in phase 1 — and because authorization bugs
   (cross-tenant leaks, impersonation flaws) are the single class of defect most likely to
   cause irreversible reputational and legal damage for a multi-tenant product.
3. **Location assignment follows** — high business impact (a worker who can't be scheduled
   at their location can't work), already analyzed in depth via ADR-002, and structurally
   simple enough to test quickly once the service-layer testing pattern is established in
   phases 1–2.
4. **General service layers, validation helpers, and handler factories** come next — by
   this point the test-writing patterns (mock conventions, event/context factories, error
   assertion helpers) are established, making this phase mostly "apply the proven pattern"
   rather than "invent it."
5. **Angular state management precedes Angular components** because components consume
   that state — testing a component before its underlying state logic is verified means
   any bug found could live in either layer, and component tests become fragile proxies for
   state-logic bugs. Fix the foundation first.
6. **DTOs/components/static content come last** because they are, by design, the lowest-risk,
   lowest-complexity code in the system — exactly where coverage-for-coverage's-sake tests
   tend to accumulate without adding confidence.

---

## Phase 1 — Scheduling core (Critical)

**Goal:** verify the algorithm that *is* the product.

- `manager/schedule/service.ts` — pure-function helpers first (`overlaps`, `effectiveAvailability`,
  `isAvailableForShift`, `countAvailableDays`, `datesInMonth`, `dayOfWeek`, `inferType`,
  `parseMonth`), then `generateDraftSchedule` end-to-end behavior (draft-limit enforcement,
  empty-input paths, assignment ordering, partial-fill/`unfilled` accounting), then
  `publishSchedule`/`getDraftSummary`/`getScheduleMetaForCaller`
- `manager/schedule/db.ts` — Model & Query Contract tests per `testing-philosophy.md`
  (list-by-manager, list-drafts, meta get/upsert, publish, availability lookups)

**Establishes:** the mocking conventions for `db` modules in service tests, fixture
builders for `Employee`/`Shift`/`WeeklySchedule`/`DateOverrides`, and the integration-test
harness for DynamoDB access patterns — all of which phases 2–4 reuse directly.

**Expected gain:** raises `manager/schedule/*` from 0% to an estimated 70–85% meaningful
coverage; raises overall backend statement coverage by roughly 6–8 percentage points on its
own (this single directory is ~17% of all backend statements).

---

## Phase 2 — Shift assignment & its inputs (High/Critical)

**Goal:** verify the code that creates, edits, and validates the records the scheduler
consumes and produces.

- `manager/shifts/service.ts` (direct shift CRUD + ownership checks)
- `manager/shifts-needed/service.ts` (staffing-requirement CRUD + validation — direct
  scheduler input)
- `employee/availability/service.ts` (availability validation — direct scheduler input)
- `employee/availability-overrides/service.ts` (date-specific exceptions — direct scheduler input)
- `employee/shifts/service.ts`, `org-admin/shifts/service.ts` (read-side views)
- `manager/shifts/db.ts`, `manager/shifts-needed/db.ts` (integration)

**Expected gain:** an estimated 9 more percentage points of backend statement coverage;
closes the loop on every input/output of the Phase 1 algorithm, so a failure can be
localized to "the algorithm" vs. "the data it was given" with confidence.

---

## Phase 3 — Authorization & the impersonation boundary (Critical)

**Goal:** verify the code that decides *who is allowed to do what* — backend and frontend
halves together, since a gap in either makes the other's guarantee meaningless.

- `shared/auth.ts` (caller identity extraction — exercise the untested local-dev fallback path)
- `shared/handler-factories.ts` (the routing/auth/error-mapping plumbing shared by 7+ handlers
  — "test once, trust everywhere")
- `web-admin/impersonate/service.ts` + `handler.ts` + `db.ts` (role resolution, context
  building, proxy delegation)
- Frontend: `core/auth/auth.ts`, `core/guards/auth.guard.ts`, `core/guards/role.guard.ts`,
  `core/interceptors/auth.interceptor.ts`, `core/interceptors/impersonation.interceptor.ts`,
  `core/services/impersonation.service.ts`

**Expected gain:** smaller raw percentage contribution than phases 1–2 (this code is
comparatively compact), but the **highest confidence-per-line-of-test-code** in the entire
roadmap — this is the code where "it passed code review and looked right" has the least
correlation with "it's actually safe."

---

## Phase 4 — Location assignment (High)

**Goal:** verify the employee/manager ↔ location binding flows, informed by the existing
[ADR-002](architecture/adr-002-reject-generic-location-assignment-layer.md) analysis of
these two parallel slices.

- `org-admin/employee-locations/service.ts` + `manager-locations/service.ts` (write once,
  mirror the test plan for the pair — their near-identical structure, which ADR-002
  examined in depth, makes this unusually efficient)
- `org-admin/employee-locations/db.ts` + `manager-locations/db.ts` (integration — DynamoDB
  key-shape contracts)
- `org-admin/locations/service.ts`, `manager/locations/service.ts`

**Expected gain:** ~3–4 percentage points; this phase is comparatively fast because the
ADR-002 analysis already mapped every behavioral difference between the two slices —
writing the first slice's tests effectively designs the second's.

---

## Phase 5 — Remaining backend service layers, validation & shared helpers (High/Medium)

**Goal:** apply the now-proven testing patterns across the rest of the backend's business
logic — user-management services, shared validation, and shared infrastructure helpers.

- `org-admin/managers/service.ts`, `org-admin/employees/service.ts`, `manager/employees/service.ts`,
  `web-admin/org-admins/service.ts` (Cognito-backed user management — create/disable/enable, org scoping)
- `shared/cognito.ts` (exception → domain-error mapping — shared by all of the above)
- `shared/validation.ts` (`validateCreateUserBody` — shared by all user-creation flows)
- `shared/dynamo.ts` (remaining untested helpers beyond `stripKeys`/`buildEmployeeRecord`)
- `web-admin/organizations/service.ts`, `web-admin/employees/service.ts`,
  `org-admin/organization/service.ts`, profile services

**Expected gain:** the largest single percentage contribution in the roadmap — an
estimated 12–16 points — simply because this phase covers the largest remaining volume of
untested service code. By this point the team is applying established patterns rather than
inventing them, so velocity should be highest here.

---

## Phase 6 — Angular state management (High)

**Goal:** verify the frontend's data-shaping and state-machine logic — the Angular
equivalent of the backend service layer, and the foundation the component layer depends on.

- `core/utils/schedule.utils.ts` (pure functions — highest ROI in this phase)
- `core/utils/schedule-base.ts`, `core/utils/employee-crud-base.ts`, `core/utils/profile-base.ts`
- Feature data-access services without specs (`*.service.ts` across manager/org-admin/employee/web-admin features)

**Expected gain:** establishes frontend confidence comparable to what phases 1–5 established
for the backend; sets up component testing in Phase 7 to be testing *rendering and
interaction*, not accidentally re-testing state logic.

---

## Phase 7 — Angular components (Medium/High, selectively)

**Goal:** close the gap on large, logic-bearing feature components that currently have no
spec — *not* to chase 100% component coverage.

- `features/employee/availability/availability.ts`
- `features/manager/shifts-needed/shifts-needed.ts`
- `features/web-admin/impersonate/impersonate.ts`
- `features/org-admin/schedule/schedule.ts`, `features/employee/schedule/schedule.ts`
- User-management & location-binding modals

Per `testing-philosophy.md`: *"Component tests should remain minimal. UI behavior is
primarily validated through E2E tests."* This phase should stay focused on **logic embedded
in the component** (computed state, form validation, conditional rendering branches) —
not on re-asserting what Angular's template engine already guarantees.

**Expected gain:** modest percentage contribution; the value here is closing specific,
named gaps in logic-heavy components, not broad coverage growth.

---

## Phase 8 — DTOs, models, and static content (Low — opportunistic only)

**Goal:** *not* a coverage push. Per the audit, most of this layer should remain untested
by design. The only action item from this phase is the **model-file triage** flagged in
[coverage-audit.md §10](coverage-audit.md#10-dtos--interfaces--constants-low-priority--mostly-skip):
confirm which `*.model.ts` files contain real parsing/normalization logic (and therefore
belong in Phase 6) versus which are pure type definitions (and should stay untested).

**Expected gain:** negligible, and that's the point — this phase exists in the roadmap so
that a future contributor sees it was *considered and deliberately deprioritized*, not
overlooked.

---

## Expected coverage trajectory

| After phase | Backend statement coverage (est.) | Cumulative confidence gained |
|---|---|---|
| Baseline | 12.4% | Handler routing only |
| Phase 1 | ~20% | The core scheduling algorithm is verified |
| Phase 2 | ~29% | Every input/output of the scheduler is verified |
| Phase 3 | ~33% | The authorization boundary (incl. impersonation) is verified |
| Phase 4 | ~37% | Location-assignment flows are verified |
| Phase 5 | ~50%+ | The bulk of remaining business logic is verified |
| Phases 6–8 | *(frontend — measured separately)* | Frontend state, then components, then triage |

These numbers are **estimates derived from line counts and the "meaningful test count"
projections in the audit**, not commitments — and they are explicitly a secondary output of
this roadmap, included only so progress is visible. The primary measure of success for each
phase is the qualitative one stated in its "Goal" — i.e., "can we now trust this code
without reading it line-by-line on every change?"

## Highest-ROI opportunities (if time is constrained)

If only a subset of this roadmap can be executed, these five items deliver the most
confidence per hour of test-writing effort:

1. **`shared/handler-factories.ts`** (Phase 3) — one well-designed test suite verifies the
   plumbing shared by 7+ production handlers simultaneously.
2. **`manager/schedule/service.ts` pure-function helpers** (Phase 1) — `overlaps`,
   `effectiveAvailability`, `isAvailableForShift`, etc. are pure, deterministic, and sit at
   the exact center of the scheduling algorithm's correctness; they're also the cheapest
   tests in the entire roadmap to write (no mocking required).
3. **`shared/auth.ts`** (Phase 3) — small file, root of the entire authorization chain,
   currently has an explicitly-uncovered fallback path.
4. **`core/guards/auth.guard.ts` / `role.guard.ts`** (Phase 3) — small files, but they are
   the *only* enforcement point between an unauthorized user and a protected SPA route.
5. **The employee/manager location-assignment service pair** (Phase 4) — ADR-002 already
   did the hard analytical work of mapping their behavior; turning that analysis into tests
   is unusually fast, and it directly improves SonarCloud's view of the exact code that ADR
   discusses.

## Keeping this roadmap current

- Re-run `cd backend && npx vitest run --project unit --coverage` after each phase and
  update the trajectory table above with actuals.
- For the frontend, establish a baseline with Angular's coverage tooling
  (`ng test --code-coverage`, or the project's equivalent) before starting Phase 6, and
  record it here.
- If a phase reveals that a file's actual complexity differs materially from this roadmap's
  estimate (more or fewer branches, more or fewer dependencies), update both this roadmap
  and [coverage-audit.md](coverage-audit.md) — they should never describe a codebase that
  no longer exists.
