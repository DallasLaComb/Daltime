import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  EmployeeResponse,
  CreateEmployeeBody,
  UpdateEmployeeBody,
} from '../../../core/models/employee.model';

type CreateManagerEmployeeBody = Omit<CreateEmployeeBody, 'manager_id'>;
type UpdateManagerEmployeeBody = Pick<UpdateEmployeeBody, 'first_name' | 'last_name' | 'phone'>;

@Injectable({ providedIn: 'root' })
export class ManagerEmployeesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/manager/employees`;

  getAll(): Observable<EmployeeResponse[]> {
    return this.http.get<EmployeeResponse[]>(this.baseUrl);
  }

  create(body: CreateManagerEmployeeBody): Observable<EmployeeResponse> {
    return this.http.post<EmployeeResponse>(this.baseUrl, body);
  }

  update(employeeId: string, body: UpdateManagerEmployeeBody): Observable<EmployeeResponse> {
    return this.http.put<EmployeeResponse>(`${this.baseUrl}/${employeeId}`, body);
  }

  disable(employeeId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${employeeId}`);
  }

  enable(employeeId: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${employeeId}`, {});
  }
}
