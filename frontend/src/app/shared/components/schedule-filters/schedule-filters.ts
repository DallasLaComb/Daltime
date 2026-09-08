import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface ScheduleFilterEmployee {
  employee_id: string;
  first_name: string;
  last_name: string;
}

export interface ScheduleFilterLocation {
  location_id: string;
  name: string;
}

@Component({
  selector: 'app-schedule-filters',
  templateUrl: './schedule-filters.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dt-debug' },
})
export class ScheduleFiltersComponent {
  employees = input<ScheduleFilterEmployee[]>([]);
  locations = input<ScheduleFilterLocation[]>([]);
  filterEmployee = input<string>('');
  filterLocation = input<string>('');
  filterType = input<string>('');
  hasActiveFilters = input<boolean>(false);

  employeeFilterChange = output<Event>();
  locationFilterChange = output<Event>();
  typeFilterChange = output<Event>();
  clearFiltersRequested = output<void>();
}
