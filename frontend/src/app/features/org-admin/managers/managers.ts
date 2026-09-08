import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ManagersService } from './managers.service';
import { ManagerLocationsService } from './manager-locations.service';
import { OrgAdminLocationsService } from '../locations/locations.service';
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
  selector: 'app-managers',
  imports: [
    DatePipe,
    CrudPageComponent,
    DataTableComponent,
    CardListComponent,
    StatusBadgeComponent,
    ConfirmationModalComponent,
    ButtonComponent,
  ],
  templateUrl: './managers.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManagersComponent {
  private readonly managersService = inject(ManagersService);
  private readonly managerLocationsService = inject(ManagerLocationsService);
  private readonly orgLocationsService = inject(OrgAdminLocationsService);

  readonly managers = signal<ManagerResponse[]>([]);
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
  readonly editingManager = signal<ManagerResponse | null>(null);
  readonly editFirstName = signal('');
  readonly editLastName = signal('');
  readonly editPhone = signal('');
  readonly editSubmitted = signal(false);
  readonly editError = signal<string | null>(null);

  // Disable modal
  readonly showDisableModal = signal(false);
  readonly disablingManager = signal<ManagerResponse | null>(null);

  // Enable modal
  readonly showEnableModal = signal(false);
  readonly enablingManager = signal<ManagerResponse | null>(null);

  // Locations modal
  readonly showLocationsModal = signal(false);
  readonly locationsManager = signal<ManagerResponse | null>(null);
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

  /** Locations not yet assigned to this manager. */
  readonly availableLocations = computed(() => {
    const assignedIds = new Set(this.assignedLocations().map((a) => a.location_id));
    return this.allOrgLocations().filter((l) => !assignedIds.has(l.location_id));
  });

  readonly columns: ColumnDef[] = [
    { header: 'Name' },
    { header: 'Email' },
    { header: 'Phone' },
    { header: 'Status' },
    { header: 'Employees' },
    { header: 'Locations' },
    { header: 'Created' },
    { header: 'Actions', cssClass: 'text-right' },
  ];

  readonly trackById = (_index: number, manager: ManagerResponse): string => manager.manager_id;
  readonly trackByLocationId = (_index: number, loc: UserLocationResponse): string =>
    loc.location_id;

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
    this.managersService.getAll().subscribe({
      next: (managers) => {
        this.managers.set(managers);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load managers');
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

    this.managersService
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
            this.modalError.set(err?.error?.error ?? 'Failed to register manager');
          }
        },
      });
  }

  // ─── Edit ────────────────────────────────────────────────────────────

  openEditModal(manager: ManagerResponse): void {
    this.editingManager.set(manager);
    this.editFirstName.set(manager.first_name);
    this.editLastName.set(manager.last_name);
    this.editPhone.set(manager.phone);
    this.editSubmitted.set(false);
    this.editError.set(null);
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.editingManager.set(null);
  }

  saveEdit(): void {
    this.editSubmitted.set(true);
    if (!this.editFirstName().trim() || !this.editLastName().trim()) return;

    this.saving.set(true);
    this.editError.set(null);

    const manager = this.editingManager()!;
    this.managersService
      .update(manager.manager_id, {
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
          this.editError.set(err?.error?.error ?? 'Failed to update manager');
        },
      });
  }

  // ─── Disable ─────────────────────────────────────────────────────────

  openDisableModal(manager: ManagerResponse): void {
    this.disablingManager.set(manager);
    this.showDisableModal.set(true);
  }

  closeDisableModal(): void {
    this.showDisableModal.set(false);
    this.disablingManager.set(null);
  }

  confirmDisable(): void {
    const manager = this.disablingManager();
    if (!manager) return;

    this.saving.set(true);
    this.managersService.disable(manager.manager_id).subscribe({
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

  openEnableModal(manager: ManagerResponse): void {
    this.enablingManager.set(manager);
    this.showEnableModal.set(true);
  }

  closeEnableModal(): void {
    this.showEnableModal.set(false);
    this.enablingManager.set(null);
  }

  confirmEnable(): void {
    const manager = this.enablingManager();
    if (!manager) return;

    this.saving.set(true);
    this.managersService.enable(manager.manager_id).subscribe({
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

  openLocationsModal(manager: ManagerResponse): void {
    this.locationsManager.set(manager);
    this.assignedLocations.set([]);
    this.allOrgLocations.set([]);
    this.selectedLocationId.set('');
    this.locationsError.set(null);
    this.assignError.set(null);
    this.locationsLoading.set(true);
    this.showLocationsModal.set(true);

    // Load in parallel: assigned locations + all org locations
    this.managerLocationsService.getAll(manager.manager_id).subscribe({
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
    this.locationsManager.set(null);
  }

  assignLocation(): void {
    const manager = this.locationsManager();
    const locationId = this.selectedLocationId();
    if (!manager || !locationId) return;

    this.assigning.set(true);
    this.assignError.set(null);

    this.managerLocationsService.assign(manager.manager_id, locationId).subscribe({
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
    const manager = this.locationsManager();
    const loc = this.removingLocation();
    if (!manager || !loc) return;

    this.removing.set(true);
    this.managerLocationsService.remove(manager.manager_id, loc.location_id).subscribe({
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
