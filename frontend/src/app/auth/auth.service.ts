import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

interface LoginResponse {
  token: string;
  refresh_token: string;
  expires_in: number;
  user: any;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = 'http://localhost:3000/auth'; // adjust if deploying

  constructor(private http: HttpClient) {}

  // 🔹 Register a new user
  register(email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, { email, password });
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

  // 🔹 Save token to localStorage
  saveToken(token: string): void {
    localStorage.setItem('authToken', token);
  }

  // 🔹 Get stored token
  getToken(): string | null {
    return localStorage.getItem('authToken');
  }

  // 🔹 Logout (clear token)
  logout(): void {
    localStorage.removeItem('authToken');
  }

  // 🔹 Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}
