import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  EmployeeProfileResponse,
  UpdateEmployeeProfileBody,
} from '../../../core/models/employee-profile.model';

@Injectable({ providedIn: 'root' })
export class EmployeeProfileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/employee/profile`;

  get(): Observable<EmployeeProfileResponse> {
    return this.http.get<EmployeeProfileResponse>(this.baseUrl);
  }

  update(body: UpdateEmployeeProfileBody): Observable<EmployeeProfileResponse> {
    return this.http.put<EmployeeProfileResponse>(this.baseUrl, body);
  }
}
