import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, type Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ImpersonateContext } from '../../../core/services/impersonation.service';

export interface ImpersonateUserSummary {
  user_id: string;
  display_name: string;
  email: string;
  status: string;
  org_id: string;
}

/** Raw shape returned by the backend (snake_case). */
interface BackendContext {
  user_id: string;
  role: ImpersonateContext['role'];
  display_name: string;
  email: string;
  org_id: string;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class ImpersonateService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/web-admin/impersonate`;

  listUsers(orgId: string, role: string): Observable<ImpersonateUserSummary[]> {
    return this.http.get<ImpersonateUserSummary[]>(`${this.baseUrl}/users`, {
      params: { orgId, role },
    });
  }

  /** Fetch user context and map backend snake_case fields to camelCase. */
  getContext(userId: string): Observable<ImpersonateContext> {
    return this.http.get<BackendContext>(`${this.baseUrl}/${userId}/context`).pipe(
      map((ctx) => ({
        userId: ctx.user_id,
        role: ctx.role,
        displayName: ctx.display_name,
        email: ctx.email,
        orgId: ctx.org_id,
      })),
    );
  }
}
