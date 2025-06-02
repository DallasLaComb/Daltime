import { Component } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'employee-dashboard',
  template: `
    <div class="p-8">
      <h1 class="text-2xl font-bold mb-4">Employee Dashboard</h1>
      <pre class="bg-gray-100 p-4 rounded">{{ authData | json }}</pre>
    </div>
  `,
  standalone: true,
  imports: [JsonPipe],
})
export class EmployeeDashboardComponent {
  authData: any;
  constructor(private auth: AuthService) {
    this.authData = this.auth.getAuthData();
  }
}
