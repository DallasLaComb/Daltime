import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import type { ManagerLocation } from '../../../core/models/manager-location.model';
import type { ShiftNeeded } from '../../../core/models/manager-shift-needed.model';
import {
  ButtonComponent,
  EmptyStateComponent,
  ErrorAlertComponent,
  LoadingSpinnerComponent,
} from '@common-daltime';
import { ManagerLocationsService } from './locations.service';
import { ManagerShiftsNeededService } from './shifts-needed.service';

interface ShiftGroup {
  dateLabel: string;
  date: string;
  shifts: ShiftNeeded[];
}

function getNextMonth(): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  return new Date(Number(year), Number(m) - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function formatDateLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Component({
  selector: 'app-manager-shifts-needed',
  imports: [ButtonComponent, EmptyStateComponent, ErrorAlertComponent, LoadingSpinnerComponent],
  templateUrl: './shifts-needed.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManagerShiftsNeededComponent {
  private readonly shiftsService = inject(ManagerShiftsNeededService);
  private readonly locationsService = inject(ManagerLocationsService);

  readonly targetMonth = signal(getNextMonth());
  readonly shifts = signal<ShiftNeeded[]>([]);
  readonly locations = signal<ManagerLocation[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly formOpen = signal(false);
  readonly editingShift = signal<ShiftNeeded | null>(null);
  readonly formDate = signal('');
  readonly formStartTime = signal('');
  readonly formEndTime = signal('');
  readonly formEmployeeCount = signal(1);
  readonly formLocationId = signal('');
  readonly formNotes = signal('');
  readonly formSubmitted = signal(false);
  readonly formSaving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly deletingShiftId = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);

  readonly monthLabel = computed(() => formatMonthLabel(this.targetMonth()));
  readonly canGoPrev = computed(() => this.targetMonth() > getCurrentMonth());

  readonly shiftGroups = computed<ShiftGroup[]>(() => {
    const map = new Map<string, ShiftNeeded[]>();
    for (const s of this.shifts()) {
      const group = map.get(s.date) ?? [];
      group.push(s);
      map.set(s.date, group);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({
        date,
        dateLabel: formatDateLabel(date),
        shifts: items.sort((a, b) => a.start_time.localeCompare(b.start_time)),
      }));
  });

  constructor() {
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      shifts: this.shiftsService.list(this.targetMonth()),
      locations: this.locationsService.list(),
    }).subscribe({
      next: ({ shifts, locations }) => {
        this.shifts.set(shifts);
        this.locations.set(locations);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load data. Please try again.');
        this.loading.set(false);
      },
    });
  }

  prevMonth(): void {
    if (!this.canGoPrev()) return;
    this.targetMonth.set(addMonths(this.targetMonth(), -1));
    this.loadShifts();
  }

  nextMonth(): void {
    this.targetMonth.set(addMonths(this.targetMonth(), 1));
    this.loadShifts();
  }

  private loadShifts(): void {
    this.loading.set(true);
    this.error.set(null);
    this.shiftsService.list(this.targetMonth()).subscribe({
      next: (shifts) => {
        this.shifts.set(shifts);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load shifts. Please try again.');
        this.loading.set(false);
      },
    });
  }

  openAddForm(): void {
    this.editingShift.set(null);
    this.formDate.set('');
    this.formStartTime.set('');
    this.formEndTime.set('');
    this.formEmployeeCount.set(1);
    this.formLocationId.set(this.locations()[0]?.location_id ?? '');
    this.formNotes.set('');
    this.formSubmitted.set(false);
    this.formError.set(null);
    this.formOpen.set(true);
  }

  openEditForm(shift: ShiftNeeded): void {
    this.editingShift.set(shift);
    this.formDate.set(shift.date);
    this.formStartTime.set(shift.start_time);
    this.formEndTime.set(shift.end_time);
    this.formEmployeeCount.set(shift.employee_count);
    this.formLocationId.set(shift.location_id);
    this.formNotes.set(shift.notes ?? '');
    this.formSubmitted.set(false);
    this.formError.set(null);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editingShift.set(null);
  }

  saveShift(): void {
    this.formSubmitted.set(true);

    const date = this.formDate();
    const startTime = this.formStartTime();
    const endTime = this.formEndTime();
    const locationId = this.formLocationId();
    const employeeCount = this.formEmployeeCount();

    if (!date || !startTime || !endTime || !locationId || employeeCount < 1) return;

    this.formSaving.set(true);
    this.formError.set(null);

    const body = {
      date,
      start_time: startTime,
      end_time: endTime,
      employee_count: employeeCount,
      location_id: locationId,
      ...(this.formNotes().trim() ? { notes: this.formNotes().trim() } : {}),
    };

    const editing = this.editingShift();
    const request$ = editing
      ? this.shiftsService.update(editing.shift_id, body)
      : this.shiftsService.create(body);

    request$.subscribe({
      next: (saved) => {
        if (editing) {
          this.shifts.update((list) =>
            list.map((s) => (s.shift_id === saved.shift_id ? saved : s)),
          );
        } else {
          this.shifts.update((list) => [...list, saved]);
        }
        this.formSaving.set(false);
        this.closeForm();
      },
      error: (err: { error?: { error?: string } }) => {
        this.formSaving.set(false);
        this.formError.set(err?.error?.error ?? 'Failed to save shift');
      },
    });
  }

  deleteShift(shift: ShiftNeeded): void {
    this.deletingShiftId.set(shift.shift_id);
    this.deleteError.set(null);
    this.shiftsService.remove(shift.shift_id).subscribe({
      next: () => {
        this.shifts.update((list) => list.filter((s) => s.shift_id !== shift.shift_id));
        this.deletingShiftId.set(null);
      },
      error: () => {
        this.deletingShiftId.set(null);
        this.deleteError.set('Failed to delete shift. Please try again.');
      },
    });
  }

  employeeLabel(count: number): string {
    return count === 1 ? '1 employee' : `${count} employees`;
  }

  trackByShiftId(_: number, s: ShiftNeeded): string {
    return s.shift_id;
  }

  trackByDate(_: number, g: ShiftGroup): string {
    return g.date;
  }

  trackByLocationId(_: number, l: ManagerLocation): string {
    return l.location_id;
  }
}
