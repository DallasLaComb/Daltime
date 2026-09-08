export type ShiftType = 'morning' | 'afternoon' | 'night';
/** Shift status values. 'draft_failed' marks an unfillable slot sentinel written during draft generation. */
export type ShiftStatus = 'draft' | 'published' | 'draft_failed';

export interface Shift {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
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
