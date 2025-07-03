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
  connecting: boolean = false;
  successMessage: string | null = null;

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
          console.log('Available Managers:', response.data?.availableManagers);
          if (response.data?.availableManagers?.length > 0) {
            console.log(
              'First manager structure:',
              response.data.availableManagers[0]
            );
          }
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
    const token = this.authService.getToken();

    if (!token) {
      this.error = 'Authentication required. Please log in again.';
      return;
    }

    console.log('Connecting to manager with ID:', managerId);
    console.log('Request payload:', { managerId });

    this.connecting = true;
    this.error = null;
    this.successMessage = null;

    this.http
      .post(
        `${environment.apiBaseUrl}/employees/managers/connect`,
        { managerId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )
      .subscribe({
        next: (response: any) => {
          console.log('Connect response:', response);
          this.connecting = false;
          this.error = null;
          this.successMessage = 'Successfully connected to manager!';
          this.fetchManagers(); // Refresh the managers list
          // Clear success message after 3 seconds
          setTimeout(() => {
            this.successMessage = null;
          }, 3000);
        },
        error: (err) => {
          console.error('Error connecting to manager:', err);
          console.error('Error details:', err.error);
          this.connecting = false;
          this.error = 'Failed to connect to manager. Please try again.';
        },
      });
  }
}
