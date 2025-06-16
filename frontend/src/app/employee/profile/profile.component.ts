import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../auth/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-employee-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class EmployeeProfileComponent implements OnInit {
  managers: {
    currentManagers: any[];
    availableManagers: any[];
  } | null = null;
  loading: boolean = false;
  error: string | null = null;

  constructor(private http: HttpClient, private authService: AuthService) {}

  ngOnInit(): void {
    this.fetchManagers();
  }

  fetchManagers(): void {
    this.loading = true;
    this.error = null;

    const token = this.authService.getToken();
    console.log('Retrieved Token:', token);

    const authorizationHeader = `Bearer ${token}`;
    console.log('Authorization Header:', authorizationHeader);

    this.http
      .get(`${environment.apiBaseUrl}/employees/managers`, {
        headers: { Authorization: authorizationHeader },
      })
      .subscribe({
        next: (response: any) => {
          console.log('Managers Response:', response);
          this.managers = response.data;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error Fetching Managers:', err);
          this.error = 'Failed to fetch managers. Please try again later.';
          this.loading = false;
        },
      });
  }

  connectToManager(managerId: string): void {
    this.http.post('/employees/connect-to-manager', { managerId }).subscribe({
      next: () => {
        alert('Successfully connected to manager!');
        this.fetchManagers();
      },
      error: () => {
        alert('Failed to connect to manager. Please try again later.');
      },
    });
  }
}
