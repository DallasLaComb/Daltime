import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import type { WebAdminEmployeeResponse } from '../core/models/web-admin-employee.model';

@Injectable({ providedIn: 'root' })
export class WebAdminEmployeesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/web-admin/employees`;

  getAll(): Observable<WebAdminEmployeeResponse[]> {
    return this.http.get<WebAdminEmployeeResponse[]>(this.baseUrl);
  }
}
