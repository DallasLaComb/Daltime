import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  CreateShiftBody,
  ShiftNeeded,
  UpdateShiftBody,
} from '../../../core/models/manager-shift-needed.model';

@Injectable({ providedIn: 'root' })
export class ManagerShiftsNeededService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/manager/shifts-needed`;

  list(month: string): Observable<ShiftNeeded[]> {
    return this.http.get<ShiftNeeded[]>(this.baseUrl, { params: { month } });
  }

  create(body: CreateShiftBody): Observable<ShiftNeeded> {
    return this.http.post<ShiftNeeded>(this.baseUrl, body);
  }

  update(shiftId: string, body: UpdateShiftBody): Observable<ShiftNeeded> {
    return this.http.put<ShiftNeeded>(`${this.baseUrl}/${shiftId}`, body);
  }

  remove(shiftId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${shiftId}`);
  }
}
