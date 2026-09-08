# Testing Backlog

**Date:** 2026-06-06
**Companion docs:** [testing-philosophy.md](testing-philosophy.md) · [coverage-audit.md](coverage-audit.md) · [coverage-roadmap.md](coverage-roadmap.md)

This is the working queue for the coverage effort described in
[coverage-roadmap.md](coverage-roadmap.md). Items are pulled from the roadmap in phase
order and worked **one at a time**, following the workflow below — tests are never written
speculatively or in bulk ahead of approval.

## Workflow for every backlog item

> **No item moves to implementation without explicit approval of its test plan.**

For the file at the top of the queue:

1. **Analyze the file** — read it fully, including its dependencies.
2. **Explain what it does** — in terms of the product, not just the code.
3. **Explain the business rules** it encodes — what *must* be true for the system to behave correctly.
4. **Explain its dependencies** — what it calls, what calls it, what state it touches.
5. **Explain edge cases** — boundary conditions, unusual-but-valid inputs, ordering effects.
6. **Explain failure modes** — what happens when dependencies fail, inputs are malformed, or invariants are violated.
7. **Propose test cases** — for each one:
   - **Why it matters** (what real-world scenario it protects)
   - **What regression it would catch** (what could silently break without it)
   - **Classification:** `Required` / `Recommended` / `Nice-to-have`
8. **Wait for approval.** Only after the plan is reviewed and approved does implementation begin.

This mirrors the project's broader "blueprint before implementation" convention (see
`CLAUDE.md` → Development workflow) applied to tests specifically.

## Implementation rules (apply once a plan is approved)

- Prefer meaningful tests over coverage metrics — every test should be traceable to a
  specific business rule, edge case, or failure mode named in its plan.
- Test behavior and contracts, not implementation details — assert on inputs/outputs and
  observable side effects (DynamoDB writes, thrown error types, HTTP status codes), not on
  internal call sequencing or private helpers.
- Prefer one well-chosen table-driven test over five near-identical copy-pasted ones.
- No snapshot tests for anything with meaningful logic; snapshots are acceptable only for
  genuinely static, rarely-changing output where a diff *is* the assertion.
- A test that would pass after deleting the logic it claims to verify is not a meaningful test — delete it, don't keep it for the count.

---

## Queue (Phase 1 — Scheduling core)

Status legend: 🔲 not started · 📝 plan drafted, awaiting approval · ✅ approved, implementing · ✔️ done

| # | File | Status | Notes |
|---|---|---|---|
| 1.1 | `backend/src/functions/manager/schedule/service.ts` — pure helpers (`overlaps`, `effectiveAvailability`, `isAvailableForShift`, `countAvailableDays`, `datesInMonth`, `dayOfWeek`, `inferType`, `parseMonth`) | 🔲 | Start here — no mocking required, fastest path to confidence on the algorithm's building blocks |
| 1.2 | `backend/src/functions/manager/schedule/service.ts` — `generateDraftSchedule` | 🔲 | Depends on 1.1's fixtures for `WeeklySchedule`/`DateOverrides` |
| 1.3 | `backend/src/functions/manager/schedule/service.ts` — `publishSchedule`, `getDraftSummary`, `getScheduleMetaForCaller` | 🔲 | Smaller surface; can piggyback on 1.2's mock-`db` setup |
| 1.4 | `backend/src/functions/manager/schedule/db.ts` | 🔲 | Integration — establishes the Model/Query Contract pattern this roadmap reuses repeatedly |

*(Phases 2–8 will be expanded into this same per-file format as each phase is reached —
keeping the active queue short avoids the backlog itself becoming stale documentation.)*

---

## Worked example — how a queue item becomes an approved plan

To make the workflow concrete, here is the analysis for the **first** item in the queue,
presented in the exact form every subsequent item should follow. **This is a proposal, not
yet an approved plan — it is included to demonstrate the process and to be the first thing
reviewed.**

### Item 1.1 — `manager/schedule/service.ts`: pure scheduling helpers

#### What it does

These eight functions are the deterministic building blocks `generateDraftSchedule` (item
1.2) composes into the actual assignment algorithm:

- `parseMonth` / `currentMonthString` — parse/default a `YYYY-MM` month string, rejecting malformed input
- `inferType(startTime)` — classifies a shift's start time into `'morning' | 'afternoon' | 'night'`
- `datesInMonth(month)` — enumerates every calendar date in a given month as `YYYY-MM-DD` strings
- `dayOfWeek(date)` — maps a date string to a `DayOfWeek` name
- `timeToMinutes(t)` — converts `HH:MM` to minutes-since-midnight for comparison
- `overlaps(shiftStart, shiftEnd, slotFrom, slotTo)` — true if an availability slot fully contains a shift's time range
- `effectiveAvailability(date, weekly, overrides)` — resolves a specific date's availability, preferring a date-specific override over the weekly schedule, falling back to `null`
- `isAvailableForShift(avail, shiftStart, shiftEnd)` — true if a resolved availability record has a slot covering the shift
- `countAvailableDays(monthDates, weekly, overrides)` — counts how many days in a month an employee has *any* usable availability (used to rank "most constrained" employees)

#### Business rules they encode

- A month string must match `YYYY-MM`; anything else is a `ValidationError`. Defaults to the current UTC month when omitted.
- Shift "type" is purely a function of start hour: `< 12` → morning, `< 17` → afternoon, else night. This is a silent business rule — there's no validation that an employee's actual working hours match; it's a classification convenience.
- **Date-specific overrides always win over the weekly schedule** — `effectiveAvailability` checks `overrides?.[date]` first. This is the single most important business rule in this group: get this backwards and every employee who set a one-off exception gets scheduled (or not scheduled) against their explicit wishes.
- An availability slot must **fully contain** a shift's time range to count as a match (`overlaps` requires `slotFrom <= shiftStart && slotTo >= shiftEnd`) — partial overlap does not qualify someone for a shift.
- "Available days" counts only days where `available === true` *and* `slots` is non-empty — an `available: true` day with no slots does not count (a data-consistency edge case worth confirming is intentional).

#### Dependencies

- Pure functions — no `db`, no AWS SDK, no I/O. `effectiveAvailability`/`isAvailableForShift`/`countAvailableDays` depend only on the `WeeklySchedule`/`DayAvailability`/`DateOverrides` model shapes from `shared/models/employee/availability.model.ts`.
- `parseMonth` throws `ValidationError` from `shared/errors.ts`.
- All eight are **unexported internals** of `service.ts` — they are not currently importable from outside the module. *(This is a real consideration for the test plan — see "open question" below.)*

#### Edge cases

- `datesInMonth`: February in a leap year vs. non-leap year; months with 30 vs. 31 days; the UTC-boundary handling (`Date.UTC` usage suggests timezone-safety was a deliberate concern — worth a test that would catch a regression to local-time construction)
- `dayOfWeek`: first and last day of a month landing on each day of the week
- `overlaps`: exact-boundary matches (`slotFrom === shiftStart && slotTo === shiftEnd`), zero-length shifts, slot exactly one minute too short
- `effectiveAvailability`: override present but explicitly `{available: false}` (must still win over an available weekly day); weekly schedule entirely `null` (new employee with no schedule set)
- `isAvailableForShift`: `available: true` but `slots: []` or `slots: undefined`
- `countAvailableDays`: a month where overrides make every weekly-available day unavailable (should count 0, not the weekly count)
- `inferType`: boundary times exactly `12:00` and `17:00`

#### Failure modes

- `parseMonth` is the only function that throws; the rest are total functions over their input domain *as typed* — but several (`dayOfWeek`, `datesInMonth`) will produce silently-wrong results (not throw) on malformed date strings, because `Number` parsing of garbage yields `NaN`, and `Date.UTC(NaN, ...)` produces `Invalid Date`. Whether that "fails loud" or "fails silent" downstream in `generateDraftSchedule` is itself worth knowing — and is exactly the kind of thing a test would surface that a code read might miss.

#### Proposed test cases

| # | Test | Why it matters | Regression it catches | Class |
|---|---|---|---|---|
| 1 | `parseMonth` accepts `YYYY-MM`, rejects `YYYY-M`, `YYYY/MM`, empty string, `undefined` (defaults to current month) | This gate determines whether a manager's "generate schedule for March" request is honored or rejected | A loosened/tightened regex that silently accepts bad months or rejects valid ones | Required |
| 2 | `inferType` returns `morning`/`afternoon`/`night` at and around the `12:00`/`17:00` boundaries (`11:59`→morning, `12:00`→afternoon, `16:59`→afternoon, `17:00`→night) | Shift "type" is shown to managers and employees; off-by-one boundary bugs are the most common class of bug in this kind of classification | A boundary shift (`<` vs `<=`) silently reclassifying shifts | Required |
| 3 | `datesInMonth` returns the correct day count and date strings for a 28/29/30/31-day month, across a UTC-vs-local-time-sensitive date (e.g., a month where local time would shift the boundary) | This drives how many days the algorithm considers per employee — wrong count means wrong "available days" ranking | A switch from `Date.UTC` to local-time `Date` construction silently shortening/lengthening months near timezone boundaries | Required |
| 4 | `dayOfWeek` correctly maps the first day of several months to their real-world weekday | Determines which weekly-availability day a date resolves to — get it wrong and *every* availability lookup is off by one day | An off-by-one in the `DAY_NAMES` array or `getUTCDay()` indexing | Required |
| 5 | `overlaps` returns true only when the slot fully contains the shift; false for partial overlap on either side, and for a shift that's longer than the slot | This is the core "can this person work this shift" predicate — too lenient and people get scheduled outside their stated hours; too strict and available people are skipped | A `<`/`<=` boundary flip, or swapped argument order (`shiftStart`/`slotFrom`) | Required |
| 6 | `overlaps` handles exact-boundary equality (slot exactly matches shift times) | The natural, common case — most people set availability that exactly brackets their typical shifts | A strict-inequality regression that rejects exact matches | Required |
| 7 | `effectiveAvailability` prefers a date override over the weekly schedule, **including when the override marks the day unavailable** | This is the single most important rule in the group — overrides are how an employee says "I know I'm usually free Tuesdays, but not THIS Tuesday" | Override precedence silently inverted or ignored — the most user-visible possible bug ("I told you I couldn't work that day!") | Required |
| 8 | `effectiveAvailability` falls back to the weekly schedule when no override exists, and to `null` when neither exists | Covers the two other branches of the precedence chain | A new employee with no weekly schedule causing a crash instead of a clean `null`/unavailable result | Required |
| 9 | `isAvailableForShift` returns false for `available: false`, for `available: true` with empty/missing `slots`, and true only when some slot satisfies `overlaps` | Guards the gate between "resolved availability" and "can be assigned" | A short-circuit that treats `available: true` as sufficient on its own, scheduling someone with no actual time slots | Required |
| 10 | `countAvailableDays` correctly counts only days with `available: true` AND non-empty `slots`, across a month with a mix of weekly availability and overrides that both add and remove available days | This count drives the "most constrained first" sort — get it wrong and the fairness/feasibility property of the whole algorithm degrades | A miscount that systematically advantages or disadvantages certain employees in shift assignment — a fairness regression that would be very hard to notice without a direct test | Required |
| 11 | `timeToMinutes` handles midnight (`00:00`), noon, and the last minute of the day (`23:59`) | Used by `overlaps`; boundary correctness here is a prerequisite for #5/#6 | A parsing bug that silently miscalculates minutes for specific hour values (e.g., leading-zero parsing) | Recommended |
| 12 | `dayOfWeek`/`datesInMonth` behavior on malformed date strings (documenting whether they throw, return `Invalid Date`-derived garbage, or something else) | Establishes — on the record — what happens when bad data reaches these functions, since they don't validate their input | Not a regression test per se, but a **characterization test**: if this behavior ever changes (e.g., someone adds validation, or a refactor makes it throw), this test forces an explicit decision rather than a silent behavior change | Nice-to-have |

#### Open question before approval

These eight functions are currently **not exported** from `service.ts`. Two paths forward,
both consistent with `testing-philosophy.md`'s "verify behavior, not implementation
details" principle:

- **(a)** Export them (they're already pure and side-effect-free, so exporting costs
  nothing architecturally) and test them directly — fast, precise, easy to pinpoint
  failures.
- **(b)** Test them only indirectly through `generateDraftSchedule`'s observable behavior
  (item 1.2) — keeps the module's public surface unchanged, but makes failures harder to
  localize (a single wrong assignment could stem from any of eight helpers).

**Recommendation: (a)** — these functions are exactly the kind of small, pure, named
business rule that benefits from being directly nameable in a test ("this test verifies
`overlaps`" is far more useful than "this test verifies that draft generation produces the
right output, which depends on `overlaps` among seven other things"). Exporting them is a
one-line change with no behavioral effect. **This recommendation itself is part of the plan
awaiting approval.**

---

## Backlog grooming notes

- As each phase from the roadmap is reached, expand its files into this queue in the same
  format as Phase 1 above — file path, status, and a one-line note on sequencing/dependencies.
- When an item's analysis surfaces something that changes its risk assessment (e.g., "this
  file is simpler than the audit estimated" or "this file has a dependency the audit
  missed"), update [coverage-audit.md](coverage-audit.md) to match — the audit should never
  describe a stale understanding of the code.
- When a phase completes, record actual coverage deltas in
  [coverage-roadmap.md](coverage-roadmap.md)'s trajectory table.
