import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { Organization, UpdateOrganizationBody } from '../../../core/models/organization.model';

@Injectable({ providedIn: 'root' })
export class OrgAdminOrganizationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/org-admin/organization`;

  get(): Observable<Organization> {
    return this.http.get<Organization>(this.baseUrl);
  }

  update(body: UpdateOrganizationBody): Observable<Organization> {
    return this.http.put<Organization>(this.baseUrl, body);
  }
}
