import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { ButtonComponent } from '../button/button';
import { PasswordInputComponent } from '../password-input/password-input';

export interface ManagerOption {
  manager_id: string;
  first_name: string;
  last_name: string;
}

export interface RegisterEmployeeData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  temp_password: string;
  manager_id?: string;
}

@Component({
  selector: 'app-register-employee-modal',
  imports: [ButtonComponent, PasswordInputComponent],
  templateUrl: './register-employee-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterEmployeeModalComponent {
  open = input<boolean>(false);
  saving = input<boolean>(false);
  error = input<string | null>(null);
  entityLabel = input<string>('Employee');
  /** Non-empty array enables manager selection. */
  managers = input<ManagerOption[]>([]);
  /** When true and managers list is non-empty, manager field is required. */
  requireManager = input<boolean>(false);

  cancelled = output<void>();
  registered = output<RegisterEmployeeData>();

  protected readonly formFirstName = signal('');
  protected readonly formLastName = signal('');
  protected readonly formEmail = signal('');
  protected readonly formPhone = signal('');
  protected readonly formPassword = signal('');
  protected readonly formManagerId = signal('');
  protected readonly formSubmitted = signal(false);
  constructor() {
    effect(() => {
      if (!this.open()) this.reset();
    });
  }

  private reset(): void {
    this.formFirstName.set('');
    this.formLastName.set('');
    this.formEmail.set('');
    this.formPhone.set('');
    this.formPassword.set('');
    this.formManagerId.set('');
    this.formSubmitted.set(false);
  }

  protected cancel(): void {
    this.cancelled.emit();
  }

  protected register(): void {
    this.formSubmitted.set(true);
    const managerRequired =
      this.requireManager() && this.managers().length > 0 && !this.formManagerId();
    if (
      !this.formFirstName().trim() ||
      !this.formLastName().trim() ||
      !this.formEmail().trim() ||
      !this.formPassword().trim() ||
      managerRequired
    ) {
      return;
    }
    this.registered.emit({
      first_name: this.formFirstName().trim(),
      last_name: this.formLastName().trim(),
      email: this.formEmail().trim(),
      phone: this.formPhone().trim(),
      temp_password: this.formPassword().trim(),
      manager_id: this.formManagerId() || undefined,
    });
  }
}
