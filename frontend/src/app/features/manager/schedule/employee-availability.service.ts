import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of, type Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
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

  getAllBundles(employeeIds: string[]): Observable<Map<string, EmployeeAvailabilityBundle>> {
    if (employeeIds.length === 0) return of(new Map());
    return forkJoin(
      employeeIds.map((id) =>
        forkJoin({
          availability: this.getAvailability(id),
          overrides: this.getOverrides(id),
        }).pipe(map((r) => ({ employeeId: id, ...r }))),
      ),
    ).pipe(
      map((bundles) => {
        const m = new Map<string, EmployeeAvailabilityBundle>();
        for (const b of bundles) m.set(b.employeeId, b);
        return m;
      }),
    );
  }
}
