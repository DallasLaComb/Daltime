import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  ManagerLocation,
  CreateLocationBody,
  UpdateLocationBody,
} from '../../../core/models/manager-location.model';

@Injectable({ providedIn: 'root' })
export class OrgAdminLocationsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/org-admin/locations`;

  getAll(): Observable<ManagerLocation[]> {
    return this.http.get<ManagerLocation[]>(this.baseUrl);
  }

  create(body: CreateLocationBody): Observable<ManagerLocation> {
    return this.http.post<ManagerLocation>(this.baseUrl, body);
  }

  update(locationId: string, body: UpdateLocationBody): Observable<ManagerLocation> {
    return this.http.put<ManagerLocation>(`${this.baseUrl}/${locationId}`, body);
  }

  remove(locationId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${locationId}`);
  }
}
