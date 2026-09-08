export type ShiftType = 'morning' | 'afternoon' | 'night';
export type ShiftStatus = 'draft' | 'published';

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
