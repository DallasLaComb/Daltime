import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  ManagerProfileResponse,
  UpdateManagerProfileBody,
} from '../../../core/models/manager-profile.model';

@Injectable({ providedIn: 'root' })
export class ManagerProfileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/manager/profile`;

  get(): Observable<ManagerProfileResponse> {
    return this.http.get<ManagerProfileResponse>(this.baseUrl);
  }

  update(body: UpdateManagerProfileBody): Observable<ManagerProfileResponse> {
    return this.http.put<ManagerProfileResponse>(this.baseUrl, body);
  }
}
