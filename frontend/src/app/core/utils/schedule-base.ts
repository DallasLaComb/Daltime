import { computed, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import type { Shift } from '../models/shift.model';
import type { EmployeeResponse } from '../models/employee.model';
import type { ManagerLocation } from '../models/manager-location.model';
import {
  SHIFT_STYLES,
  SHIFT_BORDER_STYLES,
  SHIFT_BADGE_STYLES,
  toDateKey,
  toMonthKey,
  filterShifts,
  groupShiftsByDate,
  buildCalendarWeeks,
  buildWeekDays,
  isToday as isTodayFn,
  isTodayDay as isTodayDayFn,
  dayAbbrev as dayAbbrevFn,
  employeeName as employeeNameFn,
  shortName as shortNameFn,
  locationName as locationNameFn,
  shortLocation as shortLocationFn,
  shortTime as shortTimeFn,
  type ShiftStatusFilter,
} from './schedule.utils';

/**
 * Shared base for schedule page components (org-admin and manager).
 * Holds signals, computed properties, navigation, and helper methods
 * that are identical across both schedule views.
 *
 * Subclasses must implement `loadShifts()` and `viewLabel` since those
 * depend on role-specific services and ViewMode type.
 */
export abstract class ScheduleBaseComponent {
  // ── Shared style maps ────────────────────────────────────────────────────────
  protected readonly shiftStyles = SHIFT_STYLES;
  protected readonly shiftBorderStyles = SHIFT_BORDER_STYLES;
  protected readonly shiftBadgeStyles = SHIFT_BADGE_STYLES;

  // ── Core state ───────────────────────────────────────────────────────────────
  protected readonly today = new Date();
  protected readonly currentDate = signal<Date>(new Date());

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly allShifts = signal<Shift[]>([]);
  protected readonly employees = signal<EmployeeResponse[]>([]);
  protected readonly locations = signal<ManagerLocation[]>([]);

  // ── Filter state ─────────────────────────────────────────────────────────────
  protected readonly filterEmployee = signal('');
  protected readonly filterLocation = signal('');
  protected readonly filterType = signal('');

  /**
   * Set of active status chip keys. Empty set = "All" (no status filter).
   * Populated by the ScheduleFiltersComponent statusChipsChange output.
   */
  protected readonly filterStatuses = signal<Set<ShiftStatusFilter>>(new Set());

  /**
   * True when any filter — including status chips — is active.
   * Used to show the "Clear filters" button and "filtered from N total" label.
   */
  protected readonly hasActiveFilters = computed(
    () =>
      !!this.filterEmployee() ||
      !!this.filterLocation() ||
      !!this.filterType() ||
      this.filterStatuses().size > 0,
  );

  /**
   * Derived list of shifts after applying all active filters.
   * Status chips use OR logic within themselves; other filters use AND.
   */
  protected readonly filteredShifts = computed(() =>
    filterShifts(this.allShifts(), {
      employee: this.filterEmployee(),
      location: this.filterLocation(),
      type: this.filterType(),
      statusChips: this.filterStatuses(),
    }),
  );

  protected readonly shiftsByDate = computed(() => groupShiftsByDate(this.filteredShifts()));

  /**
   * True when the unfilledSlots (ShiftNeeded-derived) should be rendered.
   * Unfilled slots are not Shift records and bypass filteredShifts entirely, so
   * we gate their rendering here: show them only when no status filter is active
   * or when the 'unfilled' chip is explicitly selected.
   */
  protected readonly showUnfilledSlots = computed(() => {
    const chips = this.filterStatuses();
    return chips.size === 0 || chips.has('unfilled');
  });

  protected readonly calendarWeeks = computed(() => buildCalendarWeeks(this.currentDate()));

  protected readonly weekDays = computed(() => buildWeekDays(this.currentDate()));

  protected readonly currentDayShifts: Signal<Shift[]> = computed(
    () => this.shiftsByDate().get(toDateKey(this.currentDate())) ?? [],
  );

  // ── Abstract contract ────────────────────────────────────────────────────────

  /** Called by prevPeriod/nextPeriod when the month changes. */
  protected abstract loadShifts(): void;

  /** Subclass viewMode signal — typed to the role's ViewMode union. */
  protected abstract readonly viewMode: Signal<string>;

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

  // ── Helpers ──────────────────────────────────────────────────────────────────

  protected isToday(d: Date): boolean {
    return isTodayFn(d, this.today);
  }

  protected isTodayDay(day: number | null): boolean {
    return isTodayDayFn(day, this.currentDate(), this.today);
  }

  protected dayAbbrev(d: Date): string {
    return dayAbbrevFn(d);
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
    return employeeNameFn(id, this.employees());
  }

  protected shortName(id: string): string {
    return shortNameFn(id, this.employees());
  }

  protected locationName(id: string): string {
    return locationNameFn(id, this.locations());
  }

  protected shortLocation(id: string): string {
    return shortLocationFn(id, this.locations());
  }

  protected shortTime(time: string): string {
    return shortTimeFn(time);
  }

  // ── Filter event handlers ─────────────────────────────────────────────────────

  protected setEmployeeFilter(event: Event): void {
    this.filterEmployee.set((event.target as HTMLSelectElement).value);
  }

  protected setLocationFilter(event: Event): void {
    this.filterLocation.set((event.target as HTMLSelectElement).value);
  }

  protected setTypeFilter(event: Event): void {
    this.filterType.set((event.target as HTMLSelectElement).value);
  }

  /**
   * Resets all filters to their default (empty) state,
   * including the status chip selection.
   */
  protected clearFilters(): void {
    this.filterEmployee.set('');
    this.filterLocation.set('');
    this.filterType.set('');
    this.filterStatuses.set(new Set());
  }

  /**
   * Handles the statusChipsChange output from ScheduleFiltersComponent.
   * Receives the full new set of active chip keys and replaces the signal value.
   */
  protected setStatusFilter(chips: Set<ShiftStatusFilter>): void {
    this.filterStatuses.set(chips);
  }
}
