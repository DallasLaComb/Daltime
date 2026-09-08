import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { USER_STATUS_COLOR_MAP, getUserStatusLabel } from '../../../core/utils/user-status';
import { OrgAdminOrganizationService } from '../organization/organization.service';
import { ManagersService } from '../managers/managers.service';
import { EmployeesService } from '../employees/employees.service';
import type { Organization } from '../../../core/models/organization.model';
import type { ManagerResponse } from '../../../core/models/manager.model';
import type { EmployeeResponse } from '../../../core/models/employee.model';
import { StatusBadgeComponent, ButtonComponent } from '@common-daltime';

@Component({
  selector: 'app-org-admin-dashboard',
  imports: [StatusBadgeComponent, ButtonComponent],
  templateUrl: './org-admin-dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrgAdminDashboard {
  private readonly orgService = inject(OrgAdminOrganizationService);
  private readonly managersService = inject(ManagersService);
  private readonly employeesService = inject(EmployeesService);

  readonly org = signal<Organization | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** Prevents rapid repeated calls to refreshOrg() by enforcing a 5-second cooldown after each click. */
  readonly orgRefreshCooldown = signal(false);

  readonly managers = signal<ManagerResponse[]>([]);
  readonly employees = signal<EmployeeResponse[]>([]);
  readonly hierarchyLoading = signal(true);
  readonly hierarchyError = signal<string | null>(null);

  readonly statusColorMap = USER_STATUS_COLOR_MAP;

  /**
   * Derives a nested hierarchy from the flat managers and employees signals.
   * Groups employees by their manager_id, omits DISABLED managers, and collects
   * employees with no manager_id under the '__unassigned__' bucket.
   */
  readonly hierarchy = computed(() => {
    const employeesByManager = new Map<string, EmployeeResponse[]>();
    for (const emp of this.employees()) {
      const key = emp.manager_id || '__unassigned__';
      const group = employeesByManager.get(key) ?? [];
      group.push(emp);
      employeesByManager.set(key, group);
    }
    return {
      managers: this.managers()
        .filter((m) => m.status !== 'DISABLED')
        .map((m) => ({ ...m, reports: employeesByManager.get(m.manager_id) ?? [] })),
      unassigned: employeesByManager.get('__unassigned__') ?? [],
    };
  });

  readonly statusLabel = getUserStatusLabel;

  constructor() {
    // Kick off the org fetch and the hierarchy fetch concurrently on init.
    // Both are extracted into methods so they can be independently retried.
    this.loadOrg();
    this.loadHierarchy();
  }

  /**
   * Fetches the org using the org-admin scoped endpoint so the API resolves
   * the org from the JWT token itself. Works correctly during web-admin
   * emulation because the HTTP interceptor attaches the emulation headers.
   * Treats a null or missing org_id response as an error to guard against
   * blank org cards from malformed API responses.
   */
  loadOrg(): void {
    this.loading.set(true);
    this.error.set(null);
    this.orgService.get().subscribe({
      next: (org) => {
        if (!org || !org.org_id) {
          this.error.set('Failed to load organization details.');
          this.loading.set(false);
          return;
        }
        this.org.set(org);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load organization details.');
        this.loading.set(false);
      },
    });
  }

  /**
   * Rate-limited wrapper around loadOrg(). If the cooldown flag is active
   * (set for 5 seconds after the previous click) the call is a noop, which
   * prevents the user from hammering the API with rapid Refresh clicks.
   */
  refreshOrg(): void {
    if (this.orgRefreshCooldown()) {
      return;
    }
    this.orgRefreshCooldown.set(true);
    this.loadOrg();
    setTimeout(() => this.orgRefreshCooldown.set(false), 5000);
  }

  /**
   * Fetches managers and employees in parallel via forkJoin and populates the
   * respective signals. Filters out DISABLED employees client-side so the
   * hierarchy computed only shows active reports.
   */
  loadHierarchy(): void {
    this.hierarchyLoading.set(true);
    this.hierarchyError.set(null);
    forkJoin({
      managers: this.managersService.getAll(),
      employees: this.employeesService.getAll(),
    }).subscribe({
      next: ({ managers, employees }) => {
        this.managers.set(managers);
        this.employees.set(employees.filter((e) => e.status !== 'DISABLED'));
        this.hierarchyLoading.set(false);
      },
      error: () => {
        this.hierarchyError.set('Failed to load hierarchy.');
        this.hierarchyLoading.set(false);
      },
    });
  }
}
