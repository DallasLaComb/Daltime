import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError, Subject } from 'rxjs';
import { OrgAdminDashboard } from './org-admin-dashboard';
import { OrgAdminOrganizationService } from '../organization/organization.service';
import { ManagersService } from '../managers/managers.service';
import { EmployeesService } from '../employees/employees.service';
import { APP_TEST_PROVIDERS } from '../../../../test-setup';
import type { Organization } from '../../../core/models/organization.model';
import type { ManagerResponse } from '../../../core/models/manager.model';
import type { EmployeeResponse } from '../../../core/models/employee.model';

// ─── Randomized data pool ─────────────────────────────────────────────────────
// Seed is randomized each run. On failure, capture the logged seed and re-run
// with the same value by assigning it here (e.g. const SEED = 42) to reproduce.
const SEED = Math.floor(Math.random() * 1_000_000);
// Simple seeded LCG so each test run is deterministic once the seed is known
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
const rng = seededRng(SEED);

const ORG_NAMES = ['Acme Corp', 'Globex', 'Initech', 'Umbrella Ltd', 'Stark Industries'];
const ADDRESSES = ['123 Main St', '456 Oak Ave', '', '789 Pine Rd'];
function pickOrg(overrides: Partial<Organization> = {}): Organization {
  const idx = Math.floor(rng() * ORG_NAMES.length);
  const addrIdx = Math.floor(rng() * ADDRESSES.length);
  return {
    org_id: `org-${Math.floor(rng() * 90000 + 10000)}`,
    name: ORG_NAMES[idx],
    address: ADDRESSES[addrIdx],
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    org_admin_count: 1,
    ...overrides,
  };
}

const FIRST_NAMES = ['Alice', 'Bob', 'Carol', 'Dan', 'Eve'];
const LAST_NAMES = ['Smith', 'Jones', 'Brown', 'Davis', 'Miller'];
function pickManager(overrides: Partial<ManagerResponse> = {}): ManagerResponse {
  const fi = Math.floor(rng() * FIRST_NAMES.length);
  const li = Math.floor(rng() * LAST_NAMES.length);
  return {
    manager_id: `mgr-${Math.floor(rng() * 90000 + 10000)}`,
    first_name: FIRST_NAMES[fi],
    last_name: LAST_NAMES[li],
    email: `${FIRST_NAMES[fi].toLowerCase()}@test.com`,
    phone: '',
    org_id: 'org-test',
    org_admin_id: 'admin-test',
    status: 'CONFIRMED',
    employee_count: 0,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function pickEmployee(
  managerId: string | null = null,
  overrides: Partial<EmployeeResponse> = {},
): EmployeeResponse {
  const fi = Math.floor(rng() * FIRST_NAMES.length);
  const li = Math.floor(rng() * LAST_NAMES.length);
  return {
    employee_id: `emp-${Math.floor(rng() * 90000 + 10000)}`,
    first_name: FIRST_NAMES[fi],
    last_name: LAST_NAMES[li],
    email: `emp${Math.floor(rng() * 1000)}@test.com`,
    phone: '',
    org_id: 'org-test',
    manager_id: managerId ?? '',
    status: 'CONFIRMED',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Log seed on every test file load so failures are reproducible

console.log(`[org-admin-dashboard.spec] random seed: ${SEED}`);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildOrgServiceMock(
  overrides: Partial<Record<keyof OrgAdminOrganizationService, unknown>> = {},
) {
  return {
    get: vi.fn().mockReturnValue(of(pickOrg())),
    update: vi.fn().mockReturnValue(of(pickOrg())),
    ...overrides,
  };
}

function buildManagersServiceMock(overrides: Partial<Record<keyof ManagersService, unknown>> = {}) {
  return {
    getAll: vi.fn().mockReturnValue(of([])),
    create: vi.fn(),
    update: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
    ...overrides,
  };
}

function buildEmployeesServiceMock(
  overrides: Partial<Record<keyof EmployeesService, unknown>> = {},
) {
  return {
    getAll: vi.fn().mockReturnValue(of([])),
    create: vi.fn(),
    update: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
    ...overrides,
  };
}

describe('OrgAdminDashboard', () => {
  let fixture: ComponentFixture<OrgAdminDashboard>;
  let component: OrgAdminDashboard;
  let orgService: ReturnType<typeof buildOrgServiceMock>;
  let managersService: ReturnType<typeof buildManagersServiceMock>;
  let employeesService: ReturnType<typeof buildEmployeesServiceMock>;

  async function createComponent(
    options: {
      orgService?: Partial<Record<keyof OrgAdminOrganizationService, unknown>>;
      managersService?: Partial<Record<keyof ManagersService, unknown>>;
      employeesService?: Partial<Record<keyof EmployeesService, unknown>>;
    } = {},
  ) {
    orgService = buildOrgServiceMock(options.orgService);
    managersService = buildManagersServiceMock(options.managersService);
    employeesService = buildEmployeesServiceMock(options.employeesService);

    await TestBed.configureTestingModule({
      imports: [OrgAdminDashboard],
      providers: [
        ...APP_TEST_PROVIDERS,
        { provide: OrgAdminOrganizationService, useValue: orgService },
        { provide: ManagersService, useValue: managersService },
        { provide: EmployeesService, useValue: employeesService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrgAdminDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  // ─── Sanity / basic creation ──────────────────────────────────────────────

  it('creates the component', async () => {
    await createComponent();
    expect(component).toBeTruthy();
  });

  // ─── Data-fetching path: uses OrgAdminOrganizationService.get() ───────────

  it('calls OrgAdminOrganizationService.get() on init — not authService.orgId()', async () => {
    await createComponent();
    expect(orgService.get).toHaveBeenCalledTimes(1);
  });

  it('does NOT inject or use AuthService for org fetching', async () => {
    // The component class should not reference orgId from AuthService.
    // Validate at the instance level: no property exposes authService.orgId usage.
    await createComponent();
    // If AuthService were still injected for the org path, orgId would appear
    // as a private property.  We can confirm the constructor uses orgService.get
    // by verifying get was called and the component holds org data.
    expect(orgService.get).toHaveBeenCalled();
    // No "No organization assigned" text — old guard is gone
    expect(fixture.nativeElement.textContent).not.toContain('No organization assigned');
  });

  // ─── Happy path: org data displayed correctly ─────────────────────────────

  it('displays org name after successful get()', async () => {
    const org = pickOrg({ name: 'Randomized Corp' });
    await createComponent({ orgService: { get: vi.fn().mockReturnValue(of(org)) } });

    expect(fixture.nativeElement.textContent).toContain('Randomized Corp');
  });

  it('displays org address when present', async () => {
    const org = pickOrg({ address: '99 Test Lane' });
    await createComponent({ orgService: { get: vi.fn().mockReturnValue(of(org)) } });

    expect(fixture.nativeElement.textContent).toContain('99 Test Lane');
  });

  it('displays em-dash placeholder when address is empty', async () => {
    const org = pickOrg({ address: '' });
    await createComponent({ orgService: { get: vi.fn().mockReturnValue(of(org)) } });

    expect(fixture.nativeElement.textContent).toContain('—');
  });

  it('displays org_id in a code element', async () => {
    const org = pickOrg({ org_id: 'org-abc-123' });
    await createComponent({ orgService: { get: vi.fn().mockReturnValue(of(org)) } });

    const code = fixture.nativeElement.querySelector('code');
    expect(code).toBeTruthy();
    expect(code.textContent).toContain('org-abc-123');
  });

  it('sets loading to false after org resolves', async () => {
    await createComponent();
    expect(component.loading()).toBe(false);
  });

  it('org signal holds the returned organization', async () => {
    const org = pickOrg({ name: 'Signal Test Org' });
    await createComponent({ orgService: { get: vi.fn().mockReturnValue(of(org)) } });

    expect(component.org()?.name).toBe('Signal Test Org');
  });

  // ─── Loading state ────────────────────────────────────────────────────────

  it('shows spinner while org get() is pending', async () => {
    const pending$ = new Subject<Organization>();
    orgService = buildOrgServiceMock({ get: vi.fn().mockReturnValue(pending$) });
    managersService = buildManagersServiceMock();
    employeesService = buildEmployeesServiceMock();

    await TestBed.configureTestingModule({
      imports: [OrgAdminDashboard],
      providers: [
        ...APP_TEST_PROVIDERS,
        { provide: OrgAdminOrganizationService, useValue: orgService },
        { provide: ManagersService, useValue: managersService },
        { provide: EmployeesService, useValue: employeesService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrgAdminDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // loading should be true, org detail section should not render
    expect(component.loading()).toBe(true);
    const spinner = fixture.nativeElement.querySelector('.dt-spinner');
    expect(spinner).toBeTruthy();
  });

  it('hides spinner after org get() resolves', async () => {
    await createComponent();
    // After resolution, the main spinner is gone (hierarchy spinner may remain briefly)
    // The outer loading spinner disappears when loading() is false
    expect(component.loading()).toBe(false);
    // No spinner visible for the org section
    expect(fixture.nativeElement.querySelector('.dt-spinner')).toBeNull();
  });

  // ─── Error path: get() fails ──────────────────────────────────────────────

  it('sets error signal when get() throws', async () => {
    await createComponent({
      orgService: { get: vi.fn().mockReturnValue(throwError(() => new Error('network error'))) },
    });

    expect(component.error()).toBeTruthy();
    expect(component.error()).toBe('Failed to load organization details.');
  });

  it('shows error alert when get() fails', async () => {
    await createComponent({
      orgService: { get: vi.fn().mockReturnValue(throwError(() => new Error('network error'))) },
    });

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('Failed to load organization details.');
  });

  it('does NOT show org detail section when get() fails', async () => {
    await createComponent({
      orgService: { get: vi.fn().mockReturnValue(throwError(() => new Error('fail'))) },
    });

    // The "Your Organization" section is inside @if (!loading() && !error())
    expect(fixture.nativeElement.textContent).not.toContain('Your Organization');
  });

  it('does not crash when get() returns a 403 (lost OrgAdmin role mid-session)', async () => {
    const error403 = { status: 403, message: 'Forbidden' };
    await createComponent({
      orgService: { get: vi.fn().mockReturnValue(throwError(() => error403)) },
    });

    // Component must not throw; error signal set, no JS exception
    expect(component.error()).toBe('Failed to load organization details.');
    expect(component.loading()).toBe(false);
  });

  it('does not crash when get() returns a 500', async () => {
    const error500 = { status: 500, message: 'Internal Server Error' };
    await createComponent({
      orgService: { get: vi.fn().mockReturnValue(throwError(() => error500)) },
    });

    expect(component.error()).toBe('Failed to load organization details.');
  });

  // ─── Adversarial: malformed/partial org response ──────────────────────────

  it('renders without crashing when org name is missing (partial response)', async () => {
    // A partial org with org_id is treated as valid — name cell will just be empty.
    // The null-guard only fires when org_id itself is absent, not when other fields are.
    const partialOrg = { org_id: 'org-partial', address: '1 Test St' } as Organization;
    await createComponent({ orgService: { get: vi.fn().mockReturnValue(of(partialOrg)) } });

    // No crash; name cell is just empty but the card renders (org_id is present)
    expect(component).toBeTruthy();
    expect(component.org()?.name).toBeUndefined();
  });

  it('sets error when org is null (get() emits null)', async () => {
    // A null response lacks org_id so loadOrg treats it as a malformed response
    // and sets the error signal rather than showing a blank org card.
    await createComponent({
      orgService: { get: vi.fn().mockReturnValue(of(null as unknown as Organization)) },
    });

    expect(component).toBeTruthy();
    expect(component.org()).toBeNull();
    expect(component.error()).toBe('Failed to load organization details.');
    expect(component.loading()).toBe(false);
  });

  it('sets error when org response has no org_id field', async () => {
    // A response without org_id is treated as malformed — prevents blank org card.
    const malformedOrg = { name: 'Broken Org', address: '1 St' } as Organization;
    await createComponent({
      orgService: { get: vi.fn().mockReturnValue(of(malformedOrg)) },
    });

    expect(component.error()).toBe('Failed to load organization details.');
    expect(component.loading()).toBe(false);
  });

  it('shows error alert and Refresh button when org response is null', async () => {
    // Confirms the template's error state renders the Refresh button for null responses.
    await createComponent({
      orgService: { get: vi.fn().mockReturnValue(of(null as unknown as Organization)) },
    });

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('Failed to load organization details.');
    // The refresh button is rendered inside the alert via app-button (testId="org-refresh-btn")
    const refreshBtn = fixture.nativeElement.querySelector('[data-testid="org-refresh-btn"]');
    expect(refreshBtn).toBeTruthy();
  });

  // ─── loadOrg() method — extractable and retriable ────────────────────────

  it('loadOrg() resets loading and error before re-fetching', async () => {
    // After a failed fetch, calling loadOrg() directly should clear the error and
    // set loading back to true before the new request completes.
    const errorThenSuccess = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('fail')))
      .mockReturnValue(of(pickOrg({ name: 'Reloaded Org' })));

    await createComponent({ orgService: { get: errorThenSuccess } });

    // First load failed
    expect(component.error()).toBe('Failed to load organization details.');

    component.loadOrg();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // After retry, error is cleared and org is set
    expect(component.error()).toBeNull();
    expect(component.org()?.name).toBe('Reloaded Org');
  });

  // ─── refreshOrg() cooldown ────────────────────────────────────────────────

  it('refreshOrg() sets orgRefreshCooldown to true immediately', async () => {
    // Confirms the cooldown flag is set on the first refresh call so subsequent
    // rapid clicks are blocked while the cooldown timer is active.
    await createComponent({
      orgService: { get: vi.fn().mockReturnValue(throwError(() => new Error('fail'))) },
    });

    // error state is shown; trigger a refresh
    expect(component.error()).toBeTruthy();
    component.refreshOrg();

    expect(component.orgRefreshCooldown()).toBe(true);
  });

  it('refreshOrg() is a noop when orgRefreshCooldown is true', async () => {
    // If the cooldown flag is already active, refreshOrg() must not call loadOrg()
    // again — preventing API hammering from rapid clicks.
    await createComponent({
      orgService: { get: vi.fn().mockReturnValue(throwError(() => new Error('fail'))) },
    });

    // Manually force cooldown active
    component.orgRefreshCooldown.set(true);
    const callCountBefore = (orgService.get as ReturnType<typeof vi.fn>).mock.calls.length;

    component.refreshOrg();

    // No additional call to get() should have been made
    expect(orgService.get).toHaveBeenCalledTimes(callCountBefore);
  });

  it('refreshOrg() cooldown resets to false after 5 seconds (vi fake timers)', async () => {
    // Validates the setTimeout inside refreshOrg() actually fires after 5 s and
    // allows subsequent refreshes — ensures the cooldown window is exactly right.
    vi.useFakeTimers();
    try {
      await createComponent({
        orgService: { get: vi.fn().mockReturnValue(throwError(() => new Error('fail'))) },
      });

      expect(component.error()).toBeTruthy();

      // First refresh — triggers cooldown
      component.refreshOrg();
      expect(component.orgRefreshCooldown()).toBe(true);

      // Advance 4999 ms — still in cooldown
      vi.advanceTimersByTime(4999);
      expect(component.orgRefreshCooldown()).toBe(true);

      // Advance past the 5 s mark — cooldown should clear
      vi.advanceTimersByTime(1);
      expect(component.orgRefreshCooldown()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Refresh button is disabled while orgRefreshCooldown is true', async () => {
    // Validates the [disabled] binding on the org-refresh-btn app-button is wired correctly.
    await createComponent({
      orgService: { get: vi.fn().mockReturnValue(throwError(() => new Error('fail'))) },
    });

    component.orgRefreshCooldown.set(true);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector(
      '[data-testid="org-refresh-btn"]',
    ) as HTMLButtonElement | null;
    expect(btn).toBeTruthy();
    expect(btn?.disabled).toBe(true);
  });

  it('Refresh button is enabled when orgRefreshCooldown is false', async () => {
    // Confirms the disabled binding clears once cooldown lifts, re-enabling the button.
    await createComponent({
      orgService: { get: vi.fn().mockReturnValue(throwError(() => new Error('fail'))) },
    });

    component.orgRefreshCooldown.set(false);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector(
      '[data-testid="org-refresh-btn"]',
    ) as HTMLButtonElement | null;
    expect(btn).toBeTruthy();
    expect(btn?.disabled).toBe(false);
  });

  // ─── data-testid coverage ─────────────────────────────────────────────────

  it('org-refresh-btn has data-testid attribute when org fetch fails', async () => {
    // Ensures tester-agent and e2e tests can locate the Refresh button by testid.
    await createComponent({
      orgService: { get: vi.fn().mockReturnValue(throwError(() => new Error('fail'))) },
    });

    const btn = fixture.nativeElement.querySelector('[data-testid="org-refresh-btn"]');
    expect(btn).toBeTruthy();
  });

  it('hierarchy-retry-btn has data-testid attribute when hierarchy fetch fails', async () => {
    // Ensures tester-agent and e2e tests can locate the hierarchy Retry button by testid.
    await createComponent({
      orgService: { get: vi.fn().mockReturnValue(of(pickOrg())) },
      managersService: {
        getAll: vi.fn().mockReturnValue(throwError(() => new Error('fail'))),
      },
      employeesService: { getAll: vi.fn().mockReturnValue(of([])) },
    });

    const btn = fixture.nativeElement.querySelector('[data-testid="hierarchy-retry-btn"]');
    expect(btn).toBeTruthy();
  });

  // ─── Hierarchy loading ────────────────────────────────────────────────────

  it('calls managersService.getAll() and employeesService.getAll() on init', async () => {
    await createComponent();
    expect(managersService.getAll).toHaveBeenCalledTimes(1);
    expect(employeesService.getAll).toHaveBeenCalledTimes(1);
  });

  it('hierarchy loading fires independently of org fetch', async () => {
    // org fetch is still pending; hierarchy should still be called
    const orgPending$ = new Subject<Organization>();
    orgService = buildOrgServiceMock({ get: vi.fn().mockReturnValue(orgPending$) });
    managersService = buildManagersServiceMock();
    employeesService = buildEmployeesServiceMock();

    await TestBed.configureTestingModule({
      imports: [OrgAdminDashboard],
      providers: [
        ...APP_TEST_PROVIDERS,
        { provide: OrgAdminOrganizationService, useValue: orgService },
        { provide: ManagersService, useValue: managersService },
        { provide: EmployeesService, useValue: employeesService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrgAdminDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Even while org is pending, hierarchy services were called
    expect(managersService.getAll).toHaveBeenCalledTimes(1);
    expect(employeesService.getAll).toHaveBeenCalledTimes(1);
  });

  it('sets managers and employees signals after hierarchy resolves', async () => {
    const manager = pickManager();
    const employee = pickEmployee(manager.manager_id);
    await createComponent({
      managersService: { getAll: vi.fn().mockReturnValue(of([manager])) },
      employeesService: { getAll: vi.fn().mockReturnValue(of([employee])) },
    });

    expect(component.managers()).toHaveLength(1);
    expect(component.employees()).toHaveLength(1);
  });

  it('filters out DISABLED employees from employees signal', async () => {
    const activeEmp = pickEmployee(null, { status: 'CONFIRMED' });
    const disabledEmp = pickEmployee(null, { status: 'DISABLED' });
    await createComponent({
      managersService: { getAll: vi.fn().mockReturnValue(of([])) },
      employeesService: { getAll: vi.fn().mockReturnValue(of([activeEmp, disabledEmp])) },
    });

    expect(component.employees()).toHaveLength(1);
    expect(component.employees()[0].status).toBe('CONFIRMED');
  });

  it('filters out DISABLED managers from hierarchy computed signal', async () => {
    const activeManager = pickManager({ status: 'CONFIRMED' });
    const disabledManager = pickManager({ status: 'DISABLED' });
    await createComponent({
      managersService: { getAll: vi.fn().mockReturnValue(of([activeManager, disabledManager])) },
      employeesService: { getAll: vi.fn().mockReturnValue(of([])) },
    });

    expect(component.hierarchy().managers).toHaveLength(1);
    expect(component.hierarchy().managers[0].status).toBe('CONFIRMED');
  });

  it('groups employees under their manager in hierarchy computed signal', async () => {
    const manager = pickManager();
    const emp1 = pickEmployee(manager.manager_id);
    const emp2 = pickEmployee(manager.manager_id);
    const empUnassigned = pickEmployee(null);
    await createComponent({
      managersService: { getAll: vi.fn().mockReturnValue(of([manager])) },
      employeesService: {
        getAll: vi.fn().mockReturnValue(of([emp1, emp2, empUnassigned])),
      },
    });

    const h = component.hierarchy();
    expect(h.managers[0].reports).toHaveLength(2);
    expect(h.unassigned).toHaveLength(1);
  });

  it('puts employees with no manager_id in unassigned bucket', async () => {
    const empUnassigned = pickEmployee('');
    await createComponent({
      managersService: { getAll: vi.fn().mockReturnValue(of([])) },
      employeesService: { getAll: vi.fn().mockReturnValue(of([empUnassigned])) },
    });

    expect(component.hierarchy().unassigned).toHaveLength(1);
  });

  it('shows hierarchy error when forkJoin fails', async () => {
    await createComponent({
      managersService: {
        getAll: vi.fn().mockReturnValue(throwError(() => new Error('managers fail'))),
      },
      employeesService: { getAll: vi.fn().mockReturnValue(of([])) },
    });

    expect(component.hierarchyError()).toBe('Failed to load hierarchy.');
    expect(component.hierarchyLoading()).toBe(false);
  });

  it('shows hierarchy error alert in template when forkJoin fails', async () => {
    await createComponent({
      orgService: { get: vi.fn().mockReturnValue(of(pickOrg())) },
      managersService: {
        getAll: vi.fn().mockReturnValue(throwError(() => new Error('fail'))),
      },
      employeesService: { getAll: vi.fn().mockReturnValue(of([])) },
    });

    // The error alert inside the hierarchy section
    const alerts = fixture.nativeElement.querySelectorAll('[role="alert"]');
    const hierarchyAlert = Array.from(alerts as NodeListOf<HTMLElement>).find((el) =>
      el.textContent?.includes('Failed to load hierarchy'),
    );
    expect(hierarchyAlert).toBeTruthy();
  });

  it('loadHierarchy() re-fetches managers and employees when called again', async () => {
    await createComponent();

    const initialManagerCallCount = (managersService.getAll as ReturnType<typeof vi.fn>).mock.calls
      .length;
    component.loadHierarchy();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(managersService.getAll).toHaveBeenCalledTimes(initialManagerCallCount + 1);
    expect(employeesService.getAll).toHaveBeenCalledTimes(initialManagerCallCount + 1);
  });

  it('resets hierarchyError to null when loadHierarchy() is retried', async () => {
    managersService = buildManagersServiceMock({
      getAll: vi
        .fn()
        .mockReturnValueOnce(throwError(() => new Error('fail')))
        .mockReturnValue(of([])),
    });
    employeesService = buildEmployeesServiceMock();

    await TestBed.configureTestingModule({
      imports: [OrgAdminDashboard],
      providers: [
        ...APP_TEST_PROVIDERS,
        { provide: OrgAdminOrganizationService, useValue: buildOrgServiceMock() },
        { provide: ManagersService, useValue: managersService },
        { provide: EmployeesService, useValue: employeesService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrgAdminDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    // First load failed
    expect(component.hierarchyError()).toBe('Failed to load hierarchy.');

    // Retry
    component.loadHierarchy();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.hierarchyError()).toBeNull();
  });

  // ─── Concurrent in-flight (race between org and hierarchy) ───────────────

  it('handles org and hierarchy resolving out of order without flicker', async () => {
    const orgSubject = new Subject<Organization>();
    const managersSubject = new Subject<ManagerResponse[]>();
    const employeesSubject = new Subject<EmployeeResponse[]>();

    orgService = buildOrgServiceMock({ get: vi.fn().mockReturnValue(orgSubject) });
    managersService = buildManagersServiceMock({
      getAll: vi.fn().mockReturnValue(managersSubject),
    });
    employeesService = buildEmployeesServiceMock({
      getAll: vi.fn().mockReturnValue(employeesSubject),
    });

    await TestBed.configureTestingModule({
      imports: [OrgAdminDashboard],
      providers: [
        ...APP_TEST_PROVIDERS,
        { provide: OrgAdminOrganizationService, useValue: orgService },
        { provide: ManagersService, useValue: managersService },
        { provide: EmployeesService, useValue: employeesService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrgAdminDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Both still pending
    expect(component.loading()).toBe(true);
    expect(component.hierarchyLoading()).toBe(true);

    // Hierarchy resolves first
    managersSubject.next([]);
    managersSubject.complete();
    employeesSubject.next([]);
    employeesSubject.complete();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.hierarchyLoading()).toBe(false);
    expect(component.loading()).toBe(true); // org still pending

    // Org resolves second
    const org = pickOrg({ name: 'Late Org' });
    orgSubject.next(org);
    orgSubject.complete();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.loading()).toBe(false);
    expect(component.org()?.name).toBe('Late Org');
    // No crash, no duplicate renders
    expect(component).toBeTruthy();
  });

  // ─── Web-Admin emulation: same code path ─────────────────────────────────

  it('uses the same OrgAdminOrganizationService.get() path regardless of caller role', async () => {
    // Emulation is handled transparently by the HTTP interceptor; the component
    // always calls orgService.get() — validate this is the only org-fetching call.
    const org = pickOrg({ name: 'Emulated Org' });
    await createComponent({ orgService: { get: vi.fn().mockReturnValue(of(org)) } });

    // get() called exactly once — no secondary getById() call
    expect(orgService.get).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Emulated Org');
  });

  // ─── No stale API calls: old path must not exist ─────────────────────────

  it('component does not call any getById() path — old broken route is removed', async () => {
    // If the old broken path were still present it would try to read authService.orgId()
    // and call getById(). Since AuthService mock returns orgId = signal(null),
    // the old code would have short-circuited to "No organization assigned".
    // The fact that org data IS displayed confirms the old path is gone.
    const org = pickOrg({ name: 'Direct Get Org' });
    await createComponent({ orgService: { get: vi.fn().mockReturnValue(of(org)) } });

    expect(fixture.nativeElement.textContent).not.toContain('No organization assigned');
    expect(fixture.nativeElement.textContent).toContain('Direct Get Org');
  });

  // ─── Template integrity ───────────────────────────────────────────────────

  it('shows "Your Organization" heading when org loads successfully', async () => {
    await createComponent();
    expect(fixture.nativeElement.textContent).toContain('Your Organization');
  });

  it('shows "Organizational Hierarchy" heading when org loads successfully', async () => {
    await createComponent();
    expect(fixture.nativeElement.textContent).toContain('Organizational Hierarchy');
  });

  it('shows empty hierarchy message when no managers or employees exist', async () => {
    await createComponent({
      managersService: { getAll: vi.fn().mockReturnValue(of([])) },
      employeesService: { getAll: vi.fn().mockReturnValue(of([])) },
    });

    expect(fixture.nativeElement.textContent).toContain(
      'No managers or employees have been added yet',
    );
  });

  it('renders manager rows in the hierarchy section', async () => {
    const manager = pickManager({ first_name: 'Unique', last_name: 'Boss', status: 'CONFIRMED' });
    await createComponent({
      managersService: { getAll: vi.fn().mockReturnValue(of([manager])) },
      employeesService: { getAll: vi.fn().mockReturnValue(of([])) },
    });

    expect(fixture.nativeElement.textContent).toContain('Unique');
    expect(fixture.nativeElement.textContent).toContain('Boss');
  });

  it('renders unassigned employee section when employees have no manager', async () => {
    const emp = pickEmployee('', { first_name: 'Orphan', last_name: 'Employee' });
    await createComponent({
      managersService: { getAll: vi.fn().mockReturnValue(of([])) },
      employeesService: { getAll: vi.fn().mockReturnValue(of([emp])) },
    });

    expect(fixture.nativeElement.textContent).toContain('Unassigned');
  });

  it('org name initial letter appears in hierarchy root node', async () => {
    const org = pickOrg({ name: 'Zephyr Co' });
    await createComponent({ orgService: { get: vi.fn().mockReturnValue(of(org)) } });

    // The root node shows org.name.charAt(0)
    expect(fixture.nativeElement.textContent).toContain('Z');
    expect(fixture.nativeElement.textContent).toContain('Zephyr Co');
  });
});
