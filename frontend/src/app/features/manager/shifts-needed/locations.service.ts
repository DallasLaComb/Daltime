import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ManagerLocation } from '../../../core/models/manager-location.model';

@Injectable({ providedIn: 'root' })
export class ManagerLocationsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/manager/locations`;

  list(): Observable<ManagerLocation[]> {
    return this.http.get<ManagerLocation[]>(this.baseUrl);
  }
}
