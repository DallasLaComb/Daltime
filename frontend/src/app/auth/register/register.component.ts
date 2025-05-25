import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  firstName = '';
  lastName = '';
  email = '';
  password = '';
  confirmPassword = '';
  company = '';
  role: 'employee' | 'manager' | 'admin' | '' = '';
  managers = '';

  companies = ['Meriden YMCA', 'Southington YMCA', 'Wallingford YMCA'];

  register() {
    if (this.password !== this.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    const userData = {
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      password: this.password,
      company: this.company,
      role: this.role,
      managers:
        this.role === 'employee'
          ? this.managers.split(',').map((m) => m.trim())
          : [],
    };

    console.log('Registering user:', userData);
    // TODO: Replace with actual API logic
  }
}
