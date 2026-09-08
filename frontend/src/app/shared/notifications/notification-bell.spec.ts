import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NotificationBellComponent } from './notification-bell';
import { environment } from '../../../environments/environment';
import type { PublicNotification } from '../../core/models/notification.model';

function makeNotification(overrides: Partial<PublicNotification> = {}): PublicNotification {
  return {
    notification_id: '2026-06-18T12:00:00.000Z#a1b2c3d4-0000-0000-0000-000000000000',
    recipient_sub: 'sub-123',
    type: 'INFO',
    message: 'Default message',
    read: false,
    created_at: '2026-06-18T12:00:00.000Z',
    ...overrides,
  };
}

describe('NotificationBellComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function createComponent(role: 'OrgAdmin' | 'Manager' | 'Employee' | 'WebAdmin' = 'OrgAdmin') {
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.componentRef.setInput('role', role);
    fixture.detectChanges();
    return fixture;
  }

  it('computes unreadCount from the list response read field with no separate unread-count call', () => {
    const fixture = createComponent('OrgAdmin');
    const component = fixture.componentInstance;

    // Opening the panel triggers the list load.
    (component as unknown as { togglePanel(): void }).togglePanel();

    const req = httpMock.expectOne(`${environment.api.baseUrl}/org-admin/notifications`);
    req.flush([
      makeNotification({ notification_id: 'a', read: false }),
      makeNotification({ notification_id: 'b', read: true }),
      makeNotification({ notification_id: 'c', read: false }),
    ]);
    fixture.detectChanges();

    expect((component as unknown as { unreadCount(): number }).unreadCount()).toBe(2);
  });

  // Explicit extensibility test required by the story: a notification whose
  // `type` is outside today's 4 known NotificationType literals must still
  // render (via the generic fallback path) rather than the component
  // throwing or silently filtering it out of the list.
  it('renders a notification with an unrecognized/future type via the default fallback instead of throwing or dropping it', () => {
    const fixture = createComponent('Employee');
    const component = fixture.componentInstance;

    (component as unknown as { togglePanel(): void }).togglePanel();

    const req = httpMock.expectOne(`${environment.api.baseUrl}/employee/notifications`);

    const futureTypeNotification = makeNotification({
      notification_id: 'future-1',
      // Cast through `unknown` is intentional: this simulates a real API
      // response containing a NotificationType value added to the backend
      // union after this frontend code shipped, which TypeScript's static
      // union would otherwise prevent us from constructing in a test.
      type: 'FUTURE_TYPE' as unknown as PublicNotification['type'],
      message: 'A brand new kind of notification',
    });

    expect(() => req.flush([futureTypeNotification])).not.toThrow();
    fixture.detectChanges();

    const list = (
      component as unknown as { notifications(): PublicNotification[] }
    ).notifications();
    expect(list).toHaveLength(1);
    expect(list[0].message).toBe('A brand new kind of notification');

    const html: string = fixture.nativeElement.textContent;
    expect(html).toContain('A brand new kind of notification');
    // Generic fallback label, not a per-type-only label that would only exist
    // for the 4 known types.
    expect(html).toContain('Notification');
  });

  it('markOneAsRead optimistically marks the item read and calls the role-prefixed mark-one route with the id encoded', () => {
    const fixture = createComponent('Manager');
    const component = fixture.componentInstance as unknown as {
      togglePanel(): void;
      markOneAsRead(n: PublicNotification): void;
      notifications(): PublicNotification[];
    };

    component.togglePanel();
    const listReq = httpMock.expectOne(`${environment.api.baseUrl}/manager/notifications`);
    const notification = makeNotification({ read: false });
    listReq.flush([notification]);
    fixture.detectChanges();

    component.markOneAsRead(notification);

    const expectedUrl = `${environment.api.baseUrl}/manager/notifications/${encodeURIComponent(
      notification.notification_id,
    )}`;
    const markReq = httpMock.expectOne(expectedUrl);
    expect(markReq.request.method).toBe('PATCH');
    markReq.flush({ ...notification, read: true });
    fixture.detectChanges();

    expect(component.notifications()[0].read).toBe(true);
  });

  it('markAllAsRead calls the mark-all route and flips every notification to read on success', () => {
    const fixture = createComponent('OrgAdmin');
    const component = fixture.componentInstance as unknown as {
      togglePanel(): void;
      markAllAsRead(): void;
      notifications(): PublicNotification[];
    };

    component.togglePanel();
    const listReq = httpMock.expectOne(`${environment.api.baseUrl}/org-admin/notifications`);
    listReq.flush([
      makeNotification({ read: false }),
      makeNotification({ notification_id: 'z', read: false }),
    ]);
    fixture.detectChanges();

    component.markAllAsRead();

    const markAllReq = httpMock.expectOne(`${environment.api.baseUrl}/org-admin/notifications`);
    expect(markAllReq.request.method).toBe('PATCH');
    markAllReq.flush({ success: true, marked_count: 2 });
    fixture.detectChanges();

    expect(component.notifications().every((n) => n.read)).toBe(true);
  });

  it('shows an error and rolls back the optimistic update when mark-one-as-read fails', () => {
    const fixture = createComponent('Employee');
    const component = fixture.componentInstance as unknown as {
      togglePanel(): void;
      markOneAsRead(n: PublicNotification): void;
      notifications(): PublicNotification[];
      error: { (): string | null };
    };

    component.togglePanel();
    const listReq = httpMock.expectOne(`${environment.api.baseUrl}/employee/notifications`);
    const notification = makeNotification({ read: false });
    listReq.flush([notification]);
    fixture.detectChanges();

    component.markOneAsRead(notification);

    const markReq = httpMock.expectOne(
      `${environment.api.baseUrl}/employee/notifications/${encodeURIComponent(
        notification.notification_id,
      )}`,
    );
    markReq.flush('Server error', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(component.notifications()[0].read).toBe(false);
    expect(component.error()).toBeTruthy();
  });

  it('markOneAsRead is a no-op (no request issued) when the notification is already read', () => {
    const fixture = createComponent('Manager');
    const component = fixture.componentInstance as unknown as {
      togglePanel(): void;
      markOneAsRead(n: PublicNotification): void;
    };

    component.togglePanel();
    const listReq = httpMock.expectOne(`${environment.api.baseUrl}/manager/notifications`);
    const alreadyRead = makeNotification({ read: true });
    listReq.flush([alreadyRead]);
    fixture.detectChanges();

    component.markOneAsRead(alreadyRead);

    httpMock.expectNone(
      `${environment.api.baseUrl}/manager/notifications/${encodeURIComponent(
        alreadyRead.notification_id,
      )}`,
    );
  });

  it('shows an error and rolls back the optimistic update when mark-all-as-read fails', () => {
    const fixture = createComponent('OrgAdmin');
    const component = fixture.componentInstance as unknown as {
      togglePanel(): void;
      markAllAsRead(): void;
      notifications(): PublicNotification[];
      error(): string | null;
    };

    component.togglePanel();
    const listReq = httpMock.expectOne(`${environment.api.baseUrl}/org-admin/notifications`);
    listReq.flush([
      makeNotification({ notification_id: 'a', read: false }),
      makeNotification({ notification_id: 'z', read: false }),
    ]);
    fixture.detectChanges();

    component.markAllAsRead();

    const markAllReq = httpMock.expectOne(`${environment.api.baseUrl}/org-admin/notifications`);
    markAllReq.flush('Server error', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    // Rolled back to the pre-mark-all snapshot — neither item should have
    // been left optimistically marked read after the server rejected the call.
    expect(component.notifications().every((n) => !n.read)).toBe(true);
    expect(component.error()).toBeTruthy();
  });

  it('markAllAsRead is a no-op (does not issue a PATCH) when there are zero unread notifications', () => {
    const fixture = createComponent('Manager');
    const component = fixture.componentInstance as unknown as {
      togglePanel(): void;
      markAllAsRead(): void;
    };

    component.togglePanel();
    const listReq = httpMock.expectOne(`${environment.api.baseUrl}/manager/notifications`);
    listReq.flush([makeNotification({ read: true })]);
    fixture.detectChanges();

    component.markAllAsRead();

    // No PATCH should have been issued — httpMock.verify() in afterEach will
    // fail this test if an unexpected request was made.
    httpMock.expectNone(`${environment.api.baseUrl}/manager/notifications`);
  });

  it('shows an error state (via ErrorAlertComponent) and retryLoad() re-issues the list request after a load failure', () => {
    const fixture = createComponent('Employee');
    const component = fixture.componentInstance as unknown as {
      togglePanel(): void;
      retryLoad(): void;
      error(): string | null;
      loading(): boolean;
    };

    component.togglePanel();
    const failedReq = httpMock.expectOne(`${environment.api.baseUrl}/employee/notifications`);
    failedReq.flush('Server error', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(component.error()).toBeTruthy();
    expect(component.loading()).toBe(false);

    component.retryLoad();
    fixture.detectChanges();

    const retryReq = httpMock.expectOne(`${environment.api.baseUrl}/employee/notifications`);
    expect(retryReq.request.method).toBe('GET');
    retryReq.flush([makeNotification({ read: false })]);
    fixture.detectChanges();

    expect(component.error()).toBeNull();
  });

  it('closePanel() sets panelOpen back to false without issuing any additional request', () => {
    const fixture = createComponent('OrgAdmin');
    const component = fixture.componentInstance as unknown as {
      togglePanel(): void;
      closePanel(): void;
      panelOpen(): boolean;
    };

    component.togglePanel();
    expect(component.panelOpen()).toBe(true);
    const listReq = httpMock.expectOne(`${environment.api.baseUrl}/org-admin/notifications`);
    listReq.flush([]);
    fixture.detectChanges();

    component.closePanel();
    fixture.detectChanges();

    expect(component.panelOpen()).toBe(false);
    httpMock.expectNone(`${environment.api.baseUrl}/org-admin/notifications`);
  });
});
