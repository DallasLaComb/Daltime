import { Component } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { JsonPipe, NgIf } from '@angular/common';

@Component({
  selector: 'employee-dashboard',
  template: `
    <div class="p-8">
      <h1 class="text-2xl font-bold mb-4">Employee Dashboard</h1>
      <ng-container *ngIf="authData; else notAuth">
        <pre class="bg-gray-100 p-4 rounded">{{ authData | json }}</pre>
      </ng-container>
      <ng-template #notAuth>
        <div class="text-red-600 font-semibold">
          No auth data found. You may not be logged in.
        </div>
      </ng-template>
    </div>
  `,
  standalone: true,
  imports: [JsonPipe, NgIf],
})
export class EmployeeDashboardComponent {
  authData: any;
  constructor(private auth: AuthService) {
    this.authData = this.auth.getAuthData();
    console.log('EmployeeDashboardComponent loaded, authData:', this.authData);
    if (!this.authData) {
      console.warn('No auth data found in EmployeeDashboardComponent.');
    } else {
      // Log the role for further debugging
      const role = this.authData.user?.role || this.authData.user?.[0]?.role;
      console.log('EmployeeDashboardComponent: user role:', role);
    }
  }
}
