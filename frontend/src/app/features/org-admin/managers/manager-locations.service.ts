import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { UserLocationResponse } from '../../../core/models/user-location.model';

@Injectable({ providedIn: 'root' })
export class ManagerLocationsService {
  private readonly http = inject(HttpClient);

  private baseUrl(managerId: string): string {
    return `${environment.api.baseUrl}/org-admin/managers/${managerId}/locations`;
  }

  getAll(managerId: string): Observable<UserLocationResponse[]> {
    return this.http.get<UserLocationResponse[]>(this.baseUrl(managerId));
  }

  assign(managerId: string, locationId: string): Observable<UserLocationResponse> {
    return this.http.post<UserLocationResponse>(this.baseUrl(managerId), {
      location_id: locationId,
    });
  }

  remove(managerId: string, locationId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl(managerId)}/${locationId}`);
  }
}
