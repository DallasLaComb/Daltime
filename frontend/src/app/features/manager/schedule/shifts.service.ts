import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { Shift, CreateShiftBody, UpdateShiftBody } from '../../../core/models/shift.model';

@Injectable({ providedIn: 'root' })
export class ManagerShiftsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/manager/shifts`;

  list(month: string): Observable<Shift[]> {
    return this.http.get<Shift[]>(this.baseUrl, { params: { month } });
  }

  create(body: CreateShiftBody): Observable<Shift> {
    return this.http.post<Shift>(this.baseUrl, body);
  }

  update(shiftId: string, body: UpdateShiftBody): Observable<Shift> {
    return this.http.put<Shift>(`${this.baseUrl}/${shiftId}`, body);
  }

  remove(shiftId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${shiftId}`);
  }
}
