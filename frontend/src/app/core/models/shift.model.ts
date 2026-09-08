export type ShiftType = 'morning' | 'afternoon' | 'night';

/**
 * ShiftStatus union matches the backend sentinel record shape.
 * 'draft_failed' was added in story #333 — shifts where the AI scheduling
 * attempt failed to assign an employee (employee_id is '' for these).
 */
export type ShiftStatus = 'draft' | 'published' | 'draft_failed';

export interface Shift {
  shift_id: string;
  org_id: string;
  manager_id: string;
  employee_id: string;
  employee_name: string;
  location_id: string;
  location_name: string;
  date: string;
  start_time: string;
  end_time: string;
  type: ShiftType;
  status: ShiftStatus;
  created_at: string;
  updated_at: string;
  /** True when the assigned employee has made this shift available for pickup by peers. */
  available_for_pickup?: boolean;
}

export interface CreateShiftBody {
  employee_id: string;
  location_id: string;
  date: string;
  start_time: string;
  end_time: string;
  type: ShiftType;
}

export type UpdateShiftBody = Partial<CreateShiftBody>;
