import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  WebAdminProfileResponse,
  UpdateWebAdminProfileBody,
} from '../../../core/models/web-admin-profile.model';
import type { ProfileData, UpdateProfileData } from '@common-daltime';
import type { IProfileService } from '../../../core/utils/profile-base';

/**
 * Maps a WebAdminProfileResponse from the backend to the shared ProfileData shape
 * required by ProfileComponentBase and app-profile-page.
 * The web-admin profile has no phone field, so we supply an empty string
 * so the shared component's phone field displays "—" rather than erroring.
 */
function toProfileData(r: WebAdminProfileResponse): ProfileData {
  return {
    email: r.email,
    first_name: r.first_name,
    last_name: r.last_name,
    phone: '',
  };
}

@Injectable({ providedIn: 'root' })
export class WebAdminProfileService implements IProfileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/web-admin/profile`;

  /**
   * Fetches the authenticated web-admin's profile from the backend and
   * maps it to the ProfileData shape expected by ProfileComponentBase.
   */
  get(): Observable<ProfileData> {
    return this.http.get<WebAdminProfileResponse>(this.baseUrl).pipe(map(toProfileData));
  }

  /**
   * Submits updated name fields for the authenticated web-admin and maps
   * the backend response back to ProfileData for the base class to store.
   * The phone field in the request body is omitted since web-admins have no phone.
   */
  update(body: UpdateProfileData): Observable<ProfileData> {
    const requestBody: UpdateWebAdminProfileBody = {
      first_name: body.first_name,
      last_name: body.last_name,
    };
    return this.http
      .put<WebAdminProfileResponse>(this.baseUrl, requestBody)
      .pipe(map(toProfileData));
  }
}
