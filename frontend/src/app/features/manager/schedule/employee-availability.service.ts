import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, from, of, type Observable } from 'rxjs';
import { catchError, map, mergeMap, toArray } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import type {
  EmployeeAvailabilityResponse,
  EmployeeAvailabilityOverridesResponse,
} from '../../../core/models/employee-availability.model';

export interface EmployeeAvailabilityBundle {
  employeeId: string;
  availability: EmployeeAvailabilityResponse | null;
  overrides: EmployeeAvailabilityOverridesResponse | null;
}

@Injectable({ providedIn: 'root' })
export class ManagerEmployeeAvailabilityService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/manager/employees`;

  getAvailability(employeeId: string): Observable<EmployeeAvailabilityResponse | null> {
    return this.http
      .get<EmployeeAvailabilityResponse>(`${this.baseUrl}/${employeeId}/availability`)
      .pipe(catchError(() => of(null)));
  }

  getOverrides(employeeId: string): Observable<EmployeeAvailabilityOverridesResponse | null> {
    return this.http
      .get<EmployeeAvailabilityOverridesResponse>(
        `${this.baseUrl}/${employeeId}/availability/overrides`,
      )
      .pipe(catchError(() => of(null)));
  }

  /**
   * Fetches availability + overrides for every employee in the list, but caps
   * the number of in-flight employees at 3 at a time. Without this cap the old
   * forkJoin pattern fires one Lambda per employee simultaneously (~30 concurrent
   * requests), which exhausts the account's Lambda concurrency budget and causes
   * 503s. The inner forkJoin for each employee still fires both requests
   * (availability and overrides) concurrently — only the outer fan-out is throttled.
   */
  getAllBundles(employeeIds: string[]): Observable<Map<string, EmployeeAvailabilityBundle>> {
    if (employeeIds.length === 0) return of(new Map());
    return from(employeeIds).pipe(
      // Concurrency limit of 3: at most 3 employees' requests are in-flight at once.
      mergeMap(
        (id) =>
          forkJoin({
            availability: this.getAvailability(id),
            overrides: this.getOverrides(id),
          }).pipe(map((r) => ({ employeeId: id, ...r }))),
        3,
      ),
      toArray(),
      map((bundles) => {
        const m = new Map<string, EmployeeAvailabilityBundle>();
        for (const b of bundles) m.set(b.employeeId, b);
        return m;
      }),
    );
  }
}
