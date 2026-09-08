# ADR-002: Rejecting a Generic Sub-Entity Location Assignment Service Layer

**Status:** Accepted
**Date:** 2026-06-06

## Context

Org admins can assign physical locations to two distinct kinds of org members —
employees and managers. Each relationship is implemented as its own vertical slice:
`backend/src/functions/org-admin/employee-locations/` and
`backend/src/functions/org-admin/manager-locations/`, each with its own `handler.ts`,
`service.ts`, and `db.ts`.

A broad refactor effort across the codebase had been steadily eliminating duplication
by extracting shared abstractions wherever two implementations were doing *the same
thing for the same underlying reason* — shared UI state machines, shared CRUD flows,
shared handler routing, shared record-construction helpers. The most recent such
extraction, `createSubEntityLocationsHandler`
(`backend/src/functions/shared/handler-factories.ts`), collapsed the HTTP-routing layer
of these two slices into a single factory, because the only thing that varied between
them was a path-parameter name (`employeeId` vs. `managerId`).

Static analysis subsequently flagged the layers *beneath* that shared handler —
`service.ts` and `db.ts` in both slices — as duplicated code. Rather than reflexively
extending the same extraction pattern downward, those two layers were reviewed as
candidates for further generalization. This ADR records the conclusion of that review:
**the duplication should remain**, and documents the reasoning so a future engineer
understands it as a deliberate architectural call rather than unfinished cleanup.

### What is actually duplicated

The `service.ts` pair (`listLocations`, `assignLocation`, `removeLocation`) and the
`db.ts` pair (`get{Employee,Manager}`, and `{list,get,create,delete}{Employee,Manager}Location`)
share the same control flow and the same DynamoDB access shapes (`Get`/`Query`/`Put`/`Delete`
against `USER#<id>` / `LOCATION#<id>` keys). They differ only in:

- the entity type itself (`Employee` vs. `Manager`, including the model import)
- the DynamoDB sort-key prefix (`EMPLOYEE#` vs. `MANAGER#`)
- the `user_type` discriminator persisted onto the assignment record
- the org-membership lookup used to validate the sub-entity (`getEmployee` vs. `getManager`)
- user-facing error copy ("Employee not found" vs. "Manager not found")

## Decision

**Keep `employee-locations` and `manager-locations` as two separate, concrete,
domain-specific implementations of `service.ts` and `db.ts`. Do not introduce a
generic or parameterized "sub-entity location assignment" layer to unify them.**

This is a deliberate rejection of a proposed abstraction — not an oversight, not
deferred cleanup, and not a "we'll get to it later." The resulting duplication is
accepted as the better engineering trade-off for this codebase, under the assumptions
stated below.

## Rationale

### 1. The duplication sits on a domain seam, not a syntactic one

Every abstraction extracted earlier in this refactor pass — `EmployeeCrudBaseComponent`,
`createSubEntityLocationsHandler`, `getOrgEntityRecord` — collapsed code whose *only*
variation was incidental: a path-parameter name, an injected service, a record shape
supplied by the caller. The underlying logic was genuinely one concept wearing different
clothes.

What remains here is different in kind: the variation point is **which domain entity is
being operated on**. `Employee` and `Manager` are distinct concepts in this system — separate
models, separate Cognito groups, separate org-membership semantics — and are reasonably
expected to keep diverging as role-specific scheduling features are added. A shared layer
over them would not be abstracting an implementation detail; it would be abstracting the
domain model itself. That is a fundamentally riskier kind of abstraction to introduce, and
a much more expensive one to unwind if it turns out to be wrong.

### 2. A shared layer would invert the abstraction, pushing complexity to every call site

A good abstraction absorbs variation so its callers can stay simple. A generic
`db.ts`/`service.ts` layer here would do the opposite: every call site would need to
supply an entity-type discriminator that the shared code would then use internally to
pick the right sort-key prefix, `user_type` literal, lookup function, and error copy.
Five small, self-explanatory functions per file would collapse into one generic function
per concern — configured by flags threaded in from outside. The reader's burden shifts
from "scan one short, concrete file" to "hold the generic implementation *and* every
concrete configuration of it in your head at once." That is a net loss of clarity, and
it is the textbook shape of an abstraction that costs more to use than the duplication
it was meant to remove.

This is the precise inverse of why `createSubEntityLocationsHandler` succeeded: its
single variation point (a path-param name) could be supplied once, at construction, and
never thought about again. Here the variation points are numerous, interact with each
other, recur on nearly every line, and would have to be re-supplied — correctly — at
every call site.

### 3. The duplication is shallow, adjacent, and cheap to keep honest

The two file pairs are short, live in sibling directories, are exercised by parallel
test suites, and change together by construction — a new validation rule or persisted
field for one almost always belongs on the other. A reviewer can diff the two files
directly and confirm they remain in lockstep in well under a minute. This is exactly the
profile of duplication that is cheap to audit and cheap to keep synchronized — which is
what makes tolerating it a reasonable trade rather than a latent risk.

### 4. The cost model favors concrete code for how this project is maintained

Per [ADR-001](adr-001-serverless-architecture.md), DalTime is built and run by a single
developer, and the architecture consistently optimizes for low day-to-day cognitive
overhead over structural elegance. A generic, flag-configured location-assignment layer
would shrink the line count modestly while adding a permanent "hold the abstraction in
your head" tax to every future change in this area. For two concrete implementations
that show no sign of becoming three, that tax outweighs the saving.

## Alternatives Considered

| Alternative | Why it was rejected |
|---|---|
| Generic `createSubEntityLocationsService(entityType)` factory mirroring `createSubEntityLocationsHandler` | Requires an entity-type discriminator threaded through every internal branch (sort-key prefix, `user_type`, lookup function, error copy) — trades five self-explanatory functions for one generic function configured by flags at every call site |
| Generic, parameterized `db.ts` helpers (`get{Entity}`, `list{Entity}Locations`, …) | Same leakage one layer down: DynamoDB key construction and the persisted `user_type` discriminator would have to be supplied externally, obscuring key shapes that are otherwise self-evident from the code as written |
| Shared `LocationAssignmentService<T>` base class (mirroring the frontend's `EmployeeCrudBaseComponent`) | The frontend base class works because it abstracts over UI state and modal wiring that genuinely *is* the same thing across roles. This would instead abstract over DynamoDB key construction and entity lookups that differ by *domain type* — requiring generic type parameters plus runtime configuration for keys and discriminators, ending up more complex than the two concrete files it would replace |
| Merge into a single `user-locations` slice keyed by a `userType` route parameter | Would require reshaping the API surface (routes, OPTIONS events, infra config, frontend callers — see `CLAUDE.md`'s "Feature completeness requirement") for marginal savings, and would make a single shared route responsible for two distinct org-membership models — a disproportionate increase in surface area and risk |
| Suppress the static-analysis finding and move on | Hides a deliberate decision behind a tooling exception. A future engineer would have no record of *why* the duplication exists, and might "fix" it by introducing exactly the abstraction this ADR argues against |

## Consequences

### Accepted costs

- `employee-locations` and `manager-locations` will continue to read as near-duplicate
  implementations of `service.ts`, `db.ts`, and their test suites. Static analysis will
  continue to flag this; that is expected and is not, by itself, a signal to act.
- Any business-rule change to location assignment — new validation, a new conflict rule,
  a new persisted field — must be applied to **both** slices by hand. There is no
  compiler or shared-code backstop forcing the second update; reviewers must
  deliberately check both files whenever either changes.
- A contributor unfamiliar with this ADR may reasonably propose unifying the two slices.
  This document exists so that proposal is evaluated against a recorded decision and its
  stated assumptions, rather than re-litigated from first principles each time.

### Benefits preserved

- Each slice is completely understandable on its own — a developer can read
  `employee-locations` end to end without reference to `manager-locations` or to any
  shared generic layer.
- Each slice can evolve independently if `Employee` and `Manager` location-assignment
  rules diverge further (e.g., capacity limits for one, multi-org assignment for the
  other) without first having to untangle a shared abstraction.
- Nothing here forecloses a future extraction — see Reversibility.

## Assumptions

This decision rests on the following premises. If any stop holding, the trade-off
calculus changes and this ADR should be revisited:

- **Only `Employee` and `Manager` are assigned to locations.** The argument that a
  shared layer would force entity-specific configuration onto every call site gets
  considerably weaker — and the case for a parameterized layer considerably stronger —
  once there is a third concrete implementation to amortize that cost across.
- **`Employee` and `Manager` are expected to keep diverging, not converge**, as
  role-specific scheduling features are built out. If their location-assignment rules
  instead turn out to be — and remain — identical in practice, the "domain seam"
  argument in Rationale §1 weakens substantially.
- **DalTime remains a solo-maintained project** (per ADR-001). The cost model in
  Rationale §4 is calibrated to a single maintainer's cognitive load; a team with
  dedicated owners for each domain area might reasonably strike a different balance.

## Revisit When

1. **A third sub-entity type gains location assignment** (e.g., a future "contractor"
   role, or org-admins themselves). Three concrete, near-identical implementations is a
   qualitatively stronger signal to extract a shared layer than two — the cost of
   parameterization is paid once and amortized across three call sites instead of forced
   onto two.
2. **`Employee` and `Manager` location-assignment rules diverge further** (e.g., one
   gains capacity limits, scheduling conflicts, or an approval workflow the other
   doesn't). This would *reinforce* the case for staying concrete, but is worth
   confirming explicitly rather than assumed.
3. **The two slices are observed drifting out of sync** — a fix or rule change applied
   to one and missed in the other. That would be direct evidence that the "cheap to keep
   in lockstep by inspection" premise in Rationale §3 has stopped holding, and a shared
   layer (or, at minimum, a shared parity test asserting the two stay aligned) becomes
   the safer choice.
4. **DalTime moves from a solo-maintained project to a team-maintained one.** The cost
   model this decision leans on (Rationale §4, and ADR-001 generally) is explicitly
   calibrated to a single maintainer; that calibration should be re-examined if the
   maintainership model changes.

## Reversibility

This decision is **low-risk and fully reversible**. Choosing to keep these
implementations concrete and separate commits to no migration, no data-model change, and
no API-surface contract — extracting a shared layer later remains exactly as available
as it is today. If anything, waiting preserves more information: a third real
implementation, or observed drift between the existing two, would make a future
extraction far better-informed than one attempted now from just two data points.
