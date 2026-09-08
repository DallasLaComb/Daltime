import type { ShiftType } from '../manager/shift.model.js';

/** Status values a swap listing can be in across its lifecycle. */
export type SwapStatus = 'open' | 'claimed' | 'cancelled';

/**
 * Full DynamoDB record shape for a SWAP# item.
 * Key fields (PK, SK, GSI1PK, GSI1SK) are included here so db.ts can write
 * complete records; callers should use stripKeys() before returning to API consumers.
 */
export interface SwapShift {
  PK: string; // ORG#<orgId>
  SK: string; // SWAP#<swapId>
  GSI1PK: string; // ORG_SWAP#<orgId>
  GSI1SK: string; // STATUS#<status>#<created_at>
  swap_id: string;
  org_id: string;
  shift_id: string;
  posted_by_employee_id: string;
  posted_by_employee_name: string;
  /** Manager's Cognito sub, denormalized at post time so claim can notify without extra fetch. */
  manager_id: string;
  status: SwapStatus;
  /** Cognito sub of the employee who claimed the shift; null until claimed. */
  claimed_by_employee_id: string | null;
  /** Full name of the employee who claimed the shift; null until claimed. */
  claimed_by_employee_name: string | null;
  /** Denormalized shift date in YYYY-MM-DD format. */
  date: string;
  /** Denormalized shift start time in HH:MM format. */
  start_time: string;
  /** Denormalized shift end time in HH:MM format. */
  end_time: string;
  type: ShiftType;
  location_id: string;
  location_name: string;
  created_at: string;
  updated_at: string;
}

/**
 * Public shape returned to API consumers — DynamoDB key fields stripped.
 * This is what service.ts and handler.ts should pass to stripKeys() to produce.
 */
export type PublicSwapShift = Omit<SwapShift, 'PK' | 'SK' | 'GSI1PK' | 'GSI1SK'>;
