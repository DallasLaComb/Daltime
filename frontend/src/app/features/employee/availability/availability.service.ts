import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  EmployeeAvailabilityResponse,
  EmployeeAvailabilityOverridesResponse,
  WeeklySchedule,
  DateOverrides,
} from '../../../core/models/employee-availability.model';

@Injectable({ providedIn: 'root' })
export class EmployeeAvailabilityService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/employee/availability`;

  get(): Observable<EmployeeAvailabilityResponse | Record<string, never>> {
    return this.http.get<EmployeeAvailabilityResponse | Record<string, never>>(this.baseUrl);
  }

  save(schedule: WeeklySchedule): Observable<EmployeeAvailabilityResponse> {
    return this.http.put<EmployeeAvailabilityResponse>(this.baseUrl, { schedule });
  }

  getOverrides(): Observable<EmployeeAvailabilityOverridesResponse | Record<string, never>> {
    return this.http.get<EmployeeAvailabilityOverridesResponse | Record<string, never>>(
      `${this.baseUrl}/overrides`,
    );
  }

  saveOverrides(overrides: DateOverrides): Observable<EmployeeAvailabilityOverridesResponse> {
    return this.http.put<EmployeeAvailabilityOverridesResponse>(`${this.baseUrl}/overrides`, {
      overrides,
    });
  }
}
