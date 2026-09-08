import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

/** Request body sent to POST /web-admin/generate-dummy-data. */
export interface GenerateDummyDataBody {
  /** Calendar year, 2020–2030. */
  year: number;
  /** 1-indexed month (1 = January, 12 = December). */
  month: number;
}

/** Response shape returned by the Lambda on 200. */
export interface GenerateDummyDataResponse {
  message: string;
}

/**
 * Service responsible for calling the generate-dummy-data Lambda.
 * Scoped to the Web-Admin feature; not shared across roles.
 */
@Injectable({ providedIn: 'root' })
export class GenerateDummyDataService {
  private readonly http = inject(HttpClient);

  /** Base URL for the web-admin generate-dummy-data endpoint. */
  private readonly url = `${environment.api.baseUrl}/web-admin/generate-dummy-data`;

  /**
   * Calls POST /web-admin/generate-dummy-data with the selected year and month.
   * Returns an observable that emits the backend's success message on 200 or
   * errors with an HttpErrorResponse on non-2xx.
   */
  generate(body: GenerateDummyDataBody): Observable<GenerateDummyDataResponse> {
    return this.http.post<GenerateDummyDataResponse>(this.url, body);
  }
}
