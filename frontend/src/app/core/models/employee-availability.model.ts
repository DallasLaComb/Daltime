export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface TimeSlot {
  from: string; // "HH:MM"
  to: string; // "HH:MM"
}

export interface DayAvailability {
  available: boolean;
  slots?: TimeSlot[];
  max_shifts?: number;
}

export type WeeklySchedule = Record<DayOfWeek, DayAvailability>;

export interface EmployeeAvailabilityResponse {
  employee_id: string;
  org_id: string;
  schedule: WeeklySchedule;
  updated_at: string;
}

/** ISO date string → per-day availability override, e.g. "2026-05-27" */
export type DateOverrides = Record<string, DayAvailability>;

export interface EmployeeAvailabilityOverridesResponse {
  employee_id: string;
  org_id: string;
  overrides: DateOverrides;
  updated_at: string;
}
