import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  EmployeeResponse,
  CreateEmployeeBody,
  UpdateEmployeeBody,
} from '../../../core/models/employee.model';

@Injectable({ providedIn: 'root' })
export class EmployeesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/org-admin/employees`;

  getAll(): Observable<EmployeeResponse[]> {
    return this.http.get<EmployeeResponse[]>(this.baseUrl);
  }

  create(body: CreateEmployeeBody): Observable<EmployeeResponse> {
    return this.http.post<EmployeeResponse>(this.baseUrl, body);
  }

  update(employeeId: string, body: UpdateEmployeeBody): Observable<EmployeeResponse> {
    return this.http.put<EmployeeResponse>(`${this.baseUrl}/${employeeId}`, body);
  }

  disable(employeeId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${employeeId}`);
  }

  enable(employeeId: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${employeeId}`, {});
  }
}
