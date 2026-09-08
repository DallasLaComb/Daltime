export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface TimeSlot {
  /** "HH:MM" 24-hour, e.g. "09:00" */
  from: string;
  /** "HH:MM" 24-hour, e.g. "17:00" */
  to: string;
}

export interface DayAvailability {
  available: boolean;
  /** One or more availability windows. Required when available is true. */
  slots?: TimeSlot[];
  /** How many shifts the employee is willing to work. 1 ≤ max_shifts ≤ slots.length */
  max_shifts?: number;
}

export type WeeklySchedule = Record<DayOfWeek, DayAvailability>;

export interface EmployeeAvailability {
  PK: string; // USER#<employeeId>
  SK: string; // AVAILABILITY
  employee_id: string;
  org_id: string;
  schedule: WeeklySchedule;
  updated_at: string;
}

export interface UpsertAvailabilityBody {
  schedule: WeeklySchedule;
}

/** ISO date string key → per-day availability override, e.g. "2026-05-27" */
export type DateOverrides = Record<string, DayAvailability>;

export interface EmployeeAvailabilityOverrides {
  PK: string; // USER#<employeeId>
  SK: string; // AVAILABILITY_OVERRIDES
  employee_id: string;
  org_id: string;
  overrides: DateOverrides;
  updated_at: string;
}

export interface UpsertOverridesBody {
  overrides: DateOverrides;
}
