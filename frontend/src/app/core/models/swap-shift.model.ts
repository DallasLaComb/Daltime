import type { ShiftType } from './shift.model';

/** Status values a swap listing can be in across its lifecycle. */
export type SwapStatus = 'open' | 'claimed' | 'cancelled';

/**
 * Public shape of a swap-shift record returned from the API.
 * Mirrors backend PublicSwapShift (SwapShift with DynamoDB key fields stripped).
 * Keep this in sync with backend/src/functions/shared/models/employee/swap-shift.model.ts.
 */
export interface SwapShift {
  swap_id: string;
  org_id: string;
  shift_id: string;
  posted_by_employee_id: string;
  posted_by_employee_name: string;
  /** Manager Cognito sub, denormalized at post time for notifications. */
  manager_id: string;
  status: SwapStatus;
  /** Cognito sub of the employee who claimed the shift; null until claimed. */
  claimed_by_employee_id: string | null;
  /** Full name of the employee who claimed the shift; null until claimed. */
  claimed_by_employee_name: string | null;
  /** Denormalized shift date in YYYY-MM-DD format. */
  date: string;
  /** Denormalized shift start time in HH:MM 24-hour format. */
  start_time: string;
  /** Denormalized shift end time in HH:MM 24-hour format. */
  end_time: string;
  type: ShiftType;
  location_id: string;
  location_name: string;
  created_at: string;
  updated_at: string;
}

/**
 * Shape returned by GET /employee/swap-shifts.
 * Both panels are fetched in a single request to minimize round-trips.
 */
export interface SwapShiftsResponse {
  /** Open listings posted by OTHER employees in the same org — "Available to Take" panel. */
  available: SwapShift[];
  /** All listings posted by the calling employee (all statuses) — "My Posted Shifts" panel. */
  mine: SwapShift[];
}

/** Request body for POST /employee/swap-shifts. */
export interface PostSwapShiftBody {
  shift_id: string;
}
