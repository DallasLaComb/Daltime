import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface GenerateResult {
  created: number;
  unfilled: number;
  draftCount: number;
  maxDrafts: number;
}

export interface PublishResult {
  published: number;
}

export interface ScheduleMeta {
  draftCount: number;
  maxDrafts: number;
}

@Injectable({ providedIn: 'root' })
export class ManagerScheduleService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/manager/schedule`;

  getMeta(month: string): Observable<ScheduleMeta> {
    return this.http.get<ScheduleMeta>(`${this.baseUrl}/meta`, { params: { month } });
  }

  generateDraft(month: string): Observable<GenerateResult> {
    return this.http.post<GenerateResult>(`${this.baseUrl}/generate`, null, {
      params: { month },
    });
  }

  publish(month: string): Observable<PublishResult> {
    return this.http.post<PublishResult>(`${this.baseUrl}/publish`, null, {
      params: { month },
    });
  }
}
