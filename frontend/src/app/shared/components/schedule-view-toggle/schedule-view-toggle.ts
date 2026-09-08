import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type ScheduleViewMode = 'day' | 'week' | 'month' | 'availability' | 'fill-shift';

@Component({
  selector: 'app-schedule-view-toggle',
  templateUrl: './schedule-view-toggle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dt-debug' },
})
export class ScheduleViewToggleComponent {
  viewMode = input<ScheduleViewMode>('week');
  showAvailability = input<boolean>(true);
  viewModeChange = output<ScheduleViewMode>();
}
