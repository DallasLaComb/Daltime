import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-employee-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class EmployeeProfileComponent implements OnInit {
  managers: any[] = [];
  loading: boolean = false;
  error: string | null = null;

  constructor(private http: HttpClient, private authService: AuthService) {}

  ngOnInit(): void {
    this.fetchManagers();
  }

  fetchManagers(): void {
    this.loading = true;
    this.error = null;

    console.log('Using token:', this.authService.getToken());

    this.http
      .get('/employees/get-managers', {
        headers: { Authorization: `Bearer ${this.authService.getToken()}` },
      })
      .subscribe({
        next: (response: any) => {
          this.managers = response.availableManagers;
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Failed to fetch managers. Please try again later.';
          this.loading = false;
        },
      });
  }

  connectToManager(managerId: string): void {
    this.http
      .post('/employees/connect-to-manager', { managerId })
      .subscribe({
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
