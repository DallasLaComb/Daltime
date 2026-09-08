# DalTime MVP Checklist

A feature is ✅ **Done** if both the backend Lambda slice and the frontend component exist. It is ⚠️ **Partial** if one side is built or real data is not yet wired in. It is 🔲 **Needed** if required for a usable MVP but not yet built. Items marked 🔲 are ordered by dependency — earlier items should be built first.

---

## 🟦 Web Admin

> Manages the platform itself — creates orgs, assigns org-admins, oversees everything.

| #   | Feature                                 | Status      | Notes                                                                                                  |
| --- | --------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| 1   | **Platform dashboard**                  | ✅ Done     | `web-admin-dashboard` component exists                                                                 |
| 2   | **Organization CRUD**                   | ✅ Done     | Backend + frontend both built                                                                          |
| 3   | **Org Admin management**                | ✅ Done     | Register, disable (soft), and re-enable OrgAdmins                                                      |
| 4   | **Employee lookup (cross-org)**         | ✅ Done     | GET /web-admin/employees — GSI1 scan enriched with org name; searchable list in frontend               |
| 5   | **Impersonate / view org as Org Admin** | ✅ Done     | Web Admin can impersonate OrgAdmin, Manager, and Employee; proxied routes use impersonated org context |
| 6   | **Billing / subscription tier**         | 🔲 Post-MVP | Nice to have after launch                                                                              |

---

## 🟩 Org Admin

> Owns one organization — manages locations, managers, employees, and views org-wide schedules.

| #   | Feature                                | Status    | Notes                                                                                              |
| --- | -------------------------------------- | --------- | -------------------------------------------------------------------------------------------------- |
| 1   | **Org Admin dashboard**                | ✅ Done   | `org-admin-dashboard` component exists                                                             |
| 2   | **Organization profile / settings**    | ✅ Done   | `organization` + `profile` feature built                                                           |
| 3   | **Manager management (CRUD)**          | ✅ Done   | Register, edit, disable (soft), and re-enable Managers                                             |
| 4   | **Location / department management**   | ✅ Done   | Backend + frontend both built                                                                      |
| 5   | **Employee management (CRUD)**         | ✅ Done   | Register, edit, disable (soft), and re-enable Employees                                            |
| 6   | **Assign employee → location**         | ✅ Done   | Many-to-many; org-admin can assign/remove from Employees page                                      |
| 7   | **Assign manager → location**          | ✅ Done   | Many-to-many; org-admin can assign/remove from Managers page                                       |
| 8   | **Org-wide schedule view (read-only)** | 🔲 Needed | See all shifts across all locations for any week/month                                             |
| 9   | **Export schedule (CSV / PDF)**        | ✅ Done   | Org admin Schedule page; CSV download + PDF print-window; respects current view period and filters |

---

## 🟨 Manager

> Owns one or more locations — creates shifts, assigns employees, publishes schedules.

| #   | Feature                                   | Status      | Notes                                                          |
| --- | ----------------------------------------- | ----------- | -------------------------------------------------------------- |
| 1   | **Manager profile**                       | ✅ Done     | `profile` feature built                                        |
| 2   | **Location view**                         | ✅ Done     | Can view their assigned location(s)                            |
| 3   | **Shifts Needed (coverage requirements)** | ✅ Done     | Full CRUD — date, time window, employee count                  |
| 4   | **Employee roster (their location)**      | ✅ Done     | Register, edit, disable (soft), and re-enable Employees        |
| 5   | **Schedule view (their location)**        | ⚠️ Partial  | Frontend shell exists; needs to render real shift data         |
| 6   | **Create / assign individual shifts**     | 🔲 Needed   | Core loop: assign a specific employee to a specific shift slot |
| 7   | **Publish / notify schedule**             | 🔲 Needed   | Employees can't act on a schedule they can't see               |
| 8   | **View employee availability**            | 🔲 Needed   | Employee data exists; manager-facing read view not yet built   |
| 9   | **Approve / deny time-off requests**      | 🔲 Needed   | Coupled with employee time-off feature                         |
| 10  | **Approve / deny shift-swap requests**    | 🔲 Needed   | Coupled with employee shift-swap feature                       |
| 11  | **Manager notifications**                 | 🔲 Needed   | In-app alerts for open shifts, swap/time-off requests          |
| 12  | **Copy previous week's schedule**         | 🔲 Post-MVP | Common manager request; saves time                             |

---

## 🟥 Employee

> Views their schedule, sets availability, requests time off, swaps shifts.

| #   | Feature                                 | Status     | Notes                                                                                                                                              |
| --- | --------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Employee dashboard**                  | ✅ Done    | `employee-dashboard` component exists                                                                                                              |
| 2   | **Employee profile**                    | ✅ Done    | GET + PUT `/employee/profile`; view/edit UI; 10-case spec covering load, edit, save, and error paths                                               |
| 3   | **View my schedule**                    | ⚠️ Partial | `schedule` component exists; needs real shift data wired in                                                                                        |
| 4   | **Set / update availability**           | ✅ Done    | Weekly recurring schedule (per-day slots + max shifts) and date-specific overrides (calendar view); multi-slot per day with shift-count preference |
| 5   | **Request time off**                    | 🔲 Needed  | Date range + reason; triggers manager notification                                                                                                 |
| 6   | **View time-off request status**        | 🔲 Needed  | Pending / approved / denied                                                                                                                        |
| 7   | **Request shift swap**                  | 🔲 Needed  | Pick a colleague, pick a shift, submit for manager approval                                                                                        |
| 8   | **Confirm / decline open shift offers** | 🔲 Needed  | Manager offers a shift → employee accepts or declines                                                                                              |
| 9   | **Employee notifications**              | 🔲 Needed  | Published schedule, swap outcome, time-off outcome                                                                                                 |

---

## 🔗 Cross-Cutting (Required for Any MVP)

These are not role-specific but block all four roles from functioning end-to-end.

| #   | Feature                             | Status     | Notes                                                                             |
| --- | ----------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| 1   | **Auth / Cognito login + JWT flow** | ✅ Done    | All roles use JWT authorizer                                                      |
| 2   | **Role-based routing & guards**     | ✅ Done    | All 4 route prefixes guarded                                                      |
| 3   | **Invitation / onboarding email**   | 🔲 Needed  | Org Admin creates an employee → employee gets a Cognito invite email              |
| 4   | **In-app notifications (basic)**    | 🔲 Needed  | At minimum: a notification bell with unread count                                 |
| 5   | **Mobile-responsive UI**            | ⚠️ Partial | Mobile fixes committed; needs full employee-view audit (employees live on phones) |
| 6   | **Error handling + empty states**   | 🔲 Needed  | Every list view needs a "nothing here yet" state                                  |

---

## Recommended Build Order for MVP

```
Phase 1 — Data Foundation
  ✅ Employee availability (backend + frontend — weekly schedule + date overrides, multi-slot)
  ✅ Assign employee/manager → location (backend + org-admin frontend)

Phase 2 — Core Scheduling Loop
  → Create/assign individual shifts (manager backend + frontend)
  → View my schedule — wire real data (employee frontend)
  → Publish schedule + notification (manager action → employee sees it)

Phase 3 — Requests & Approvals
  → Time-off request (employee submits → manager approves/denies)
  → Shift swap request (employee submits → manager approves/denies)
  → Open shift offer (manager offers → employee accepts/declines)

Phase 4 — Notifications
  → In-app notification bell (all roles)
  → Invitation email (onboarding)

Phase 5 — Polish
  → Org-wide schedule view (org admin)
  → Mobile audit (employee views)
  → Error/empty states across all list views
```

---

> **TL;DR — the biggest gap is the core scheduling loop.** Shifts Needed exists (how many people you need), but the actual shift assignment (which person fills it), schedule publishing, and employee visibility of their own schedule are all still needed. That loop is the entire product.
