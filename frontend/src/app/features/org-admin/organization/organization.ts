import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { OrgAdminOrganizationService } from './organization.service';
import type { Organization } from '../../../core/models/organization.model';
import { ButtonComponent } from '@common-daltime';

@Component({
  selector: 'app-org-admin-organization',
  imports: [ButtonComponent],
  templateUrl: './organization.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrgAdminOrganizationComponent {
  private readonly orgService = inject(OrgAdminOrganizationService);

  readonly org = signal<Organization | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly editing = signal(false);
  readonly editName = signal('');
  readonly editAddress = signal('');
  readonly editSubmitted = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly saveSuccess = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.orgService.get().subscribe({
      next: (org) => {
        this.org.set(org);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load organization');
        this.loading.set(false);
      },
    });
  }

  startEdit(): void {
    this.editName.set(this.org()?.name ?? '');
    this.editAddress.set(this.org()?.address ?? '');
    this.editSubmitted.set(false);
    this.saveError.set(null);
    this.saveSuccess.set(false);
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  save(): void {
    this.editSubmitted.set(true);
    if (!this.editName().trim() || !this.editAddress().trim()) return;

    this.saving.set(true);
    this.saveError.set(null);

    this.orgService.update({ name: this.editName(), address: this.editAddress() }).subscribe({
      next: (updated) => {
        this.org.set(updated);
        this.saving.set(false);
        this.editing.set(false);
        this.saveSuccess.set(true);
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(err?.error?.error ?? 'Failed to save organization');
      },
    });
  }
}
