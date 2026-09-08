import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  OrgAdminProfileResponse,
  UpdateOrgAdminProfileBody,
} from '../../../core/models/org-admin-profile.model';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/org-admin/profile`;

  get(): Observable<OrgAdminProfileResponse> {
    return this.http.get<OrgAdminProfileResponse>(this.baseUrl);
  }

  update(body: UpdateOrgAdminProfileBody): Observable<OrgAdminProfileResponse> {
    return this.http.put<OrgAdminProfileResponse>(this.baseUrl, body);
  }
}
