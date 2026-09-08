import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { Shift } from '../../../core/models/shift.model';
import { EmployeeShiftsService } from './shifts.service';
import {
  ButtonComponent,
  LoadingSpinnerComponent,
  ErrorAlertComponent,
  EmptyStateComponent,
} from '@common-daltime';
import {
  SHIFT_BORDER_STYLES,
  SHIFT_BADGE_STYLES,
  toMonthKey,
  formatMonthLabel,
  formatLongDateLabel,
} from '../../../core/utils/schedule.utils';

interface ShiftGroup {
  date: string;
  dateLabel: string;
  shifts: Shift[];
}

@Component({
  selector: 'app-employee-schedule',
  imports: [ButtonComponent, LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent],
  templateUrl: './schedule.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeScheduleComponent implements OnInit {
  private readonly shiftsService = inject(EmployeeShiftsService);

  protected readonly shiftBorderStyles = SHIFT_BORDER_STYLES;
  protected readonly shiftBadgeStyles = SHIFT_BADGE_STYLES;

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly shifts = signal<Shift[]>([]);
  protected readonly currentMonth = signal(toMonthKey(new Date()));

  protected readonly monthLabel = computed(() => formatMonthLabel(this.currentMonth()));

  protected readonly grouped = computed((): ShiftGroup[] => {
    const map = new Map<string, Shift[]>();
    for (const shift of this.shifts()) {
      const existing = map.get(shift.date) ?? [];
      map.set(shift.date, [...existing, shift]);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayShifts]) => ({
        date,
        dateLabel: formatLongDateLabel(date),
        shifts: [...dayShifts].sort((a, b) => a.start_time.localeCompare(b.start_time)),
      }));
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.shiftsService.list(this.currentMonth()).subscribe({
      next: (shifts) => {
        this.shifts.set(shifts);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load your schedule. Please try again.');
        this.loading.set(false);
      },
    });
  }

  protected prevMonth(): void {
    const [y, m] = this.currentMonth().split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    this.currentMonth.set(toMonthKey(d));
    this.load();
  }

  protected nextMonth(): void {
    const [y, m] = this.currentMonth().split('-').map(Number);
    const d = new Date(y, m, 1);
    this.currentMonth.set(toMonthKey(d));
    this.load();
  }

  protected goToCurrentMonth(): void {
    this.currentMonth.set(toMonthKey(new Date()));
    this.load();
  }

  protected isCurrentMonth(): boolean {
    return this.currentMonth() === toMonthKey(new Date());
  }

  protected isToday(date: string): boolean {
    return date === toMonthKey(new Date()) + '-' + String(new Date().getDate()).padStart(2, '0');
  }

  protected formatTime(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const period = h < 12 ? 'AM' : 'PM';
    const hour = h % 12 || 12;
    return m === 0 ? `${hour} ${period}` : `${hour}:${String(m).padStart(2, '0')} ${period}`;
  }
}
