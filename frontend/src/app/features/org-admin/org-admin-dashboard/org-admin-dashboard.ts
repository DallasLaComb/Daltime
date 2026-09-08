import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { USER_STATUS_COLOR_MAP, getUserStatusLabel } from '../../../core/utils/user-status';
import { AuthService } from '../../../core/auth/auth';
import { ImpersonationService } from '../../../core/services/impersonation.service';
import { OrganizationService } from '../../../services/organization.service';
import { ManagersService } from '../managers/managers.service';
import { EmployeesService } from '../employees/employees.service';
import type { Organization } from '../../../core/models/organization.model';
import type { ManagerResponse } from '../../../core/models/manager.model';
import type { EmployeeResponse } from '../../../core/models/employee.model';
import { StatusBadgeComponent } from '@common-daltime';

@Component({
  selector: 'app-org-admin-dashboard',
  imports: [StatusBadgeComponent],
  templateUrl: './org-admin-dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrgAdminDashboard {
  private readonly orgService = inject(OrganizationService);
  private readonly managersService = inject(ManagersService);
  private readonly employeesService = inject(EmployeesService);

  readonly org = signal<Organization | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly managers = signal<ManagerResponse[]>([]);
  readonly employees = signal<EmployeeResponse[]>([]);
  readonly hierarchyLoading = signal(true);
  readonly hierarchyError = signal<string | null>(null);

  readonly statusColorMap = USER_STATUS_COLOR_MAP;

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
    const authService = inject(AuthService);
    const impersonationService = inject(ImpersonationService);

    // When a web-admin is impersonating, use the impersonated user's orgId
    // because the web-admin JWT has no custom:org_id Cognito attribute.
    const orgId = impersonationService.viewingAs()?.orgId ?? authService.orgId();

    if (!orgId) {
      this.error.set('No organization assigned to your account.');
      this.loading.set(false);
      return;
    }

    this.orgService.getById(orgId).subscribe({
      next: (org) => {
        this.org.set(org);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load organization details.');
        this.loading.set(false);
      },
    });

    this.loadHierarchy();
  }

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
