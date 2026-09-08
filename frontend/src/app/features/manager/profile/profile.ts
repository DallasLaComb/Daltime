import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ManagerProfileService } from './profile.service';
import type { ManagerProfileResponse } from '../../../core/models/manager-profile.model';
import { ButtonComponent } from '@common-daltime';

@Component({
  selector: 'app-manager-profile',
  imports: [ButtonComponent],
  templateUrl: './profile.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManagerProfileComponent {
  private readonly profileService = inject(ManagerProfileService);
  private readonly router = inject(Router);

  readonly profile = signal<ManagerProfileResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly editing = signal(false);
  readonly editFirstName = signal('');
  readonly editLastName = signal('');
  readonly editPhone = signal('');
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
    this.profileService.get().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load profile');
        this.loading.set(false);
      },
    });
  }

  startEdit(): void {
    const p = this.profile()!;
    this.editFirstName.set(p.first_name);
    this.editLastName.set(p.last_name);
    this.editPhone.set(p.phone);
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
    if (!this.editFirstName().trim() || !this.editLastName().trim()) return;

    this.saving.set(true);
    this.saveError.set(null);

    this.profileService
      .update({
        first_name: this.editFirstName(),
        last_name: this.editLastName(),
        phone: this.editPhone(),
      })
      .subscribe({
        next: (updated) => {
          this.profile.set(updated);
          this.saving.set(false);
          this.editing.set(false);
          this.saveSuccess.set(true);
        },
        error: (err) => {
          this.saving.set(false);
          this.saveError.set(err?.error?.error ?? 'Failed to save profile');
        },
      });
  }

  goToDashboard(): void {
    void this.router.navigate(['/manager']);
  }
}
