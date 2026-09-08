import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EmployeesService } from './employees.service';
import { ManagersService } from '../managers/managers.service';
import { EmployeeLocationsService } from './employee-locations.service';
import { OrgAdminLocationsService } from '../locations/locations.service';
import type { EmployeeResponse } from '../../../core/models/employee.model';
import type { ManagerResponse } from '../../../core/models/manager.model';
import type { UserLocationResponse } from '../../../core/models/user-location.model';
import type { ManagerLocation } from '../../../core/models/manager-location.model';
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
  selector: 'app-employees',
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
export class EmployeesComponent {
  private readonly employeesService = inject(EmployeesService);
  private readonly managersService = inject(ManagersService);
  private readonly employeeLocationsService = inject(EmployeeLocationsService);
  private readonly orgLocationsService = inject(OrgAdminLocationsService);

  readonly employees = signal<EmployeeResponse[]>([]);
  readonly managers = signal<ManagerResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly activeManagers = computed(() => this.managers().filter((m) => m.status !== 'DISABLED'));

  // Register modal
  readonly showRegisterModal = signal(false);
  readonly saving = signal(false);
  readonly modalError = signal<string | null>(null);
  readonly formFirstName = signal('');
  readonly formLastName = signal('');
  readonly formEmail = signal('');
  readonly formPhone = signal('');
  readonly formPassword = signal('');
  readonly formManagerId = signal('');
  readonly showPassword = signal(false);
  readonly formSubmitted = signal(false);

  // Edit modal
  readonly showEditModal = signal(false);
  readonly editingEmployee = signal<EmployeeResponse | null>(null);
  readonly editFirstName = signal('');
  readonly editLastName = signal('');
  readonly editPhone = signal('');
  readonly editManagerId = signal('');
  readonly editSubmitted = signal(false);
  readonly editError = signal<string | null>(null);

  // Disable modal
  readonly showDisableModal = signal(false);
  readonly disablingEmployee = signal<EmployeeResponse | null>(null);

  // Enable modal
  readonly showEnableModal = signal(false);
  readonly enablingEmployee = signal<EmployeeResponse | null>(null);

  // Locations modal
  readonly showLocationsModal = signal(false);
  readonly locationsEmployee = signal<EmployeeResponse | null>(null);
  readonly assignedLocations = signal<UserLocationResponse[]>([]);
  readonly allOrgLocations = signal<ManagerLocation[]>([]);
  readonly locationsLoading = signal(false);
  readonly locationsError = signal<string | null>(null);
  readonly selectedLocationId = signal('');
  readonly assigning = signal(false);
  readonly assignError = signal<string | null>(null);

  // Remove-location confirmation
  readonly showRemoveLocationModal = signal(false);
  readonly removingLocation = signal<UserLocationResponse | null>(null);
  readonly removing = signal(false);

  /** Locations not yet assigned to this employee. */
  readonly availableLocations = computed(() => {
    const assignedIds = new Set(this.assignedLocations().map((a) => a.location_id));
    return this.allOrgLocations().filter((l) => !assignedIds.has(l.location_id));
  });

  readonly columns: ColumnDef[] = [
    { header: 'Name' },
    { header: 'Email' },
    { header: 'Phone' },
    { header: 'Manager' },
    { header: 'Status' },
    { header: 'Locations' },
    { header: 'Created' },
    { header: 'Actions', cssClass: 'text-right' },
  ];

  readonly trackById = (_index: number, employee: EmployeeResponse): string => employee.employee_id;
  readonly trackByLocationId = (_index: number, loc: UserLocationResponse): string =>
    loc.location_id;

  readonly statusColorMap: Record<string, string> = {
    CONFIRMED: 'badge-dt-success',
    DISABLED: 'badge-dt-secondary',
    FORCE_CHANGE_PASSWORD: 'badge-dt-warning',
  };

  constructor() {
    this.load();
    this.loadManagers();
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

  loadManagers(): void {
    this.managersService.getAll().subscribe({
      next: (managers) => this.managers.set(managers),
      error: () => {},
    });
  }

  managerName(managerId: string): string {
    if (!managerId) return '—';
    const m = this.managers().find((mgr) => mgr.manager_id === managerId);
    return m ? `${m.first_name} ${m.last_name}` : '—';
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
    this.formManagerId.set('');
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
      !this.formPassword().trim() ||
      (this.activeManagers().length > 0 && !this.formManagerId())
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
        manager_id: this.formManagerId() || undefined,
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
    this.editManagerId.set(employee.manager_id ?? '');
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
        manager_id: this.editManagerId(),
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

  // ─── Locations ───────────────────────────────────────────────────────

  openLocationsModal(employee: EmployeeResponse): void {
    this.locationsEmployee.set(employee);
    this.assignedLocations.set([]);
    this.allOrgLocations.set([]);
    this.selectedLocationId.set('');
    this.locationsError.set(null);
    this.assignError.set(null);
    this.locationsLoading.set(true);
    this.showLocationsModal.set(true);

    this.employeeLocationsService.getAll(employee.employee_id).subscribe({
      next: (assigned) => this.assignedLocations.set(assigned),
      error: () => this.locationsError.set('Failed to load assigned locations'),
    });

    this.orgLocationsService.getAll().subscribe({
      next: (all) => {
        this.allOrgLocations.set(all);
        this.locationsLoading.set(false);
      },
      error: () => {
        this.locationsError.set('Failed to load locations');
        this.locationsLoading.set(false);
      },
    });
  }

  closeLocationsModal(): void {
    this.showLocationsModal.set(false);
    this.locationsEmployee.set(null);
  }

  assignLocation(): void {
    const employee = this.locationsEmployee();
    const locationId = this.selectedLocationId();
    if (!employee || !locationId) return;

    this.assigning.set(true);
    this.assignError.set(null);

    this.employeeLocationsService.assign(employee.employee_id, locationId).subscribe({
      next: (assignment) => {
        this.assignedLocations.update((list) => [...list, assignment]);
        this.selectedLocationId.set('');
        this.assigning.set(false);
      },
      error: (err) => {
        this.assigning.set(false);
        this.assignError.set(err?.error?.error ?? 'Failed to assign location');
      },
    });
  }

  openRemoveLocationModal(loc: UserLocationResponse): void {
    this.removingLocation.set(loc);
    this.showLocationsModal.set(false);
    this.showRemoveLocationModal.set(true);
  }

  closeRemoveLocationModal(): void {
    this.showRemoveLocationModal.set(false);
    this.removingLocation.set(null);
    this.showLocationsModal.set(true);
  }

  confirmRemoveLocation(): void {
    const employee = this.locationsEmployee();
    const loc = this.removingLocation();
    if (!employee || !loc) return;

    this.removing.set(true);
    this.employeeLocationsService.remove(employee.employee_id, loc.location_id).subscribe({
      next: () => {
        this.assignedLocations.update((list) =>
          list.filter((a) => a.location_id !== loc.location_id),
        );
        this.removing.set(false);
        this.showRemoveLocationModal.set(false);
        this.removingLocation.set(null);
        this.showLocationsModal.set(true);
      },
      error: () => {
        this.removing.set(false);
      },
    });
  }
}
