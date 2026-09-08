import type { Shift, ShiftType } from '../models/shift.model';
import type { EmployeeResponse } from '../models/employee.model';
import type { ManagerLocation } from '../models/manager-location.model';

export type ViewMode = 'day' | 'week' | 'month';

export const SHIFT_STYLES: Record<ShiftType, string> = {
  morning: 'bg-sky-100 text-sky-700 border border-sky-200',
  afternoon: 'bg-amber-100 text-amber-700 border border-amber-200',
  night: 'bg-violet-100 text-violet-700 border border-violet-200',
};

export const SHIFT_BORDER_STYLES: Record<ShiftType, string> = {
  morning: 'border-l-sky-400',
  afternoon: 'border-l-amber-400',
  night: 'border-l-violet-400',
};

export const SHIFT_BADGE_STYLES: Record<ShiftType, string> = {
  morning: 'bg-sky-100 text-sky-700',
  afternoon: 'bg-amber-100 text-amber-700',
  night: 'bg-violet-100 text-violet-700',
};

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function toMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Shared schedule helper functions ─────────────────────────────────────────

export function getWeekStart(d: Date): Date {
  const result = new Date(d);
  result.setDate(d.getDate() - d.getDay());
  return result;
}

export function isToday(d: Date, today: Date): boolean {
  return toDateKey(d) === toDateKey(today);
}

export function isTodayDay(day: number | null, currentDate: Date, today: Date): boolean {
  if (day === null) return false;
  return (
    currentDate.getFullYear() === today.getFullYear() &&
    currentDate.getMonth() === today.getMonth() &&
    day === today.getDate()
  );
}

export function dayAbbrev(d: Date): string {
  return d.toLocaleString('default', { weekday: 'short' });
}

export function employeeName(id: string, employees: EmployeeResponse[]): string {
  const emp = employees.find((e) => e.employee_id === id);
  return emp ? `${emp.first_name} ${emp.last_name}` : id;
}

export function shortName(id: string, employees: EmployeeResponse[]): string {
  const emp = employees.find((e) => e.employee_id === id);
  if (!emp) return id;
  return emp.last_name ? `${emp.first_name} ${emp.last_name[0]}.` : emp.first_name;
}

export function locationName(id: string, locations: ManagerLocation[]): string {
  return locations.find((l) => l.location_id === id)?.name ?? id;
}

export function shortLocation(id: string, locations: ManagerLocation[]): string {
  const name = locationName(id, locations);
  return name.length > 8 ? name.slice(0, 8) + '…' : name;
}

export function shortTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h < 12 ? 'a' : 'p';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, '0')}${period}`;
}

export function buildViewLabel(currentDate: Date, viewMode: ViewMode): string {
  if (viewMode === 'month')
    return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  if (viewMode === 'week') {
    const weekStart = getWeekStart(currentDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return `${weekStart.toLocaleString('default', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return currentDate.toLocaleString('default', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function buildCalendarWeeks(currentDate: Date): (number | null)[][] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...new Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function buildWeekDays(currentDate: Date): Date[] {
  const weekStart = getWeekStart(currentDate);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function scheduleExportFilename(currentDate: Date, viewMode: ViewMode): string {
  if (viewMode === 'month')
    return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  if (viewMode === 'week') return `week-of-${toDateKey(getWeekStart(currentDate))}`;
  return toDateKey(currentDate);
}

export function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  return new Date(Number(year), Number(m) - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function formatShortDateLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatLongDateLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Shared schedule filter/grouping utilities ─────────────────────────────────

export interface ShiftFilters {
  employee: string;
  location: string;
  type: string;
}

export function filterShifts(shifts: Shift[], filters: ShiftFilters): Shift[] {
  return shifts.filter((s) => {
    if (filters.employee && s.employee_id !== filters.employee) return false;
    if (filters.location && s.location_id !== filters.location) return false;
    if (filters.type && s.type !== filters.type) return false;
    return true;
  });
}

export function groupShiftsByDate(shifts: Shift[]): Map<string, Shift[]> {
  const map = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const existing = map.get(shift.date) ?? [];
    map.set(shift.date, [...existing, shift]);
  }
  return map;
}

export function getVisibleShifts(
  filteredShifts: Shift[],
  currentDate: Date,
  viewMode: ViewMode,
): Shift[] {
  if (viewMode === 'month') {
    const prefix = toMonthKey(currentDate);
    return filteredShifts.filter((s) => s.date.startsWith(prefix));
  }
  if (viewMode === 'week') {
    const weekStart = getWeekStart(currentDate);
    const keys = new Set(
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return toDateKey(d);
      }),
    );
    return filteredShifts.filter((s) => keys.has(s.date));
  }
  return filteredShifts.filter((s) => s.date === toDateKey(currentDate));
}
