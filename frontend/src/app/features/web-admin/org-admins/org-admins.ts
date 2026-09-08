import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  CrudPageComponent,
  DataTableComponent,
  CardListComponent,
  StatusBadgeComponent,
  ConfirmationModalComponent,
  ButtonComponent,
} from '@common-daltime';
import type { ColumnDef } from '@common-daltime';
import { OrgAdminsService } from '../../../services/org-admins.service';
import { OrganizationService } from '../../../services/organization.service';
import type { OrgAdminUserResponse } from '../../../core/models/org-admin-user.model';

@Component({
  selector: 'app-org-admins',
  imports: [
    DatePipe,
    RouterLink,
    CrudPageComponent,
    DataTableComponent,
    CardListComponent,
    StatusBadgeComponent,
    ConfirmationModalComponent,
    ButtonComponent,
  ],
  templateUrl: './org-admins.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrgAdminsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orgAdminsService = inject(OrgAdminsService);
  private readonly orgService = inject(OrganizationService);

  readonly orgId = this.route.snapshot.params['orgId'] as string;

  readonly orgName = signal<string>('');
  readonly admins = signal<OrgAdminUserResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly showModal = signal(false);
  readonly showDisableModal = signal(false);
  readonly disablingAdmin = signal<OrgAdminUserResponse | null>(null);
  readonly showEnableModal = signal(false);
  readonly enablingAdmin = signal<OrgAdminUserResponse | null>(null);
  readonly saving = signal(false);
  readonly modalError = signal<string | null>(null);

  readonly formName = signal('');
  readonly formEmail = signal('');
  readonly formPassword = signal('');
  readonly showPassword = signal(false);
  readonly formSubmitted = signal(false);

  readonly columns: ColumnDef[] = [
    { header: 'Name' },
    { header: 'Email' },
    { header: 'Status' },
    { header: 'Created' },
    { header: 'Actions', cssClass: 'text-right' },
  ];

  readonly trackById = (_index: number, admin: OrgAdminUserResponse): string => admin.user_id;

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

    forkJoin([
      this.orgService.getById(this.orgId),
      this.orgAdminsService.getAll(this.orgId),
    ]).subscribe({
      next: ([org, admins]) => {
        this.orgName.set(org.name);
        this.admins.set(admins);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load org admins');
        this.loading.set(false);
      },
    });
  }

  statusLabel(status: string): string {
    if (status === 'CONFIRMED') return 'Active';
    if (status === 'DISABLED') return 'Disabled';
    return 'Pending';
  }

  openRegisterModal(): void {
    this.formName.set('');
    this.formEmail.set('');
    this.formPassword.set('');
    this.showPassword.set(false);
    this.formSubmitted.set(false);
    this.modalError.set(null);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  register(): void {
    this.formSubmitted.set(true);
    if (!this.formName().trim() || !this.formEmail().trim() || !this.formPassword().trim()) return;

    this.saving.set(true);
    this.modalError.set(null);

    this.orgAdminsService
      .create(this.orgId, {
        name: this.formName(),
        email: this.formEmail(),
        temp_password: this.formPassword(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeModal();
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          if (err?.status === 409) {
            this.modalError.set('A user with this email already exists.');
          } else {
            this.modalError.set(err?.error?.error ?? 'Failed to register org admin');
          }
        },
      });
  }

  openDisableModal(admin: OrgAdminUserResponse): void {
    this.disablingAdmin.set(admin);
    this.showDisableModal.set(true);
  }

  closeDisableModal(): void {
    this.showDisableModal.set(false);
    this.disablingAdmin.set(null);
  }

  confirmDisable(): void {
    const admin = this.disablingAdmin();
    if (!admin) return;

    this.saving.set(true);
    this.orgAdminsService.disable(this.orgId, admin.user_id).subscribe({
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

  openEnableModal(admin: OrgAdminUserResponse): void {
    this.enablingAdmin.set(admin);
    this.showEnableModal.set(true);
  }

  closeEnableModal(): void {
    this.showEnableModal.set(false);
    this.enablingAdmin.set(null);
  }

  confirmEnable(): void {
    const admin = this.enablingAdmin();
    if (!admin) return;

    this.saving.set(true);
    this.orgAdminsService.enable(this.orgId, admin.user_id).subscribe({
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
