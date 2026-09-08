import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';

export interface EmployeeStatusTarget {
  first_name: string;
  last_name: string;
  email: string;
}

@Component({
  selector: 'app-employee-status-modals',
  imports: [ConfirmationModalComponent],
  templateUrl: './employee-status-modals.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dt-debug' },
})
export class EmployeeStatusModalsComponent {
  entityLabel = input<string>('Employee');
  testIdPrefix = input<string>('employee');
  showDisableModal = input<boolean>(false);
  showEnableModal = input<boolean>(false);
  disablingEmployee = input<EmployeeStatusTarget | null>(null);
  enablingEmployee = input<EmployeeStatusTarget | null>(null);
  saving = input<boolean>(false);

  disableConfirmed = output<void>();
  disableCancelled = output<void>();
  enableConfirmed = output<void>();
  enableCancelled = output<void>();
}
