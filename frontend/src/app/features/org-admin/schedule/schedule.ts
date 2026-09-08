import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import type { Shift, ShiftType } from '../../../core/models/shift.model';
import type { EmployeeResponse } from '../../../core/models/employee.model';
import type { ManagerLocation } from '../../../core/models/manager-location.model';
import { OrgAdminShiftsService } from './shifts.service';
import { EmployeesService } from '../employees/employees.service';
import { OrgAdminLocationsService } from '../locations/locations.service';
import {
  ButtonComponent,
  LoadingSpinnerComponent,
  ErrorAlertComponent,
  EmptyStateComponent,
} from '@common-daltime';

export type ViewMode = 'day' | 'week' | 'month';

const SHIFT_STYLES: Record<ShiftType, string> = {
  morning: 'bg-sky-100 text-sky-700 border border-sky-200',
  afternoon: 'bg-amber-100 text-amber-700 border border-amber-200',
  night: 'bg-violet-100 text-violet-700 border border-violet-200',
};

const SHIFT_BORDER_STYLES: Record<ShiftType, string> = {
  morning: 'border-l-sky-400',
  afternoon: 'border-l-amber-400',
  night: 'border-l-violet-400',
};

const SHIFT_BADGE_STYLES: Record<ShiftType, string> = {
  morning: 'bg-sky-100 text-sky-700',
  afternoon: 'bg-amber-100 text-amber-700',
  night: 'bg-violet-100 text-violet-700',
};

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Component({
  selector: 'app-org-admin-schedule',
  imports: [ButtonComponent, LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent],
  templateUrl: './schedule.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrgAdminSchedule implements OnInit {
  private readonly shiftsService = inject(OrgAdminShiftsService);
  private readonly employeesService = inject(EmployeesService);
  private readonly locationsService = inject(OrgAdminLocationsService);

  protected readonly shiftStyles = SHIFT_STYLES;
  protected readonly shiftBorderStyles = SHIFT_BORDER_STYLES;
  protected readonly shiftBadgeStyles = SHIFT_BADGE_STYLES;

  protected readonly today = new Date();
  protected readonly viewMode = signal<ViewMode>('month');
  protected readonly currentDate = signal<Date>(new Date());

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly allShifts = signal<Shift[]>([]);
  protected readonly employees = signal<EmployeeResponse[]>([]);
  protected readonly locations = signal<ManagerLocation[]>([]);

  protected readonly filterEmployee = signal('');
  protected readonly filterLocation = signal('');
  protected readonly filterType = signal('');

  protected readonly hasActiveFilters = computed(
    () => !!this.filterEmployee() || !!this.filterLocation() || !!this.filterType(),
  );

  protected readonly filteredShifts = computed(() =>
    this.allShifts().filter((s) => {
      if (this.filterEmployee() && s.employee_id !== this.filterEmployee()) return false;
      if (this.filterLocation() && s.location_id !== this.filterLocation()) return false;
      if (this.filterType() && s.type !== this.filterType()) return false;
      return true;
    }),
  );

  protected readonly shiftsByDate = computed(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of this.filteredShifts()) {
      const existing = map.get(shift.date) ?? [];
      map.set(shift.date, [...existing, shift]);
    }
    return map;
  });

  protected readonly viewLabel = computed(() => {
    const d = this.currentDate();
    const mode = this.viewMode();
    if (mode === 'month') return d.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (mode === 'week') {
      const weekStart = this.getWeekStart(d);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return `${weekStart.toLocaleString('default', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return d.toLocaleString('default', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  });

  protected readonly calendarWeeks = computed(() => {
    const d = this.currentDate();
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [
      ...Array<null>(firstDow).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  });

  protected readonly weekDays = computed(() => {
    const weekStart = this.getWeekStart(this.currentDate());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  });

  protected readonly currentDayShifts = computed(
    () => this.shiftsByDate().get(toDateKey(this.currentDate())) ?? [],
  );

  protected readonly visibleShifts = computed((): Shift[] => {
    const mode = this.viewMode();
    const d = this.currentDate();
    const all = this.filteredShifts();
    if (mode === 'month') {
      const prefix = toMonthKey(d);
      return all.filter((s) => s.date.startsWith(prefix));
    }
    if (mode === 'week') {
      const weekStart = this.getWeekStart(d);
      const keys = new Set(
        Array.from({ length: 7 }, (_, i) => {
          const day = new Date(weekStart);
          day.setDate(day.getDate() + i);
          return toDateKey(day);
        }),
      );
      return all.filter((s) => keys.has(s.date));
    }
    return all.filter((s) => s.date === toDateKey(d));
  });

  ngOnInit(): void {
    this.loadAll();
  }

  private loadAll(): void {
    this.loading.set(true);
    this.error.set(null);
    const month = toMonthKey(this.currentDate());
    forkJoin({
      shifts: this.shiftsService.list(month),
      employees: this.employeesService.getAll(),
      locations: this.locationsService.getAll(),
    }).subscribe({
      next: ({ shifts, employees, locations }) => {
        this.allShifts.set(shifts);
        this.employees.set(employees);
        this.locations.set(locations);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load schedule. Please try again.');
        this.loading.set(false);
      },
    });
  }

  private loadShifts(): void {
    const month = toMonthKey(this.currentDate());
    this.shiftsService.list(month).subscribe({
      next: (shifts) => this.allShifts.set(shifts),
      error: () => this.error.set('Failed to refresh shifts.'),
    });
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  protected prevPeriod(): void {
    const d = new Date(this.currentDate());
    const prevMonth = toMonthKey(this.currentDate());
    if (this.viewMode() === 'month') d.setMonth(d.getMonth() - 1);
    else if (this.viewMode() === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    this.currentDate.set(d);
    if (this.viewMode() === 'month' && toMonthKey(d) !== prevMonth) this.loadShifts();
  }

  protected nextPeriod(): void {
    const d = new Date(this.currentDate());
    const prevMonth = toMonthKey(this.currentDate());
    if (this.viewMode() === 'month') d.setMonth(d.getMonth() + 1);
    else if (this.viewMode() === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    this.currentDate.set(d);
    if (this.viewMode() === 'month' && toMonthKey(d) !== prevMonth) this.loadShifts();
  }

  protected goToToday(): void {
    this.currentDate.set(new Date(this.today));
  }

  protected setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private getWeekStart(d: Date): Date {
    const result = new Date(d);
    result.setDate(d.getDate() - d.getDay());
    return result;
  }

  protected isToday(d: Date): boolean {
    return toDateKey(d) === toDateKey(this.today);
  }

  protected isTodayDay(day: number | null): boolean {
    if (day === null) return false;
    const d = this.currentDate();
    return (
      d.getFullYear() === this.today.getFullYear() &&
      d.getMonth() === this.today.getMonth() &&
      day === this.today.getDate()
    );
  }

  protected dayAbbrev(d: Date): string {
    return d.toLocaleString('default', { weekday: 'short' });
  }

  protected shiftsForDay(day: number | null): Shift[] {
    if (day === null) return [];
    const d = this.currentDate();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return this.shiftsByDate().get(key) ?? [];
  }

  protected shiftsForDate(date: Date): Shift[] {
    return this.shiftsByDate().get(toDateKey(date)) ?? [];
  }

  protected employeeName(id: string): string {
    const emp = this.employees().find((e) => e.employee_id === id);
    return emp ? `${emp.first_name} ${emp.last_name}` : id;
  }

  protected shortName(id: string): string {
    const emp = this.employees().find((e) => e.employee_id === id);
    if (!emp) return id;
    return emp.last_name ? `${emp.first_name} ${emp.last_name[0]}.` : emp.first_name;
  }

  protected locationName(id: string): string {
    return this.locations().find((l) => l.location_id === id)?.name ?? id;
  }

  protected shortLocation(id: string): string {
    const name = this.locationName(id);
    return name.length > 8 ? name.slice(0, 8) + '…' : name;
  }

  protected shortTime(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const period = h < 12 ? 'a' : 'p';
    const hour = h % 12 || 12;
    return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, '0')}${period}`;
  }

  // ── Filter event handlers ────────────────────────────────────────────────────

  protected setEmployeeFilter(event: Event): void {
    this.filterEmployee.set((event.target as HTMLSelectElement).value);
  }

  protected setLocationFilter(event: Event): void {
    this.filterLocation.set((event.target as HTMLSelectElement).value);
  }

  protected setTypeFilter(event: Event): void {
    this.filterType.set((event.target as HTMLSelectElement).value);
  }

  protected clearFilters(): void {
    this.filterEmployee.set('');
    this.filterLocation.set('');
    this.filterType.set('');
  }

  // ── Exports ──────────────────────────────────────────────────────────────────

  protected exportCsv(): void {
    const shifts = this.visibleShifts();
    const header = ['Date', 'Employee', 'Location', 'Type', 'Start Time', 'End Time'];
    const rows = shifts
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => [
        s.date,
        this.employeeName(s.employee_id),
        this.locationName(s.location_id),
        s.type.charAt(0).toUpperCase() + s.type.slice(1),
        s.start_time,
        s.end_time,
      ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule-${this.exportFilename()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected exportPdf(): void {
    const label = this.viewLabel();
    const shifts = this.visibleShifts();
    const subtitle = `DalTime · Exported ${new Date().toLocaleDateString()} · ${shifts.length} shift${shifts.length !== 1 ? 's' : ''}`;
    let body: string;
    if (this.viewMode() === 'month') body = this.buildMonthCalendarHtml();
    else if (this.viewMode() === 'week') body = this.buildWeekCalendarHtml();
    else body = this.buildDayCalendarHtml();

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Schedule — ${label}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;color:#111;background:#fff}.page{padding:20px 24px}.header{margin-bottom:14px}.header h1{font-size:17px;font-weight:700}.header p{font-size:10px;color:#888;margin-top:2px}.month-grid{display:grid;grid-template-columns:repeat(7,1fr);border:1px solid #e5e7eb;border-radius:6px;overflow:hidden}.dow-header{background:#f9fafb;padding:5px 0;text-align:center;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;border-bottom:1px solid #e5e7eb}.month-cell{min-height:80px;padding:4px 5px;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;background:#fff}.month-cell.empty{background:#f9fafb}.month-cell.today{background:#eff6ff}.day-num{font-size:9px;font-weight:600;color:#9ca3af;text-align:right;margin-bottom:3px}.chip{border-radius:3px;padding:2px 4px;margin-bottom:2px;font-size:8.5px;line-height:1.3}.chip-name{font-weight:700;display:block}.chip-detail{display:block;opacity:.75}.chip.morning{background:#e0f2fe;color:#0369a1}.chip.afternoon{background:#fef3c7;color:#92400e}.chip.night{background:#ede9fe;color:#5b21b6}.legend{display:flex;gap:14px;margin-top:10px}.legend-item{display:flex;align-items:center;gap:4px;font-size:9px;color:#6b7280}.legend-dot{width:8px;height:8px;border-radius:50%}.legend-dot.morning{background:#38bdf8}.legend-dot.afternoon{background:#fbbf24}.legend-dot.night{background:#a78bfa}</style></head><body><div class="page"><div class="header"><h1>Schedule — ${label}</h1><p>${subtitle}</p></div>${body}<div class="legend"><div class="legend-item"><div class="legend-dot morning"></div>Morning</div><div class="legend-item"><div class="legend-dot afternoon"></div>Afternoon</div><div class="legend-item"><div class="legend-dot night"></div>Night</div></div></div></body></html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  private buildMonthCalendarHtml(): string {
    const d = this.currentDate();
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [
      ...Array<null>(firstDow).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    const headers = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      .map((h) => `<div class="dow-header">${h}</div>`)
      .join('');
    const monthStr = String(month + 1).padStart(2, '0');
    const cellsHtml = cells
      .map((day) => {
        if (day === null) return `<div class="month-cell empty"></div>`;
        const isToday =
          year === this.today.getFullYear() &&
          month === this.today.getMonth() &&
          day === this.today.getDate();
        const key = `${year}-${monthStr}-${String(day).padStart(2, '0')}`;
        const dayShifts = this.shiftsByDate().get(key) ?? [];
        const chips = dayShifts
          .map(
            (s) =>
              `<div class="chip ${s.type}"><span class="chip-name">${this.shortName(s.employee_id)}</span><span class="chip-detail">${this.shortTime(s.start_time)}–${this.shortTime(s.end_time)} · ${this.shortLocation(s.location_id)}</span></div>`,
          )
          .join('');
        const numHtml = isToday
          ? `<span class="day-num" style="background:#2563eb;color:#fff;border-radius:50%;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;float:right;font-size:8px">${day}</span>`
          : `<span class="day-num">${day}</span>`;
        return `<div class="month-cell${isToday ? ' today' : ''}">${numHtml}${chips}</div>`;
      })
      .join('');
    return `<div class="month-grid">${headers}${cellsHtml}</div>`;
  }

  private buildWeekCalendarHtml(): string {
    const weekStart = this.getWeekStart(this.currentDate());
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
    const headers = days
      .map((d) => {
        const isT = toDateKey(d) === toDateKey(this.today);
        const num = isT
          ? `<div style="background:#2563eb;color:#fff;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;margin:2px auto 0;font-size:11px">${d.getDate()}</div>`
          : `<div style="font-size:13px;font-weight:600;color:#374151;margin-top:2px">${d.getDate()}</div>`;
        return `<div style="background:#f9fafb;padding:7px 4px;text-align:center;border-bottom:1px solid #e5e7eb;border-right:1px solid #e5e7eb"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280">${d.toLocaleString('default', { weekday: 'short' })}</div>${num}</div>`;
      })
      .join('');
    const cols = days
      .map((d) => {
        const dayShifts = this.shiftsByDate().get(toDateKey(d)) ?? [];
        const chips = dayShifts
          .map(
            (s) =>
              `<div class="chip ${s.type}"><span class="chip-name">${this.shortName(s.employee_id)}</span><span class="chip-detail">${this.shortTime(s.start_time)}–${this.shortTime(s.end_time)}</span></div>`,
          )
          .join('');
        const isT = toDateKey(d) === toDateKey(this.today);
        return `<div style="min-height:120px;padding:6px 4px;border-right:1px solid #e5e7eb;background:${isT ? '#eff6ff' : '#fff'}">${chips}</div>`;
      })
      .join('');
    return `<div style="display:grid;grid-template-columns:repeat(7,1fr);border:1px solid #e5e7eb;border-radius:6px;overflow:hidden"><div style="display:contents">${headers}</div><div style="display:contents">${cols}</div></div>`;
  }

  private buildDayCalendarHtml(): string {
    const shifts = this.currentDayShifts();
    if (shifts.length === 0)
      return `<div style="border:1px solid #e5e7eb;border-radius:6px;padding:32px;text-align:center;color:#9ca3af;font-size:12px;font-style:italic">No shifts scheduled for this day</div>`;
    const cards = shifts
      .map(
        (s) =>
          `<div style="display:flex;align-items:flex-start;gap:14px;padding:10px 14px;border-bottom:1px solid #f3f4f6;border-left:4px solid ${s.type === 'morning' ? '#38bdf8' : s.type === 'afternoon' ? '#fbbf24' : '#a78bfa'}"><div style="width:72px;flex-shrink:0;text-align:center"><div style="font-size:11px;font-weight:600;color:#1f2937">${s.start_time}</div><div style="font-size:9px;color:#9ca3af">to</div><div style="font-size:11px;font-weight:600;color:#1f2937">${s.end_time}</div></div><div style="flex:1"><div style="font-weight:600;font-size:11px">${this.employeeName(s.employee_id)}</div><div style="font-size:10px;color:#6b7280;margin-top:1px">${this.locationName(s.location_id)}</div></div></div>`,
      )
      .join('');
    return `<div style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">${cards}</div>`;
  }

  private exportFilename(): string {
    const d = this.currentDate();
    if (this.viewMode() === 'month')
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (this.viewMode() === 'week') return `week-of-${toDateKey(this.getWeekStart(d))}`;
    return toDateKey(d);
  }
}
