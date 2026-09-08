import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import type { Shift, ShiftType, CreateShiftBody } from '../../../core/models/shift.model';
import type { EmployeeResponse } from '../../../core/models/employee.model';
import type { ManagerLocation } from '../../../core/models/manager-location.model';
import type { ShiftNeeded } from '../../../core/models/manager-shift-needed.model';
import type {
  DayAvailability,
  DayOfWeek,
  WeeklySchedule,
} from '../../../core/models/employee-availability.model';
import { ManagerShiftsService } from './shifts.service';
import { ManagerScheduleService } from './schedule.service';
import { ManagerEmployeesService } from '../employees/employees.service';
import { ManagerLocationsService } from '../shifts-needed/locations.service';
import { ManagerShiftsNeededService } from '../shifts-needed/shifts-needed.service';
import { ManagerEmployeeAvailabilityService } from './employee-availability.service';
import type { EmployeeAvailabilityBundle } from './employee-availability.service';
import { DatePipe } from '@angular/common';
import {
  ButtonComponent,
  LoadingSpinnerComponent,
  ErrorAlertComponent,
  EmptyStateComponent,
} from '@common-daltime';

export type ViewMode = 'day' | 'week' | 'month' | 'availability' | 'fill-shift';

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

export interface UnfilledSlot {
  shiftNeeded: ShiftNeeded;
  /** How many more employees are needed for this slot */
  remaining: number;
}

const DOW_NAMES: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function dayOfWeek(date: string): DayOfWeek {
  const [y, m, d] = date.split('-').map(Number);
  return DOW_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function toMins(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function effectiveDayAvail(
  date: string,
  schedule: WeeklySchedule | null | undefined,
  overrides: Record<string, DayAvailability> | null | undefined,
): DayAvailability | null {
  if (overrides?.[date]) return overrides[date];
  if (!schedule) return null;
  return schedule[dayOfWeek(date)] ?? null;
}

function isAvailableFor(
  avail: DayAvailability | null,
  startTime: string,
  endTime: string,
): boolean {
  if (!avail?.available || !avail.slots?.length) return false;
  return avail.slots.some(
    (s) => toMins(s.from) <= toMins(startTime) && toMins(s.to) >= toMins(endTime),
  );
}

function weekBounds(date: string): { startKey: string; endKey: string } {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  const dow = day.getUTCDay(); // 0 = Sunday
  const sunday = new Date(day);
  sunday.setUTCDate(day.getUTCDate() - dow);
  const saturday = new Date(sunday);
  saturday.setUTCDate(sunday.getUTCDate() + 6);
  return {
    startKey: sunday.toISOString().slice(0, 10),
    endKey: saturday.toISOString().slice(0, 10),
  };
}

function weeklyHoursForEmployee(employeeId: string, targetDate: string, shifts: Shift[]): number {
  const { startKey, endKey } = weekBounds(targetDate);
  return shifts
    .filter((s) => s.employee_id === employeeId && s.date >= startKey && s.date <= endKey)
    .reduce((total, s) => total + (toMins(s.end_time) - toMins(s.start_time)) / 60, 0);
}

@Component({
  selector: 'app-manager-schedule',
  imports: [
    DatePipe,
    ButtonComponent,
    LoadingSpinnerComponent,
    ErrorAlertComponent,
    EmptyStateComponent,
  ],
  templateUrl: './schedule.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManagerSchedule implements OnInit {
  private readonly shiftsService = inject(ManagerShiftsService);
  private readonly scheduleService = inject(ManagerScheduleService);
  private readonly employeesService = inject(ManagerEmployeesService);
  private readonly locationsService = inject(ManagerLocationsService);
  private readonly shiftsNeededService = inject(ManagerShiftsNeededService);
  private readonly availabilityService = inject(ManagerEmployeeAvailabilityService);

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
  protected readonly allShiftsNeeded = signal<ShiftNeeded[]>([]);
  protected readonly availabilityBundles = signal<Map<string, EmployeeAvailabilityBundle>>(
    new Map(),
  );

  protected readonly filterEmployee = signal('');
  protected readonly filterLocation = signal('');
  protected readonly filterType = signal('');

  // ── Modal state ──────────────────────────────────────────────────────────────
  protected readonly modalOpen = signal(false);
  protected readonly editingShift = signal<Shift | null>(null);
  protected readonly formDate = signal('');
  protected readonly formEmployeeId = signal('');
  protected readonly formLocationId = signal('');
  protected readonly formStartTime = signal('');
  protected readonly formEndTime = signal('');
  protected readonly formType = signal<ShiftType>('morning');
  protected readonly modalSaving = signal(false);
  protected readonly modalError = signal<string | null>(null);
  protected readonly showDeleteConfirm = signal(false);

  protected readonly generating = signal(false);
  protected readonly publishing = signal(false);
  protected readonly scheduleActionResult = signal<string | null>(null);

  protected readonly draftRunCount = signal(0);
  protected readonly maxDraftRuns = signal(10);
  protected readonly draftLimitReached = computed(
    () => this.draftRunCount() >= this.maxDraftRuns(),
  );

  // ── Feature #166: Unfilled shifts-needed ─────────────────────────────────────

  protected readonly unfilledSlots = computed<UnfilledSlot[]>(() => {
    const shifts = this.allShifts();
    const result: UnfilledSlot[] = [];
    for (const sn of this.allShiftsNeeded()) {
      const filled = shifts.filter(
        (s) =>
          s.date === sn.date &&
          s.location_id === sn.location_id &&
          s.start_time === sn.start_time &&
          s.end_time === sn.end_time,
      ).length;
      const remaining = sn.employee_count - filled;
      if (remaining > 0) result.push({ shiftNeeded: sn, remaining });
    }
    return result;
  });

  protected readonly unfilledByDate = computed(() => {
    const map = new Map<string, UnfilledSlot[]>();
    for (const slot of this.unfilledSlots()) {
      const existing = map.get(slot.shiftNeeded.date) ?? [];
      map.set(slot.shiftNeeded.date, [...existing, slot]);
    }
    return map;
  });

  // ── Feature #165: Availability view ──────────────────────────────────────────

  protected readonly DAYS_DISPLAY: { key: DayOfWeek; label: string }[] = [
    { key: 'monday', label: 'Mon' },
    { key: 'tuesday', label: 'Tue' },
    { key: 'wednesday', label: 'Wed' },
    { key: 'thursday', label: 'Thu' },
    { key: 'friday', label: 'Fri' },
    { key: 'saturday', label: 'Sat' },
    { key: 'sunday', label: 'Sun' },
  ];

  protected readonly availabilityRows = computed(() =>
    this.employees().map((emp) => {
      const bundle = this.availabilityBundles().get(emp.employee_id);
      return { employee: emp, bundle: bundle ?? null };
    }),
  );

  protected readonly showUnavailableCandidates = signal(false);

  // ── Fill-shift tab ────────────────────────────────────────────────────────────

  protected readonly selectedUnfilledSlot = signal<UnfilledSlot | null>(null);
  protected readonly fillShiftReturnMode = signal<Exclude<ViewMode, 'fill-shift'>>('month');
  protected readonly fillShiftSaving = signal(false);
  protected readonly fillShiftError = signal<string | null>(null);
  protected readonly fillShiftSuccess = signal<string | null>(null);

  protected readonly fillShiftRemaining = computed(() => {
    const slot = this.selectedUnfilledSlot();
    if (!slot) return 0;
    const sn = slot.shiftNeeded;
    return Math.max(
      0,
      sn.employee_count -
        this.allShifts().filter(
          (s) =>
            s.date === sn.date &&
            s.location_id === sn.location_id &&
            s.start_time === sn.start_time &&
            s.end_time === sn.end_time,
        ).length,
    );
  });

  protected readonly fillShiftCandidates = computed(() => {
    const date = this.formDate();
    const start = this.formStartTime();
    const end = this.formEndTime();
    if (!date || !start || !end) return [];
    const shiftHours = (toMins(end) - toMins(start)) / 60;
    return this.employees()
      .map((emp) => {
        const bundle = this.availabilityBundles().get(emp.employee_id);
        const avail = effectiveDayAvail(
          date,
          bundle?.availability?.schedule,
          bundle?.overrides?.overrides,
        );
        const availableSlots = bundle?.availability?.schedule?.[dayOfWeek(date)]?.slots ?? null;
        const available = isAvailableFor(avail, start, end);
        const weekHours = weeklyHoursForEmployee(emp.employee_id, date, this.allShifts());
        const wouldExceed = weekHours + shiftHours > 39;
        return { employee: emp, available, availableSlots, weekHours, wouldExceed };
      })
      .sort((a, b) => {
        if (a.available !== b.available) return a.available ? -1 : 1;
        return a.weekHours - b.weekHours;
      });
  });

  protected readonly hasDrafts = computed(() => this.allShifts().some((s) => s.status === 'draft'));
  protected readonly draftCount = computed(
    () => this.allShifts().filter((s) => s.status === 'draft').length,
  );
  protected readonly publishedCount = computed(
    () => this.allShifts().filter((s) => s.status === 'published').length,
  );

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
      locations: this.locationsService.list(),
      shiftsNeeded: this.shiftsNeededService.list(month),
      meta: this.scheduleService.getMeta(month),
    }).subscribe({
      next: ({ shifts, employees, locations, shiftsNeeded, meta }) => {
        this.allShifts.set(shifts);
        this.employees.set(employees);
        this.locations.set(locations);
        this.allShiftsNeeded.set(shiftsNeeded);
        this.draftRunCount.set(meta.draftCount);
        this.maxDraftRuns.set(meta.maxDrafts);
        this.loading.set(false);
        this.loadAvailability(employees.map((e) => e.employee_id));
      },
      error: () => {
        this.error.set('Failed to load schedule. Please try again.');
        this.loading.set(false);
      },
    });
  }

  private loadAvailability(employeeIds: string[]): void {
    this.availabilityService.getAllBundles(employeeIds).subscribe({
      next: (bundles) => this.availabilityBundles.set(bundles),
    });
  }

  private loadShifts(): void {
    const month = toMonthKey(this.currentDate());
    forkJoin({
      shifts: this.shiftsService.list(month),
      shiftsNeeded: this.shiftsNeededService.list(month),
      meta: this.scheduleService.getMeta(month),
    }).subscribe({
      next: ({ shifts, shiftsNeeded, meta }) => {
        this.allShifts.set(shifts);
        this.allShiftsNeeded.set(shiftsNeeded);
        this.draftRunCount.set(meta.draftCount);
        this.maxDraftRuns.set(meta.maxDrafts);
      },
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

  // ── Modal ────────────────────────────────────────────────────────────────────

  protected openCreateModal(prefillDate?: string): void {
    this.editingShift.set(null);
    this.formDate.set(prefillDate ?? toDateKey(this.currentDate()));
    this.formEmployeeId.set('');
    this.formLocationId.set(this.locations()[0]?.location_id ?? '');
    this.formStartTime.set('09:00');
    this.formEndTime.set('17:00');
    this.formType.set('morning');
    this.modalError.set(null);
    this.showDeleteConfirm.set(false);
    this.modalOpen.set(true);
  }

  protected openFillShiftView(slot: UnfilledSlot): void {
    const sn = slot.shiftNeeded;
    this.selectedUnfilledSlot.set(slot);
    this.formDate.set(sn.date);
    this.formEmployeeId.set('');
    this.formLocationId.set(sn.location_id);
    this.formStartTime.set(sn.start_time);
    this.formEndTime.set(sn.end_time);
    const hour = parseInt(sn.start_time.split(':')[0], 10);
    this.formType.set(hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'night');
    this.fillShiftError.set(null);
    this.fillShiftSuccess.set(null);
    this.fillShiftReturnMode.set(
      this.viewMode() === 'fill-shift'
        ? this.fillShiftReturnMode()
        : (this.viewMode() as Exclude<ViewMode, 'fill-shift'>),
    );
    this.viewMode.set('fill-shift');
  }

  protected closeFillShiftView(): void {
    this.viewMode.set(this.fillShiftReturnMode());
    this.selectedUnfilledSlot.set(null);
    this.fillShiftError.set(null);
    this.fillShiftSuccess.set(null);
  }

  protected assignFromFillView(employeeId: string): void {
    const sn = this.selectedUnfilledSlot()?.shiftNeeded;
    if (!sn) return;
    this.fillShiftSaving.set(true);
    this.fillShiftError.set(null);
    this.fillShiftSuccess.set(null);
    const body: CreateShiftBody = {
      employee_id: employeeId,
      location_id: sn.location_id,
      date: sn.date,
      start_time: sn.start_time,
      end_time: sn.end_time,
      type: this.formType(),
    };
    this.shiftsService.create(body).subscribe({
      next: (shift) => {
        this.fillShiftSaving.set(false);
        this.allShifts.update((s) => [...s, shift]);
        const emp = this.employees().find((e) => e.employee_id === employeeId);
        const name = emp ? `${emp.first_name} ${emp.last_name}` : 'Employee';
        if (this.fillShiftRemaining() === 0) {
          this.closeFillShiftView();
        } else {
          this.fillShiftSuccess.set(
            `${name} assigned. ${this.fillShiftRemaining()} slot${this.fillShiftRemaining() === 1 ? '' : 's'} remaining.`,
          );
        }
      },
      error: () => {
        this.fillShiftSaving.set(false);
        this.fillShiftError.set('Failed to assign shift. Please try again.');
      },
    });
  }

  protected openEditModal(shift: Shift): void {
    this.editingShift.set(shift);
    this.formDate.set(shift.date);
    this.formEmployeeId.set(shift.employee_id);
    this.formLocationId.set(shift.location_id);
    this.formStartTime.set(shift.start_time);
    this.formEndTime.set(shift.end_time);
    this.formType.set(shift.type);
    this.modalError.set(null);
    this.showDeleteConfirm.set(false);
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
  }

  protected saveShift(): void {
    if (
      !this.formDate() ||
      !this.formEmployeeId() ||
      !this.formLocationId() ||
      !this.formStartTime() ||
      !this.formEndTime()
    ) {
      this.modalError.set('All fields are required.');
      return;
    }

    const body: CreateShiftBody = {
      employee_id: this.formEmployeeId(),
      location_id: this.formLocationId(),
      date: this.formDate(),
      start_time: this.formStartTime(),
      end_time: this.formEndTime(),
      type: this.formType(),
    };

    this.modalSaving.set(true);
    this.modalError.set(null);

    const editing = this.editingShift();
    const request = editing
      ? this.shiftsService.update(editing.shift_id, body)
      : this.shiftsService.create(body);

    request.subscribe({
      next: () => {
        this.modalOpen.set(false);
        this.modalSaving.set(false);
        this.loadShifts();
      },
      error: () => {
        this.modalError.set('Failed to save shift. Please try again.');
        this.modalSaving.set(false);
      },
    });
  }

  protected confirmDelete(): void {
    this.showDeleteConfirm.set(true);
  }

  protected cancelDelete(): void {
    this.showDeleteConfirm.set(false);
  }

  protected deleteShift(): void {
    const shift = this.editingShift();
    if (!shift) return;
    this.modalSaving.set(true);
    this.shiftsService.remove(shift.shift_id).subscribe({
      next: () => {
        this.modalOpen.set(false);
        this.modalSaving.set(false);
        this.allShifts.update((shifts) => shifts.filter((s) => s.shift_id !== shift.shift_id));
      },
      error: () => {
        this.modalError.set('Failed to delete shift. Please try again.');
        this.modalSaving.set(false);
      },
    });
  }

  // ── Generate / Publish ───────────────────────────────────────────────────────

  protected generateDraft(): void {
    this.generating.set(true);
    this.scheduleActionResult.set(null);
    const month = toMonthKey(this.currentDate());
    this.scheduleService.generateDraft(month).subscribe({
      next: (result) => {
        this.generating.set(false);
        this.draftRunCount.set(result.draftCount);
        this.maxDraftRuns.set(result.maxDrafts);
        const remaining = result.maxDrafts - result.draftCount;
        const runLabel = `Run ${result.draftCount}/${result.maxDrafts}`;
        const msg =
          result.created === 0 && result.unfilled === 0
            ? `${runLabel}: all slots already filled — no new shifts created.`
            : result.unfilled > 0
              ? `${runLabel}: ${result.created} shifts assigned, ${result.unfilled} slot${result.unfilled === 1 ? '' : 's'} still unfilled. ${remaining} run${remaining === 1 ? '' : 's'} remaining.`
              : `${runLabel}: ${result.created} shift${result.created === 1 ? '' : 's'} assigned. ${remaining} run${remaining === 1 ? '' : 's'} remaining.`;
        this.scheduleActionResult.set(msg);
        this.loadShifts();
      },
      error: (err) => {
        this.generating.set(false);
        const detail = err?.error?.message as string | undefined;
        this.scheduleActionResult.set(
          detail?.includes('Maximum')
            ? detail
            : 'Failed to generate draft schedule. Please try again.',
        );
      },
    });
  }

  protected publishSchedule(): void {
    this.publishing.set(true);
    this.scheduleActionResult.set(null);
    const month = toMonthKey(this.currentDate());
    this.scheduleService.publish(month).subscribe({
      next: (result) => {
        this.publishing.set(false);
        this.scheduleActionResult.set(
          `Schedule published: ${result.published} shifts are now visible to employees.`,
        );
        this.loadShifts();
      },
      error: () => {
        this.publishing.set(false);
        this.scheduleActionResult.set('Failed to publish schedule. Please try again.');
      },
    });
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

  protected toDateKey(d: Date): string {
    return toDateKey(d);
  }

  // ── Availability view helpers ────────────────────────────────────────────────

  protected dayAvailForEmployee(
    bundle: EmployeeAvailabilityBundle | null,
    dayKey: DayOfWeek,
  ): DayAvailability | null {
    return bundle?.availability?.schedule?.[dayKey] ?? null;
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

  protected setFormType(event: Event): void {
    this.formType.set((event.target as HTMLSelectElement).value as ShiftType);
  }
}
