import type { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { AdminListGroupsForUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { stripKeys } from '../../shared/dynamo.js';
import { listShifts as dbListShifts } from '../../manager/shifts-needed/db.js';
import {
  listShifts as listManagerShifts,
  createShift as createManagerShift,
  updateShift as updateManagerShift,
  removeShift as removeManagerShift,
} from '../../manager/shifts/service.js';
import { listShifts as listOrgAdminShifts } from '../../org-admin/shifts/service.js';
import { listMyShifts as listEmployeeShifts } from '../../employee/shifts/service.js';
import {
  generateDraftSchedule,
  publishSchedule,
  getDraftSummary,
} from '../../manager/schedule/service.js';
import {
  getAvailability as getEmployeeAvailability,
  upsertAvailability as upsertEmployeeAvailability,
} from '../../employee/availability/service.js';
import {
  getAvailabilityOverrides as getEmployeeAvailabilityOverrides,
  upsertAvailabilityOverrides as upsertEmployeeAvailabilityOverrides,
} from '../../employee/availability-overrides/service.js';
import type {
  UpsertAvailabilityBody,
  UpsertOverridesBody,
} from '../../shared/models/employee/availability.model.js';
import * as db from './db.js';

export class ValidationError extends Error {}
export class NotFoundError extends Error {}

const USER_POOL_ID = process.env.USER_POOL_ID!;

const VALID_ROLES = new Set(['OrgAdmin', 'Manager', 'Employee']);

export interface ImpersonateUserSummary {
  user_id: string;
  display_name: string;
  email: string;
  status: string;
  org_id: string;
}

export interface ImpersonateContext {
  user_id: string;
  role: 'OrgAdmin' | 'Manager' | 'Employee';
  display_name: string;
  email: string;
  org_id: string;
  status: string;
}

/** Resolve the Cognito group (role) for a given user sub. */
async function resolveRole(
  userId: string,
  cognitoClient: CognitoIdentityProviderClient,
): Promise<'OrgAdmin' | 'Manager' | 'Employee' | null> {
  const response = await cognitoClient.send(
    new AdminListGroupsForUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: userId,
    }),
  );
  const group = (response.Groups ?? []).find((g) => VALID_ROLES.has(g.GroupName ?? ''));
  if (!group?.GroupName) return null;
  return group.GroupName as 'OrgAdmin' | 'Manager' | 'Employee';
}

/** Build a display name from a raw DynamoDB row (handles both name and first_name/last_name). */
function buildDisplayName(row: Record<string, unknown>): string {
  if (typeof row['name'] === 'string' && row['name']) return row['name'];
  const first = typeof row['first_name'] === 'string' ? row['first_name'] : '';
  const last = typeof row['last_name'] === 'string' ? row['last_name'] : '';
  return `${first} ${last}`.trim() || 'Unknown';
}

/** List all users for an org + role that can be impersonated. */
export async function listImpersonatableUsers(
  orgId: string,
  role: string,
): Promise<ImpersonateUserSummary[]> {
  if (!orgId) throw new ValidationError('orgId is required');
  if (!VALID_ROLES.has(role)) {
    throw new ValidationError('role must be one of: OrgAdmin, Manager, Employee');
  }

  const rows = await db.listUsersByOrgAndRole(orgId, role);

  return rows.map((row) => {
    // SK is always "<ROLE>#<userId>" — extract the ID after the first "#"
    // This avoids ambiguity: employee records carry a manager_id field which
    // would otherwise be picked up before employee_id in a fallback chain.
    const skParts = (row.SK as string).split('#');
    const userId = skParts.length >= 2 ? skParts.slice(1).join('#') : '';

    return {
      user_id: userId,
      display_name: buildDisplayName(row),
      email: (row['email'] as string) ?? '',
      status: (row['status'] as string) ?? '',
      org_id: (row['org_id'] as string) ?? orgId,
    };
  });
}

/** Fetch a user's full context (profile + role) for starting impersonation. */
export async function getUserContext(
  userId: string,
  cognitoClient: CognitoIdentityProviderClient,
): Promise<ImpersonateContext> {
  const row = await db.getUserReverseLookup(userId);
  if (!row) throw new NotFoundError('User not found');

  const role = await resolveRole(userId, cognitoClient);
  if (!role) throw new NotFoundError('User has no recognised role');

  return {
    user_id: userId,
    role,
    display_name: buildDisplayName(row),
    email: (row['email'] as string) ?? '',
    org_id: (row['org_id'] as string) ?? '',
    status: (row['status'] as string) ?? '',
  };
}

/** Resolve org_id for any user (looks up USER# reverse record). */
async function resolveOrgId(userId: string): Promise<string> {
  const row = await db.getUserReverseLookup(userId);
  if (!row) throw new NotFoundError('User not found');
  const orgId = row['org_id'] as string;
  if (!orgId) throw new NotFoundError('User has no org_id');
  return orgId;
}

/** Proxy: list managers in the impersonated user's org. */
export async function getOrgManagers(userId: string): Promise<unknown[]> {
  const orgId = await resolveOrgId(userId);
  const rows = await db.listManagersByOrg(orgId);
  return rows.map((r) => stripKeys(r));
}

/** Proxy: list employees in the impersonated user's org. */
export async function getOrgEmployees(userId: string): Promise<unknown[]> {
  const orgId = await resolveOrgId(userId);
  const rows = await db.listEmployeesByOrg(orgId);
  return rows.map((r) => stripKeys(r));
}

/** Proxy: list locations in the impersonated user's org. */
export async function getOrgLocations(userId: string): Promise<unknown[]> {
  const orgId = await resolveOrgId(userId);
  const rows = await db.listLocationsByOrg(orgId);
  return rows.map((r) => stripKeys(r));
}

/** Proxy: get the org record itself. */
export async function getOrgMetadata(userId: string): Promise<unknown> {
  const orgId = await resolveOrgId(userId);
  const row = await db.getOrgMetadata(orgId);
  if (!row) throw new NotFoundError('Organisation not found');
  return stripKeys(row);
}

// ── Location-assignment proxies ──────────────────────────────────────────────

/** Proxy: list location assignments for a manager, scoped to the impersonated user's org. */
export async function getManagerLocationAssignments(
  userId: string,
  managerId: string,
): Promise<unknown[]> {
  const orgId = await resolveOrgId(userId);
  const manager = await db.getItemByPkSk(`ORG#${orgId}`, `MANAGER#${managerId}`);
  if (!manager) throw new NotFoundError('Manager not found');
  const assignments = await db.listUserLocations(managerId);
  return assignments.map((r) => stripKeys(r));
}

/** Proxy: assign a location to a manager, scoped to the impersonated user's org. */
export async function assignManagerLocation(
  userId: string,
  managerId: string,
  locationId: string,
): Promise<unknown> {
  const orgId = await resolveOrgId(userId);

  const manager = await db.getItemByPkSk(`ORG#${orgId}`, `MANAGER#${managerId}`);
  if (!manager) throw new NotFoundError('Manager not found');

  const location = await db.getItemByPkSk(`ORG#${orgId}`, `LOCATION#${locationId}`);
  if (!location) throw new NotFoundError('Location not found');

  const existing = await db.getUserLocation(managerId, locationId);
  if (existing) throw new ValidationError('Manager is already assigned to this location');

  const now = new Date().toISOString();
  const item = {
    PK: `USER#${managerId}`,
    SK: `LOCATION#${locationId}`,
    user_id: managerId,
    user_type: 'MANAGER',
    location_id: locationId,
    location_name: location['name'],
    org_id: orgId,
    assigned_by: userId,
    assigned_at: now,
  };
  await db.createUserLocation(item);
  return stripKeys(item);
}

/** Proxy: remove a location assignment from a manager. */
export async function removeManagerLocation(
  userId: string,
  managerId: string,
  locationId: string,
): Promise<void> {
  const orgId = await resolveOrgId(userId);
  const manager = await db.getItemByPkSk(`ORG#${orgId}`, `MANAGER#${managerId}`);
  if (!manager) throw new NotFoundError('Manager not found');
  const existing = await db.getUserLocation(managerId, locationId);
  if (!existing) throw new NotFoundError('Assignment not found');
  await db.deleteUserLocation(managerId, locationId);
}

/** Proxy: list location assignments for an employee, scoped to the impersonated user's org. */
export async function getEmployeeLocationAssignments(
  userId: string,
  employeeId: string,
): Promise<unknown[]> {
  const orgId = await resolveOrgId(userId);
  const employee = await db.getItemByPkSk(`ORG#${orgId}`, `EMPLOYEE#${employeeId}`);
  if (!employee) throw new NotFoundError('Employee not found');
  const assignments = await db.listUserLocations(employeeId);
  return assignments.map((r) => stripKeys(r));
}

/** Proxy: assign a location to an employee, scoped to the impersonated user's org. */
export async function assignEmployeeLocation(
  userId: string,
  employeeId: string,
  locationId: string,
): Promise<unknown> {
  const orgId = await resolveOrgId(userId);

  const employee = await db.getItemByPkSk(`ORG#${orgId}`, `EMPLOYEE#${employeeId}`);
  if (!employee) throw new NotFoundError('Employee not found');

  const location = await db.getItemByPkSk(`ORG#${orgId}`, `LOCATION#${locationId}`);
  if (!location) throw new NotFoundError('Location not found');

  const existing = await db.getUserLocation(employeeId, locationId);
  if (existing) throw new ValidationError('Employee is already assigned to this location');

  const now = new Date().toISOString();
  const item = {
    PK: `USER#${employeeId}`,
    SK: `LOCATION#${locationId}`,
    user_id: employeeId,
    user_type: 'EMPLOYEE',
    location_id: locationId,
    location_name: location['name'],
    org_id: orgId,
    assigned_by: userId,
    assigned_at: now,
  };
  await db.createUserLocation(item);
  return stripKeys(item);
}

/** Proxy: remove a location assignment from an employee. */
export async function removeEmployeeLocation(
  userId: string,
  employeeId: string,
  locationId: string,
): Promise<void> {
  const orgId = await resolveOrgId(userId);
  const employee = await db.getItemByPkSk(`ORG#${orgId}`, `EMPLOYEE#${employeeId}`);
  if (!employee) throw new NotFoundError('Employee not found');
  const existing = await db.getUserLocation(employeeId, locationId);
  if (!existing) throw new NotFoundError('Assignment not found');
  await db.deleteUserLocation(employeeId, locationId);
}

/** Proxy: list a manager's shifts-needed for a given month. */
export async function getManagerShiftsNeeded(
  managerId: string,
  rawMonth: string | undefined,
): Promise<unknown[]> {
  const month = resolveMonth(rawMonth);
  const shifts = await dbListShifts(managerId, month);
  return shifts
    .map((s) => stripKeys(s))
    .sort((a, b) => {
      const dateCompare = (a as { date: string }).date.localeCompare((b as { date: string }).date);
      return dateCompare !== 0
        ? dateCompare
        : (a as { start_time: string }).start_time.localeCompare(
            (b as { start_time: string }).start_time,
          );
    });
}

function resolveMonth(raw: string | undefined): string {
  if (!raw) return nextMonthString();
  if (!/^\d{4}-\d{2}$/.test(raw)) throw new ValidationError('month must be in YYYY-MM format');
  return raw;
}

function nextMonthString(): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ── Employee proxy routes ────────────────────────────────────────────────────

/** Proxy: get an employee's profile (DB only — no Cognito enrichment needed for impersonate view). */
export async function getEmployeeProfileProxy(userId: string): Promise<unknown> {
  const row = await db.getUserReverseLookup(userId);
  if (!row) throw new NotFoundError('Employee profile not found');
  return stripKeys(row);
}

/** Proxy: get an employee's weekly availability. Returns {} if not yet set. */
export async function getEmployeeAvailabilityProxy(userId: string): Promise<unknown> {
  const availability = await getEmployeeAvailability(userId);
  return availability ?? {};
}

/** Proxy: save an employee's weekly availability. */
export async function upsertEmployeeAvailabilityProxy(
  userId: string,
  body: UpsertAvailabilityBody,
): Promise<unknown> {
  return upsertEmployeeAvailability(userId, body);
}

/** Proxy: get an employee's date-specific availability overrides. Returns {} if not yet set. */
export async function getEmployeeAvailabilityOverridesProxy(userId: string): Promise<unknown> {
  const overrides = await getEmployeeAvailabilityOverrides(userId);
  return overrides ?? {};
}

/** Proxy: save an employee's date-specific availability overrides. */
export async function upsertEmployeeAvailabilityOverridesProxy(
  userId: string,
  body: UpsertOverridesBody,
): Promise<unknown> {
  return upsertEmployeeAvailabilityOverrides(userId, body);
}

// ── Shift proxy routes ───────────────────────────────────────────────────────

/** Proxy: list an org-admin's org shifts for a given month. */
export async function getOrgAdminShiftsProxy(
  userId: string,
  rawMonth: string | undefined,
): Promise<unknown[]> {
  return listOrgAdminShifts(userId, rawMonth);
}

/** Proxy: list a manager's shifts for a given month. */
export async function getManagerShiftsProxy(
  userId: string,
  rawMonth: string | undefined,
): Promise<unknown[]> {
  return listManagerShifts(userId, rawMonth);
}

/** Proxy: create a shift on behalf of an impersonated manager. */
export async function createManagerShiftProxy(
  userId: string,
  body: Parameters<typeof createManagerShift>[1],
): Promise<unknown> {
  return createManagerShift(userId, body);
}

/** Proxy: update a shift on behalf of an impersonated manager. */
export async function updateManagerShiftProxy(
  userId: string,
  shiftId: string,
  body: Parameters<typeof updateManagerShift>[2],
): Promise<unknown> {
  return updateManagerShift(userId, shiftId, body);
}

/** Proxy: delete a shift on behalf of an impersonated manager. */
export async function removeManagerShiftProxy(userId: string, shiftId: string): Promise<void> {
  return removeManagerShift(userId, shiftId);
}

/** Proxy: list an employee's shifts for a given month. */
export async function getEmployeeShiftsProxy(
  userId: string,
  rawMonth: string | undefined,
): Promise<unknown[]> {
  return listEmployeeShifts(userId, rawMonth);
}

/** Proxy: generate a draft schedule for an impersonated manager. */
export async function generateDraftScheduleProxy(
  userId: string,
  rawMonth: string | undefined,
): Promise<unknown> {
  return generateDraftSchedule(userId, rawMonth);
}

/** Proxy: publish a draft schedule for an impersonated manager. */
export async function publishScheduleProxy(
  userId: string,
  rawMonth: string | undefined,
): Promise<unknown> {
  return publishSchedule(userId, rawMonth);
}

/** Proxy: get draft shift summary for an impersonated manager. */
export async function getDraftSummaryProxy(
  userId: string,
  rawMonth: string | undefined,
): Promise<unknown> {
  return getDraftSummary(userId, rawMonth);
}
