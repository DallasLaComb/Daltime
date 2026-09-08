import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { Shift } from '../../../core/models/shift.model';

@Injectable({ providedIn: 'root' })
export class OrgAdminShiftsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/org-admin/shifts`;

  list(month: string): Observable<Shift[]> {
    return this.http.get<Shift[]>(this.baseUrl, { params: { month } });
  }
}
