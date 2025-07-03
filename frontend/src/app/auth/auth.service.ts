import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

interface LoginResponse {
  token: string;
  refresh_token: string;
  expires_in: number;
  user: any;
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at: number;
  };
  data: {
    user: {
      role: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = environment.apiBaseUrl + '/auth';

  constructor(private http: HttpClient) {}

  // 🔹 Register a new user
  // Accepts a full payload for registration
  register(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, payload);
  }

  // 🔹 Login user and get JWT
  login(email: string, password: string): Observable<LoginResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<LoginResponse>(
      `${this.apiUrl}/login`,
      { email, password },
      { headers }
    );
  }

  // 🔹 Save full auth data to localStorage
  saveAuthData(auth: any): void {
    console.log('Saving auth data:', auth);
    localStorage.setItem('authData', JSON.stringify(auth));
  }

  // 🔹 Get full auth data from localStorage
  getAuthData(): LoginResponse | null {
    const raw = localStorage.getItem('authData');
    console.log('Raw authData from localStorage:', raw);
    return raw ? JSON.parse(raw) : null;
  }

  // 🔹 Get token from stored auth data
  getToken(): string | null {
    const raw = localStorage.getItem('authData');
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      const token = parsed?.data?.session?.access_token;
      const expiresAt = parsed?.data?.session?.expires_at;

      if (!token) {
        console.error('Token is missing');
        return null;
      }

      if (expiresAt && Date.now() / 1000 > expiresAt) {
        console.error('Token has expired');
        return null;
      }

      return token;
    } catch (error) {
      console.error('Error parsing authData:', error);
      return null;
    }
  }

  // 🔹 Logout (clear all auth data)
  logout(): void {
    localStorage.removeItem('authData');
  }

  // 🔹 Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}
