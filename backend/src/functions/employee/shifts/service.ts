import { stripKeys } from '../../shared/dynamo.js';
import * as db from './db.js';

import { ForbiddenError } from '../../shared/errors.js';

async function resolveCallerEmployee(
  sub: string,
): Promise<{ org_id: string; employee_id: string }> {
  const lookup = await db.getCallerLookup(sub);
  if (!lookup) throw new ForbiddenError('Caller could not be resolved');
  return lookup;
}

function parseMonth(raw: string | undefined): string {
  const d = new Date();
  const month = raw ?? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('month must be in YYYY-MM format');
  }
  return month;
}

export async function listMyShifts(callerSub: string, rawMonth: string | undefined) {
  const month = parseMonth(rawMonth);
  const { org_id, employee_id } = await resolveCallerEmployee(callerSub);
  const shifts = await db.listShiftsByEmployee(org_id, employee_id, month);
  return shifts
    .map((s) => stripKeys(s))
    .sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      return dc === 0 ? a.start_time.localeCompare(b.start_time) : dc;
    });
}
