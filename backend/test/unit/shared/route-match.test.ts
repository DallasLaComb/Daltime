import { describe, it, expect } from 'vitest';
import { matchPath } from '../../../src/functions/shared/route-match.js';

// Pure-logic tests for the generic API-Gateway-style path matcher that
// backs the impersonation proxy's generic dispatch (see
// web-admin/impersonate/route-registry.ts). No AWS SDK involved.

describe('matchPath', () => {
  it('matches a literal pattern with no params', () => {
    expect(matchPath('manager/shifts', 'manager/shifts')).toEqual({});
  });

  it('returns null for a non-matching literal pattern', () => {
    expect(matchPath('manager/shifts', 'manager/shifts-needed')).toBeNull();
  });

  it('extracts a single named path parameter', () => {
    expect(matchPath('manager/shifts/{shiftId}', 'manager/shifts/abc-123')).toEqual({
      shiftId: 'abc-123',
    });
  });

  it('extracts multiple named path parameters', () => {
    expect(
      matchPath(
        'org-admin/managers/{managerId}/locations/{locationId}',
        'org-admin/managers/m-1/locations/l-2',
      ),
    ).toEqual({ managerId: 'm-1', locationId: 'l-2' });
  });

  it('does not match when the path has extra trailing segments', () => {
    expect(matchPath('manager/shifts/{shiftId}', 'manager/shifts/abc-123/extra')).toBeNull();
  });

  it('does not match when the path is missing a required segment', () => {
    expect(matchPath('manager/shifts/{shiftId}', 'manager/shifts')).toBeNull();
  });

  it('does not let a path param capture a slash (no cross-segment matching)', () => {
    expect(matchPath('manager/shifts/{shiftId}', 'manager/shifts/a/b')).toBeNull();
  });

  it('treats regex special characters in literal segments as literal', () => {
    expect(matchPath('manager/schedule/drafts', 'manager/schedule/drafts')).toEqual({});
    expect(matchPath('manager/schedule/drafts', 'manager/scheduleXdrafts')).toBeNull();
  });
});
