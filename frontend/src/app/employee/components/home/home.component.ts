import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'shift-scheduler-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  authData: any = null;
  role: string = '';
  firstName: string = '';
  lastName: string = '';
  email: string = '';
  company: string = '';

  ngOnInit() {
    const raw = localStorage.getItem('authData');
    if (raw) {
      this.authData = JSON.parse(raw);

      const user = this.authData.user || {};
      this.role = user.role || '';
      this.firstName = user.first_name || '';
      this.lastName = user.last_name || '';
      this.email = user.email || '';
      this.company = user.company || '';
    }
  }
}
