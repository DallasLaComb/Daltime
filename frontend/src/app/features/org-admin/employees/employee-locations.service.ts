import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { UserLocationResponse } from '../../../core/models/user-location.model';

@Injectable({ providedIn: 'root' })
export class EmployeeLocationsService {
  private readonly http = inject(HttpClient);

  private baseUrl(employeeId: string): string {
    return `${environment.api.baseUrl}/org-admin/employees/${employeeId}/locations`;
  }

  getAll(employeeId: string): Observable<UserLocationResponse[]> {
    return this.http.get<UserLocationResponse[]>(this.baseUrl(employeeId));
  }

  assign(employeeId: string, locationId: string): Observable<UserLocationResponse> {
    return this.http.post<UserLocationResponse>(this.baseUrl(employeeId), {
      location_id: locationId,
    });
  }

  remove(employeeId: string, locationId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl(employeeId)}/${locationId}`);
  }
}
