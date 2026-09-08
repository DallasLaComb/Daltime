export interface ShiftNeeded {
  shift_id: string;
  org_id: string;
  manager_id: string;
  date: string;
  start_time: string;
  end_time: string;
  employee_count: number;
  location_id: string;
  location_name: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateShiftBody {
  date: string;
  start_time: string;
  end_time: string;
  employee_count: number;
  location_id: string;
  notes?: string;
}

export type UpdateShiftBody = Partial<CreateShiftBody>;
