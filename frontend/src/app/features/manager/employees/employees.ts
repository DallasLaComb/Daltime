import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ManagerEmployeesService } from './employees.service';
import type { EmployeeResponse } from '../../../core/models/employee.model';
import type { ColumnDef } from '@common-daltime';
import {
  CrudPageComponent,
  DataTableComponent,
  CardListComponent,
  StatusBadgeComponent,
  ConfirmationModalComponent,
  ButtonComponent,
} from '@common-daltime';

@Component({
  selector: 'app-manager-employees',
  imports: [
    DatePipe,
    CrudPageComponent,
    DataTableComponent,
    CardListComponent,
    StatusBadgeComponent,
    ConfirmationModalComponent,
    ButtonComponent,
  ],
  templateUrl: './employees.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManagerEmployeesComponent {
  private readonly employeesService = inject(ManagerEmployeesService);

  readonly employees = signal<EmployeeResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // Register modal
  readonly showRegisterModal = signal(false);
  readonly saving = signal(false);
  readonly modalError = signal<string | null>(null);
  readonly formFirstName = signal('');
  readonly formLastName = signal('');
  readonly formEmail = signal('');
  readonly formPhone = signal('');
  readonly formPassword = signal('');
  readonly showPassword = signal(false);
  readonly formSubmitted = signal(false);

  // Edit modal
  readonly showEditModal = signal(false);
  readonly editingEmployee = signal<EmployeeResponse | null>(null);
  readonly editFirstName = signal('');
  readonly editLastName = signal('');
  readonly editPhone = signal('');
  readonly editSubmitted = signal(false);
  readonly editError = signal<string | null>(null);

  // Disable modal
  readonly showDisableModal = signal(false);
  readonly disablingEmployee = signal<EmployeeResponse | null>(null);

  // Enable modal
  readonly showEnableModal = signal(false);
  readonly enablingEmployee = signal<EmployeeResponse | null>(null);

  readonly columns: ColumnDef[] = [
    { header: 'Name' },
    { header: 'Email' },
    { header: 'Phone' },
    { header: 'Status' },
    { header: 'Created' },
    { header: 'Actions', cssClass: 'text-right' },
  ];

  readonly trackById = (_index: number, employee: EmployeeResponse): string => employee.employee_id;

  readonly statusColorMap: Record<string, string> = {
    CONFIRMED: 'badge-dt-success',
    DISABLED: 'badge-dt-secondary',
    FORCE_CHANGE_PASSWORD: 'badge-dt-warning',
  };

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.employeesService.getAll().subscribe({
      next: (employees) => {
        this.employees.set(employees);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load employees');
        this.loading.set(false);
      },
    });
  }

  statusLabel(status: string): string {
    if (status === 'CONFIRMED') return 'Active';
    if (status === 'DISABLED') return 'Disabled';
    return 'Pending';
  }

  // ─── Register ────────────────────────────────────────────────────────

  openRegisterModal(): void {
    this.formFirstName.set('');
    this.formLastName.set('');
    this.formEmail.set('');
    this.formPhone.set('');
    this.formPassword.set('');
    this.showPassword.set(false);
    this.formSubmitted.set(false);
    this.modalError.set(null);
    this.showRegisterModal.set(true);
  }

  closeRegisterModal(): void {
    this.showRegisterModal.set(false);
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  register(): void {
    this.formSubmitted.set(true);
    if (
      !this.formFirstName().trim() ||
      !this.formLastName().trim() ||
      !this.formEmail().trim() ||
      !this.formPassword().trim()
    )
      return;

    this.saving.set(true);
    this.modalError.set(null);

    this.employeesService
      .create({
        first_name: this.formFirstName(),
        last_name: this.formLastName(),
        email: this.formEmail(),
        phone: this.formPhone() || undefined,
        temp_password: this.formPassword(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeRegisterModal();
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          if (err?.status === 409) {
            this.modalError.set('A user with this email already exists.');
          } else {
            this.modalError.set(err?.error?.error ?? 'Failed to register employee');
          }
        },
      });
  }

  // ─── Edit ────────────────────────────────────────────────────────────

  openEditModal(employee: EmployeeResponse): void {
    this.editingEmployee.set(employee);
    this.editFirstName.set(employee.first_name);
    this.editLastName.set(employee.last_name);
    this.editPhone.set(employee.phone);
    this.editSubmitted.set(false);
    this.editError.set(null);
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.editingEmployee.set(null);
  }

  saveEdit(): void {
    this.editSubmitted.set(true);
    if (!this.editFirstName().trim() || !this.editLastName().trim()) return;

    this.saving.set(true);
    this.editError.set(null);

    const employee = this.editingEmployee()!;
    this.employeesService
      .update(employee.employee_id, {
        first_name: this.editFirstName(),
        last_name: this.editLastName(),
        phone: this.editPhone(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeEditModal();
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.editError.set(err?.error?.error ?? 'Failed to update employee');
        },
      });
  }

  // ─── Disable ─────────────────────────────────────────────────────────

  openDisableModal(employee: EmployeeResponse): void {
    this.disablingEmployee.set(employee);
    this.showDisableModal.set(true);
  }

  closeDisableModal(): void {
    this.showDisableModal.set(false);
    this.disablingEmployee.set(null);
  }

  confirmDisable(): void {
    const employee = this.disablingEmployee();
    if (!employee) return;

    this.saving.set(true);
    this.employeesService.disable(employee.employee_id).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDisableModal();
        this.load();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  // ─── Enable ──────────────────────────────────────────────────────────

  openEnableModal(employee: EmployeeResponse): void {
    this.enablingEmployee.set(employee);
    this.showEnableModal.set(true);
  }

  closeEnableModal(): void {
    this.showEnableModal.set(false);
    this.enablingEmployee.set(null);
  }

  confirmEnable(): void {
    const employee = this.enablingEmployee();
    if (!employee) return;

    this.saving.set(true);
    this.employeesService.enable(employee.employee_id).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeEnableModal();
        this.load();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }
}
