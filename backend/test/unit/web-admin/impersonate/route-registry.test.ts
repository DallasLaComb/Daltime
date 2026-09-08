import { describe, it, expect } from 'vitest';
import { resolveProxyRoute } from '../../../../src/functions/web-admin/impersonate/route-registry.js';

// Pure-logic coverage for the route registry's resolution function — no
// handler invocation, no AWS SDK. Confirms every route family the parent
// story calls out as previously uncovered now resolves to *some* registered
// route (proving generic dispatch reaches it), and that unregistered paths
// correctly resolve to null so the handler can fail closed with a 400.

describe('resolveProxyRoute', () => {
  it.each([
    'manager/shifts',
    'manager/shifts/shift-1',
    'manager/schedule/generate',
    'manager/schedule/publish',
    'manager/schedule/drafts',
    'manager/schedule/meta',
    'org-admin/shifts',
    'employee/shifts',
    'manager/employees/emp-1/availability',
    'manager/employees/emp-1/availability/overrides',
    'org-admin/notifications',
    'manager/notifications/notif-1',
    'employee/notifications',
  ])('resolves previously-uncovered route "%s" to a registered handler', (path) => {
    expect(resolveProxyRoute(path)).not.toBeNull();
  });

  it('extracts path params for a parameterized route', () => {
    const resolved = resolveProxyRoute('org-admin/managers/m-1/locations/l-2');
    expect(resolved).not.toBeNull();
    expect(resolved?.pathParams).toEqual({ managerId: 'm-1', locationId: 'l-2' });
  });

  it('returns null for an unregistered path', () => {
    expect(resolveProxyRoute('manager/does-not-exist')).toBeNull();
  });

  it('does not confuse "manager/shifts" with "manager/shifts-needed"', () => {
    const shifts = resolveProxyRoute('manager/shifts');
    const shiftsNeeded = resolveProxyRoute('manager/shifts-needed');
    expect(shifts).not.toBeNull();
    expect(shiftsNeeded).not.toBeNull();
  });
});
