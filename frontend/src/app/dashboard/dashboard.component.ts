import { Component, inject, OnInit } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <h1>Welcome to your dashboard</h1>
      <pre>{{ userData | json }}</pre>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private auth = inject(AuthService);
  userData: any;

  ngOnInit() {
    const authData = this.auth.getAuthData();
    this.userData = authData?.user;
  }
}
