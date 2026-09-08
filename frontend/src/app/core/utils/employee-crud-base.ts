import { signal } from '@angular/core';
import type { Observable } from 'rxjs';

export interface EntityWithStatus {
  status: string;
  first_name: string;
  last_name: string;
  email: string;
}

/**
 * Abstract base for components that manage an employee/manager CRUD page with
 * register, edit, disable, and enable modal flows.
 *
 * Subclasses provide:
 * - `extractId(entity)` — returns the entity's primary key string
 * - `disableEntity(id)` / `enableEntity(id)` — service calls
 * - `load()` — initial data fetch
 *
 * The register and edit flows differ too much between role types (different
 * service signatures and request bodies) so they remain in subclasses.
 */
export abstract class EmployeeCrudBaseComponent<T extends EntityWithStatus> {
  // ── Core state ────────────────────────────────────────────────────────────────
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);

  // ── Register modal ────────────────────────────────────────────────────────────
  readonly showRegisterModal = signal(false);
  readonly modalError = signal<string | null>(null);

  // ── Edit modal ────────────────────────────────────────────────────────────────
  readonly showEditModal = signal(false);
  readonly editError = signal<string | null>(null);

  // ── Disable modal ─────────────────────────────────────────────────────────────
  readonly showDisableModal = signal(false);
  readonly disablingEntity = signal<T | null>(null);

  // ── Enable modal ──────────────────────────────────────────────────────────────
  readonly showEnableModal = signal(false);
  readonly enablingEntity = signal<T | null>(null);

  // ── Abstract contract ─────────────────────────────────────────────────────────

  protected abstract load(): void;
  protected abstract extractId(entity: T): string;
  protected abstract disableEntity(id: string): Observable<void>;
  protected abstract enableEntity(id: string): Observable<void>;

  // ── Register modal handlers ───────────────────────────────────────────────────

  openRegisterModal(): void {
    this.modalError.set(null);
    this.showRegisterModal.set(true);
  }

  closeRegisterModal(): void {
    this.showRegisterModal.set(false);
  }

  // ── Edit modal handlers ───────────────────────────────────────────────────────

  closeEditModal(): void {
    this.showEditModal.set(false);
  }

  // ── Disable modal handlers ────────────────────────────────────────────────────

  openDisableModal(entity: T): void {
    this.disablingEntity.set(entity);
    this.showDisableModal.set(true);
  }

  closeDisableModal(): void {
    this.showDisableModal.set(false);
    this.disablingEntity.set(null);
  }

  confirmDisable(): void {
    const entity = this.disablingEntity();
    if (!entity) return;
    this.saving.set(true);
    this.disableEntity(this.extractId(entity)).subscribe({
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

  // ── Enable modal handlers ─────────────────────────────────────────────────────

  openEnableModal(entity: T): void {
    this.enablingEntity.set(entity);
    this.showEnableModal.set(true);
  }

  closeEnableModal(): void {
    this.showEnableModal.set(false);
    this.enablingEntity.set(null);
  }

  confirmEnable(): void {
    const entity = this.enablingEntity();
    if (!entity) return;
    this.saving.set(true);
    this.enableEntity(this.extractId(entity)).subscribe({
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
