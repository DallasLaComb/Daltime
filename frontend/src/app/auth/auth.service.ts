import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

interface LoginResponse {
  token: string;
  refresh_token: string;
  expires_in: number;
  user: any;
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
    localStorage.setItem('authData', JSON.stringify(auth));
  }

  // 🔹 Get full auth data from localStorage
  getAuthData(): LoginResponse | null {
    const raw = localStorage.getItem('authData');
    return raw ? JSON.parse(raw) : null;
  }

  // 🔹 Get token from stored auth data
  getToken(): string | null {
    const data = this.getAuthData();
    return data?.token || null;
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
